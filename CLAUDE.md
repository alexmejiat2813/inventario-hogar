## Approach
- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes in code or commits.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

## Development Tracking

**SIEMPRE al iniciar una sesión de trabajo:**
1. Leer `DEVELOPMENT.md` en la raíz del proyecto
2. Identificar el próximo ítem pendiente (⬜)
3. Marcar ese ítem como `🔄 En progreso` en el documento ANTES de empezar
4. Agregar cualquier bug o feature nuevo descubierto durante el trabajo a la tabla "Mejoras detectadas"
5. Al completar, mover a tabla "Trabajo completado" con el commit y marcar `✅ Hecho`

No iniciar trabajo sin actualizar DEVELOPMENT.md primero.

## Stack del proyecto

- Node.js + Express 4 + SQLite (`node:sqlite`) — sin ORM
- Vanilla JS frontend (sin framework)
- Google OAuth via Passport
- Arquitectura: `routes/`, `middleware/`, `database.js`
- Tests: ninguno todavía

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `server.js` | Entry point — monta middleware y routers (~62 líneas) |
| `database.js` | Capa de datos completa — schema + migrations + todos los métodos |
| `routes/` | Un archivo por dominio (products, purchases, shopping, etc.) |
| `middleware/` | auth, inventory guards, upload, validate, rate-limit, session-store |
| `public/js/app.js` | JS principal del inventario (stock + dashboard) |
| `public/js/shopping-list.js` | Lista de compras con registro de compra |
| `public/js/history.js` | Historial de compras |
| `DEVELOPMENT.md` | Tracking de tareas — leer y actualizar en cada sesión |

## Convenciones

- Commits en español con prefijos: `feat:`, `fix:`, `refactor:`, `chore:`
- Rutas API: `/api/{recurso}` con requireInventory aplicado en server.js para rutas que lo necesitan
- i18n: agregar keys en ES + EN + FR siempre que se agregue texto visible
- No agregar dependencias npm sin necesidad real — preferir soluciones con node built-ins
