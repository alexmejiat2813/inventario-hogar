require('dotenv').config();
const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const passport = require('./auth');
const db       = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

const VALID_CATEGORIES = ['Alimentos', 'Aseo', 'Alacena', 'Bebidas', 'Otros'];
const VALID_UNITS = ['unidades','kg','g','lt','ml','paquetes','cajas','bolsas','latas','botellas'];

function validate({ name, category, current_qty, min_qty, unit }) {
  if (!name?.trim())                        return 'El nombre es requerido';
  if (!VALID_CATEGORIES.includes(category)) return 'Categoría inválida';
  if (current_qty == null || isNaN(+current_qty) || +current_qty < 0) return 'Cantidad actual inválida';
  if (min_qty == null || isNaN(+min_qty) || +min_qty < 0)            return 'Cantidad mínima inválida';
  if (!VALID_UNITS.includes(unit))          return 'Unidad inválida';
  return null;
}

// ── Core middleware ────────────────────────────────────────────────────────────
app.use(express.json());

app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Public routes ──────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=1' }),
  (req, res) => res.redirect('/')
);

app.post('/auth/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect('/login'));
  });
});

// ── Public static assets (CSS + JS needed by the login page too) ───────────────
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js',  express.static(path.join(__dirname, 'public/js')));

// ── Auth guards ────────────────────────────────────────────────────────────────
function requireAuthPage(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

function requireAuthApi(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'No autenticado' });
}

// ── Main app (protected) ───────────────────────────────────────────────────────
app.get('/', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── API (all routes protected by single guard) ─────────────────────────────────
app.use('/api', requireAuthApi);

// Current user
app.get('/api/me', (req, res) => res.json(req.user));

// Products
app.get('/api/products', (req, res) => {
  try {
    const { category } = req.query;
    const products = category ? db.getByCategory(category) : db.getAll();
    res.json(products);
  } catch {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.getById(parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    const { name, category, current_qty, min_qty, unit } = req.body;
    const product = db.create({ name: name.trim(), category, current_qty: +current_qty, min_qty: +min_qty, unit });
    res.status(201).json(product);
  } catch {
    res.status(500).json({ error: 'Error al crear el producto' });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    const { name, category, current_qty, min_qty, unit } = req.body;
    const product = db.update(parseInt(req.params.id), {
      name: name.trim(), category, current_qty: +current_qty, min_qty: +min_qty, unit,
    });
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const ok = db.remove(parseInt(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    res.json(db.getStats());
  } catch {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

app.listen(PORT, () => {
  console.log('\n🏠  Inventario Hogar');
  console.log(`📡  Servidor corriendo en http://localhost:${PORT}`);
  console.log('     Presiona Ctrl+C para detener\n');
});
