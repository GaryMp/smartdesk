# Workflow de n8n · SmartDesk

n8n se encarga de la automatización y del procesamiento con IA de las solicitudes de soporte. El backend NestJS registra la solicitud en PostgreSQL y la reenvía a un webhook de n8n. El workflow la clasifica con Google Gemini y devuelve el análisis al backend, que lo entrega al frontend.

## Contenido de este directorio

| Archivo | Descripción |
|---|---|
| `smartdesk-workflow.json` | Workflow saneado, listo para importar. |
| `crear-credencial-gemini.ps1` | Script auxiliar (Windows/PowerShell) para crear la credencial de Gemini en un n8n ejecutado con `npx`. |
| `README.md` | Este documento. |

> **Procedencia:** `smartdesk-workflow.json` se generó a partir de una exportación del workflow que estaba activo en la instancia de desarrollo del autor el 23/10/2026. Se eliminaron los metadatos de la instancia, del proyecto y de la propiedad, así como el identificador interno de la credencial. Después se renombraron el workflow, la credencial y el mensaje de confirmación para usar el nombre genérico *SmartDesk*. **No se ha vuelto a comparar con esa instancia después de exportarlo.** Las exportaciones históricas usadas durante el desarrollo se archivaron fuera del repositorio porque contenían metadatos personales.

---

## Workflow

**Nombre al importar:** "SmartDesk - Recepción con Gemini (borrador)". Puedes renombrarlo en tu instancia; el nombre no afecta al funcionamiento.

```
Recibir solicitud de soporte ──► Preparar respuesta ──► Analizar solicitud con Gemini ──► Normalizar resultado Gemini
        (Webhook)                     (Set)                (Basic LLM Chain)                     (Code)
                                                                   ▲
                                                                   │ ai_languageModel
                                                       Modelo Gemini SmartDesk
                                                     (Google Gemini Chat Model)
```

| Nodo | Tipo | Función |
|---|---|---|
| Recibir solicitud de soporte | `n8n-nodes-base.webhook` | `POST` en la ruta `support-request`. Responde con la salida del último nodo. |
| Preparar respuesta | `n8n-nodes-base.set` | Guarda un mensaje de confirmación y el cuerpo recibido (`datosRecibidos`). |
| Analizar solicitud con Gemini | `@n8n/n8n-nodes-langchain.chainLlm` | Pide al modelo solo un JSON con `category`, `priority` y `summary`. |
| Modelo Gemini SmartDesk | `@n8n/n8n-nodes-langchain.lmChatGoogleGemini` | `models/gemini-3.1-flash-lite`, temperatura 0.2. Usa la credencial `Gemini - SmartDesk` (tipo `googlePalmApi`). |
| Normalizar resultado Gemini | `n8n-nodes-base.code` | Interpreta el JSON del modelo (acepta bloques ```` ```json ````), limita los valores a los permitidos y aplica `other` / `low` con `parseOk: false` si la respuesta no es JSON válido. |

### Respuesta

```json
{
  "mensaje": "Solicitud recibida por SmartDesk",
  "datosRecibidos": { "subject": "…", "description": "…" },
  "analisisIA": {
    "category": "access | technical_error | query | other",
    "priority": "low | medium | high",
    "summary": "Resumen breve en español"
  }
}
```

### Manejo de errores

- **Gemini responde con texto no interpretable:** el nodo Code aplica valores por defecto y el workflow responde con normalidad (verificado).
- **Gemini devuelve un error** (clave inválida, cuota agotada, servicio caído): el workflow falla y n8n responde `500 {"message":"Error in workflow"}`. El backend lo traduce a `503` y deja la solicitud en `PENDING` (verificado con una clave ficticia).

---

## Relación con el backend

- El backend envía `{ subject, description }` por `POST` a `N8N_WEBHOOK_URL`, definida en `backend/.env`.
- Con la configuración por defecto, esa URL es `http://localhost:5678/webhook/support-request`.
- La ruta del nodo Webhook (`support-request`) debe coincidir con el final de `N8N_WEBHOOK_URL`.
- La URL de producción (`/webhook/...`) solo responde cuando el workflow está **publicado o activo**.
- En una instancia no pueden estar activos a la vez dos workflows con el mismo método y ruta. Si ya tienes otro workflow en `POST /support-request`, desactívalo o cambia la ruta en uno de ellos (y en `N8N_WEBHOOK_URL`).

---

## Configuración

### 1. Credencial de Gemini

**Las credenciales se configuran en cada instancia de n8n y no se distribuyen con el repositorio.**

> Los pasos de la interfaz describen el procedimiento estándar de n8n. En la verificación se probaron los comandos de CLI, no los menús de la interfaz, cuyos textos pueden variar ligeramente entre versiones.

- **Desde la interfaz (válido para Docker y para `npx`):**
  1. Ve a *Credentials* → *Add credential* → **Google Gemini (PaLM) API**.
  2. Introduce tu API key. Deja el *host* por defecto (`https://generativelanguage.googleapis.com`).
  3. Llámala exactamente `Gemini - SmartDesk`.
- **Con el script (solo para n8n ejecutado con `npx` en Windows):** `.\crear-credencial-gemini.ps1` pide la API key como entrada oculta, la importa con `npx n8n@2.44.5 import:credentials` y borra el archivo temporal. Actúa sobre la instancia local del usuario que lo ejecuta (`~/.n8n`).

### 2. Importar el workflow

**Desde la interfaz:** en n8n, *Create workflow* → menú `…` → *Import from file…* → `smartdesk-workflow.json`. Después guárdalo.

**Por CLI con n8n ejecutado con `npx` (verificado con n8n 2.44.5):**

```bash
npx n8n@2.44.5 import:workflow --input=n8n/smartdesk-workflow.json
npx n8n@2.44.5 list:workflow                     # obtén el ID asignado
npx n8n@2.44.5 publish:workflow --id=<ID>        # luego reinicia n8n
```

> La CLI escribe en la base de datos de la instancia local (`~/.n8n`, o la carpeta indicada en `N8N_USER_FOLDER`). Haz una copia de seguridad antes de importar en una instancia con datos.

**Por CLI con Docker Compose (verificado con Docker 29.9.2 y Compose v5.6.1):**

```bash
docker compose cp n8n/smartdesk-workflow.json n8n:/tmp/smartdesk-workflow.json
docker compose exec n8n n8n import:workflow --input=/tmp/smartdesk-workflow.json
docker compose exec n8n n8n list:workflow                 # obtén el ID asignado
docker compose exec n8n n8n publish:workflow --id=<ID>
docker compose restart n8n                                # aplica la publicación
```

> En **Git Bash** (Windows), antepón `MSYS_NO_PATHCONV=1` a los comandos `exec` para que `/tmp/...` no se convierta en una ruta de Windows. En PowerShell no hace falta.

### 3. Comprobaciones después de importar

1. Abre el nodo **Modelo Gemini SmartDesk** y confirma que tiene asignada tu credencial. Si creaste la credencial con el nombre exacto **antes** de importar, n8n la asigna automáticamente (verificado). Si no, selecciónala a mano.
2. Revisa que la ruta del nodo Webhook sea `support-request`.
3. Publica o activa el workflow. Por CLI, el workflow siempre se importa **desactivado**.
4. Prueba el flujo completo desde el formulario o con:

```bash
curl -X POST http://localhost:5678/webhook/support-request \
  -H "Content-Type: application/json" \
  -d '{"subject":"Prueba","description":"No puedo iniciar sesión"}'
```

---

## Detalles de la exportación saneada

Se conserva lo necesario para importar y ejecutar el workflow:

- Nombre, nodos (parámetros, tipo, versión, posición e `id` de nodo), conexiones y `settings`.
- `active: false`.
- Del nodo del modelo, solo el **tipo y nombre** de la credencial.
- El `webhookId` del nodo Webhook. Es un UUID aleatorio del nodo que no identifica ninguna cuenta. Se mantiene porque la importación por CLI no lo regenera si falta (verificado).

Se eliminó:

- El ID del workflow, las versiones (`versionId`, `activeVersionId`, `versionCounter`), las fechas, `triggerCount` y `versionMetadata`.
- `shared`: proyecto, propietario y un correo personal.
- El `id` interno de la credencial.

## Verificación realizada

En una instancia **aislada** de n8n 2.44.5, con carpeta de datos y puertos propios, separada de cualquier instancia en uso:

| Prueba | Resultado |
|---|---|
| `import:workflow` del archivo saneado | ✅ Importado y desactivado |
| Asignación de la credencial por nombre | ✅ Vinculada a la credencial existente con el mismo nombre y tipo |
| `publish:workflow` y registro del webhook de producción | ✅ |
| Llamada al webhook con una clave ficticia | ✅ Se ejecutan Webhook → Set → LLM Chain → modelo. Google rechaza la clave y n8n responde 500 |
| Backend → webhook → simulador local de la API de Gemini | ✅ 201 con el análisis normalizado. Respuesta no JSON → `other`/`low`/`parseOk: false` |
| Docker Compose: importación, publicación y ejecución dentro del contenedor `n8nio/n8n:2.44.5` | ✅ La credencial se vincula por nombre, el webhook se registra tras `restart` y la llamada sale hacia la API de Gemini. El workflow y la credencial (todavía descifrable) se conservan tras `down`/`up` y `--force-recreate` |
| Gemini real con una API key válida | ✅ Verificado manualmente por el autor desde el formulario (23/10/2026), en su instancia de desarrollo |
