import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { SupportService } from './support.service';

const WEBHOOK_URL = 'http://n8n.test/webhook/support-request';

const dto = {
  subject: 'No puedo iniciar sesión',
  description: 'El sistema rechaza mi contraseña desde esta mañana.',
};

const analysis = {
  mensaje: 'Solicitud recibida por SmartDesk',
  datosRecibidos: dto,
  analisisIA: { category: 'access', priority: 'high', summary: 'Acceso.' },
};

describe('SupportService', () => {
  let service: SupportService;
  let errorSpy: jest.SpyInstance;
  let http: { post: jest.Mock };
  let config: { get: jest.Mock };
  let prisma: {
    supportRequest: { create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    http = { post: jest.fn() };
    config = { get: jest.fn().mockReturnValue(WEBHOOK_URL) };
    prisma = {
      supportRequest: {
        create: jest.fn().mockResolvedValue({ id: 42, status: 'PENDING' }),
        update: jest.fn().mockResolvedValue({ id: 42, status: 'SENT' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: HttpService, useValue: http },
        { provide: ConfigService, useValue: config },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SupportService);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('registra la solicitud como PENDING, la envía a n8n y la marca como SENT', async () => {
    http.post.mockReturnValue(of({ data: analysis }));

    await expect(service.createSupport(dto)).resolves.toEqual(analysis);

    expect(prisma.supportRequest.create).toHaveBeenCalledWith({
      data: { ...dto, status: 'PENDING' },
    });
    expect(http.post).toHaveBeenCalledWith(WEBHOOK_URL, dto);
    expect(prisma.supportRequest.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { status: 'SENT' },
    });
  });

  it('responde 503 sin llamar a n8n cuando falta N8N_WEBHOOK_URL', async () => {
    config.get.mockReturnValue(undefined);

    await expect(service.createSupport(dto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(http.post).not.toHaveBeenCalled();
    expect(prisma.supportRequest.update).not.toHaveBeenCalled();
  });

  it('responde 503 y deja la solicitud PENDING cuando n8n falla', async () => {
    http.post.mockReturnValue(
      throwError(() =>
        Object.assign(new Error('Request failed'), {
          name: 'AxiosError',
          code: 'ERR_BAD_RESPONSE',
          response: { status: 500 },
        }),
      ),
    );

    await expect(service.createSupport(dto)).rejects.toThrow(
      'Error al enviar la solicitud de soporte a n8n',
    );

    expect(prisma.supportRequest.update).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('HTTP remoto: 500'),
    );
  });

  it('no registra el contenido de la solicitud en los logs de error', async () => {
    http.post.mockReturnValue(throwError(() => new Error('timeout')));

    await expect(service.createSupport(dto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    const logged = errorSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain(dto.subject);
    expect(logged).not.toContain(dto.description);
  });

  it('devuelve el análisis aunque no pueda actualizar el estado a SENT', async () => {
    http.post.mockReturnValue(of({ data: analysis }));
    prisma.supportRequest.update.mockRejectedValue(new Error('db down'));

    await expect(service.createSupport(dto)).resolves.toEqual(analysis);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no se pudo actualizar el estado'),
    );
  });

  it('propaga el error si no puede registrar la solicitud y no llama a n8n', async () => {
    prisma.supportRequest.create.mockRejectedValue(new Error('db down'));

    await expect(service.createSupport(dto)).rejects.toThrow('db down');
    expect(http.post).not.toHaveBeenCalled();
  });
});
