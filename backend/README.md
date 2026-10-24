# SmartDesk · Backend

API NestJS y frontend accesible de SmartDesk. La documentación completa (arquitectura, instalación, Docker Compose, n8n y limitaciones) está en el [README principal](../README.md).

## Comandos

| Comando | Descripción |
|---|---|
| `npm ci` | Instala las dependencias y genera el cliente Prisma (`postinstall`). |
| `npm run prisma:generate` | Regenera el cliente Prisma en `generated/prisma/`. |
| `npm run db:migrate` | Aplica las migraciones existentes (`prisma migrate deploy`). No borra datos. |
| `npm run db:migrate:status` | Muestra las migraciones aplicadas y pendientes. |
| `npm run start:dev` | Desarrollo con recarga automática. |
| `npm run build` | Compila a `dist/` (el punto de entrada es `dist/src/main.js`). |
| `npm run start:prod` | Ejecuta la versión compilada. |
| `npm test` | Pruebas unitarias. |
| `npm run test:e2e` | Pruebas e2e con PostgreSQL y n8n simulados. |
| `npm run test:cov` | Cobertura de las pruebas unitarias. |
| `npm run lint:check` | ESLint sin modificar archivos. |
| `npm run lint` | ESLint con `--fix` (**modifica archivos**). |
| `npm run format` | Prettier sobre `src/` y `test/` (**modifica archivos**). |

## Variables de entorno

Copia `.env.example` como `.env`. Variables: `DATABASE_URL`, `N8N_WEBHOOK_URL` y `PORT` (opcional). La descripción de cada una está en el README principal.

## Endpoints

| Método y ruta | Respuesta |
|---|---|
| `GET /` | Frontend (`public/index.html`). |
| `GET /health` | `200` si PostgreSQL responde y `N8N_WEBHOOK_URL` está configurada; `503` en caso contrario. |
| `POST /support` | `201` con el análisis de n8n; `400` si los datos no son válidos; `503` si n8n falla o no está configurado. |
