import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportDto } from './dto/create-support.dto';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async createSupport(createSupportDto: CreateSupportDto): Promise<unknown> {
    const supportRequest = await this.prismaService.supportRequest.create({
      data: {
        subject: createSupportDto.subject,
        description: createSupportDto.description,
        status: 'PENDING',
      },
    });

    const webhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL');

    if (!webhookUrl) {
      throw new ServiceUnavailableException(
        'La URL del webhook de n8n no está configurada',
      );
    }

    let response: AxiosResponse<unknown>;

    try {
      response = await firstValueFrom(
        this.httpService.post<unknown>(webhookUrl, createSupportDto),
      );
    } catch (error: unknown) {
      const axiosError = error as {
        name?: string;
        code?: string;
        response?: {
          status?: number;
        };
      };

      this.logger.error(
        `Falló el envío a n8n para la solicitud ${supportRequest.id}. ` +
          `Tipo: ${axiosError.name ?? 'desconocido'}. ` +
          `Código: ${axiosError.code ?? 'sin código'}. ` +
          `HTTP remoto: ${axiosError.response?.status ?? 'sin respuesta HTTP'}.`,
      );

      this.logger.warn(`La solicitud ${supportRequest.id} permanece PENDING.`);

      throw new ServiceUnavailableException(
        'Error al enviar la solicitud de soporte a n8n',
      );
    }

    try {
      await this.prismaService.supportRequest.update({
        where: { id: supportRequest.id },
        data: { status: 'SENT' },
      });
    } catch {
      this.logger.error(
        `n8n respondió correctamente, pero no se pudo actualizar el estado de la solicitud ${supportRequest.id}.`,
      );
    }

    return response.data;
  }
}
