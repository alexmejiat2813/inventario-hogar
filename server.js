require('dotenv').config({ override: true });
const express     = require('express');
const path        = require('path');
const session     = require('express-session');
const passport    = require('./auth');
const compression = require('compression');

const { requireAuthApi, requireAdmin } = require('./middleware/auth');
const { requireInventory }  = require('./middleware/inventory');
const SQLiteStore           = require('./middleware/session-store');
const { createRateLimiter } = require('./middleware/rate-limit');
const { securityHeaders }   = require('./middleware/security-headers');
const db                    = require('./database');
const logger                = require('./logger');

const app  = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Cache version: package.json or FLY_COMMIT_SHA or timestamp
const pkg = require('./package.json');
const CACHE_VERSION = process.env.FLY_COMMIT_SHA?.slice(0, 7) || pkg.version;

// En produccion el SESSION_SECRET es obligatorio: nunca arrancar con el
// fallback debil 'dev-secret' (sesiones falsificables).
if (IS_PROD && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET es requerido en producción');
}

// Uploads dir — overridable so it can live on a persistent volume in production
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'public', 'uploads');

// Behind a reverse proxy (Fly.io, Render, nginx): trust X-Forwarded-* headers
// so secure cookies and req.ip (rate limiter) work correctly.
app.set('trust proxy', 1);

app.use(compression());

// ── Request logging ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const lvl = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[lvl]({ method: req.method, url: req.originalUrl, status: res.statusCode, ms });
  });
  next();
});

// ── Core middleware ────────────────────────────────────────────────────────────
app.use(securityHeaders(IS_PROD));
app.use(express.json());

app.use(session({
  store:             new SQLiteStore(),
  secret:            process.env.SESSION_SECRET || 'dev-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   IS_PROD,          // HTTPS-only cookie in production
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// Invalidate sessions from the pre-multi-inventory version (id was a Google string)
app.use((req, res, next) => {
  if (req.user && typeof req.user.id !== 'number') return req.logout(() => next());
  next();
});

// ── Static assets ──────────────────────────────────────────────────────────────
app.use('/css',     express.static(path.join(__dirname, 'public/css')));
app.use('/js',      express.static(path.join(__dirname, 'public/js')));
app.use('/locales', express.static(path.join(__dirname, 'public/locales')));
// Uploads: privados. Solo miembros del inventario dueño del archivo pueden
// verlo. Las <img> mandan la cookie de sesion, asi que la auth funciona.
// Defensa en profundidad: CSP sandbox + nosniff por si un archivo se cuela.
app.use('/uploads', requireAuthApi, (req, res) => {
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.set('X-Content-Type-Options', 'nosniff');

  const rel      = req.path.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(UPLOADS_DIR, rel));
  // Guard anti path-traversal: el archivo debe quedar dentro de UPLOADS_DIR
  if (filePath !== UPLOADS_DIR && !filePath.startsWith(UPLOADS_DIR + path.sep)) {
    return res.status(400).end();
  }

  const webPath = '/uploads/' + rel;
  const invId   = db.getUploadOwnerInventory(webPath);
  if (!invId) return res.status(404).end();
  if (!db.getMember(invId, req.user.id)) return res.status(403).end();

  res.sendFile(filePath, err => {
    if (err && !res.headersSent) res.status(404).end();
  });
});
app.use('/icons',   express.static(path.join(__dirname, 'public/icons')));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'public/manifest.json')));
// sw.js siempre revalidado: el browser debe ver al instante un SW nuevo tras deploy
app.get('/sw.js', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public/sw.js'));
});

// Cache version endpoint — SW la obtiene para versionar el CACHE
app.get('/cache-version', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('text/plain').send(`ih-v${CACHE_VERSION}`);
});

// OpenAPI spec endpoint
app.get('/openapi.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'openapi.json'));
});

// ── Rate limiting ──────────────────────────────────────────────────────────────
// Auth: 20 req / 15 min / IP  — prevents OAuth abuse
app.use('/auth', createRateLimiter({
  windowMs:  15 * 60 * 1000,
  max:       20,
  keyPrefix: 'auth',
  message:   'Demasiados intentos. Intentá de nuevo en 15 minutos.',
}));

// API: 200 req / min / IP  — blocks bots/scrapers, generous for real users
app.use('/api', createRateLimiter({
  windowMs:  60 * 1000,
  max:       200,
  keyPrefix: 'api',
  message:   'Demasiadas solicitudes. Intentá más tarde.',
}));

// ── Auth & page routes ─────────────────────────────────────────────────────────
app.use(require('./routes/auth'));
app.use(require('./routes/pages'));

// ── API: all routes require authentication ─────────────────────────────────────
app.use('/api', requireAuthApi);

app.use('/api',              require('./routes/me'));
app.use('/api/admin',        requireAdmin, require('./routes/admin'));
app.use('/api/inventories',  require('./routes/inventories'));
app.use('/api/catalog',      require('./routes/catalog'));
app.use('/api/notifications', require('./routes/notifications'));

// Routes below require an active inventory in session
app.use(
  ['/api/products', '/api/stats', '/api/shopping', '/api/stores',
   '/api/purchases', '/api/settings/taxes', '/api/budget', '/api/templates'],
  requireInventory
);

app.use('/api/products',  require('./routes/products'));
app.use('/api/stats',     require('./routes/stats'));
app.use('/api/shopping',  require('./routes/shopping'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/stores',    require('./routes/stores'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/budget',    require('./routes/budget'));
app.use('/api/settings',  require('./routes/settings'));

// ── API 404 ────────────────────────────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error');
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Inventario Hogar started');
  });
}

module.exports = app;
