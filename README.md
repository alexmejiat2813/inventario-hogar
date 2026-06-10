# Inventario Hogar

Gestión de inventario doméstico con alertas de stock, historial de compras y PWA offline.

**Producción:** https://inventario-hogar-alex.fly.dev

## Stack

- **Backend:** Node.js + Express 4 + SQLite (`node:sqlite` built-in)
- **Auth:** Google OAuth 2.0 + express-session
- **Frontend:** Vanilla JS, sin framework — i18n ES/EN/FR
- **PWA:** Service Worker + push notifications (web-push)
- **Deploy:** Fly.io — CI/CD automático via GitHub Actions

## Desarrollo local

### Requisitos

- Node.js 22+
- Cuenta Google Cloud (para OAuth)

### Setup

```bash
git clone https://github.com/alexmejiat2813/inventario-hogar.git
cd inventario-hogar
npm install
cp .env.example .env
```

Editar `.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
CALLBACK_URL=http://localhost:3000/auth/google/callback
SESSION_SECRET=any-long-random-string
```

Iniciar:

```bash
npm run dev        # servidor con hot-reload + pino-pretty logs
npm test           # 53 tests
npm run coverage   # reporte de cobertura
```

### Google OAuth (desarrollo)

1. Google Cloud Console → APIs & Services → Credentials
2. Crear OAuth 2.0 Client ID (tipo: Web application)
3. Authorized redirect URI: `http://localhost:3000/auth/google/callback`
4. Copiar Client ID y Secret a `.env`

## Push Notifications

### Generar claves VAPID

```bash
node -e "const wp = require('web-push'); const k = wp.generateVAPIDKeys(); console.log('VAPID_PUBLIC_KEY=' + k.publicKey); console.log('VAPID_PRIVATE_KEY=' + k.privateKey);"
```

Agregar a `.env`:

```env
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

Sin VAPID keys: push notifications se desactivan gracefully (UI muestra 503).

## Deploy a Fly.io

### Primer deploy

```bash
fly auth login
fly launch          # detecta Dockerfile, crea app
fly volumes create ih_data --region yyz --size 1
```

### Secrets

```bash
fly secrets set GOOGLE_CLIENT_ID=...
fly secrets set GOOGLE_CLIENT_SECRET=...
fly secrets set SESSION_SECRET=...
fly secrets set CALLBACK_URL=https://tu-app.fly.dev/auth/google/callback

# Opcional — push notifications
fly secrets set VAPID_PUBLIC_KEY=...
fly secrets set VAPID_PRIVATE_KEY=...

# Opcional — super admin
fly secrets set ADMIN_EMAILS=tu-email@gmail.com
```

### CI/CD

Push a `master` → GitHub Action (`flyctl deploy`) → producción automática.

Secret requerido en GitHub: `FLY_API_TOKEN`

```bash
fly tokens create deploy -x 999999h
# Agregar como secret FLY_API_TOKEN en GitHub repo settings
```

### Cron de alertas

`fly.toml` incluye cron cada hora que llama `POST /api/notifications/send-alerts`.
Requiere VAPID keys configuradas.

### Comandos útiles

```bash
fly status                    # estado de la app
fly logs                      # logs en tiempo real
fly ssh console               # shell en el container
fly secrets list              # ver secrets (sin valores)
fly deploy                    # deploy manual
```

## Estructura

```
server.js          # Entry point — monta middleware y routers
database.js        # Capa de datos — schema + migrations + todos los métodos
logger.js          # Structured logging con pino
routes/            # Un archivo por dominio
middleware/        # auth, inventory, rate-limit, security-headers, session-store
public/
  js/              # Vanilla JS por página
  css/             # Estilos por página
  locales/         # i18n ES/EN/FR
  sw.js            # Service Worker con versioning dinámico
test/
  database.test.js # Tests unitarios DB (25)
  server.test.js   # Tests smoke HTTP (28)
openapi.json       # API spec OpenAPI 3.0
```

## Tests

```bash
npm test           # todos los tests
npm run coverage   # con reporte de cobertura (c8)
```

Cobertura actual: ~60% statements, ~70% branches.

## Seguridad

- Google OAuth — sin passwords locales
- CSP headers, HSTS, X-Frame-Options
- Rate limiting: 20 req/15min (auth), 200 req/min (API)
- Uploads privados: solo miembros del inventario
- SQL injection: queries parametrizadas (prepared statements)
- Session cookies: httpOnly, secure (prod), sameSite: lax
- SESSION_SECRET obligatorio en producción

## Licencia

MIT
