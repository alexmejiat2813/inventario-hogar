require('dotenv').config();
const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const passport = require('./auth');
const db       = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

const VALID_CATEGORIES = ['Alimentos','Aseo','Alacena','Bebidas','Otros'];
const VALID_UNITS = ['unidades','kg','g','lt','ml','paquetes','cajas','bolsas','latas','botellas'];

function validateProduct({ name, category, current_qty, min_qty, unit }) {
  if (!name?.trim())                        return 'El nombre es requerido';
  if (!VALID_CATEGORIES.includes(category)) return 'Categoría inválida';
  if (current_qty == null || isNaN(+current_qty) || +current_qty < 0) return 'Cantidad actual inválida';
  if (min_qty    == null || isNaN(+min_qty)    || +min_qty    < 0) return 'Cantidad mínima inválida';
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

// Invalidate sessions from the pre-multi-inventory version (id was a Google string)
app.use((req, res, next) => {
  if (req.user && typeof req.user.id !== 'number') {
    return req.logout(() => next());
  }
  next();
});

// ── Auth guards ────────────────────────────────────────────────────────────────
function requireAuthPage(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}
function requireAuthApi(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'No autenticado' });
}

// ── Inventory guards ───────────────────────────────────────────────────────────
// Used by product/stats routes — reads activeInventoryId from session
function requireInventory(req, res, next) {
  const id = req.session.activeInventoryId;
  if (!id) return res.status(400).json({ error: 'No hay inventario activo' });
  const member = db.getMember(id, req.user.id);
  if (!member) {
    req.session.activeInventoryId = null;
    return res.status(403).json({ error: 'Sin acceso al inventario' });
  }
  req.inventoryId = id;
  req.userRole    = member.role;
  next();
}
function requireEditorOrOwner(req, res, next) {
  if (req.userRole === 'owner' || req.userRole === 'editor') return next();
  res.status(403).json({ error: 'Se requiere rol de editor o dueño' });
}

// Used by /api/inventories/:id/* routes — checks membership in req.params.id
function requireMember(req, res, next) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  const member = db.getMember(id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Sin acceso al inventario' });
  req.inventoryId = id;
  req.userRole    = member.role;
  next();
}
function requireOwner(req, res, next) {
  if (req.userRole === 'owner') return next();
  res.status(403).json({ error: 'Solo el dueño puede realizar esta acción' });
}

// ── Public routes ──────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/inventories');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=1' }),
  (req, res) => res.redirect('/inventories')
);
app.post('/auth/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect('/login'));
  });
});

// ── Static assets (accessible without auth — needed by login page too) ─────────
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js',  express.static(path.join(__dirname, 'public/js')));

// ── Protected pages ────────────────────────────────────────────────────────────
app.get('/', requireAuthPage, (req, res) => res.redirect('/inventories'));

app.get('/inventories', requireAuthPage, (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'inventories.html'))
);

app.get('/inventory', requireAuthPage, (req, res) => {
  if (!req.session.activeInventoryId) return res.redirect('/inventories');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/shopping-list', requireAuthPage, (req, res) => {
  if (!req.session.activeInventoryId) return res.redirect('/inventories');
  res.sendFile(path.join(__dirname, 'public', 'shopping-list.html'));
});

// ── All API routes require auth ────────────────────────────────────────────────
app.use('/api', requireAuthApi);

// Current user
app.get('/api/me', (req, res) => res.json(req.user));

// Active inventory (from session)
app.get('/api/active-inventory', (req, res) => {
  const id = req.session.activeInventoryId;
  if (!id) return res.json(null);
  const inv    = db.getInventory(id);
  const member = db.getMember(id, req.user.id);
  if (!inv || !member) {
    req.session.activeInventoryId = null;
    return res.json(null);
  }
  res.json({ ...inv, role: member.role });
});

// ── Inventories ────────────────────────────────────────────────────────────────
app.get('/api/inventories', (req, res) => {
  try { res.json(db.getUserInventories(req.user.id)); }
  catch { res.status(500).json({ error: 'Error al obtener inventarios' }); }
});

app.post('/api/inventories', (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    const inv = db.createInventory(name.trim(), req.user.id);
    res.status(201).json({ ...inv, role: 'owner' });
  } catch { res.status(500).json({ error: 'Error al crear el inventario' }); }
});

app.post('/api/inventories/join', (req, res) => {
  try {
    const { code } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'El código es requerido' });
    const result = db.joinByCode(code.trim(), req.user.id);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch { res.status(500).json({ error: 'Error al unirse al inventario' }); }
});

// Enter an inventory — sets active inventory in session
app.post('/api/inventories/:id/enter', (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const member = db.getMember(id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso al inventario' });
    const inv = db.getInventory(id);
    if (!inv) return res.status(404).json({ error: 'Inventario no encontrado' });
    req.session.activeInventoryId = id;
    res.json({ ...inv, role: member.role });
  } catch { res.status(500).json({ error: 'Error al acceder al inventario' }); }
});

// Members & invite codes
app.get('/api/inventories/:id/members', requireMember, (req, res) => {
  try {
    const canManage = req.userRole === 'owner' || req.userRole === 'editor';
    res.json({
      members: db.getMembers(req.inventoryId),
      codes:   canManage ? db.getActiveInviteCodes(req.inventoryId) : [],
      role:    req.userRole,
    });
  } catch { res.status(500).json({ error: 'Error al obtener colaboradores' }); }
});

app.post('/api/inventories/:id/invite', requireMember, (req, res) => {
  try {
    if (req.userRole === 'reader') return res.status(403).json({ error: 'Sin permiso' });
    const { role } = req.body;
    if (!['editor', 'reader'].includes(role)) return res.status(400).json({ error: 'Rol inválido' });
    if (req.userRole === 'editor' && role === 'editor') {
      return res.status(403).json({ error: 'Los editores solo pueden invitar lectores' });
    }
    res.status(201).json(db.generateInviteCode(req.inventoryId, role, req.user.id));
  } catch { res.status(500).json({ error: 'Error al generar código' }); }
});

app.delete('/api/inventories/:id/invite/:code', requireMember, requireOwner, (req, res) => {
  try {
    const ok = db.revokeCode(req.inventoryId, req.params.code);
    if (!ok) return res.status(404).json({ error: 'Código no encontrado' });
    res.json({ message: 'Código revocado' });
  } catch { res.status(500).json({ error: 'Error al revocar código' }); }
});

app.delete('/api/inventories/:id/members/:userId', requireMember, requireOwner, (req, res) => {
  try {
    const targetId = parseInt(req.params.userId);
    if (targetId === req.user.id) return res.status(400).json({ error: 'No podés removerte a vos mismo' });
    const ok = db.removeMember(req.inventoryId, targetId);
    if (!ok) return res.status(404).json({ error: 'Miembro no encontrado' });
    res.json({ message: 'Miembro removido' });
  } catch { res.status(500).json({ error: 'Error al remover miembro' }); }
});

// ── Products (all require an active inventory in session) ──────────────────────
app.use(['/api/products', '/api/stats', '/api/shopping'], requireInventory);

app.get('/api/products', (req, res) => {
  try {
    const { category } = req.query;
    res.json(category ? db.getByCategory(req.inventoryId, category) : db.getAll(req.inventoryId));
  } catch { res.status(500).json({ error: 'Error al obtener productos' }); }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const p = db.getById(parseInt(req.params.id));
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    res.json(p);
  } catch { res.status(500).json({ error: 'Error al obtener el producto' }); }
});

app.post('/api/products', requireEditorOrOwner, (req, res) => {
  try {
    const error = validateProduct(req.body);
    if (error) return res.status(400).json({ error });
    const { name, category, current_qty, min_qty, unit } = req.body;
    res.status(201).json(db.create({
      name: name.trim(), category, current_qty: +current_qty,
      min_qty: +min_qty, unit, inventoryId: req.inventoryId,
    }));
  } catch { res.status(500).json({ error: 'Error al crear el producto' }); }
});

app.put('/api/products/:id', requireEditorOrOwner, (req, res) => {
  try {
    const error = validateProduct(req.body);
    if (error) return res.status(400).json({ error });
    const p = db.getById(parseInt(req.params.id));
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    const { name, category, current_qty, min_qty, unit } = req.body;
    res.json(db.update(parseInt(req.params.id), { name: name.trim(), category, current_qty: +current_qty, min_qty: +min_qty, unit }));
  } catch { res.status(500).json({ error: 'Error al actualizar el producto' }); }
});

app.delete('/api/products/:id', requireEditorOrOwner, (req, res) => {
  try {
    const p = db.getById(parseInt(req.params.id));
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    db.remove(parseInt(req.params.id));
    res.json({ message: 'Producto eliminado' });
  } catch { res.status(500).json({ error: 'Error al eliminar el producto' }); }
});

app.get('/api/stats', (req, res) => {
  try { res.json(db.getStats(req.inventoryId)); }
  catch { res.status(500).json({ error: 'Error al obtener estadísticas' }); }
});

// ── Shopping list ──────────────────────────────────────────────────────────────
app.get('/api/shopping', (req, res) => {
  try { res.json(db.getShoppingList(req.inventoryId)); }
  catch { res.status(500).json({ error: 'Error al obtener la lista de compras' }); }
});

app.put('/api/shopping/:productId', (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
    db.setShoppingItem(req.inventoryId, productId, !!req.body.checked);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error al actualizar el item' }); }
});

app.delete('/api/shopping', (req, res) => {
  try {
    db.clearShoppingList(req.inventoryId);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error al limpiar la lista' }); }
});

app.listen(PORT, () => {
  console.log('\n🏠  Inventario Hogar');
  console.log(`📡  Servidor corriendo en http://localhost:${PORT}`);
  console.log('     Presiona Ctrl+C para detener\n');
});
