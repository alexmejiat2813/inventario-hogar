# Guía de Desarrollo y Despliegue a Producción

**Proyecto:** Inventario Hogar
**Producción:** https://inventario-hogar-alex.fly.dev
**Repositorio:** https://github.com/alexmejiat2813/inventario-hogar
**Host:** Fly.io (región `yyz` — Toronto)

---

## 1. Arquitectura general

| Capa | Tecnología |
|------|------------|
| Backend | Node.js + Express 4 |
| Base de datos | SQLite (`node:sqlite`, built-in de Node 22.5+) |
| Auth | Google OAuth 2.0 (Passport) + sesiones en SQLite |
| Frontend | Vanilla JS (sin framework) |
| Contenedor | Docker (`node:24-slim`) |
| Hosting | Fly.io con volumen persistente |
| CI/CD | GitHub Actions → `flyctl deploy` |

**Principio clave:** un solo código para todos los entornos. La diferencia entre local y producción son **variables de entorno**, no archivos ni ramas distintas.

---

## 2. Modelo de ramas

```
develop  →  trabajo local y pruebas
master   →  producción (auto-despliega a Fly.io)
```

- **`develop`**: donde programás día a día. Probás en `localhost:3000`.
- **`master`**: cada push dispara el despliegue automático a producción.

**Nunca** trabajes directo en `master`. Siempre `develop` → merge → `master`.

---

## 3. Diferencias por entorno (NO por rama)

| Variable | Local (`develop`) | Producción (Fly.io / `master`) |
|----------|-------------------|-------------------------------|
| Configuración | archivo `.env` | `fly secrets` (nunca en git) |
| `NODE_ENV` | sin definir / `development` | `production` |
| Cookie `secure` | `false` (HTTP) | `true` (HTTPS) |
| `DB_PATH` | `./inventario.db` | `/data/inventario.db` (volumen) |
| `UPLOADS_DIR` | `public/uploads` | `/data/uploads` (volumen) |
| Google OAuth | client dev (callback `localhost`) | client prod (callback `fly.dev`) |
| `CALLBACK_URL` | `http://localhost:3000/auth/google/callback` | `https://inventario-hogar-alex.fly.dev/auth/google/callback` |

El código lee `process.env.NODE_ENV` y ajusta el comportamiento automáticamente (ver `server.js`).

---

## 4. Flujo de trabajo diario

### 4.1 Empezar a trabajar

```bash
git checkout develop
git pull origin develop          # traer últimos cambios
npm run dev                      # servidor local con auto-reload
```

Abrir http://localhost:3000

### 4.2 Hacer cambios

1. Editar código
2. Probar en localhost
3. Correr los tests:
   ```bash
   npm test
   ```
4. Commit:
   ```bash
   git add .
   git commit -m "feat: descripción del cambio"
   ```
5. Push a develop (backup, no despliega):
   ```bash
   git push origin develop
   ```

### 4.3 Publicar a producción

Cuando los cambios estén probados y listos:

```bash
git checkout master
git merge develop
git push origin master           # ← esto dispara el despliegue automático
git checkout develop             # volver a trabajar en develop
```

El push a `master` activa la GitHub Action, que ejecuta `flyctl deploy` y publica en Fly.io. Tarda 2-4 minutos.

### 4.4 Verificar el despliegue

```bash
gh run list --limit 3            # ver estado de la Action
```

O abrir https://github.com/alexmejiat2813/inventario-hogar/actions

Si dice **success** → ya está en producción.

---

## 5. Cómo funciona el despliegue (qué pasa al pushear master)

```
1. push a master en GitHub
        ↓
2. GitHub Action (.github/workflows/fly-deploy.yml) se dispara
        ↓
3. La Action ejecuta: flyctl deploy --remote-only
   (usa el secret FLY_API_TOKEN de GitHub para autenticarse)
        ↓
4. Fly.io construye la imagen Docker (remote builder)
        ↓
5. Sube la imagen y arranca una máquina nueva en yyz
        ↓
6. Monta el volumen ih_data en /data (datos persisten)
        ↓
7. Inyecta los fly secrets como variables de entorno
        ↓
8. App live en https://inventario-hogar-alex.fly.dev
```

El **volumen `ih_data` NO se toca** en los deploys → productos, compras, fotos y sesiones sobreviven.

---

## 6. Archivos clave de infraestructura

| Archivo | Rol |
|---------|-----|
| `Dockerfile` | Define la imagen (node:24-slim, `npm ci`, puerto 8080) |
| `.dockerignore` | Excluye `node_modules`, `.env`, `*.db`, `uploads`, `test` de la imagen |
| `fly.toml` | Config de Fly: app, región `yyz`, volumen, HTTPS, env públicas |
| `.github/workflows/fly-deploy.yml` | Action que despliega en push a master |

> ⚠️ **Nunca** pongas secrets en `fly.toml`, `Dockerfile` ni en el código. Solo en `fly secrets` (producción) o `.env` (local, gitignored).

---

## 7. Variables y secrets

### 7.1 Local — archivo `.env` (NO se commitea, está en `.gitignore`)

```
GOOGLE_CLIENT_ID=<client-id-de-dev>
GOOGLE_CLIENT_SECRET=<secret-de-dev>
CALLBACK_URL=http://localhost:3000/auth/google/callback
SESSION_SECRET=<cualquier-texto-largo>
PORT=3000
```

### 7.2 Producción — `fly secrets` (en Fly.io)

```bash
fly secrets set \
  GOOGLE_CLIENT_ID="<client-id-de-prod>" \
  GOOGLE_CLIENT_SECRET="<secret-de-prod>" \
  SESSION_SECRET="<texto-largo-aleatorio>" \
  CALLBACK_URL="https://inventario-hogar-alex.fly.dev/auth/google/callback" \
  --app inventario-hogar-alex
```

Ver qué secrets hay (sin mostrar valores):
```bash
fly secrets list --app inventario-hogar-alex
```

### 7.3 GitHub — para la Action

| Secret | Dónde | Para qué |
|--------|-------|----------|
| `FLY_API_TOKEN` | repo → Settings → Secrets → Actions | Autenticar `flyctl deploy` desde la Action |

---

## 8. Configuración de Google OAuth (dos clients)

**Regla:** un OAuth client por entorno. Aísla los secrets.

### Client de DESARROLLO (localhost)
- Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
- JavaScript origins: `http://localhost:3000`
- Su secret va en `.env` local

### Client de PRODUCCIÓN (Fly)
- Authorized redirect URIs: `https://inventario-hogar-alex.fly.dev/auth/google/callback`
- JavaScript origins: `https://inventario-hogar-alex.fly.dev`
- Su secret va en `fly secrets`

Crear un client: [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application.

> Si el login da `redirect_uri_mismatch`, falta registrar el redirect URI en el client correcto.

---

## 9. Comandos útiles de Fly.io

> En Windows, si `flyctl` no está en el PATH de la sesión, usá la ruta completa:
> `& "C:\Users\AlexMejia\.fly\bin\flyctl.exe" <comando>`

| Acción | Comando |
|--------|---------|
| Ver estado de la app | `fly status --app inventario-hogar-alex` |
| Ver logs en vivo | `fly logs --app inventario-hogar-alex` |
| Deploy manual | `fly deploy --app inventario-hogar-alex` |
| Listar secrets | `fly secrets list --app inventario-hogar-alex` |
| Setear/actualizar secret | `fly secrets set KEY="valor" --app inventario-hogar-alex` |
| Ver volúmenes | `fly volumes list --app inventario-hogar-alex` |
| Abrir consola SSH en la máquina | `fly ssh console --app inventario-hogar-alex` |
| Ver el dashboard web | `fly dashboard --app inventario-hogar-alex` |
| Listar tokens | `fly tokens list` |
| Revocar token | `fly tokens revoke <id>` |

---

## 10. Respaldo de la base de datos (importante)

La DB vive en el volumen (`/data/inventario.db`). Para bajar una copia:

```bash
fly ssh console --app inventario-hogar-alex
# dentro de la máquina:
cd /data
# salir y descargar con sftp:
fly sftp get /data/inventario.db ./backup-inventario.db --app inventario-hogar-alex
```

Hacelo periódicamente. Un volumen es persistente pero no es un backup.

---

## 11. Solución de problemas comunes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| Login falla `redirect_uri_mismatch` | redirect URI no registrado en Google | Agregar URI en el client prod |
| Login falla `client secret is invalid` | secret incorrecto/inhabilitado | Verificar `fly secrets`; rotar en Google |
| Action falla `token validation error` | `FLY_API_TOKEN` mal copiado | Recrear token, actualizar secret en GitHub |
| App carga pero pierde datos | volumen no montado / región distinta | Verificar `fly.toml` mounts y región del volumen |
| `region X not found` al crear volumen | falta método de pago en Fly | Agregar tarjeta en Billing |
| Deploy ok pero 503 | app no escucha en el puerto correcto | Verificar `PORT=8080` en `fly.toml` y Dockerfile |

Ver logs siempre primero: `fly logs --app inventario-hogar-alex`

---

## 12. Checklist de seguridad

- [ ] `.env` está en `.gitignore` (nunca commitear)
- [ ] Secrets de prod solo en `fly secrets`
- [ ] `FLY_API_TOKEN` solo en GitHub Secrets
- [ ] OAuth client separado dev/prod
- [ ] Cookie `secure: true` en producción (automático por `NODE_ENV`)
- [ ] Rotar cualquier secret que se haya expuesto
- [ ] Backups periódicos de la DB

---

## 13. Resumen de un vistazo

```
TRABAJAR:
  git checkout develop
  npm run dev
  ... cambios ...
  npm test
  git add . && git commit -m "..."
  git push origin develop

PUBLICAR:
  git checkout master
  git merge develop
  git push origin master      ← despliega solo
  git checkout develop

VERIFICAR:
  gh run list --limit 3
  https://inventario-hogar-alex.fly.dev
```

---

*Documento generado para el proyecto Inventario Hogar. Mantener actualizado si cambia la infraestructura.*
