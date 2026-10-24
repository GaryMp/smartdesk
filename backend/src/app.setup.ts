import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

/**
 * Configuración compartida por main.ts y las pruebas e2e, para que ambas
 * ejerciten exactamente la misma validación y el mismo contenido estático.
 */
export function configureApp(app: NestExpressApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Los scripts npm se ejecutan desde backend/, donde reside public/.
  app.useStaticAssets(join(process.cwd(), 'public'));
}
