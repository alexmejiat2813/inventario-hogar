# OPERATIONS — Inventario Hogar

Guía de infraestructura y operaciones. Para tracking de tareas ver `DEVELOPMENT.md`.

---

## Arquitectura de deployment

```
Usuario
  │
  ▼
Cloudflare (CDN / proxy / SSL automático)
  │
  ▼
Fly.io — máquina virtual shared-cpu-1x / 256MB RAM
  │  region: yyz (Toronto)
  │  app: inventario-hogar-alex
  │
  ├── Node.js 24 + Express (server.js)
  │     puerto interno: 8080
  │
  └── Volumen persistente: ih_data  →  /data/
        ├── inventario.db       ← base de datos SQLite
        ├── uploads/            ← fotos de productos y recibos
        └── backups/            ← backups locales (últimos 7)
```

### Por qué Fly.io

Fly.io es una plataforma de hosting que corre contenedores Docker en máquinas
virtuales distribuidas globalmente. Ventajas para este proyecto:

- **SSL automático** — HTTPS sin configuración adicional.
- **Volumen persistente** — el directorio `/data` sobrevive reinicios y deploys.
- **Crons integrados** — tareas programadas declaradas en `fly.toml`.
- **Secrets** — variables de entorno cifradas, nunca en el código.
- **free-ish tier** — shared-cpu-1x con 256MB RAM es suficiente para uso familiar.

### El volumen `ih_data`

A diferencia de S3/R2, Fly.io usa discos locales adjuntos a la máquina virtual.
Ventaja: I/O rápido para SQLite. Riesgo: si el hardware del datacenter falla
físicamente, el volumen puede corromperse o perderse. Por eso existe el backup a R2.

---

## Sistema de backup

### Flujo completo

```
Cada día a las 03:00 UTC
  │
  ▼
Cron en fly.toml
  │  imagen: curlimages/curl
  │  comando: POST /api/backup con header x-backup-secret
  │
  ▼
routes/backup.js
  │
  ├── 1. Abre DB en modo lectura
  ├── 2. VACUUM INTO /data/backups/backup-<timestamp>.db
  │       (snapshot consistente, seguro con WAL activo)
  ├── 3. Elimina backups locales > 7
  │
  └── 4. Si S3_ENDPOINT + S3_BUCKET + S3_ACCESS_KEY_ID están presentes:
            PUT https://<account>.r2.cloudflarestorage.com/<bucket>/backups/<archivo>
            (S3-compatible API de Cloudflare R2)
```

### Por qué VACUUM INTO en lugar de copiar el archivo

SQLite en modo WAL (Write-Ahead Log) puede tener escrituras pendientes en el
archivo `-wal`. Copiar el `.db` directamente puede producir un backup corrupto.
`VACUUM INTO` genera un snapshot compacto y consistente en un archivo nuevo,
sin interrumpir operaciones en curso.

### Por qué Cloudflare R2

- **Mismo bucket, sin egress fees** — descargar el backup para restaurar no cuesta nada.
- **S3-compatible** — el código usa fetch estándar con API S3, sin SDK propietario.
- **Free tier suficiente** — 10 GB almacenamiento, 1M operaciones/mes. Un backup
  diario de ~10MB usa < 300 MB/mes y ~30 operaciones de escritura.
- **Separado del volumen Fly** — si el datacenter de Fly pierde el disco,
  el backup en R2 (Cloudflare) está intacto.

### RPO y RTO

- **RPO (Recovery Point Objective):** ~24 horas — máximo de datos que se puede perder
  es lo que se escribió desde el último backup (03:00 UTC).
- **RTO (Recovery Time Objective):** ~15 minutos — tiempo estimado para descargar
  el backup de R2 y restaurarlo en un nuevo volumen Fly.

---

## Cómo restaurar desde R2

### Escenario: volumen Fly corrupto o perdido

1. **Descargar el backup más reciente de R2:**

   Desde Cloudflare R2 dashboard → bucket `inventario-hogar-backups` →
   carpeta `backups/` → descargar el archivo más reciente `backup-<timestamp>.db`.

   O con curl (requiere las credenciales R2):
   ```bash
   curl -o restaurado.db \
     -H "Authorization: AWS4-HMAC-SHA256 ..." \
     "https://<account-id>.r2.cloudflarestorage.com/inventario-hogar-backups/backups/backup-<timestamp>.db"
   ```

2. **Crear nuevo volumen en Fly (si el anterior fue destruido):**
   ```bash
   flyctl volumes create ih_data --region yyz --size 3
   ```

3. **Subir el archivo restaurado al volumen:**
   ```bash
   # Copiar al contenedor via SSH
   flyctl ssh sftp shell
   > put restaurado.db /data/inventario.db
   ```

4. **Reiniciar la app:**
   ```bash
   flyctl machine restart
   ```

5. **Verificar health:**
   ```bash
   curl https://inventario-hogar-alex.fly.dev/health
   ```

---

## Secrets en Fly.io

Los secrets se almacenan cifrados en Fly y se inyectan como variables de entorno
en tiempo de ejecución. Nunca aparecen en logs ni en el código.

| Secret | Para qué sirve |
|--------|----------------|
| `SESSION_SECRET` | Firma las cookies de sesión (Google OAuth) |
| `GOOGLE_CLIENT_ID` | ID de la app en Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Clave privada de la app en Google OAuth |
| `BACKUP_SECRET` | Header para autorizar `POST /api/backup` desde el cron |
| `S3_ENDPOINT` | URL del bucket R2: `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | Nombre del bucket: `inventario-hogar-backups` |
| `S3_ACCESS_KEY_ID` | Access Key del token R2 |
| `S3_SECRET_ACCESS_KEY` | Secret Key del token R2 |
| `S3_REGION` | `auto` (Cloudflare R2 no usa región fija) |

Para listar secrets activos (sin ver los valores):
```bash
flyctl secrets list --app inventario-hogar-alex
```

Para agregar o actualizar un secret:
```bash
flyctl secrets set NOMBRE="valor"
```

---

## Deploy

```bash
flyctl deploy --remote-only
```

`--remote-only`: el build Docker ocurre en los servidores de Fly, no en tu
máquina local. Más rápido y no requiere Docker instalado localmente.

El deploy es zero-downtime: Fly levanta la nueva máquina, espera que pase el
health check en `/health`, y luego apaga la anterior.

---

## Comandos útiles

```bash
# Ver logs en tiempo real
flyctl logs --app inventario-hogar-alex

# Abrir consola SSH en el contenedor
flyctl ssh console --app inventario-hogar-alex

# Disparar backup manual
Invoke-RestMethod -Uri "https://inventario-hogar-alex.fly.dev/api/backup" `
  -Method POST -Headers @{"x-backup-secret"="<BACKUP_SECRET>"}

# Ver estado de la máquina
flyctl status --app inventario-hogar-alex

# Ver secrets configurados
flyctl secrets list --app inventario-hogar-alex
```

---

## Crons configurados en fly.toml

| Schedule | Qué hace |
|----------|----------|
| `0 * * * *` | Cada hora — envía alertas de notificaciones via `POST /api/notifications/send-alerts` |
| `0 3 * * *` | 03:00 UTC diario — backup SQLite + upload a R2 via `POST /api/backup` |

---

## Costos actuales (estimado mensual)

| Servicio | Plan | Costo |
|----------|------|-------|
| Fly.io shared-cpu-1x 256MB | — | ~$0–3/mes |
| Fly.io volumen 3GB | — | ~$0.15/mes |
| Cloudflare R2 | Free tier | $0/mes |
| Google OAuth | Free | $0/mes |
| **Total** | | **< $5/mes** |
