# Inventario Hogar — Development Tracking

> **Instrucción para Claude:** Al iniciar cualquier sesión de trabajo, leer este archivo, identificar el próximo ítem a trabajar, actualizar el estado a `🔄 En progreso` antes de comenzar, y marcarlo `✅ Hecho` con el commit al finalizar. Agregar nuevos bugs o features descubiertos durante el trabajo.

---

## Stack

- **Backend:** Node.js + Express 4 + SQLite (`node:sqlite` built-in) + Passport (Google OAuth)
- **Frontend:** Vanilla JS, sin framework. HTML con CSS propio por página.
- **Auth:** Google OAuth 2.0 + express-session con store SQLite persistente
- **Arquitectura:** MVC — `routes/`, `middleware/`, `database.js` (modelo)
- **PWA:** manifest.json + service worker con estrategias por tipo de recurso

---

## Trabajo completado

| # | Prioridad | Tarea | Commit | Estado |
|---|-----------|-------|--------|--------|
| 1 | P0 | Fix tabla `taxes` → `tax_types` en `createPurchaseSession` | `e49fb9e` | ✅ |
| 2 | P1 | Refactor MVC — server.js 962→62 líneas, routes/ + middleware/ | `f316885` | ✅ |
| 3 | P1 | Session store persistente en SQLite (sobrevive reinicios) | `10a1a80` | ✅ |
| 4 | P2 | Alertas de vencimiento en dashboard (badge expired/urgent/soon/ok) | `ea6665e` | ✅ |
| 5 | P2 | Historial de precios UI — ya existía (false pending) | — | ✅ |
| 6 | P2 | Alertas de presupuesto banner — ya existía (false pending) | — | ✅ |
| 7 | bug | Dropdown establecimientos vacío en lista de compras (race condition) | `a2e8047` | ✅ |
| 8 | P3 | Items libres en lista de compras (ad-hoc, tabla custom_shopping_items) | `1b63f87` | ✅ |
| 9 | P3 | Rename / delete inventario (solo owner, cascade borra todo) | `5bf57ad` | ✅ |
| 10 | P3 | Cambio de rol de miembros existentes (select inline, solo owner) | `75a6fd7` | ✅ |
| 11 | P3 | Export historial de compras a PDF y CSV (respeta filtros activos) | `59882ac` | ✅ |
| 12 | P3 | PWA offline para lista de compras (SW v8, banner sin conexión) | `972096a` | ✅ |
| 13 | P4 | Rate limiting auth (20/15min) y API (200/min) sin dependencias externas | `09238bd` | ✅ |
| 14 | P4 | Audit log de actividad por inventario (30 últimas acciones, modal acceso) | `4d123f5` | ✅ |
| 16 | bug | Filtros período dashboard no filtraban gráficas — monthlySpend usaba fecha hardcodeada | `746647c` | ✅ |
| 21 | UI | Ajustes visuales — badge dueño inline, grid stock 6/3/1, thumbnails de foto, charts con % responsive | `289a7b4` | ✅ |
| 22 | UI | Paleta de marca navy/sky/orange/teal aplicada a botones, tabs, menús, charts | `76b1757` | ✅ |
| 23 | bug | `progressColor` usaba `var(--warning)` inexistente → `var(--warn)` | `76b1757` | ✅ |
| 24 | chore | gitignore `public/uploads/` (contenido de usuarios) | `a4ce276` | ✅ |
| 25 | UI | Compras/historial: header estilo dashboard, paleta marca, avatar perfil, font igualado | `8dd2e6f` | ✅ |
| 26 | UI | Rediseño tabla lista de compras (sombra, hover, inputs alineados, botón navy) | `8b18cec` | ✅ |
| 27 | deploy | Producción en Fly.io — env-aware, Docker, volumen yyz, OAuth client prod | `babd26c`, `c7bea0c` | ✅ |
| 28 | deploy | CI auto-deploy GitHub Action en push a master (verificado) | `babd26c` | ✅ |
| 29 | UI | Stepper de stock en card (−/+/input, guarda al instante, paso por unidad) | `63d1455` | ✅ |
| 30 | UI | Stock visible hasta qty 0; bajo el minimo permanece en Stock y aparece en Compras | `63d1455` | ✅ |
| 31 | UI | Fotos en lista de compras — boton + popup/carrusel, json de imagenes en getShoppingList | `63d1455` | ✅ |
| 32 | UI | Dashboard por periodo (mes/3m/6m/año) en barra y drawer movil, titulos con sufijo | `63d1455` | ✅ |
| 33 | UI | Gasto por categoria suma subtotales de compras (no count de productos) + formato moneda | `63d1455` | ✅ |

---

## Despliegue

- **Producción:** https://inventario-hogar-alex.fly.dev (Fly.io, región `yyz` Toronto)
- **Volumen:** `ih_data` montado en `/data` — SQLite (`/data/inventario.db`) + uploads (`/data/uploads`) persisten entre deploys
- **OAuth:** client de producción separado del de desarrollo (localhost)
- **CI:** push a `master` → GitHub Action (`flyctl deploy`) → producción
- **Flujo:** trabajar en `develop` → merge a `master` → deploy automático
- **Secrets en Fly:** `GOOGLE_CLIENT_ID/SECRET`, `SESSION_SECRET`, `CALLBACK_URL` (vía `fly secrets`)
- **Secret en GitHub:** `FLY_API_TOKEN`

### Pendiente de seguridad (rotar)

- ⚠️ `GOOGLE_CLIENT_SECRET` de **dev** (`...VHby`) fue expuesto en chat → rotar en Google Console + actualizar `.env` local
- ⚠️ `FLY_API_TOKEN` inicial apareció en screenshot → revocar el viejo (`fly tokens list` / `revoke`), ya se recreó el activo

---

## Pendiente

### P4 — Calidad

| # | Tarea | Descripción | Estado |
|---|-------|-------------|--------|
| 15 | Tests | 37 tests con node:test — 25 unit (DB layer) + 12 smoke (HTTP). Regresión P0 incluida. | `7609244` | ✅ |
| 16 | Trust proxy | `app.set('trust proxy', 1)` para que rate limiter funcione detrás de nginx/Caddy | ⬜ |

### Mejoras detectadas durante el desarrollo

| # | Tarea | Descripción | Estado |
|---|-------|-------------|--------|
| 34 | Tabla compras móvil | Columnas establecimiento/cantidad/precio se cortan en celular → acordeón expandible bajo el producto | ✅ |
| 35 | Fotos cámara/álbum + recorte | Cropper reutilizable (cámara o álbum en ambas vistas) + recorte/redimensión. Quitar `capture` forzado en recibo | ✅ |
| 36 | Card móvil lista de compras | Rediseño grid: categoría/producto/tenés·mín apilados con labels inline, flechita acordeón a la derecha centrada. Sin header de tabla en móvil | ✅ |
| 17 | P0 ruta `/api/shopping/custom` | 404 con servidor viejo sin reiniciar — verificar que SW v8 no sirve respuestas cacheadas de rutas inexistentes | ⬜ |
| 18 | Historial de precios — locale hardcodeado | `expiryInfo()` en app.js usa strings en español hardcodeados, no responde a cambio de idioma | ⬜ |
| 19 | Export lista de compras — custom items | `buildExportText()` en shopping-list.html no incluye `state.customItems` en PDF/WhatsApp/clipboard | ⬜ |
| 20 | Sesión activa al eliminar inventario | Solo limpia `activeInventoryId` del request actual. Otros dispositivos/sesiones del mismo user no se limpian hasta el próximo request | ⬜ |

---

## Cómo usar este documento

### Al iniciar una sesión de trabajo

1. Leer la tabla **Pendiente**
2. Elegir el ítem a trabajar
3. Cambiar estado a `🔄 En progreso`
4. Agregar cualquier bug o feature descubierto a la tabla "Mejoras detectadas"

### Al completar un ítem

1. Mover a tabla **Trabajo completado** con número de commit
2. Cambiar estado a `✅ Hecho`

### Formato de estado

| Emoji | Significado |
|-------|-------------|
| ⬜ | Pendiente |
| 🔄 | En progreso |
| ✅ | Hecho |
| ⏸ | Bloqueado / en espera |
