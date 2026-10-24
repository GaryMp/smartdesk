import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

/** Tiempo máximo de espera de la respuesta de n8n (incluye la llamada a Gemini). */
export const N8N_REQUEST_TIMEOUT_MS = 30_000;

@Module({
  imports: [HttpModule.register({ timeout: N8N_REQUEST_TIMEOUT_MS })],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
