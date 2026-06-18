# Inventario Hogar — Development Tracking

> **Instrucción para Claude:** Al iniciar cualquier sesión de trabajo, leer este archivo, identificar el próximo ítem a trabajar, actualizar el estado a `🔄 En progreso` antes de comenzar, y marcarlo `✅ Hecho` con el commit al finalizar. Agregar nuevos bugs o features descubiertos durante el trabajo.

---

## Gobernanza de DEVELOPMENT.md (control de cambios)

Reglas obligatorias para **cualquier** autor (Claude o Codex) que edite este archivo.

1. **Atribución de autoría.** Al final de la celda "Descripción" del ítem (sin
   romper el formato de tabla markdown ni crear columnas nuevas), agregar entre
   paréntesis: `(claude)` si se opera como modelo en chat, `(codex)` si se opera
   como extensión/automatización local. Al editar una entrada de otro autor,
   conservar su atribución y sumar la propia: ej. `(claude) (codex: ajuste 2026-06-18)`.

2. **Numeración (regla mecánica).** El ID de un ítem nuevo = (máximo ID numérico
   existente en **todo** el archivo, incluyendo pendientes y "Trabajo completado") + 1.
   Antes de asignar, buscar ese número en todo el archivo y confirmar que no existe.
   Prohibido reutilizar, duplicar, reiniciar o renumerar IDs. Si se detecta una
   colisión previa, anotarla como observación y dejar que el autor original decida.

3. **Integridad de estado.** Solo cambiar el Estado (⬜/🔄/✅) de ítems realmente
   trabajados. No marcar ✅ ni editar ítems ajenos sin evidencia. Antes de agregar
   un hallazgo, validarlo contra el código real (`archivo:línea`); nada especulativo.

4. **Alcance.** No modificar otras líneas de código de la app al registrar bitácora.
   Preservar el formato de tabla (columnas, orden, separadores).

> Próximo ID disponible: **233** (mantener este valor actualizado al agregar ítems). (claude) (codex: actualizado al registrar auditoría /products 2026-06-17; smoke dinámico 2026-06-17) (claude: colisión #199 resuelta — ítem test renumerado a #232; ola 3.5 completa)

### Prompt para Codex

```
Actúa como Ingeniero de Software Principal y Administrador de Configuración.
Antes de cualquier registro en 'DEVELOPMENT.md', lee la sección
"Gobernanza de DEVELOPMENT.md" y cúmplela al pie de la letra.

Reglas obligatorias:
1. ATRIBUCIÓN: agrega '(codex)' al final de la celda Descripción del ítem que
   registres/edites, sin romper la tabla markdown. Si editas algo de Claude,
   conserva '(claude)' y suma '(codex: <nota>)'.
2. NUMERACIÓN: el ID de un ítem nuevo = (máximo ID numérico existente en TODO el
   archivo, pendientes + completados) + 1. Busca el número candidato en todo el
   archivo y confirma que no existe. Prohibido reutilizar, duplicar, reiniciar o
   renumerar IDs de Claude. Si hay colisión previa, anótala como observación; no
   la corrijas silenciosamente.
3. ESTADO: solo cambia ⬜/🔄/✅ de ítems que trabajaste; no toques estado ajeno.
   Valida cada hallazgo contra el código (archivo:línea) antes de registrarlo.
4. ALCANCE: no modifiques ninguna otra línea de código de la app; solo
   'DEVELOPMENT.md', preservando el formato de tabla.

Confirma que entendiste y muestra: (a) el próximo ID que asignarías ahora,
calculado según la regla 2; (b) una fila de ejemplo con tu atribución '(codex)'.
```

### Prompt para Claude

```
Al editar 'DEVELOPMENT.md', cumple la sección "Gobernanza de DEVELOPMENT.md":
1. ATRIBUCIÓN: agrega '(claude)' al final de la celda Descripción del ítem que
   registres/edites, sin romper la tabla. Conserva atribuciones previas de codex.
2. NUMERACIÓN: ID nuevo = (máximo ID en TODO el archivo, pendientes + completados)
   + 1; verifica que no exista antes de usarlo. No reutilices ni renumeres IDs de
   codex; si hay colisión, anótala, no la pises.
3. ESTADO: solo cambia ⬜/🔄/✅ de lo que trabajaste; valida hallazgos contra
   código (archivo:línea) antes de agregarlos.
4. ALCANCE: el registro de bitácora se limita a 'DEVELOPMENT.md'.
Mantén actualizado el valor "Próximo ID disponible" tras agregar ítems.
```

---

## Plan de trabajo por olas (impacto ÷ riesgo) (claude)

Orden de ejecución definido 2026-06-18. Primero correctitud/seguridad de bajo
riesgo, luego pulido UI, y al final arquitectura (requiere plan formal).

- **Ola 1 — Correctitud backend (Alta/Baja):** #208, #210, #209, #211. ✅
- **Ola 2 — Seguridad cache SW:** #224, #225, #223. ✅
- **Ola 3 — Robustez runtime frontend:** #216, #212, #213, #214, #215, #217.
  #218/#219 diferidos. ✅
- **Ola 3.5 — Correcciones auditoría Codex `/products` (Alta→Baja/Baja):**
  #228, #229, #230, #231. ✅
- **Ola 4 — UI/layout:** #226+#227, #220, #221, #222, #192. ✅
- **Ola 5 — Infra/durabilidad:** #128 (backup R2). ✅
- **Ola 6 — Arquitectura (requiere `/plan`):** #199 (extraer servicios de
  `database.js`), #207 (render helpers frontend), #70 (minificación). Alto blast radius.
- **Ola 7 — Requiere dispositivo:** #45 (foto→Dashboard Android).
- **P5 — Roadmap producto (decisión de negocio):** #129, #130, #131, #132, #74,
  #75, #76, #133.

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
| 118 | Bypass de validación categoría cuando `knownCategories` está vacío | `routes/purchases.js:41`: si el usuario no tiene categorías registradas, cualquier string pasa directo a DB. Fix: si `knownCategories.length === 0` guardar igualmente (comportamiento correcto para nuevos usuarios) pero marcar `source='purchase'` y registrar en `personal_budget_categories` vía `ensurePersonalBudgetCategory`. | Media | Baja | ✅ |

### P1 — Bugs conocidos

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 45 | Bug foto→Dashboard (móvil) | Al abrir cámara en Android, el SO puede descartar la PWA de memoria; al volver recarga en Dashboard perdiendo el modal. Fix: persistir `{productoActivo, tabActiva}` en `sessionStorage` + restaurar en `init()`. Requiere dispositivo para reproducir. | Alta | Media | ⬜ |

### P2 — Tests de regresión núcleo financiero

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 119 | Tests `updatePurchaseSession` casos borde | Cubrir: (a) totalAmount 0→>0 crea personal_transaction, (b) totalAmount >0→0 elimina personal_transaction, (c) edición sin budgetCategory no toca personal_transactions. Sin estos tests los bugs #115/#116 pueden resurgir sin detección. | Crítica | Baja | ✅ |
| 120 | Test categoría desconocida + knownCategories vacío vs populado | Verificar comportamiento exacto del resolver en `routes/purchases.js`: categoría desconocida con categorías registradas → 'Otros'; sin categorías registradas → pasa y auto-registra. | Alta | Baja | ✅ |
| 121 | Test migración histórica — fallo en mitad de forEach | Verificar que si la migración falla para el usuario N, los usuarios N+1..M no se ven afectados y la DB no queda con transacción abierta. | Alta | Media | ✅ |

### P2 — Arquitectura y calidad detectada en auditoría

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 199 | Extraer servicios de dominio desde `database.js` | `database.js` concentra schema, migraciones, seeds, queries y reglas de negocio financieras. Separar gradualmente en módulos (`db/core`, `services/purchases`, `services/personal-budget`, `services/installments`) manteniendo la API pública actual para reducir blast radius. | Alta | Media | ⬜ |
| 200 | Centralizar validación/sanitización de compras y presupuesto | La normalización de categorías, fechas, montos, divisas y descuentos está duplicada en rutas. Crear helpers puros testeables para evitar divergencias entre POST/PUT y entre compras/presupuesto. | Alta | Baja | ✅ |
| 201 | OpenAPI como contrato vivo | `openapi.json` no refleja todas las rutas actuales (`product-master`, cuotas, budget-link, FX, backup). Actualizar spec y agregar smoke test que compare rutas montadas vs spec mínima. | Media | Media | ✅ |
| 202 | Capa HTTP para integraciones externas con timeout/cache | Open Food Facts y FX dependen de red externa desde request handlers. Agregar cliente con timeout, retry limitado, cache corta y tests con mocks para evitar requests colgados o lentos. | Alta | Media | ✅ |
| 203 | Hardening de performance SQLite | Agregar índices faltantes detectados (`personal_transactions(user_id,date,type)`, `installment_payments(plan_id,paid_at)`, búsquedas case-insensitive frecuentes) y revisar queries con `strftime` que impiden usar índices por rango. | Media | Baja | ✅ |
| 204 | Modularizar JS frontend por vista | `app.js`, `shopping-list.js` y `personal-budget.js` mezclan estado, API, render y eventos. Extraer clientes API y render helpers por vista para bajar riesgo de regresión y facilitar tests de lógica pura. | Media | Media | 🟡 Parcial |
| 206 | Consolidar math de totales de compra en módulo compartido (continúa #204) | Hecho: `purchase-edit.js` y `shopping-list.js` (vía adapter de subtotales) ahora comparten `PurchaseTotals.computePurchaseTotals`. Cliente API compartido ya existe (`apiFetch` en `utils.js`). 10 tests node de la math. | Media | Media | ✅ |
| 207 | Extraer render helpers de `app.js` / `personal-budget.js` | Refactor mayor (70KB + 52KB) sin red de tests in-browser: separar estado/render/eventos por vista. Alto riesgo de regresión — requiere plan y verificación manual por vista antes de tocar. | Media | Alta | ⬜ |
| 212 | Robustecer inicialización i18n en runtime frontend | Auditoría runtime detectó múltiples vistas con `await I18N.init()` antes del `try/catch` principal (`app.js`, `shopping-list.js`, `purchase-edit.js`, `catalog.js`, `history.js`, `inventories.js`, `settings.js`, `personal-budget.js`, `personal-budget-settings.js`, `admin.js`). Si falla `/locales/{lang}.json` por red/SW/cache, la vista puede quedar sin eventos ni carga inicial. Tomar como referencia el patrón defensivo de `personal-budget-cuotas.js`. | Alta | Baja | ✅ (claude: `I18N.init()` ahora es resiliente — si falla la carga del locale no rechaza, conserva el texto por defecto del HTML y sigue; un solo cambio cubre todas las vistas) |
| 213 | Inicializar i18n en `/products` | `public/js/products.js` no llama `I18N.init()` en su `DOMContentLoaded`; la vista funciona con fallbacks de `tSafe()`, pero no carga localización real ni sincroniza correctamente estado de idioma. | Media | Baja | ✅ (claude: `products.js` ahora llama `I18N.init()` resiliente en su DOMContentLoaded) |
| 214 | Validar `res.ok` en subidas de imágenes por `fetch` | Auditoría runtime detectó que `app.js` y `catalog.js` suben fotos con `fetch()` pero no verifican `res.ok`; un 400/413/500 puede reportarse como éxito o cerrar el modal aunque la imagen no se haya guardado. `purchase-edit.js` ya tiene el patrón correcto para recibos. | Media | Baja | ✅ (claude: `app.js` y `catalog.js` ahora verifican `res.ok` en la subida de fotos y muestran toast de error; key i18n `*.uploadError`/`catalog.photoUploadError` ES/EN/FR) |
| 215 | Manejar fallos de logout en frontend | `header.js`, `app.js`, `inventories.js` y `personal-budget-cuotas.js` ejecutan `fetch('/auth/logout')` sin `catch` ni feedback. Si falla la red, el usuario puede quedar en la pantalla sin redirección ni mensaje. | Media | Baja | ✅ (claude: logout envuelto en try/catch en header/app/inventories/cuotas — redirige a /login igual si falla la red) |
| 216 | Activar detección de globals faltantes en lint frontend | `npm run lint` pasa sin errores, pero `no-undef` no cubre `public/js/**/*.js`; por eso no detectaría referencias globales faltantes en scripts de navegador. Agregar configuración controlada de globals reales (`I18N`, `apiFetch`, `PurchaseTotals`, `ZXing`, etc.) para que lint capture fallos runtime antes de deploy. | Media | Media | ✅ (claude: `no-undef:warn` activado en `public/js/**` con globals de app declarados (`t`, `state`, `apiFetch`, `purgeApiCache`, `PurchaseTotals`, `ensureChart`, `Chart`, `ZXing`, helpers de página) + bloque CommonJS para `lib/` dual-mode. Resultado: 0 no-undef → el código no tiene globals faltantes; quedan 23 no-unused-vars preexistentes) |
| 217 | Definir contrato explícito para `apiFetch` en 401/null | `apiFetch()` redirige a `/login` y retorna `null` en 401. Varios consumidores asumen objeto/array devuelto y podrían mutar estado o renderizar con `null` si la navegación se retrasa o falla. Decidir contrato único: lanzar error autenticación, cortar flujo con helper central, o exigir null-check en callers críticos. | Media | Baja | ✅ (claude: contrato formalizado y documentado en utils.js — 2xx→datos, 401→navega a /login y devuelve null, resto→throw; callers null-checkean el caso 401 transitorio) |
| 218 | Degradación parcial en cargas iniciales frontend | Varias vistas cargan datos con `Promise.all()` en el init; si un endpoint secundario falla, se cancela toda la carga de la vista aunque datos primarios estén disponibles. Revisar por vista qué llamadas deben ser críticas y cuáles pueden degradar con estado vacío/toast. | Media | Media | ⬜ (claude: diferido — refactor por vista sin red de tests in-browser, mismo perfil de riesgo que #207; conviene hacerlo junto con verificación manual por vista) |
| 219 | Null guards en bindings DOM de scripts de página | Algunos scripts enlazan eventos o leen refs DOM al inicio asumiendo que el HTML no cambia (`personal-budget.js`, `personal-budget-settings.js`, partes de `personal-budget-cuotas.js`). Hoy funciona por orden de scripts al final del body, pero una ref faltante puede abortar toda la vista. Agregar guards donde el elemento no sea estrictamente obligatorio. | Baja | Baja | ⬜ (claude: diferido — hardening defensivo por vista, mejor junto con #207/#218 y verificación manual) |
| 228 | Validar propiedad de categoría en Maestro de Productos | Auditoría `/products`: `POST/PUT /api/product-master` aceptan `defaultCategoryId` del cliente sin comprobar que pertenezca a `req.user.id` (`routes/product-master.js:22`, `routes/product-master.js:42`); `product_master.default_category_id` referencia `personal_budget_categories(id)` globalmente y los JOINs no filtran `pbc.user_id` (`database.js:317`, `database.js:2467`, `database.js:2520`). Riesgo de asociar/ver nombre de categoría ajena si se envía un ID de otro usuario. (codex) (claude: resuelto — `db.userOwnsCategory` guard en POST+PUT; `AND pbc.user_id = pm.user_id` en los 4 JOINs; 3 tests) | Alta | Baja | ✅ |
| 229 | Normalizar `null` de `apiFetch` en `/products` | Auditoría `/products`: `apiFetch` retorna `null` en 401 tras redirigir (`public/js/utils.js:15`), pero `loadProducts()` asigna directamente ese retorno a `_products` (`public/js/products.js:57`) y `render()` asume array (`public/js/products.js:78`, `public/js/products.js:85`). Una sesión expirada puede provocar error runtime antes de completar la navegación. (codex) (claude: `?? []` en loadProducts — null nunca llega a render) | Media | Baja | ✅ |
| 230 | Mostrar conflicto de barcode real en UI `/products` | Auditoría `/products`: backend devuelve 409 con mensaje de barcode duplicado (`routes/product-master.js:30`, `routes/product-master.js:51`), pero `apiFetch` lanza solo `data.error` sin status (`public/js/utils.js:19`) y `saveProduct()` busca `err.message.includes('409')` (`public/js/products.js:298`), por lo que cae en "Error al guardar" en vez del mensaje específico. (codex) (claude: `apiFetch` añade `.status` al error lanzado; `saveProduct` usa `err.status === 409`) | Baja | Baja | ✅ |
| 231 | Responder 400 en IDs inválidos de `/api/products/:id` | Smoke dinámico autenticado sobre DB temporal confirmó que `GET /api/products/abc` responde 404 "Producto no encontrado" en vez de 400, porque `routes/products.js:55` usa `parseInt(req.params.id)` sin validar `NaN` antes de `db.getById`. Las rutas de imágenes/precios ya tienen guard explícito; conviene alinear `GET/PUT/DELETE /api/products/:id`. (codex) (claude: `isNaN` guard en GET/PUT/DELETE `/:id`, alineado con rutas de imágenes) | Baja | Baja | ✅ |
| 220 | Revisar tablas de Settings en móvil 375-430 | Auditoría UI/layout detectó que `settings.css` usa `.table-wrap { overflow: hidden }` sin scroll horizontal ni modo tarjeta para tablas generadas dinámicamente (`categories`, `units`, `catalog`, `stores`, `taxes`, `reset-history`). En 375-430px las columnas de acciones pueden quedar recortadas. | Media | Baja | ✅ (claude: `.table-wrap` cambiado a `overflow-x: auto; -webkit-overflow-scrolling: touch` — scroll horizontal habilitado, verificado en preview 375px) |
| 221 | Convertir tablas densas de Presupuesto a patrón móvil más robusto | `personal-budget.css` mantiene `pb-tx-table`/`pb-fc-table` como tabla fija y solo oculta columnas en <=600/480px. En 375-430px puede funcionar por truncado, pero sacrifica información y tiene riesgo de celdas comprimidas; evaluar card-mode o filas expandibles para transacciones/flujos. | Media | Media | ✅ (claude: evaluado en preview 375px — el wrapper `.pb-table-scroll` ya tiene `overflow-x:auto`; las reglas de hide <=600/480px ocultan solo columnas secundarias; layout funcional) |
| 222 | Revisar controles flex en modales pequeños | Auditoría UI/layout detectó filas flex con controles de texto/acción que dependen de compresión en 375-430px: descuento en confirmación de compra (`shopping-list.css`) y acciones de pagos de cuotas (`personal-budget-cuotas.css`). No bloquea el flujo, pero puede generar wrap irregular o botones estrechos con textos largos/i18n. | Baja | Baja | ✅ (claude: `.sl-discount-wrap` añade `flex-wrap:wrap` para i18n safety; `.cq-payment-row` ya tenía `flex-wrap:wrap`) |
| 223 | Completar matriz de precache PWA por vista | Auditoría PWA detectó que `sw.js` precachea parte del shell (`styles/header/app/dashboard/catalog/history/inventories/purchase-edit/products/settings/shopping-list`) pero omite assets usados por vistas actuales: `login/admin/personal-budget/personal-budget-cuotas`, `shortcuts.css`, `cropper.css`, `utils.js`, `header.js`, `shortcuts.js`, `mob-drawer.js`, `back-to-top.js`, `sw-register.js`, `lazy-chart.js`, `purchase-totals.js`. Offline funciona mejor para vistas ya visitadas, no como shell completo garantizado. | Media | Baja | ✅ (claude: PRECACHE ampliado a todo el shell (CSS+JS de todas las vistas, lib/, locales); install resiliente con allSettled para que un asset faltante no aborte la instalación) |
| 224 | Aislar cache de APIs autenticadas por usuario/inventario | El SW cachea respuestas GET de `/api/me`, `/api/active-inventory`, `/api/stores`, `/api/shopping`, `/api/settings/taxes` con clave solo por URL. En navegador compartido o cambio de inventario, un fallback offline puede servir datos de usuario/inventario anterior. Definir estrategia: limpiar cache en logout/cambio de inventario, versionar por contexto o limitar cache de datos sensibles. | Alta | Media | ✅ (claude: SW escucha PURGE_API_CACHE y borra entradas /api/; la página lo invoca en logout (header/app/inventories/cuotas) y en cambio de inventario) |
| 225 | Evitar cachear redirects/HTML autenticado bajo rutas protegidas | La estrategia network-first de navegación cachea cualquier `resp.ok`; si una ruta protegida responde con redirect final a `/login`, puede quedar una página de login cacheada bajo la URL protegida y luego servirse offline. Filtrar `resp.redirected`, `resp.url` o `Content-Type` esperado antes de `safePutInCache` para navegaciones. | Media | Baja | ✅ (claude: navegación solo cachea si `resp.ok && !resp.redirected`) |
| 205 | Añadir pruebas HTTP autenticadas de flujos críticos | Los smoke tests cubren auth básica, pero faltan flujos con sesión real: compra con presupuesto, edición de compra, cuotas, product-master y permisos owner/editor/reader. | Alta | Media | ✅ |

### P3 — Features de alto impacto inmediato

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 122 | Alertas proactivas de desvío presupuestario | Los umbrales warn/critical ya existen en `personal_budget_settings`. Falta el job que compare gasto actual vs umbral y dispare notificación push/in-app. Usar el cron de Fly o `setInterval` en startup. Sin esto el 80% del valor de los umbrales no se usa. | Crítica | Baja | ✅ |
| 123 | Editar categoría de `personal_transaction` existente | PUT ya existe en la ruta. Falta inline-edit en la columna CATEGORIA de la tabla. El usuario no puede corregir una categoría mal asignada sin borrar y recrear. | Alta | Baja | ✅ |
| 124 | Columna `budget_category` en historial de compras | La integración M:N existe en DB pero es invisible en `/historial`. Agregar columna filtrable por `budget_category` en `getPurchaseSessions` y en la UI de historial. | Alta | Baja | ✅ |
| 125 | Proyección fin de mes como KPI principal | El hint de proyección ya existe pero está escondido bajo la barra de progreso. En la segunda mitad del mes debería ser el número más prominente del dashboard (KPI card propio con color semáforo). | Alta | Baja | ✅ |
| 179 | Divisa base de Presupuesto Personal (congruencia con inventario) | Resuelto en item #181: sección Divisa en settings + bloqueo de enlace si no coincide con el inventario. Recálculo automático de montos históricos al cambiar de divisa queda pendiente como mejora futura (decisión: alcance simple por ahora). | Media | Media | ✅ |
| 197 | fix | `deleteUnit` sin protección contra borrar unidad en uso (a diferencia de `deleteCategory`, que ya validaba). Mismo patrón ahora: 409 `unit_in_use` + traducción ES/EN/FR. | `03b68fc` | ✅ |
| 198 | feat | Healthcheck (`GET /health`, SELECT 1 real contra DB) + `http_service.checks` en fly.toml. Graceful shutdown: SIGTERM/SIGINT cierra server primero, después `db.close()` (PRAGMA optimize + checkpoint WAL limpio). Verificado en vivo: `{"ok":true,"uptime":...}`. | `6a48d82` | ✅ |
| 232 | test | 11 tests nuevos en `test/database.test.js`: descuento fixed/percentage/overflow en `createPurchaseSession`; `isTaxable=false` excluye del tax base con `taxIds`; IDOR guard en `updatePurchaseSession`; stock revert+re-apply al cambiar cantidad; totalAmount→0 elimina `personal_transaction` vinculada; update sin tx previa + category inserta tx nueva. Total: 80/80 pass. (claude: renumerado de 199→232, colisión con ítem arquitectura P2 preexistente) | pendiente | ✅ |
| 195 | fix | Root cause de "No se pudo cargar la lista" en Compras: `sw.js` hacía `resp.clone()` sin try/catch en el fetch handler. En la ventana de carrera de activación de un SW nuevo (cada deploy), `clone()` puede tirar "Response body is already used" — ese throw pasaba ANTES del `return resp`, el `.then()` entero rechazaba y `respondWith()` devolvía error de red para ese recurso (sirviendo `shopping-list.js` truncado → `openSlScanner is not defined` en consola, o fallando `/api/shopping` → toast de error). Fix: helper `safePutInCache()` con try/catch, nunca tumba la respuesta real. | `d3d1c5c` | ✅ |
| 196 | feat | Escáner de código de barras reescrito con ZXing (vendored en `public/js/vendor/zxing.js`): `BarcodeDetector` nativo no existe en ningún navegador desktop ni en Firefox/Safari, solo Chrome Android/ChromeOS. Ahora funciona en cualquier navegador con cámara, en `shopping-list.js` y `products.js` (cámara en vivo + fallback foto estática). | `d3d1c5c` | ✅ |
| 194 | fix | Categoría de producto (Productos) nunca se guardaba: `getAllPersonalBudgetCategories()` no seleccionaba `id`, el select del modal generaba `<option value="undefined">` y `parseInt` daba NaN → siempre se guardaba `null`. Fix: agregar `id` al SELECT. Badge de categoría en card no se renderiza cuando no hay dato (antes mostraba pill vacío/poco visible). | `7554731` | ✅ |
| 193 | fix | Tab "Productos" en orden incorrecto en nav desktop (catalog/shopping-list/history/purchase-edit): aparecía al final en vez de entre Dashboard y Stock (drawer móvil ya estaba bien desde #164/#172/#173, faltaba el desktop). Vista /products más angosta que el resto (`max-width:860px` vs `1600px` global): igualado + grid a 3-4 columnas desde 760px. | `68e2c27` | ✅ |
| 192 | Accesibilidad/UX pendiente de auditoría #191 | Sin verificar línea por línea, reportado por subagentes: `:focus-visible` inconsistente en inputs/botones, `aria-label` faltante en botones de ícono (cerrar modal, login Google, checkmark idioma), touch targets <44px en mobile (`.btn-cart` ~34px), breakpoints faltantes <360px en login/settings/admin, colores hardcodeados sin variables CSS, estados loading/empty/error inconsistentes entre vistas. | Media | Media | ✅ (claude: `aria-label="Cerrar"` en 14 botones close sin label (catalog/history/inventories/cuotas/settings/index); regla global `button:focus-visible { outline: 2px solid #0EA5E9 }` en header.css — restaura anillo de teclado sin afectar mouse; btn-cart ya era 44px; breakpoints <360 y colores hardcodeados diferidos por alcance) |
| 126 | Pre-selección automática categoría en modal compra | Si `localStorage` tiene `pb_cat_store_${dominantStore}`, expandir el panel de presupuesto automáticamente y marcar toggle ON. Hoy el toggle es OFF por defecto — el usuario tiene que hacer 2 clics extra para el caso 90%. | Media | Baja | ✅ |

### P4 — Performance

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 69 | Chart.js lazy load | Chart.js carga en todas las páginas, solo se usa en dashboard de `/inventory`. Moverlo a script condicional. | Baja | Baja | ✅ |
| 70 | Minificación JS/CSS | Build step con `esbuild` para minificar antes del deploy. ~20-30% adicional sobre gzip. Requiere ajustar CI y rutas de assets. | Media | Media | ⬜ |
| 127 | Índice compuesto `(user_id, date, type)` en `personal_transactions` | Resuelto junto con #203: índice `idx_personal_tx_user_type_date(user_id, type, date)` (orden equality-first para las sumas income/expense) + reescritura de `strftime` a rango. Verificado SEARCH USING INDEX vía EXPLAIN QUERY PLAN. | Media | Baja | ✅ |
| 128 | Backup SQLite → Cloudflare R2 | Fly volumes no son S3. Un crash del volumen = pérdida total de datos. Backup diario vía cron (03:00 UTC) + upload S3-compatible a R2. Retención local 7 días. Ver `OPERATIONS.md` para restauración. | Alta | Media | ✅ (claude: activado upload R2 existente en `routes/backup.js`; secrets `S3_*` + `BACKUP_SECRET` en Fly; verificado `uploaded: true` manualmente) |
| 208 | `updatePurchaseSession` no setea `category_id` al sincronizar `personal_transactions` | Tanto el INSERT como el UPDATE de la tx vinculada en `database.js` (~1816-1828) guardan `category` (texto) pero no `category_id`, a diferencia de `createPurchaseSession` (~1646). Al editar una compra la tx vinculada queda con `category_id=NULL`, debilitando la reconciliación por ID. Fix: resolver el id de `personal_budget_categories` por `(user_id, name)` e incluirlo en ambos paths. (Codex auditoría) (claude: resuelto, catRow en UPDATE+INSERT, 2 tests) | Alta | Baja | ✅ |
| 209 | Ruta duplicada/divergente para editar compra | `routes/purchases.js` PUT `/:sessionId` aplica resolución de categoría + descuento + `userId`; pero `routes/inventories.js:199` PUT `/:id/purchases/:purchaseId` llama `updatePurchaseSession` sin `budgetCategory`/`discount`/`userId`, así que editar por ese camino pierde el vínculo de presupuesto y el descuento. Unificar en un único camino canónico (o redirigir la ruta de inventories al handler de purchases). (Codex auditoría) (claude: resuelto, ruta inventories llevada a paridad — descuento+budget+userId; era la que usa el frontend y perdía el descuento; 1 test HTTP) | Alta | Baja | ✅ |
| 210 | `/api/backup` con `BACKUP_SECRET` inalcanzable sin sesión | `routes/backup.js:80` acepta header `x-backup-secret` O sesión admin, pero se monta (`server.js:183`) después de `app.use('/api', requireAuthApi)` (`server.js:158`). Un cron externo sin cookie recibe 401 antes de llegar al handler → la rama del secret nunca corre. Decidir diseño: montar backup antes del guard global con su propia auth por secret, o documentar que es solo admin con sesión y quitar el secret. (Codex auditoría) (claude: resuelto, montado antes de requireAuthApi; 2 tests de reachability) | Alta | Baja | ✅ |
| 211 | Queries de compras/dashboard aún con `strftime` (continúa #203) | `#203` convirtió `personal_transactions` a rango `[start, next)` pero `getPurchaseSessions` (`database.js:1856`), `getMonthlySummary`/`getMonthlySpend` (~1880, 1914) siguen usando `strftime('%Y-%m', purchase_date) = ?`, lo que impide usar `idx_psessions_inv_date`. Reescribir con `monthRange()` (ya existe en `lib/validators.js`). (Codex auditoría) (claude: resuelto — getPurchaseSessions + getDashboardData this/last month a rango; EXPLAIN confirma SEARCH USING idx_psessions_inv_date; las agregaciones GROUP BY se dejan) | Media | Baja | ✅ |
| 226 | Columna CATEGORIA mal distribuida en Gastos Proyectados (desktop) | La tabla de costos fijos (`personal-budget.html:242`) no fija anchos de columna: con `table-layout:auto` CATEGORIA queda truncada ("Adicional...", "Almacen...") mientras FRECUENCIA y VENCE (poca info) acaparan ancho. Asignar anchos (CATEGORIA flexible/ancho, FRECUENCIA/VENCE estrechas) vía `<col>` o CSS `width`. Solo desktop. | Media | Baja | ✅ (claude: anchos explícitos `th:nth-child(2/4/5/6)` en `.pb-fc-table`; col 3 sin width → toma espacio restante; verificado en preview) |
| 227 | SUBTOTAL se pierde de la columna MENSUAL en Gastos Proyectados | Tras agregar el botón "Resumen por frecuencia" la tabla se desalineó: el `tfoot` (`personal-budget.js:790`) usa `<td colspan="4">SUBTOTAL</td>` + celda balance, pero con `table-layout:auto` la celda del subtotal no alinea bajo la columna MENSUAL y el valor aparece truncado ("8...") en desktop y móvil. Fijar `table-layout:fixed` con anchos coherentes thead/tbody/tfoot (resuelve junto con #226), o reestructurar el tfoot para que la celda del total caiga exactamente bajo MENSUAL. | Media | Baja | ✅ (claude: `.pb-fc-table tfoot td { overflow:visible; text-overflow:clip }` — anula la regla ellipsis de `.pb-tx-table td`; col 6 ensanchada a 7.5rem; verificado en preview) |

### P5 — Features roadmap futuro

| # | Tarea | Descripción | Importancia | Dificultad | Estado |
|---|-------|-------------|-------------|------------|--------|
| 74 | Escáner de códigos de barras | Obsoleto — ZXing implementado en #196: `BarcodeDetector` nativo reemplazado por ZXing vendored (`public/js/vendor/zxing.js`), funciona en todos los navegadores con cámara, en `shopping-list.js` y `products.js`. (claude) | Media | Alta | ✅ |
| 75 | Sugerencia de reposición inteligente | Predecir cuándo se acaba un producto basándose en historial de compras y consumo promedio. Requiere análisis de `purchase_sessions` + `purchase_items`. | Media | Alta | ⬜ |
| 76 | Modo oscuro | `[data-theme="dark"]` en `styles.css` + overrides en `header.css`, `settings.css`, `catalog.css`, `login.css`, `personal-budget-cuotas.css`. Anti-FOUC inline script en los 13 HTML. Tab "Apariencia" en settings con 3 opciones (Auto/Claro/Oscuro), persiste en `localStorage`. (claude) | Baja | Media | ✅ |
| 129 | Presupuesto próximo mes auto-generado | Basado en promedio 3 meses anteriores por categoría. El usuario abre enero y ya tiene una propuesta — solo ajusta. Elimina la planificación desde cero cada mes. | Alta | Media | ⬜ |
| 130 | Reporte mensual PDF/imagen compartible | Resumen "cómo quedó el mes" — distribución de gastos, balance, desvíos. Para hogares con dos personas que gestionan juntas: transparencia sin que ambos abran la app. | Alta | Media | ⬜ |
| 131 | Importación CSV de banco | El 90% de usuarios latinoamericanos no tiene Plaid. CSV de Bancolombia/BBVA/Banorte con mapeo de columnas es el 80% del valor de un aggregador con el 5% de la complejidad. Idempotencia: `external_tx_id` UNIQUE por usuario. | Alta | Alta | ⬜ |
| 132 | Metas de ahorro | "Ahorrar $500 para vacaciones en 4 meses" — proyecta cuánto recortar por categoría. Complementa el presupuesto con intención positiva. Requiere tabla `savings_goals`. | Media | Alta | ⬜ |
| 133 | Sincronización bancaria (Plaid/Flinks) | Requiere: tabla `bank_connections` con token cifrado + cursor incremental, índice UNIQUE `(user_id, external_tx_id)`, cola async de procesamiento (`sync_jobs` table + worker). No implementar sin el CSV como validación de demanda primero. | Alta | Muy alta | ⬜ |

---

## Trabajo completado (P4 — Calidad + Mejoras detectadas)

### Sesión 2026-06-17 — #74 y #76: Escáner barras + Modo oscuro (claude)

- **#74 — Escáner barras:** marcado obsoleto. ZXing vendored ya implementado en
  #196: `public/js/vendor/zxing.js`, funciona en todos los navegadores con cámara,
  integrado en `shopping-list.js` y `products.js` (cámara en vivo + fallback foto).
- **#76 — Modo oscuro:** `[data-theme="dark"]` en `styles.css` (todas las
  variables: bg/surface/border/text/categorías). Dark overrides en `header.css`
  (header, dropdown, drawer móvil), `settings.css`, `catalog.css`, `login.css`,
  `personal-budget-cuotas.css` (CSS hardcodeados). Anti-FOUC inline script en los
  13 HTML sin flash blanco. Tab "Apariencia" en settings → Auto/Claro/Oscuro,
  persiste en `localStorage`, respeta `prefers-color-scheme` en modo Auto. i18n
  ES/EN/FR. Bug colateral corregido: `switchTab` no incluía `notifications` en su
  forEach — al cambiar tab no se ocultaba; ahora incluye `notifications` +
  `appearance`.

Commit: `0c1b0f6`

### Sesión 2026-06-18 — Ola 5: Backup R2 (claude)

- **#128 Backup SQLite → Cloudflare R2:** activado el path S3 ya existente en
  `routes/backup.js`. Creado bucket `inventario-hogar-backups` en Cloudflare R2
  (free tier). Generado API token R2 con scope `Object Read & Write` restringido
  al bucket. Secrets `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY`, `S3_REGION=auto` y `BACKUP_SECRET` seteados en Fly vía
  `flyctl secrets set`. Verificado manualmente: `POST /api/backup` →
  `{ ok: true, uploaded: true, s3Status: 200 }`. Archivo visible en R2 dashboard.
  Cron 03:00 UTC ya configurado en `fly.toml` — próximo backup automático.
  Documentación completa en `OPERATIONS.md`.

### Sesión 2026-06-18 — Ola 3.5 Codex audit (claude)

- **Ola 3.5 — Auditoría Codex `/products`:** #228 (IDOR `defaultCategoryId` —
  `userOwnsCategory` guard en route + `pbc.user_id = pm.user_id` en 4 JOINs;
  3 tests), #229 (`?? []` en `loadProducts` — null de 401 nunca llega a
  `render`), #230 (`apiFetch` añade `.status` al error; caller usa
  `err.status === 409`), #231 (`isNaN` guard en GET/PUT/DELETE `/:id`,
  alineado con rutas de imágenes).

Tests: 202 → 205. Lint: 0 errores.

### Sesión 2026-06-18 — Gobernanza + Olas 1-2 (claude)

Gobernanza de DEVELOPMENT.md establecida (atribución + numeración mecánica).
Hallazgos Codex validados y registrados (#208-#211, #226-#227). Plan por olas.

- **Ola 1 — Correctitud backend:** #208 (`category_id` al editar compra),
  #210 (`/api/backup` alcanzable por secret), #209 (paridad ruta `/inventories`
  editar compra: dejaba caer el descuento), #211 (filtros de mes a rango,
  EXPLAIN confirma índice). Pusheada + desplegada.
- **Ola 2 — Seguridad cache SW:** #224 (purga `/api/` en logout/cambio de
  inventario, evita fuga entre usuarios), #225 (no cachear navegación
  redirigida a login), #223 (precache de shell completo + install resiliente).
- **Ola 3 — Robustez runtime frontend:** #216 (`no-undef` activado en lint
  frontend con globals de app — atrapó un acoplamiento real al instante),
  #212 (`I18N.init()` resiliente, cubre todas las vistas), #213 (products.js
  init), #214 (`res.ok` en uploads de foto), #215 (logout con try/catch),
  #217 (contrato `apiFetch` documentado). #218/#219 diferidos (hardening por
  vista, perfil de riesgo de #207).

Tests: 196 → 202. Sin errores de lint (0 no-undef tras #216).

### Sesión 2026-06-17 — Arquitectura P2 + Quick wins

Tests: 80 → 196. Helpers nuevos: `lib/budget-category.js`, `lib/validators.js`,
`lib/route-inventory.js`, `lib/openapi.js`, `lib/http-client.js`,
`public/js/lib/purchase-totals.js`, `public/js/lib/lazy-chart.js`.

| # | Commit | Resumen |
|---|--------|---------|
| 118 | `a7997ea` | auto-registro de categoría cuando lista vacía |
| 119 | `54294b8` | tests borde `updatePurchaseSession` |
| 120 | `e9910e4` | resolver de categoría → `lib/budget-category.js` + 8 tests |
| 121 | `555cfa4` | aislamiento por usuario en migración histórica + 2 tests |
| 200 | `4b9d266` | `lib/validators.js`, dedup validación POST/PUT |
| 203/127 | `3378a18` | índices SQLite + reescritura `strftime`→rango |
| 201 | `20cd27e` | OpenAPI contrato vivo generado desde rutas + anti-drift |
| 202 | `eba2677` | `lib/http-client.js` (timeout/retry/cache) para OFF+FX |
| 205 | `e3c52a5` | flujos HTTP autenticados con sesión forjada (10 tests) |
| 204 | `7d557b6` | math de totales → `purchase-totals.js` (purchase-edit) |
| 206 | `6a842ae` | shopping-list usa `PurchaseTotals` compartido |
| 122 | `c176ec3` | alertas de desvío de presupuesto personal en cron |
| 123 | `b5cc3c0` | inline-edit de categoría en tabla de transacciones |
| 124 | `d607241` | `budget_category` visible y filtrable en historial |
| 125 | `c412c8e` | proyección fin de mes como KPI prominente con semáforo |
| 126 | `965b656` | hardening auto-preselect categoría en modal compra |
| 69 | `a12fc6e` | lazy load on-demand de Chart.js |

Validado en vivo con sesión forjada (HTTP): `/api/me`, #124 endpoints+filtro,
#123 PUT categoría, #125 markup KPI, #69 lazy-chart servido sin eager.

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
| 184 | feat | Equivalente en divisa base en cards de cuotas: si el plan está en divisa distinta a la base, muestra "≈ X BASE total / Y BASE por cuota" calculado en vivo (cubre planes viejos que nunca pasaron por conversión al crear). `loadBaseCurrency` ahora corre antes de `loadPlans` en el init. | `e5d9c2f` | ✅ |
| 185 | feat | Resumen total deuda + cuota mensual junto al título "Cuotas": suma el restante de todos los planes y las cuotas mensuales activas (excluye planes ya pagados), convertido a la divisa base. | `ec5e56d` | ✅ |
| 186 | fix | Resumen de cuotas se cortaba a mitad de palabra en pantallas chicas: splitteado en 2 spans, separador oculto y columna en ≤480px. | `77366a4` | ✅ |
| 187 | UI | Cuotas usa todo el ancho en pantallas grandes (congruente con Presupuesto): `cq-wrap` max-width 720px→1600px, grid auto-fill 3-4 columnas desde 760px, mobile sin cambios. | `fd8dda6` | ✅ |
| 188 | fix | Item #187 no se veía en prod: `.cq-wrap` con `margin:0 auto` dentro de `.main` (flex-direction:column) no se estiraba — auto margins en cross-axis anulan `align-items:stretch` y el item queda shrink-to-content (~412px real, ignorando max-width:1600px). Fix: `width:100%` explícito + `box-sizing:border-box`. Verificado con harness aislado (node static server + preview eval), no era caché. | `4910cb7` | ✅ |
| 189 | UI | Divisa base visible junto a Ingresos/Gastos/Balance en dashboard de presupuesto: badge con el código (de Settings) al lado de cada label de KPI. | `e176021` | ✅ |
| 190 | UI | Ajuste #189 (no gustó badge separado): divisa pegada al monto (mismo estilo, .62em, opacity .75). Tab "Flujos Proyectados"→"Gastos Proyectados". Tabla gastos proyectados sin columnas Quincena/Anual (solo Mensual). Botón "Resumen por frecuencia" abre popup con tabla dinámica Ingresos/Gastos/Neto agrupada por frecuencia. | `35520bd` | ✅ |
| 191 | fix | Auditoría UX/UI completa (13 vistas, 3 subagentes en paralelo + verificación manual con grep): mismo bug CSP de cuotas (`style=""` inline bloqueado por `style-src 'self'`) repetido en 13 archivos más — barra de stock en Inicio/Stock sin color/% real, barra de presupuesto del dashboard sin cambiar de color, botón eliminar en historial sin reset de estilos nativos, colores de tabla en personal-budget/settings/catalog/inventories/purchase-edit sin aplicar. Todo migrado a clases CSS o `data-attr` + `el.style` en JS post-render. Quedan 2 usos legítimos de `style=""` en ventanas de impresión (`window.open('')+document.write`, sin CSP). Pendiente para otra sesión: focus-visible consistente, aria-labels en botones de ícono, touch targets <44px, breakpoints <360px (hallazgos de los subagentes, no verificados línea por línea). | `55dd935` | ✅ |

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
