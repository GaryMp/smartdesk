import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthReport {
  status: 'ok' | 'error';
  service: 'smartdesk';
  checks: {
    database: 'up' | 'down';
    n8nWebhook: 'configured' | 'missing';
  };
}

/**
 * Comprueba los requisitos esenciales del servicio: conexión con PostgreSQL
 * y configuración del webhook de n8n. No invoca el webhook, porque hacerlo
 * ejecutaría el workflow y consumiría la API de Gemini.
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async check(): Promise<HealthReport> {
    const database = await this.prismaService.$queryRaw`SELECT 1`.then(
      () => 'up' as const,
      () => {
        this.logger.warn('La base de datos no responde.');
        return 'down' as const;
      },
    );

    const n8nWebhook = this.configService.get<string>('N8N_WEBHOOK_URL')
      ? ('configured' as const)
      : ('missing' as const);

    const healthy = database === 'up' && n8nWebhook === 'configured';
    const report: HealthReport = {
      status: healthy ? 'ok' : 'error',
      service: 'smartdesk',
      checks: { database, n8nWebhook },
    };

    if (!healthy) {
      throw new ServiceUnavailableException(report);
    }

    return report;
  }
}
