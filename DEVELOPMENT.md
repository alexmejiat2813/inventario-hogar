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

### P0 — Bugs críticos (núcleo financiero)

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 115 | `updatePurchaseSession` sin compensación 0→>0 | RESUELTO en `7f06392` — reescritura con UPSERT/DELETE logic detecta fila existente y crea si no existe. | Crítica | Baja | ✅ |
| 116 | `updatePurchaseSession` sin compensación >0→0 | RESUELTO en `7f06392` — mismo bloque: si `totalAmount === 0` y existe tx, DELETE. | Alta | Baja | ✅ |
| 117 | Categoría desconocida degradada a 'Otros' sin notificar al cliente | RESUELTO en `73d92d0` — match case-insensitive en POST y PUT (find+toLowerCase) usa nombre canónico de la BD; toast ámbar diferido 600ms cuando `budget_category_status === 'degraded'`. | Alta | Baja | ✅ |
| 118 | Bypass de validación categoría cuando `knownCategories` está vacío | `routes/purchases.js:41`: si el usuario no tiene categorías registradas, cualquier string pasa directo a DB. Fix: si `knownCategories.length === 0` guardar igualmente (comportamiento correcto para nuevos usuarios) pero marcar `source='purchase'` y registrar en `personal_budget_categories` vía `ensurePersonalBudgetCategory`. | Media | Baja | ⬜ |

### P1 — Bugs conocidos

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 45 | Bug foto→Dashboard (móvil) | Al abrir cámara en Android, el SO puede descartar la PWA de memoria; al volver recarga en Dashboard perdiendo el modal. Fix: persistir `{productoActivo, tabActiva}` en `sessionStorage` + restaurar en `init()`. Requiere dispositivo para reproducir. | Alta | Media | ⬜ |

### P2 — Tests de regresión núcleo financiero

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 119 | Tests `updatePurchaseSession` casos borde | Cubrir: (a) totalAmount 0→>0 crea personal_transaction, (b) totalAmount >0→0 elimina personal_transaction, (c) edición sin budgetCategory no toca personal_transactions. Sin estos tests los bugs #115/#116 pueden resurgir sin detección. | Crítica | Baja | ⬜ |
| 120 | Test categoría desconocida + knownCategories vacío vs populado | Verificar comportamiento exacto del resolver en `routes/purchases.js`: categoría desconocida con categorías registradas → 'Otros'; sin categorías registradas → pasa y auto-registra. | Alta | Baja | ⬜ |
| 121 | Test migración histórica — fallo en mitad de forEach | Verificar que si la migración falla para el usuario N, los usuarios N+1..M no se ven afectados y la DB no queda con transacción abierta. | Alta | Media | ⬜ |

### P3 — Features de alto impacto inmediato

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 122 | Alertas proactivas de desvío presupuestario | Los umbrales warn/critical ya existen en `personal_budget_settings`. Falta el job que compare gasto actual vs umbral y dispare notificación push/in-app. Usar el cron de Fly o `setInterval` en startup. Sin esto el 80% del valor de los umbrales no se usa. | Crítica | Baja | ⬜ |
| 123 | Editar categoría de `personal_transaction` existente | PUT ya existe en la ruta. Falta inline-edit en la columna CATEGORIA de la tabla. El usuario no puede corregir una categoría mal asignada sin borrar y recrear. | Alta | Baja | ⬜ |
| 124 | Columna `budget_category` en historial de compras | La integración M:N existe en DB pero es invisible en `/historial`. Agregar columna filtrable por `budget_category` en `getPurchaseSessions` y en la UI de historial. | Alta | Baja | ⬜ |
| 125 | Proyección fin de mes como KPI principal | El hint de proyección ya existe pero está escondido bajo la barra de progreso. En la segunda mitad del mes debería ser el número más prominente del dashboard (KPI card propio con color semáforo). | Alta | Baja | ⬜ |
| 179 | Divisa base de Presupuesto Personal (congruencia con inventario) | Resuelto en item #181: sección Divisa en settings + bloqueo de enlace si no coincide con el inventario. Recálculo automático de montos históricos al cambiar de divisa queda pendiente como mejora futura (decisión: alcance simple por ahora). | Media | Media | ✅ |
| 126 | Pre-selección automática categoría en modal compra | Si `localStorage` tiene `pb_cat_store_${dominantStore}`, expandir el panel de presupuesto automáticamente y marcar toggle ON. Hoy el toggle es OFF por defecto — el usuario tiene que hacer 2 clics extra para el caso 90%. | Media | Baja | ⬜ |

### P4 — Performance

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 69 | Chart.js lazy load | Chart.js carga en todas las páginas, solo se usa en dashboard de `/inventory`. Moverlo a script condicional. | Baja | Baja | ⬜ |
| 70 | Minificación JS/CSS | Build step con `esbuild` para minificar antes del deploy. ~20-30% adicional sobre gzip. Requiere ajustar CI y rutas de assets. | Media | Media | ⬜ |
| 127 | Índice compuesto `(user_id, date, type)` en `personal_transactions` | Las queries de presupuesto mensual hacen scan por `user_id` solo. Con 5k+ filas empieza a notarse. `CREATE INDEX IF NOT EXISTS idx_pt_user_date_type ON personal_transactions(user_id, date, type)`. | Media | Baja | ⬜ |
| 128 | Litestream → R2/S3 backup SQLite | Fly volumes no son S3. Un crash del volumen = pérdida total de datos. Litestream replica WAL continuamente. Diferencia entre "perdimos todo" y "restauramos en 2 minutos". | Alta | Media | ⬜ |

### P5 — Features roadmap futuro

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 74 | Escáner de códigos de barras | Cámara ya integrada. Agregar librería de decode (ej. `zxing-js`) para identificar/agregar productos escaneando el código. | Media | Alta | ⬜ |
| 75 | Sugerencia de reposición inteligente | Predecir cuándo se acaba un producto basándose en historial de compras y consumo promedio. Requiere análisis de `purchase_sessions` + `purchase_items`. | Media | Alta | ⬜ |
| 76 | Modo oscuro | CSS variables ya están parcialmente preparadas. Agregar `prefers-color-scheme: dark` + toggle manual. | Baja | Media | ⬜ |
| 129 | Presupuesto próximo mes auto-generado | Basado en promedio 3 meses anteriores por categoría. El usuario abre enero y ya tiene una propuesta — solo ajusta. Elimina la planificación desde cero cada mes. | Alta | Media | ⬜ |
| 130 | Reporte mensual PDF/imagen compartible | Resumen "cómo quedó el mes" — distribución de gastos, balance, desvíos. Para hogares con dos personas que gestionan juntas: transparencia sin que ambos abran la app. | Alta | Media | ⬜ |
| 131 | Importación CSV de banco | El 90% de usuarios latinoamericanos no tiene Plaid. CSV de Bancolombia/BBVA/Banorte con mapeo de columnas es el 80% del valor de un aggregador con el 5% de la complejidad. Idempotencia: `external_tx_id` UNIQUE por usuario. | Alta | Alta | ⬜ |
| 132 | Metas de ahorro | "Ahorrar $500 para vacaciones en 4 meses" — proyecta cuánto recortar por categoría. Complementa el presupuesto con intención positiva. Requiere tabla `savings_goals`. | Media | Alta | ⬜ |
| 133 | Sincronización bancaria (Plaid/Flinks) | Requiere: tabla `bank_connections` con token cifrado + cursor incremental, índice UNIQUE `(user_id, external_tx_id)`, cola async de procesamiento (`sync_jobs` table + worker). No implementar sin el CSV como validación de demanda primero. | Alta | Muy alta | ⬜ |

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
| 79 | Simplificar filtros categoría Stock | Tarjetas eliminadas. Contador en chips. Reorden: buscar → categorías → en/fuera stock. Fix overflow medianas. | `456f77f` | ✅ |
| 57 | `CURRENCY_SYMBOLS` duplicado | Movido de shopping-list.js + inventories.js a utils.js. | `d35b450` | ✅ |
| 58 | `catch {}` traga errores | 11 route files: logger require + `catch (err) { logger.error(...)` en todos los catch bare. | `d35b450` | ✅ |
| 59 | SW versionado manual | Ya automatizado: `sw.js` fetch `/cache-version` devuelve `FLY_COMMIT_SHA` en prod. `ih-v1` es default pre-fetch. | `d35b450` | ✅ |
| 60 | Strings hardcodeados en `<th>` | `shopping.cols.*` keys en ES/EN/FR; `renderTable`/`renderTableRow` usan `tSafe()`. | `d35b450` | ✅ |
| 61 | Números mágicos | `MAX_PHOTOS=5` y `MAX_PHOTO_SIZE` en utils.js (frontend) + upload.js (backend). Eliminados de app.js y catalog.js. | `d35b450` | ✅ |
| 80 | Stat cards móvil — overflow + layout columna | Tercer card se cortaba en ≤412px. Fix: `min-width:0` en grid children, `flex-direction:column` en ≤480px (ícono arriba, texto abajo), `word-break:break-word`. | `4515d53` | ✅ |
| 81 | Dashboard empty state | El estado vacío mostraba skeletons persistentes. Reemplazado con UI limpia: ícono 3D, título/subtítulo i18n, botón "Ir a Stock". Charts area se oculta cuando no hay datos. | `4515d53` | ✅ |
| 82 | Favicon + ícono PWA | Creado `public/favicon.svg` (32×32, colores sólidos) + actualizado `public/icons/icon.svg` (512×512). Ruta explícita en server.js (`app.get('/favicon.svg',...)`). Solid hex — rgba no fiable en favicons cross-browser. | `4515d53` | ✅ |
| 78 | Compartir la aplicación | `header.js` no cargaba en index.html → TypeError antes del try → init() fallaba silenciosamente. Fix: agregar `<script src="/js/header.js">` en index.html + manejador `btn-share` en `initEvents()` de app.js e inventories.js. | `4515d53` | ✅ |
| 83 | Bug dropdown perfil dashboard/stock | `initProfileMenu()` registraba segundo listener sobre `profile-btn` → doble-toggle (abrir+cerrar en un clic). Fix: eliminar llamada de `app.js` e `inventories.js`; ambos ya tienen lógica completa de dropdown en su propio `initEvents()`. Manejador `btn-share` agregado inline en cada uno. | `1ce3c29` | ✅ |
| 84 | Módulo Presupuesto Personal (fases 1–3) | Tablas `personal_budgets` + `personal_transactions` + métodos DB. Rutas `/api/personal-budget` (GET, POST /budget, POST/DELETE /transaction). Página `/personal-budget` con HTML/CSS/JS completo: stat cards, form transacciones, tabla con delete. i18n ES/EN/FR. | — | ✅ |
| 85 | Integración Presupuesto en Mis Inventarios | Tabla `personal_budget_plans`, bloque compuesto inventario+presupuesto en grid, tarjeta standalone, modal crear plan (nombre + inventario), métricas dinámicas (`income_real`, `total_budgeted`) desde `personal_transactions` y `personal_budgets`. | — | ✅ |
| 86 | Motor cashflow semanal + Gastos Fijos | Columnas `frequency`/`due_date` en `personal_budgets`. Método `getWeeklyFixedCosts` con factores Mensual/Semestral/Anual/Bianual. Endpoint `/cashflow-analysis` con `total_weekly_needed` + `calendar_alerts` (30 días). Widget retención semanal con badges tricolor urgencia. Tercer tipo "Gasto Fijo" en form principal con campos ocultos condicionales, color índigo activo. | — | ✅ |
| 87 | Tabla Gastos Fijos Programados + endpoints control | `GET /fixed-costs`, `DELETE /budget/:id`, método `deletePersonalBudget`. Card `#pb-fixed-costs-card` (oculto si vacío) con tabla compacta: categoría, monto, frecuencia, vencimiento, equiv. semanal, botón delete. Recarga en paralelo con cashflow al guardar/eliminar. i18n ES/EN/FR. | `81db081` | ✅ |
| 88 | KPIs reales + acción Pagar en gastos fijos | KPI Gastos = gastos reales + suma `personal_budgets`. Balance = ingresos − gastos totales. Botón "Pagar" en tabla fijos prefilla form como Gasto real (categoría, monto, scroll + foco en fecha). CSS `.pb-btn-pay`. i18n `fixedList.pay` ES/EN/FR. | — | ✅ |
| 89 | Tabs + subtotales + edición gastos fijos | Dos cards unificadas en una con `.pb-tabs` (Transacciones / Gastos Fijos). `<tfoot>` en ambas tablas con subtotales dinámicos. Botón Editar en fijos: pre-carga form tipo "Gasto Fijo" + `_editingFixedId`. Submit envía PUT si hay ID activo. `updatePersonalBudget` en DB. `PUT /budget/:id` en router. i18n `tabs.*`, `fixedList.edit/saveEdit/updated/empty` ES/EN/FR. | — | ✅ |
| 90 | Selector de periodo Semanal/Quincenal | `<select #pb-period-selector>` reemplaza badge estático. Estado `_currentPeriod` con factor ×1/×2. `_lastCashflow` y `_lastFixedCosts` cachean datos del server. Re-render inmediato sin llamadas extra. Título, subtítulo y columna "Equiv." actualizan dinámicamente. CSS `.pb-period-selector` (pill accent). i18n `cashflow.titleBiweekly/subtitleBiweekly/periodWeekly/Biweekly/biweekSuffix`, `fixedList.colBiweekly` ES/EN/FR. | `a05f1ae` | ✅ |
| 91 | Modelo Real/Proyectado — 6 KPIs y flow_type | Migración `flow_type` en `personal_budgets` (DEFAULT 'expense'). `addPersonalBudget` reemplaza upsert. `getWeeklyFixedCosts` calcula `net_weekly = max(0, expense − income)`. GET / devuelve 6 KPIs (income/expense/balance real + proyectado). POST/PUT /budget validan `flow_type`. Cashflow analysis incluye `flow_type` en alertas. 2 toggles apilados (Naturaleza: Real/Proyectado + Tipo: Ingreso/Gasto). 6 stat cards en 2 secciones (borde sólido Real / punteado Proyectado). `renderFixedCosts` con badge income/expense y tfoot neto. Alertas cashflow coloreadas por flow_type. i18n `summary.label*`, `form.nature/flowType`, `tabs.fixed` → "Flujos Proyectados" ES/EN/FR. | `75b2daf` | ✅ |
| 92 | Simplificación UI — select único, 3 cols contables, neto quincenal/mensual | Reemplaza 2 toggles por 1 `<select id="pb-record-type">` con 4 opciones (Ingreso/Gasto Real/Proyectado). Selector periodo cambia a Quincenal/Mensual. Tarjeta retención muestra neto proyectado signed (`income_weekly − expense_weekly × factor`) con color verde superávit / rojo déficit — corrige bug de 0.00. Tabla proyectados: columna semanal → 3 cols Quincena/Mensual/Anual (desde `weekly_equivalent` ×2, ×52/12, ×52). tfoot con subtotales netos en 3 cols. Frecuencia Quincenal (FACTOR=24/52) en DB y validación backend. i18n `form.recordType/rt.*`, `fixed.freqBiweekly`, `fixedList.colBiweekly/colMonthly/colAnnual`, `cashflow.titleMonthly/subtitleBiweekly/subtitleMonthly/periodMonthly` ES/EN/FR. | `aeb6a0e` | ✅ |
| 93 | Dropdown "+ Nuevo Registro" con 4 opciones | Botón reemplazado por `.pb-dropdown` con menú flotante: Ingreso Real, Gasto Real, Ingreso Proyectado, Gasto Proyectado. Cada opción pre-selecciona el tipo y abre modal. CSS chevron animado, cierre por click fuera / Escape. | `930c656` | ✅ |
| 94 | Fix badge Balance — eliminar cashflow-analysis, computeAndRenderProj | Badge flotante mostraba valor incorrecto (intermediarios semanales). Eliminado endpoint `/cashflow-analysis` del frontend. `computeAndRenderProj()` calcula todo directamente desde `_lastFixedCosts` con `MONTHLY_FACTOR` — fuente única de verdad. | `75b2daf` | ✅ |
| 95 | Filtro frecuencia en tabla Flujos Proyectados | Segundo `<select id="pb-fc-filter-freq">` en thead, AND con filtro de tipo existente. `applyFcFilter()` filtra filas y recalcula tfoot con ítems visibles. `data-freq` en cada `<tr>`. i18n `fixedList.filterFreqAll` ES/EN/FR. | `8562b60` | ✅ |
| 96 | Cropper CSS fix — CSP bloqueaba `injectStyles()` | `style-src 'self'` en CSP bloqueaba `document.createElement('style')` dinámico en `cropper.js`. Fix: extraer todos los estilos a `public/css/cropper.css` estático + `<link>` en index/shopping-list/purchase-edit. Eliminados `injected` flag e `injectStyles()`. | `930c656` | ✅ |
| 97 | Responsive bloque compuesto + botones uniformes inventarios | Bloque Mi Hogar + Presupuesto se desbordaba en viewports medianos. Fix: `grid-column: span 2` para dar 2 columnas siempre al bloque compuesto. Botones `.page-actions .btn` con `min-width: 165px` + `flex-wrap`. | `930c656` | ✅ |
| 98 | Título "Mis inventarios y presupuestos" + drawer hamburguesa | Título de inventories.html actualizado. Drawer móvil dividido en 2 secciones ("Mis inventarios" / "Mis presupuestos") con opción "Crear presupuesto". `mob-drawer.js` actualizado con `data-mob-acts`. i18n `inventories.title` ES/EN/FR. | `930c656` | ✅ |
| 99 | Fix editar transacción — prefill modal y PUT route | Al editar una transacción el modal abría en blanco. Fix: data-attrs en radio (`data-category/amount/date/desc/inv`), `_selectedRow` almacena datos completos, `_editingTxId` state, edit handler prefilla form, `PUT /api/personal-budget/transaction/:id` + `updatePersonalTransaction` en DB. | `f778686` | ✅ |
| 100 | Integración M:N compras inventario ↔ presupuesto personal | Migraciones: `personal_budgets.inventory_id` + `purchase_sessions.budget_category`. `GET /api/personal-budget/expense-categories`. `createPurchaseSession` acepta `budgetCategory` — inserta `personal_transaction(expense)` en la misma transacción SQLite (rollback automático). Modal confirmar compra: dropdown categorías expense (oculto si no hay). Flujo proyectado: selector inventario visible también en tipo projected. i18n ES/EN/FR. | `87feeb9` | ✅ |
| 101 | Fix modal categorías settings — layout pantallas medianas | `.modal` max-width 400→460px + `box-sizing:border-box`. `.form-row > .form-group` con `min-width:0` para evitar overflow del grid. Collapse a 1 columna en ≤400px. Overlay centra el modal desde 480px (antes 600px). | `a6a6215` | ✅ |
| 102 | Fix flujos proyectados — guardar y mostrar inventario vinculado | `getWeeklyFixedCosts` JOIN inventories para traer `inventory_name`. Radio fixed costs: `data-inventory-id/name`. `_selectedRow.data` almacena `inventory_id/name`. Edit handler pre-llena `elInventory`. Tabla: badge azul `.pb-inv-badge` con nombre del inventario junto a categoría. | `1180306` | ✅ |
| 103 | Ítems personalizados de compra — guardar al inventario y catálogo | Checkbox "Guardar en inventario" por ítem ad-hoc en modal confirmar compra. `createPurchaseSession` acepta `saveToCatalog` por ítem: `INSERT OR IGNORE catalog_products`, crea `products(qty=0)`, luego `updQty` suma la cantidad comprada. CSS: `.confirm-item--custom` fondo azul claro, `.sl-save-catalog-label`. i18n `shopping.register.saveToCatalog` ES/EN/FR. | `ba6cf96` | ✅ |
| 104 | Tarjeta presupuesto en inventarios — balance real disponible | `getPersonalBudgetDynamicStats` calcula `balance_real = income_real − expense_real`. Tarjeta en inventarios muestra ese balance con color verde/rojo según signo. CSS `.inv-bp-stat-num--negative`. i18n `personalBudget.plan.balanceReal` ES/EN/FR. | `6b190ab` | ✅ |
| 105 | Fix subtotal tfoot — overflow móvil | `.pb-tfoot-balance` con `position:sticky; right:0; background:var(--card-bg)` evita que el colspan empuje la celda fuera del viewport en móvil. | `6b190ab` | ✅ |
| 106 | Mover botón Nuevo Registro a toolbar | Dropdown `#pb-dropdown` movido de `pb-month-bar-right` a `pb-toolbar` como primer elemento. Separador visual `border-right` entre el botón de agregar y los botones contextuales (Editar/Pagar/Eliminar). CSS `.pb-toolbar-btn--primary`. | `4f3cc78` | ✅ |
| 107 | Saneamiento núcleo financiero | `getCatalog` en `createPurchaseSession` usa `LOWER(name)=LOWER(?)` — dedup case-insensitive en catálogo. `budgetCategory.trim()` antes del INSERT en `personal_transactions`. `purchase_date` requerida y validada en `POST /purchases` — elimina fallback UTC del servidor. `shopping-list.js`: fechas de compra con hora local (`getFullYear/Month/Date`) en lugar de `toISOString()` UTC. | `e6e5981` | ✅ |
| 108 | Auditoría estratégica + implementación masiva UI/UX | Skeleton shimmer en KPI cards (se elimina al cargar). Badge de desvío presupuestario (warn ≥80%, alert ≥100% del proyectado). Barra de progreso mensual: % días transcurridos vs % gasto. Toggle opt-in para categoría presupuestaria en modal de compra (oculto por defecto). `localStorage` guarda categoría por establecimiento dominante y la pre-selecciona. Toast post-confirmación con monto y categoría registrada. Microinteracción fade en filtros de tabla. Empty state Flujos Proyectados con SVG + subtítulo + botón CTA "+ Agregar flujo". Fix `applyFcFilter`: usa `data-category` en `<tr>` en lugar de `td:nth-child(3)`. Migraciones `source` + `source_purchase_session_id` en `personal_transactions`. `createPurchaseSession` pasa `source='purchase'` y `sessionId` para vínculo bidireccional. Todas las fechas locales (no UTC). | `d76a0f4` | ✅ |
| 109 | Donut gastos, rango multi-mes, cascade delete | Gráfico donut (Chart.js) de distribución de gastos por categoría con leyenda personalizada top-7 + %. Selector de rango (1/3/6 meses) — `load()` hace `Promise.all` paralelo y merge de transacciones; KPIs y donut reflejan el rango completo. `deletePurchaseSession` elimina `personal_transactions` vinculadas (`source_purchase_session_id`) en el mismo `BEGIN/COMMIT` — vinculación bidireccional completa. | `c9499f9` | ✅ |
| 114 | Fix duplicados categorias presupuesto | UNIQUE INDEX `(user_id, LOWER(name))` en `personal_budget_categories`. Migracion elimina duplicados existentes + corre para todos los usuarios. `ensurePersonalBudgetCategory` usa INSERT OR IGNORE. `getAllPersonalBudgetCategories` simplificado. Categorias visibles en settings. | `31ec894` | ✅ |
| 113 | Unificar personal_budget_categories fuente unica | Migracion startup importa categorias historicas. `ensurePersonalBudgetCategory` auto-registra en POST /transaction y /budget. `getAllPersonalBudgetCategories` merges settings+historico. Endpoint /categories-all. Datalist nativo en modal filtrado por flow_type. | `e69e407` | ✅ |
| 112 | Mejoras UI/UX dashboard presupuesto | Columnas sortables FECHA/CATEGORIA/MONTO. Click en donut/leyenda filtra tabla (toggle). Badge contador resultados en buscador. Skeleton animado en donut card. Error state KPI cards. Gear con label 'Config.' visible. Reset filtro al cambiar mes/rango. | `3ac96b8` | ✅ |
| 111 | Deuda tecnica SE — nucleo financiero | `getPersonalBudgetExpenseCategories` unifica `personal_budget_categories` + `personal_budgets` como fuente de verdad unica. Toast diferenciado cuando `budget_tx_omitted=true`. 20 tests nuevos: compra atomica, sync update, cascade delete, CRUD categorias, settings umbrales. | `2204f8c` | ✅ |
| 110 | Modulo configuracion presupuesto personal | Tablas `personal_budget_categories` + `personal_budget_settings`. Migracion idempotente FK `personal_transactions` ON DELETE CASCADE (deteccion via `PRAGMA foreign_key_list`). Guard `totalAmount > 0` + flag `budget_tx_omitted`. `updatePurchaseSession` sincroniza `personal_transaction` vinculada. `saveToCatalog` hereda categoria real del catalogo. Sanitizacion `budgetCategory` con fallback a 'Otros' en route. CRUD `/api/personal-budget/categories`. `GET/PUT /api/personal-budget/settings` (umbrales). Pagina `/personal-budget/settings` 3 secciones: Categorias, Flujos Proyectados, Umbrales. Dashboard carga umbrales dinamicamente via `loadSettings()` — semaforo proyeccion configurable por usuario. CSS completo `pbs-*` + `btn-icon-sm`. | `1ba01c4` | ✅ |
| 115b | Fix i18n — keys faltantes y strings hardcodeados en presupuesto personal | Agregar `personalBudget.chart.*`, `range.*`, `progress.*`, `projection.*`, `search.*` en es/en/fr.json. Reemplazar labels hardcodeados (Mes X%, Gasto X%, Proyeccion fin de mes) con `t()` en personal-budget.js. Opciones selector rango con `data-i18n`. Campo busqueda con `data-i18n-ph`. | `3c819a2` | ✅ |
| 134 | fix | 5 bugs núcleo financiero: `updatePurchaseSession` UPSERT/DELETE logic, `deletePurchaseSession` revertBudget, migración forEach → console.error (no throw), sanitización `effectiveBudgetCategory` en route, coerción fecha local en shopping-list. | `7f06392` | ✅ |
| 135 | fix | Backup SQLite seguro — `VACUUM INTO` reemplaza `fs.copyFileSync` en live DB para evitar snapshots corruptos en WAL mode. | `93276b8` | ✅ |
| 136 | UI | Mejoras UX dashboard presupuesto y modal de compra: skeleton shimmer, badge desvío, barra progreso mensual, toggle opt-in budget en modal, localStorage categoría por establecimiento, toast con monto+categoría, donut empty state con SVG. | `66132a8` | ✅ |
| 137 | feat | Modelo colaborativo con privacidad estricta (5 reglas): tabla `user_inventory_budget_links` UNIQUE(user_id, inventory_id), endpoints budget-link GET/PUT/DELETE, middleware `requireInventory` en server.js, opt-in explícito por usuario por inventario. | `20e684f` | ✅ |
| 138 | feat | UI inline gestión vínculo inventario-presupuesto en modal de compra: checkbox "predeterminada", snapshot de link al abrir modal, sincronización silenciosa PUT/DELETE antes del POST, Rule 5 payer confirmation dialog. | `3dc33cf` | ✅ |
| 139 | fix | ReferenceError `allChecked` en `handleConfirm` — variable usada en bloque `if (budgetCategory)` sin declarar, causaba fallo silencioso en frontend que se interpretaba como ROLLBACK en backend. | `ff4d141` | ✅ |
| 140 | fix | catch defensivo en ROLLBACK (preserva error original), coerción `Number(lastInsertRowid)`, log estructurado `err.errcode`/`err.dberrmsg` en `createPurchaseSession` y `updatePurchaseSession`. | `c082195` | ✅ |
| 141 | feat | Reconciliación por ID: `category_id` FK en `personal_transactions` + `personal_budgets` con backfill. Cascade rename atómico en `updatePersonalBudgetCategory`. Limpieza vínculo huérfano en `deletePersonalBudgetCategory`. `loadSettings()` secuenciado antes de `load()`. Trend badges ↑/↓ % vs mes anterior. Paginación TX (30/página). Donut empty state CTA. Jerarquía visual modal. Sticky footer mobile. Visibility detection robusta. i18n ES/EN/FR. | `6878cd6` | ✅ |
| 142 | fix | Validación categoría case-insensitive en POST/PUT purchases: `find+toLowerCase` usa nombre canónico de la BD, evita degradaciones por autocorrector móvil. Toast ámbar diferido cuando `budget_category_status === 'degraded'`. i18n `budgetOmitted`/`budgetDegraded` ES/EN/FR. | `73d92d0` | ✅ |
| 143 | fix | Atomicidad de migraciones: dos bloques BEGIN/COMMIT agrupan ALTER TABLE del startup (PRAGMA reads fuera del tx). Empty state tabla transacciones con botón CTA "Registrar primer movimiento". `pb-modal-footer` sticky en ≤430px. Breakpoint `modal-foot` shopping-list extendido 420→430px. i18n `table.emptyCta` ES/EN/FR. | `0b68c44` | ✅ |
| 144 | feat | Filtro búsqueda en tiempo real: lista de compras (`_searchTerm` persistente, `applySearchFilter()`, search bar con lupa+×, `data-name` en filas, estado vacío) y edición de historial (`applyEditFilter()` en módulo, re-aplica en cada `renderItems()`, input en HTML, estado vacío). CSS `sl-search-bar`/`pe-search-bar` con `var(--border)`. i18n ES/EN/FR. | `253e23b` | ✅ |
| 145 | fix/feat | Sprint 5 bugs: (1) `updatePurchaseSession` revierte cantidades antiguas y aplica nuevas — stock correcto al editar sesión. (2) botón "Agregar producto" movido al tope de sección en purchase-edit.html. (3) columna `is_taxable` en `purchase_items`; impuestos calculados solo sobre subtotal gravable en backend y frontend (checkbox por ítem, `calcTotals` usa `taxableSubtotal`). (4) scroll-to-top en purchase-edit vía `back-to-top.js` compartido. (5) `getProductStorePrices` usa `MIN(unit_price)` por tienda. i18n `col.taxable/taxableTip` ES/EN/FR. | `08c4ee6` | ✅ |
| 146 | fix | Grid 8 columnas en purchase-edit — `.cell-taxable` invisible porque grid declaraba 7 cols. Extendido `grid-template-columns` a 8 + estilos `cell-taxable` para checkbox. | `95022d3` | ✅ |
| 147 | fix/chore | SW cache no invalidaba en Fly.io: `FLY_COMMIT_SHA` no disponible en runtime. Fix definitivo: `ARG COMMIT_SHA` en Dockerfile + `--build-arg` en CI. Fix inmediato: bump `package.json` `1.0.0→1.1.0`. | `7e2c8db` | ✅ |
| 148 | feat | Maestro de Productos: tabla `product_master` (user-scoped, barcode UNIQUE parcial), CRUD API `/api/product-master`, endpoint `scan-register` (local→Open Food Facts fallback), página `/products` con búsqueda en tiempo real, cards con toggle `tracks_stock`, modal con lookup por barcode, escáner de cámara real (`BarcodeDetector` + `getUserMedia` + `requestAnimationFrame` loop, beep AudioContext, overlay con esquinas animadas y línea de barrido). i18n ES/EN/FR. | `b57ba9e` | ✅ |
| 149 | feat/fix | purchase-edit reestructurado: secciones Impuestos y Recibo movidas SOBRE la lista de productos (antes quedaban al fondo). Checkbox `item-taxable` reemplazado por `<select class="item-taxable-select">` con opciones "Con Tax"/"Sin Tax" — dispara `calcTotals()` on change. Grid desktop balanceado (col 7 pasa de `36px` fijo a `minmax(72px,90px)`). `syncItemsFromDOM` lee `.value !== '0'` en lugar de `.checked`. i18n `purchaseEdit.tax.withTax/noTax` ES/EN/FR. | `8a3bb94` | ✅ |
| 150 | fix | `personal_transactions_v2` faltaba columna `category_id` — migración de recreación de tabla corría después de que `category_id` ya había sido agregado al vuelo, causando mismatch 11 vs 12 cols en DB fresca. Todos los deploys fallaban desde `b57ba9e`. | `f7c6367` | ✅ |
| 151 | fix | Summary bar móvil (<600px): totales SUBTOTAL/IMPUESTOS/TOTAL en fila horizontal con `justify-content: space-between`, botones ancho completo en segunda fila. `back-to-top` `bottom: 5.5rem` para no quedar tapado por la summary bar fija. | `d6de9eb` | ✅ |
| 152 | fix | Descuento General en purchase-edit y shopping-list: select tipo (Monto$/Porcentaje), input valor, cálculo `gross*(val/100)` o `val` fijo, `total = max(0, gross - discount)`. DB: cols `discount_type/discount_value` en `purchase_sessions`. Bar sticky con `bar-discount` (rojo, oculto si 0). i18n `discount.*` ES/EN/FR. | `[sesión]` | ✅ |
| 153 | fix | Menú hamburguesa catalog.html: eliminado ítem "Catálogo" `mob-active` del drawer (no existía en tab bar). purchase-edit.html: agregado tab "Productos" como 5to ítem del tab bar. | `00d4fea` | ✅ |
| 154 | fix | Drawer de index.html tab-aware: secciones `[data-mob-for]` — periodo del dashboard se oculta en tab Stock, sección Agregar se oculta en tab Dashboard. `switchTab` y `syncMobDrawerActive` actualizan visibilidad. | `3097c0c` | ✅ |
| 155 | fix | 3 bugs UI: (1) `.dash-budget-bar-fill` sin background en CSS → `background: #16a34a` + `display:block; height:6px; width:0` explícito. (2) `.inv-card` tap highlight iOS iluminaba toda la card → `-webkit-tap-highlight-color: transparent` + `cursor: default`. (3) placeholders i18n `{pct}`/`{amount}` → `{{pct}}`/`{{amount}}` en `progress.*` y `projection.*` ES/EN/FR. | `2bf8a6e` | ✅ |
| 156 | fix | `pb-period-selector` (select Quincenal/Mensual) y badge `+47.90 Quincenal` eliminados de personal-budget.html y personal-budget.js. Período fijo a biweekly. | `2bf8a6e`, `203fca9` | ✅ |
| 157 | fix | `.inv-card-menu-btn` color `#B2B0AD` (invisible en fondo blanco) → `#4B5563` con `border: 1px solid #EAEAEA` y `box-shadow` para simetría visual con `.card-menu-btn`. | `9b314e7` | ✅ |
| 158 | fix | `.dash-budget-bar-fill` `width:0` CSS default (bloquea render 100% cuando JS no setea inline style por cache). `display:block; height:6px` explícito. Bump v1.1.2 → v1.1.3 para invalidar SW cache. | `fff4461`, `aa24a4d` | ✅ |
| 159 | fix | `.inv-budget-fill` mismo patrón: `display:block; height:6px; width:0` en inventories.css. JS: `inv.budget_pct \|\| 0` para evitar `NaN%` cuando API no incluye el campo. | `fab8791` | ✅ |
| 160 | fix | Key `invTabs.section` faltaba en los 3 locales → drawer mostraba "INVTABS.SECTION". Agregado `"section": "Navegación/Navigation/Navigation"` en ES/EN/FR. Reorden drawer index.html: Dashboard → Productos → Stock → Compras → Historial. | `fee144f` | ✅ |
| 161 | feat | Rediseño tarjetas Maestro de Productos: `pm-card` ahora tiene imagen placeholder en top (estilo `product-card` de inventory), botón 3 puntos absoluto top-right, categoría badge prominente, nombre como `h3`, chips con padding propio, toggle row al pie. CSS `pm-card-img`, `pm-cat-badge`. Bump v1.1.5. | `6fbf38c` | ✅ |
| 162 | fix | `esc`, `tSafe`, `showToast` no estaban definidas en el contexto de `products.html` (declaradas `/* global */` pero nunca incluidas). Página en blanco + botón roto. Fix: definir las 3 funciones al inicio de `products.js`. | `d89a9f2` | ✅ |
| 163 | fix | Unificar logo: `favicon.svg` y `icons/icon.svg` reemplazados por diseño "IH" (texto blanco sobre `#082F49`, igual al `.header-icon`). `products.html` faltaban `<link rel="icon">` y `<link rel="apple-touch-icon">`. | `eef572f` | ✅ |
| 164 | fix | Orden menú inconsistente: tab bar de `index.html` tenía Productos al final → movido a posición 2 (Dashboard → Productos → Stock → Compras → Historial). Drawer de `products.html` reordenado igual con Productos activo entre Dashboard y Stock. | `9d2540e` | ✅ |
| 165 | fix | SW v2 + bump 1.1.6: forzar reinstalación del service worker para limpiar caches viejos de menús. | `a7045dc` | ✅ |
| 166 | chore | Renombrar "Maestro de Productos" → "Productos" en locales ES/EN/FR, products.html (title/breadcrumb/drawer) y fallbacks en products.js. | `257a7a2` | ✅ |
| 167 | feat | Foto de producto + Nutriscore + tabla nutricional desde Open Food Facts: 4 cols nuevas en `product_master` (image_url, nutriments, serving_size, nutriscore), OFF fetch ampliado, card muestra foto real o SVG placeholder, badge Nutriscore A-E con colores, sección nutricional colapsable en modal (energía, grasas, carbohidratos, azúcares, proteínas, fibra, sodio / 100g). i18n ES/EN/FR. Bump v1.1.8. | `3a6a477` | ✅ |
| 168 | feat | Opción A — FK `product_master_id` en `products`: migración, `products.create()` acepta `productMasterId`, nueva `db.linkMaster()`, `updQty`/`revertQty`/`applyQty` respetan `tracks_stock` (subquery), auto-link por `catalog_product_id` en flujo `saveToCatalog`, endpoint `PUT /api/products/:id/link-master`. Bump v1.1.9. | `c52bd23` | ✅ |
| 169 | feat | UI vinculación stock↔maestro: selector en modal de stock, `populateLinkMasterSelect`, `handleLinkMasterChange` (PUT /:id/link-master + toast + update state sin reload), `loadModalData` carga product_master, i18n ES/EN/FR. Bump v1.2.0. | `12ab3ec` | ✅ |
| 170 | feat | Búsqueda por código de barras en lista de compras: botón cámara en barra de búsqueda, scanner overlay (reutiliza CSS de products), `GET /api/product-master/lookup?barcode=X` (sin side effects), `openSlScanner`/`onSlBarcodeDetected` → filtra lista + scroll + highlight `.sl-row--highlight`. i18n ES/EN/FR. Bump v1.2.1. | — | ✅ |
| 171 | UI | Refinamiento estético tarjetas /products: foto 16:9 con `:has(img)`, 2-line clamp nombre, chips uniformes 22px altura, toggle row con borde superior, nutriscore badge en meta-row, más padding en body. Bump v1.2.2. | `[sesión anterior]` | ✅ |
| 172 | fix | Alineación header /products + foto pequeña: `header-left+header-back` → `btn-back` directo en `header-inner`; agregar `btn-back-label "Inventarios"` para igualar layout de Stock; clase JS `pm-card-img--photo` como fallback a `:has(img)` para aspect-ratio 16:9. Bump v1.2.3. | `fd41cbf`, `94fb5dd` | ✅ |
| 173 | fix | Orden drawer Productos: movido a posición 2 (Dashboard → Productos → Stock → Compras → Historial) en `history.html`, `catalog.html` y `shopping-list.html`. `index.html` y `products.html` ya lo tenían correcto. | `a4305d4` | ✅ |
| 174 | feat | Módulo Cuotas: tablas `installment_plans`+`installment_payments`, 6 métodos DB, 5 rutas API en `personal-budget.js`, página `/personal-budget/cuotas` con plan cards + barras de progreso + filas por cuota (pagar/desmarcar/enlazar tx/desenlazar) + modal nueva cuota + modal enlazar transacción. Link desde header de personal-budget.html. i18n ES/EN/FR. | — | ✅ |
| 175 | fix | CSP bloqueaba cuotas: `<style>` e `<script>` inline violaban `style-src 'self'` + `script-src 'self'`. Fix: extraer a `public/css/personal-budget-cuotas.css` y `public/js/personal-budget-cuotas.js`. Init defensivo con `typeof` guards en `initProfileMenu`/`loadProfileAvatar`. Strings dinámicos via `I18N.t()`, labels estáticos con `data-i18n`. | — | ✅ |
| 176 | UI | Acordeón en filas de cuotas: pagos ocultos por defecto, botón "Ver cuotas" con flecha rotativa para expandir/colapsar por plan. Key `installments.toggle` ES/EN/FR. | — | ✅ |
| 177 | fix | Barra de progreso cuotas real: CSP (`style-src 'self'`) bloqueaba `style="width:X%"` inline → fill quedaba siempre a ancho completo. Fix: `data-pct` + `el.style.width` vía JS post-render (mismo patrón que `dashboard.js`/`inventories.js`). También se quitó el último `style=""` inline restante (color "restante") por clase `.cq-remaining`. | `d951da5` | ✅ |
| 178 | feat | Conversión de divisas en cuotas: selector "Moneda de la deuda" + "Convertir a" (CAD/COP/USD/EUR/MXN/BRL/GBP) en modal nueva cuota. Consulta `open.er-api.com` (sin API key) y guarda el plan ya convertido en la divisa destino. Columnas `currency`/`original_amount`/`original_currency`/`exchange_rate` en `installment_plans`. Ruta `GET /installments/fx-rate`. Card muestra badge de divisa + nota "Ingresado como X (tasa)". | `e5f4f52` | ✅ |
| 180 | feat | Editar plan de cuotas: botón lápiz junto a eliminar, reusa modal en modo edición (PUT). Si ya hay pagos registrados, bloquea total/núm. cuotas/divisa (solo nombre/categoría/notas) para no romper el historial; sin pagos, edición completa regenera el calendario. | `1bab304` | ✅ |
| 181 | feat | Divisa base de Presupuesto Personal (item #179 resuelto, alcance acotado): sección "Divisa" en `/personal-budget/settings` (columna `currency` en `personal_budget_settings`). Inventario y Presupuesto siguen siendo independientes, pero al enlazarlos (`PUT /api/purchases/budget-link`) se bloquea con 409 si las divisas no coinciden, indicando cuál cambiar. Sin recálculo automático de montos históricos (decisión explícita: alcance simple, no tocar dinero histórico sin pedirlo). | `3d4431f` | ✅ |
| 182 | fix | Editar cuota ocultaba selector de divisa: `setConvertRowVisible` ocultaba `.cq-field-row` completo (compartido por divisa + convertir-a) en vez de solo el campo convertir-a. | `67a59a6` | ✅ |
| 183 | feat | Conversión automática a divisa base en cuotas: se elimina selector manual "Convertir a" — la divisa destino siempre es la base configurada en Settings (`loadBaseCurrency`). Si "Moneda de la deuda" difiere, convierte solo al crear (no al editar). Hint visible bajo el selector con la divisa base activa. | `8a3cab9` | ✅ |

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
