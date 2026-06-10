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

Ordenado por prioridad descendente. Atacar en orden salvo que haya un motivo explícito para saltarse.

### P0 — Seguridad (arreglar antes del próximo deploy público)

| # | Tarea | Descripción | Estado |
|---|-------|-------------|--------|
| 55 | Error handler expone `err.message` | `server.js` manda detalles internos al cliente en prod. Fix: mensaje genérico en prod + `logger.error(err)` completo en servidor. | ✅ |
| 56 | Endurecer CSP — quitar `unsafe-inline` | 40 style="" convertidos a clases CSS, 5 inline scripts extraídos a archivos externos, onclick delegados a header.js/app.js. CSP limpio. | `6eae06f` | ✅ |

### P1 — Bugs conocidos

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 45 | Bug foto→Dashboard (móvil) | Al abrir cámara en Android, el SO puede descartar la PWA de memoria; al volver recarga en Dashboard perdiendo el modal. Fix: persistir `{productoActivo, tabActiva}` en `sessionStorage` + restaurar en `init()`. Requiere dispositivo para reproducir. | Alta | Media | ⬜ |

### P2 — Deuda técnica

| # | Tarea | Descripción | Estado |
|---|-------|-------------|--------|
| 57 | `CURRENCY_SYMBOLS` duplicado | Definido en `app.js`, `shopping-list.js`, `inventories.js`. Mover a `utils.js` (ya existe y se carga en todas las páginas). | ✅ |
| 58 | `catch {}` traga errores sin loguear | Varias rutas backend hacen `catch { res.status(500) }` perdiendo el detalle. Agregar `logger.error(err)` antes de responder. | ✅ |
| 59 | SW versionado manual | `ih-vNN` en `sw.js` se bump a mano — se olvida. Generar en CI con `Date.now()` o hash del commit para que sea automático. | ✅ |
| 60 | Strings hardcodeados en español | Algunos `<th>` de la lista de compras están en español fijo, no usan i18n. Agregar keys ES/EN/FR faltantes. | ✅ |
| 61 | Números mágicos sin constante | `5` (fotos máx) y `5MB` repetidos en frontend y backend sin constante compartida. Declarar en un lugar, referenciar desde ambos lados. | ✅ |
| 62 | `express.json()` sin `limit` explícito | Default 100kb implícito. Declarar `express.json({ limit: '100kb' })` para que sea intencional y auditable. | ✅ |

### P3 — Calidad e infraestructura

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 63 | ESLint + Prettier + pre-commit hook | Sin linter hoy. Setup `eslint` + `.eslintrc` + `prettier` + hook pre-commit (script git o husky). Evita errores silenciosos y mantiene formato consistente. | Media | Baja | ⬜ |
| 64 | Ampliar cobertura de tests | Hoy: 53 tests — faltan: budget (cálculo/reset), shopping list (custom items, templates), purchases (createSession/IDOR cross-inventory), autorización IDOR. Meta: ~80 tests. | Alta | Media | ⬜ |
| 65 | Chart.js self-hosted | Hoy carga desde CDN (`cdn.jsdelivr.net`) — rompe offline real y es dependencia externa. Copiar a `/js/vendor/chart.min.js` + lazy-load solo en `/inventory`. | Media | Baja | ✅ |
| 66 | Backup automático SQLite en Fly | Si el volumen se corrompe, datos perdidos. Configurar cron en Fly (`fly machine run`) que haga `sqlite3 /data/inventario.db .dump` y suba a un bucket S3/R2. | Alta | Media | ⬜ |
| 67 | Magic bytes en uploads | `fileFilter` confía en `Content-Type` del cliente (falsificable). Leer primeros bytes del buffer y verificar firma real (JPEG: `FF D8`, PNG: `89 50 4E 47`, WebP: `52 49 46 46`). | Alta | Baja | ✅ |

### P4 — Performance

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 68 | Lazy loading de imágenes | Agregar `loading="lazy"` a todos los `<img>` de cards de productos. 1 atributo, mejora TTI en inventarios grandes. | Media | Baja | ⬜ |
| 69 | Chart.js lazy load (depende de #65) | Chart.js carga en todas las páginas, solo se usa en dashboard de `/inventory`. Moverlo a import dinámico o script condicional. | Baja | Baja | ⬜ |
| 70 | Minificación JS/CSS | Build step con `esbuild` para minificar antes del deploy. ~20-30% adicional sobre gzip. Requiere ajustar CI y rutas de assets. | Media | Media | ⬜ |

### P5 — Features nuevas

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 71 | Cron push notifications | Endpoint ya existe (`/api/notifications/send-alerts`). Falta dispararlo desde Fly con `fly machine run` en un cron diario. | Media | Baja | ⬜ |
| 72 | Export/import inventario | Exportar productos + stock a CSV/JSON para backup manual del usuario. Importar desde CSV para onboarding. | Alta | Media | ⬜ |
| 73 | Comparador de precios por tienda | Datos ya existen (`getProductStorePrices`). Falta UI: tabla/chart de precio por tienda en el modal de producto, con recomendación de dónde comprar más barato. | Media | Baja | ⬜ |
| 74 | Escaner de códigos de barras | Cámara ya integrada. Agregar librería de decode (ej. `zxing-js`) para identificar/agregar productos escaneando el código. | Media | Alta | ⬜ |
| 75 | Sugerencia de reposición inteligente | Predecir cuándo se acaba un producto basándose en historial de compras y consumo promedio. Requiere análisis de `purchase_sessions` + `purchase_items`. | Media | Alta | ⬜ |
| 76 | Modo oscuro | CSS variables ya están parcialmente preparadas. Agregar `prefers-color-scheme: dark` + toggle manual. | Baja | Media | ⬜ |
| 78 | Compartir la aplicación | Botón/opción para invitar a otros usuarios a unirse al inventario activo (link con código de invitación) o compartir la URL de la PWA. Posibles puntos de entrada: card del inventario, menú de perfil. | Alta | Media | ⬜ |
| 79 | Simplificar filtros de categoría en Stock | Actualmente hay dos filtros redundantes: chips horizontales + tarjetas con contador. Eliminar las tarjetas. Agregar el contador de productos al lado del nombre en cada chip (ej. "Alimentos (12)"). Una sola interfaz, más limpia. | Media | Baja | ⬜ |

---

## Trabajo completado (P4 — Calidad + Mejoras detectadas)

| # | Tarea | Descripción | Commit | Estado |
|---|-------|-------------|--------|--------|
| 15 | Tests | 37 tests con node:test — 25 unit (DB layer) + 12 smoke (HTTP). Regresión P0 incluida. | `7609244` | ✅ |
| 16 | Trust proxy | `app.set('trust proxy', 1)` habilitado en todos los ambientes para rate limiter detrás de nginx/Caddy | `45fbc3f` | ✅ |
| 17 | P0 ruta `/api/shopping/custom` | Ruta implementada y SW cachea correctamente. Verificado en `6b5c2e2` | ✅ |
| 18 | Historial de precios — locale hardcodeado | `expiryInfo()` en app.js usa strings en español hardcodeados, no responde a cambio de idioma | `515f6bb` | ✅ |
| 19 | Export lista de compras — custom items | `buildExportText()` en shopping-list.html no incluye `state.customItems` en PDF/WhatsApp/clipboard | `515f6bb` | ✅ |
| 20 | Sesión activa al eliminar inventario | Eventos sincronizados entre dispositivos via localStorage/message. Verificado en trabajo anterior | ✅ |
| 34 | Tabla compras móvil | Columnas establecimiento/cantidad/precio se cortan en celular → acordeón expandible bajo el producto | ✅ |
| 35 | Fotos cámara/álbum + recorte | Cropper reutilizable (cámara o álbum en ambas vistas) + recorte/redimensión. Quitar `capture` forzado en recibo | ✅ |
| 36 | Card móvil lista de compras | Rediseño grid: categoría/producto/tenés·mín apilados con labels inline, flechita acordeón a la derecha centrada. Sin header de tabla en móvil | ✅ |
| 37 | Cámara dedicada en fotos | Botón Cámara (`capture`) + Galería en stock y recibo (Samsung abría galería directo). i18n ES/EN/FR | ✅ |
| 38 | Auto-reload al actualizar SW | `controllerchange` en i18n.js recarga la página tras deploy para no quedar con cache vieja | ✅ |
| 39 | Bug grid card móvil | `.sl-table tbody>tr` (esp. 0,1,2) pisaba `.sl-row{display:grid}` (0,1,0). Fix `:not(.sl-row)` | ✅ |
| 40 | Anti-cache definitivo | `Cache-Control: no-cache` en páginas HTML y sw.js + `reg.update()` por carga | ✅ |
| 41 | Alineación tabla desktop | Títulos numéricos + datos left-align; inputs cantidad/precio al ancho con tope, Producto más ancho | ✅ |
| 42 | Resumen en card de inventario | Productos, críticos, budget gastado/restante con barra. API extendida + i18n ES/EN/FR | ✅ |
| 43 | Orientación móvil | manifest `orientation` portrait→any, la app rota con la pantalla | ✅ |
| 44 | Auditoría técnica | Revisión completa en `AUDIT.md` (seguridad, deuda, roadmap) | ✅ |
| 46 | Unificar header Catálogo | Header de catalog.html con hamburguesa + avatar + drawer como Stock/Compras (header.css compartido, SW v22). PROMPT-PROXIMA-SESION #3 — `b0f7971` | ✅ |
| 47 | Pestañas En/Fuera de stock | Sub-tabs En/Fuera de stock en vista Stock (contador por pestaña). Incluye grid 2-col en móvil, botón volver-arriba, menú kebab Editar/Eliminar y fix overflow. PROMPT-PROXIMA-SESION #4 — `e496c54` | ✅ |
| 48 | Botón Ver separado de Editar | Vista read-only del producto en Stock (reusa modal en modo readonly). Incluye modal 2-col, quita botón Lista, campos obligatorios con * rojo. PROMPT-PROXIMA-SESION #7 — `be28869` | ✅ |
| 49 | Bug plantillas no guardaban | `createTemplate` usaba `db.transaction()` (API de better-sqlite3) inexistente en `node:sqlite` → POST /api/templates devolvía 500 siempre. Fix: BEGIN/COMMIT/ROLLBACK manual + 3 tests de regresión | ✅ |
| 50 | Métricas de uso (super admin) | Columna `last_login_at`, `getAdminStats()`, middleware `requireAdmin` por env `ADMIN_EMAILS` (404 a no-admins), `GET /api/admin/stats`, página `/admin`, link en dropdown de inventories solo admin. Secret `ADMIN_EMAILS` ya seteado en Fly — `7cd0023` | ✅ |
| 51 | Bug catálogo resucitaba productos | Seeds de catálogo/categorías/unidades corrían con INSERT OR IGNORE en cada arranque → productos borrados/renombrados reaparecían tras cada deploy. Fix: seeds solo en primera ejecución (PRAGMA user_version); DBs pobladas solo marcan el flag sin resembrar | ✅ |
| 52 | Catálogo no se traducía | Los 100 productos sembrados se guardaban en español y se mostraban igual en EN/FR (ej "Frijoles" en vez de "Haricots"). Fix: columna `i18n_key` + 100 keys `catalogSeed.*` en ES/EN/FR; catalog.html muestra traducido; al agregar al inventario guarda el nombre en el idioma activo; renombrar limpia la key. Categorías ya traducían vía tabs | ✅ |
| 53 | Categorías no se reflejaban en todas las vistas + sin íconos | Tabs de filtro e íconos estaban hardcodeados en Stock/Catálogo; agregar/editar una categoría en settings no se veía. Fix: tabla `categories` unificada como fuente única (columnas `name_en`/`name_fr`), tabs e íconos data-driven en Stock y Catálogo, selects dinámicos, rename con cascade a productos/catálogo, migración auto-crea categorías usadas, delete bloqueado si está en uso, UI de traducción en settings. Eliminado mapeo catálogo→inventario | ✅ |
| 54 | Push notifications al celular | Alertas al teléfono con la app cerrada (vencimientos, stock crítico, presupuesto). Tabla `push_subscriptions`, ruta `/api/notifications`, handlers `push`/`notificationclick` en sw.js, UI en settings con enable/disable. VAPID keys configurables vía .env. Graceful: sin keys = 503. Cron en Fly para enviar = futuro. iOS requiere PWA instalada. i18n ES/EN/FR | `96fd654` | ✅ |
| 77 | Bug plantillas no guardaban establecimiento/precio | `list_template_items` sin columnas `store_id`/`unit_price`. Migration + fix en `createTemplate`, save y applyTemplate. | `b8eaf36` | ✅ |
| 57 | `CURRENCY_SYMBOLS` duplicado | Movido de shopping-list.js + inventories.js a utils.js. | `d35b450` | ✅ |
| 58 | `catch {}` traga errores | 11 route files: logger require + `catch (err) { logger.error(...)` en todos los catch bare. | `d35b450` | ✅ |
| 59 | SW versionado manual | Ya automatizado: `sw.js` fetch `/cache-version` devuelve `FLY_COMMIT_SHA` en prod. `ih-v1` es default pre-fetch. | `d35b450` | ✅ |
| 60 | Strings hardcodeados en `<th>` | `shopping.cols.*` keys en ES/EN/FR; `renderTable`/`renderTableRow` usan `tSafe()`. | `d35b450` | ✅ |
| 61 | Números mágicos | `MAX_PHOTOS=5` y `MAX_PHOTO_SIZE` en utils.js (frontend) + upload.js (backend). Eliminados de app.js y catalog.js. | `d35b450` | ✅ |

> **Nota deuda:** `initProfileMenu()` + `loadProfileAvatar()` están duplicados en app.js/history.js/shopping-list.js/inventories.js/catalog.js. Candidato a extraer a un módulo compartido `public/js/header.js` (no hecho aquí para mantener el cambio acotado).

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
