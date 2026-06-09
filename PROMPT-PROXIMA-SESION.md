# Prompt para la próxima sesión — 4 bugs/features pendientes

> Pegá este archivo (o su contenido) como primer mensaje en la nueva sesión.
> Proyecto: `inventario-hogar` (Node 24 + Express 4 + `node:sqlite` + Vanilla JS PWA).

## Contexto del proyecto (leer primero)

- **Arquitectura**: `routes/` por dominio, `middleware/`, `database.js` (capa de datos, sin ORM). `server.js` delgado.
- **Frontend**: Vanilla JS, una página HTML por vista con CSS **inline** en `<style>` (deuda conocida, ver `AUDIT.md` #9). i18n en `public/locales/{es,en,fr}.json` — agregar keys en los 3 idiomas siempre.
- **Deploy**: trabajar en `develop` → merge a `master` → GitHub Action corre `npm test` (gate) → `flyctl deploy`. Prod: https://inventario-hogar-alex.fly.dev
- **Service Worker**: cache `ih-vNN` en `public/sw.js` (actual **v21**). **Bumpear el número en CADA deploy** que toque assets, para disparar el auto-reload (`controllerchange` en `i18n.js`). Páginas se sirven `no-cache`.
- **Tests**: `npm test` (39 tests, `node:test`). Mantener verde.
- **Convenciones**: commits en español (`feat:`/`fix:`/`refactor:`/`chore:`). Sin emojis/em-dashes en código/commits. No agregar deps npm sin necesidad real.
- **Lección aprendida**: cuidado con **especificidad CSS** — `.sl-table tbody > tr` pisó `.sl-row{display:grid}`. Si un estilo no aplica, revisar reglas más específicas antes de culpar al cache.

---

## #1 — Al dar OK a la foto del producto, a veces vuelve al Dashboard

**Síntoma**: en Stock, editar producto → tomar/elegir foto → recortar → OK. A veces la pantalla se cierra o salta a la pestaña Dashboard, perdiendo el modal.

**Archivos**:
- `public/js/cropper.js` — `openCropper(file)` (overlay propio, `onOk` hace `canvas.toBlob` → resuelve File).
- `public/js/app.js` — `handleModalFileInputChange` (async, recorre archivos por el cropper), `switchTab()`, `loadData()`.
- `public/index.html` — modal de producto (`#fg-photos`, `#modal-file-input`, `#modal-camera-input`), tabs Dashboard/Stock.

**Hipótesis principal**: en Android, al abrir la cámara (input `capture`), el SO puede **descartar la página PWA de memoria**; al volver, la página **se recarga** y cae en la vista por defecto (Dashboard), perdiendo el modal abierto. No es el cropper en sí.

**Aprox. sugerida**:
1. Reproducir en móvil: ver si la URL/estado se resetea tras volver de la cámara (escuchar `pagehide`/`visibilitychange`).
2. Si es eviction: persistir estado mínimo (producto en edición + pestaña activa) en `sessionStorage` y restaurarlo en `init()`; o evitar `capture` directo y usar el selector que no mata la página.
3. Confirmar que ningún botón del cropper o del modal sea `type="submit"` dentro de un `<form>` (revisar `index.html` `#product-form`).

---

## #3 — Unificar el header del Catálogo con el header normal

**Síntoma**: el header de Catálogo es el viejo (`< Inventario` + título + botón "Agregar al catálogo"). Las vistas normales (Stock/Compras) tienen el header unificado: logo `IH`, breadcrumb, **menú hamburguesa** (drawer móvil) y **avatar de perfil**. Hay que unificar.

**Archivos**:
- `public/catalog.html` — header actual en ~líneas 332-344 (`<header class="header">`).
- Referencia del header unificado + drawer: `public/shopping-list.html` (header + `.mob-ham` + drawer `.mob-overlay`/`.mob-drawer` + avatar `#profile-btn`) y `public/css/header.css` (ya define `.mob-ham`, `.profile-menu-wrap`).
- `public/js/shopping-list.js` — `initProfileMenu()` y los handlers del drawer móvil (toggle, items). `public/js/catalog.js` necesita el mismo wiring.

**Aprox. sugerida**:
1. Copiar el bloque de header unificado + drawer de `shopping-list.html` a `catalog.html` (marcar la pestaña/contexto de Catálogo). Conservar el botón "Agregar al catálogo" dentro del nuevo header o en la barra de acciones.
2. Verificar que `catalog.html` linkee `header.css`.
3. Portar `initProfileMenu()` + handlers del drawer a `catalog.js` (o extraer a un módulo compartido para no duplicar — ideal).
4. i18n de cualquier texto nuevo (ES/EN/FR).

---

## #4 — Pestañas "En stock" / "Fuera de stock"

**Motivo**: al bajar un producto a 0 desaparece de Stock (solo queda en Compras). Si fue por error, **no se puede subir la cantidad de vuelta** porque ya no se ve en Stock. Solución: dos sub-pestañas en la vista Stock.

**Comportamiento deseado**:
- Pestaña **En stock**: productos con `current_qty > 0` (incluye los críticos `current_qty < min_qty` pero > 0).
- Pestaña **Fuera de stock**: productos con `current_qty === 0`. Siguen editables (stepper +/−) para poder devolverlos a stock.
- La lista de **Compras** no cambia (sigue mostrando `current_qty < min_qty`).

**Archivos**:
- `public/js/app.js` — `filteredProducts()` (~línea 255, hoy filtra `current_qty > 0`). Agregar estado `state.stockTab` ('in' | 'out') y filtrar según pestaña. `renderProducts()`, `switchTab()`.
- `public/index.html` — panel Stock (`#panel-stock`): agregar el toggle de 2 pestañas.
- i18n ES/EN/FR para los labels.

**Aprox. sugerida**: sub-tabs dentro del panel Stock; `filteredProducts()` aplica `tab==='out' ? qty===0 : qty>0`. Mostrar contador por pestaña. El stepper ya existe y permite subir la cantidad.

---

## #7 — Botón "Ver" separado de "Editar" en Stock

**Motivo**: la info del producto (dónde se compró, historial de precios, precios por tienda) hoy solo se ve abriendo **Editar**. Debería haber un botón **Ver** (solo lectura).

**Archivos**:
- `public/js/app.js` — `renderProductCard()` (~línea 322, acción editar abre modal). Secciones de detalle: `#fg-price-chart`, `#fg-store-prices` (cargadas en el modal de edición). Funciones `openProductPhotoViewer`, price history (`/api/products/:id/price-history`, `/api/products/:id/store-prices`).
- `public/index.html` — modal de producto.

**Aprox. sugerida**:
1. Agregar botón "Ver" (ícono ojo) en la card, visible para todos (incluido rol reader).
2. Abrir un modal/vista **read-only** que muestre: datos del producto, fotos, historial de precios y precios por tienda — sin inputs editables.
3. "Editar" queda solo para owner/editor (ya hay `state.inventory.role`).
4. Reutilizar los renders de price-chart/store-prices existentes para no duplicar.
5. i18n ES/EN/FR ("Ver"/"View"/"Voir").

---

## Checklist al terminar cada bug
1. `npm test` verde (agregar test si aplica).
2. Bump `ih-vNN` en `sw.js`.
3. Commit en `develop` → merge `master` → esperar CI (test + deploy) success.
4. Actualizar `DEVELOPMENT.md` (mover a completado) y `AUDIT.md` si aplica.
