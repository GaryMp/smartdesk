import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

// Valores ficticios: tienen prioridad sobre backend/.env, así que la prueba
// nunca usa la base de datos ni el n8n reales.
const WEBHOOK_URL = 'http://n8n.test/webhook/support-request';
process.env.N8N_WEBHOOK_URL = WEBHOOK_URL;
process.env.DATABASE_URL = 'postgresql://test:test@db.test:5432/test';

const validRequest = {
  subject: 'Error al exportar informes',
  description: 'Al pulsar Exportar aparece un error 500.',
};

const n8nResponse = {
  mensaje: 'Solicitud recibida por SmartDesk',
  datosRecibidos: validRequest,
  analisisIA: {
    category: 'technical_error',
    priority: 'medium',
    summary: 'Error 500 al exportar informes.',
  },
};

describe('SmartDesk (e2e)', () => {
  let app: NestExpressApplication;
  let http: { post: jest.Mock };
  let prisma: {
    $queryRaw: jest.Mock;
    supportRequest: { create: jest.Mock; update: jest.Mock };
  };

  beforeAll(async () => {
    http = { post: jest.fn() };
    prisma = {
      $queryRaw: jest.fn(),
      supportRequest: { create: jest.fn(), update: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(HttpService)
      .useValue(http)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    prisma.supportRequest.create.mockResolvedValue({ id: 7 });
    prisma.supportRequest.update.mockResolvedValue({ id: 7, status: 'SENT' });
  });

  const server = (): App => app.getHttpServer();

  describe('GET /', () => {
    it('sirve el frontend accesible', async () => {
      const response = await request(server())
        .get('/')
        .expect(200)
        .expect('Content-Type', /html/);

      expect(response.text).toContain('<html lang="es">');
      expect(response.text).toContain('id="support-form"');
    });
  });

  describe('GET /health', () => {
    it('responde 200 cuando la base de datos y el webhook están disponibles', async () => {
      await request(server())
        .get('/health')
        .expect(200)
        .expect({
          status: 'ok',
          service: 'smartdesk',
          checks: { database: 'up', n8nWebhook: 'configured' },
        });
    });

    it('responde 503 cuando la base de datos no responde', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      const response = await request(server()).get('/health').expect(503);

      expect(response.body).toMatchObject({
        status: 'error',
        checks: { database: 'down' },
      });
    });
  });

  describe('POST /support', () => {
    it('registra la solicitud, la envía a n8n y devuelve el análisis', async () => {
      http.post.mockReturnValue(of({ data: n8nResponse }));

      await request(server())
        .post('/support')
        .send(validRequest)
        .expect(201)
        .expect(n8nResponse);

      expect(http.post).toHaveBeenCalledWith(WEBHOOK_URL, validRequest);
      expect(prisma.supportRequest.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { status: 'SENT' },
      });
    });

    it.each([
      ['campos ausentes', {}],
      ['campos vacíos', { subject: '', description: '' }],
      ['asunto demasiado largo', { ...validRequest, subject: 'a'.repeat(121) }],
      [
        'descripción demasiado larga',
        { ...validRequest, description: 'b'.repeat(2001) },
      ],
      ['campos no permitidos', { ...validRequest, priority: 'high' }],
    ])('responde 400 con %s y no registra nada', async (_case, body) => {
      await request(server()).post('/support').send(body).expect(400);

      expect(prisma.supportRequest.create).not.toHaveBeenCalled();
      expect(http.post).not.toHaveBeenCalled();
    });

    it('responde 503 con un mensaje para el frontend cuando n8n falla', async () => {
      http.post.mockReturnValue(
        throwError(() =>
          Object.assign(new Error('fail'), { code: 'ECONNREFUSED' }),
        ),
      );

      const response = await request(server())
        .post('/support')
        .send(validRequest)
        .expect(503);

      expect((response.body as { message: string }).message).toBe(
        'Error al enviar la solicitud de soporte a n8n',
      );
      expect(prisma.supportRequest.update).not.toHaveBeenCalled();
    });
  });
});
