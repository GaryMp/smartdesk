import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    config = {
      get: jest.fn().mockReturnValue('http://n8n.test/webhook/support-request'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    controller = module.get(HealthController);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('informa ok cuando la base de datos responde y el webhook está configurado', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      service: 'smartdesk',
      checks: { database: 'up', n8nWebhook: 'configured' },
    });
  });

  it('responde 503 cuando la base de datos no responde', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const error = await controller.check().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      status: 'error',
      checks: { database: 'down' },
    });
  });

  it('responde 503 cuando falta N8N_WEBHOOK_URL', async () => {
    config.get.mockReturnValue(undefined);

    const error = await controller.check().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      status: 'error',
      checks: { n8nWebhook: 'missing' },
    });
  });
});
