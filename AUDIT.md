# Auditoría del proyecto — Inventario Hogar

> Revisión técnica completa: estado actual, qué está bien, qué corregir, malas prácticas y roadmap futuro.
> Fecha: 2026-06-05

---

## Resumen ejecutivo

Proyecto sólido para su tamaño. Arquitectura MVC limpia, SQL parametrizado, autorización por inventario bien aplicada (sin IDOR en products), rate limiting propio, tests, i18n trilingüe, PWA con SW network-first. No hay deuda técnica grave. Las mejoras son de robustez (headers de seguridad, privacidad de uploads), cobertura de tests y features.

Veredicto: **bueno**. Listo para uso real; endurecer seguridad antes de exponer a usuarios externos.

---

## Lo que está BIEN

- **SQL 100% parametrizado** (`db.prepare(...).run/get/all`). Sin concatenación → sin inyección SQL.
- **Autorización defensiva**: cada ruta de `products` valida `p.inventory_id === req.inventoryId` antes de leer/editar/borrar. No hay IDOR.
- **Roles** (owner/editor/reader) con middlewares `requireEditorOrOwner` / `requireOwner` aplicados.
- **Arquitectura MVC** clara: `routes/` por dominio, `middleware/`, `database.js` como capa de datos. `server.js` delgado (~125 líneas).
- **SQLite robusto**: WAL + `foreign_keys = ON`. Driver `node:sqlite` estable en Node 24.
- **Rate limiting** propio sin dependencias (auth 20/15min, API 200/min).
- **Sesiones persistentes** en SQLite (sobreviven reinicios), cookie `httpOnly` + `secure` en prod + `sameSite: lax`.
- **Audit log** de acciones por inventario.
- **PWA**: SW network-first para shell, `Cache-Control: no-cache` en páginas + sw.js, auto-reload por `controllerchange`.
- **i18n** ES/EN/FR consistente.
- **Tests**: 37 (25 unit DB + 12 smoke HTTP), incluye regresión P0.
- **Uploads validados**: límite 5MB + fileFilter por mimetype, filenames aleatorios.
- **Deploy**: Docker (Node 24) + Fly.io + CI auto-deploy, volumen persistente para DB y uploads.

---

## Lo que se debe CORREGIR (priorizado)

### P1 — Seguridad

1. ~~**Sin headers de seguridad.**~~ ✅ RESUELTO (`middleware/security-headers.js`): CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, COOP, HSTS (prod), Permissions-Policy. Sin dependencia. CSP usa `'unsafe-inline'` por ahora (CSS/scripts inline); endurecer tras migrar CSS a archivos (#9).

2. **SVG subido = XSS almacenado.** `uploadProductImage` acepta `image/svg+xml` (regex `/^image\//`). Un SVG con `<script>` servido desde `/uploads/...` ejecuta en el origin si se abre la URL directa.
   - Fix: rechazar SVG en el fileFilter, o servir uploads con `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.

3. **Uploads públicos sin auth.** `/uploads` es `express.static` abierto. Fotos de productos y **recibos** (pueden tener datos personales) son accesibles por URL sin sesión. Filenames aleatorios mitigan pero no es control de acceso.
   - Fix: servir uploads tras `requireAuthApi` + verificación de pertenencia al inventario, o firmar URLs.

4. **`SESSION_SECRET` con fallback `'dev-secret'`.** Si en prod falta el env var, arranca con secreto débil silenciosamente.
   - Fix: en prod, `throw` si `!process.env.SESSION_SECRET`.

### P2 — Robustez

5. **Error handler filtra `err.message` al cliente** (`server.js`). Puede exponer detalles internos.
   - Fix: mensaje genérico en prod, log completo en servidor.

6. **Validación de mimetype confiable.** `fileFilter` confía en el header `Content-Type` enviado por el cliente (falsificable). No es crítico (no se ejecuta), pero combinar con validación de magic bytes sería ideal.

7. **`express.json()` sin límite explícito.** Default 100kb está bien, pero conviene declararlo (`limit: '100kb'`) para que sea intencional.

8. **Sin índices declarados** en tablas grandes (products.inventory_id, purchase_sessions.inventory_id, purchase_items.session_id). SQLite hace scans; con pocos datos no se nota, escala mal.
   - Fix: `CREATE INDEX` en FKs y columnas de filtro frecuente.

### P3 — Mantenibilidad

9. **CSS inline gigante en cada HTML.** Cientos de líneas de `<style>` por página → duplicación, difícil de mantener, y fue la causa del bug de especificidad de esta sesión. Migrar a archivos `/css/*.css` (revalidados por el browser) reduce el HTML y centraliza estilos.

10. **Sin linter/formatter** (ESLint/Prettier) ni pre-commit hook. Un `eslint` atraparía cosas como reglas CSS conflictivas no, pero sí JS muerto/uso de vars.

11. **Cobertura de tests baja en lógica de negocio**: budget, shopping list, purchases, autorización IDOR no tienen tests. El bug del card móvil no era testeable (CSS) pero la lógica sí.

12. **Números mágicos repetidos** (límite 5 fotos, 5MB) en frontend y backend sin constante compartida.

---

## Malas prácticas detectadas

- **CSS inline masivo** (ver #9) — la peor; rompe DRY y dificulta el cascade.
- **Símbolos de moneda duplicados** (`CURRENCY_SYMBOLS`) en `app.js`, `shopping-list.js`, `inventories.js`. Centralizar en un módulo compartido.
- **`catch {}` que se traga el error** en varias rutas (`catch { res.status(500)... }`) — pierde el detalle para debug. Loguear antes de responder.
- **Strings hardcodeados** en algunas tablas (thead de la lista de compras en español fijo) conviviendo con i18n — inconsistencia.
- **Versionado manual del SW** (`ih-vN` bump a mano cada deploy) — error-prone. Generar el cache name del hash del build o timestamp en CI.

---

## Futuros desarrollos sugeridos

### Funcionalidad
- **Notificaciones push** de stock crítico / presupuesto excedido (ya hay SW; falta Web Push + suscripción).
- **Búsqueda y filtros** en historial de compras (por tienda, rango de fechas, producto).
- **Sugerencia de reposición inteligente**: predecir cuándo se acaba un producto según consumo histórico.
- **Comparador de precios por tienda** ampliado (ya hay `getProductStorePrices`) → recomendación de dónde comprar más barato.
- **Códigos de barras**: escanear para agregar/identificar productos (cámara ya integrada).
- **Exportar/importar inventario** (CSV/JSON) para backup del usuario.
- **Modo oscuro**.

### Técnico
- **Migrar CSS inline a archivos** (#9).
- **Suite de tests de autorización** (IDOR cross-inventory) y de lógica de budget/shopping.
- **Headers de seguridad + CSP** (#1) y auto-hospedar Chart.js (quitar dependencia de CDN, mejora offline real).
- **Índices SQLite** (#8).
- **CI**: agregar `npm test` como gate ANTES del deploy (hoy el deploy no corre tests).
- **Versionado automático del SW** en build.
- **Observabilidad**: structured logging + error tracking (Sentry o similar).
- **Backups automáticos** del volumen SQLite (snapshot Fly o dump programado).

---

## Quick wins (alto impacto, bajo esfuerzo)

1. `throw` si falta `SESSION_SECRET` en prod.
2. Rechazar SVG en upload + `X-Content-Type-Options: nosniff` en `/uploads`.
3. Helmet con CSP básica.
4. `CREATE INDEX` en FKs.
5. `npm test` como gate en el GitHub Action antes de `flyctl deploy`.
