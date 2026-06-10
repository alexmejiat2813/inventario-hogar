# Changelog

## [Unreleased]

## [1.0.0] — 2026-06-10

### Added
- Push notifications al celular con web-push + VAPID keys (#54)
- Cron Fly.io cada hora para alertas de vencimientos, stock crítico y presupuesto (#55)
- Structured logging con pino (JSON en prod, pretty en dev) (#P1.4)
- OpenAPI 3.0 spec en `/openapi.json` (#P1.3)
- Test coverage reporting con c8 (#P1.2)
- SW cache versioning dinámico desde package.json o FLY_COMMIT_SHA (#P1.1)
- `header.js` módulo compartido: extrae initProfileMenu + loadProfileAvatar (#P0.3)
- Trust proxy habilitado en todos los ambientes para rate limiter (#16)
- i18n para expiryInfo() en app.js (#18)
- customItems incluidos en export de lista de compras (#19)
- Categorías unificadas data-driven en todas las vistas con íconos (#53)
- Catálogo i18n: 100 productos con keys ES/EN/FR (#52)
- Fix: productos del catálogo no reaparecen tras deploy (#51)
- Métricas de uso para super admin con ADMIN_EMAILS (#50)
- Botón Ver (solo lectura) separado de Editar en Stock (#48)
- Sub-pestañas En stock / Fuera de stock con contadores (#47)
- Header unificado en Catálogo con hamburguesa y avatar (#46)
- Fix: plantillas de compras no se guardaban (db.transaction inexistente) (#49)

## [0.9.0] — 2026-05-15

### Added
- Deploy en Fly.io con volumen persistente + CI/CD GitHub Actions (#27 #28)
- Security headers: CSP, nosniff, X-Frame-Options, HSTS (#44)
- Uploads privados: solo miembros del inventario (#27)
- Rate limiting en auth (20/15min) y API (200/min) sin dependencias externas (#13)
- Audit log de actividad por inventario (últimas 30 acciones) (#14)
- Session store persistente en SQLite (sobrevive reinicios) (#3)
- Trust proxy para rate limiter detrás de nginx/Fly (#16)
- Test suite: 53 tests con node:test sin dependencias externas (#15)

### UI
- Resumen en card de inventario (críticos, presupuesto, progreso)
- Stepper de stock en card (−/+/input, paso por unidad)
- Dashboard por período (mes/3m/6m/año) con gráficas
- Fotos en lista de compras — popup/carrusel
- Rediseño tabla lista de compras, grid stock 2-col en móvil
- Header unificado en todas las vistas con drawer móvil

## [0.8.0] — 2026-04-20

### Added
- Export historial de compras a PDF y CSV (#11)
- PWA offline para lista de compras con Service Worker (#12)
- Items libres en lista de compras (ad-hoc, custom_shopping_items) (#8)
- Renombrar y eliminar inventario (solo owner, cascade) (#9)
- Cambio de rol de miembros existentes (solo owner) (#10)
- Alertas de vencimiento en dashboard (badge expired/urgent/soon/ok) (#4)
- Sistema de presupuesto mensual con alertas por porcentaje
- Recorte de fotos con Cropper.js (cámara o galería)
- Auto-reload al actualizar SW

### Fixed
- Dropdown establecimientos vacío en lista de compras (race condition) (#7)
- Filtros período dashboard no filtraban gráficas (#16)

## [0.7.0] — 2026-03-10

### Added
- Multi-language: ES / EN / FR en toda la aplicación
- Settings: gestión dinámica de categorías, unidades, catálogo
- Historial de compras completo (PDF, WhatsApp, clipboard)
- Dashboard con estadísticas (gasto mensual, por categoría, top 5)
- Sistema de impuestos (IVA, GST, HST, etc.)
- Plantillas de lista de compras recurrentes
- Comparación de precios por tienda en modal de producto
- Historial de precios por producto (chart)
- Fotos de referencia por producto

## [0.6.0] — 2026-02-01

### Added
- Lista de compras automática desde stock bajo mínimo
- Catálogo de 100 productos predefinidos
- Sistema de inventarios múltiples con roles (owner/editor/reader) e invitaciones
- Google OAuth 2.0
- PWA instalable con manifest.json
- Menú desplegable de perfil con avatar

### Fixed
- MVC: separar server.js monolítico en routes/ y middleware/ (#2)
- Tabla taxes → tax_types en createPurchaseSession (#1)
