require('dotenv').config({ override: true });
const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const passport = require('./auth');

const { requireAuthApi }    = require('./middleware/auth');
const { requireInventory }  = require('./middleware/inventory');
const SQLiteStore           = require('./middleware/session-store');
const { createRateLimiter } = require('./middleware/rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Uploads dir — overridable so it can live on a persistent volume in production
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'public', 'uploads');

// Behind a reverse proxy (Fly.io, Render, nginx): trust X-Forwarded-* headers
// so secure cookies and req.ip (rate limiter) work correctly.
if (IS_PROD) app.set('trust proxy', 1);

// ── Core middleware ────────────────────────────────────────────────────────────
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
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/icons',   express.static(path.join(__dirname, 'public/icons')));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'public/manifest.json')));
app.get('/sw.js',         (req, res) => res.sendFile(path.join(__dirname, 'public/sw.js')));

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
app.use('/api/inventories',  require('./routes/inventories'));
app.use('/api/catalog',      require('./routes/catalog'));

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
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n🏠  Inventario Hogar');
    console.log(`📡  Servidor corriendo en http://localhost:${PORT}`);
    console.log('     Presiona Ctrl+C para detener\n');
  });
}

module.exports = app;
