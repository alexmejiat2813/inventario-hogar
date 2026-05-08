require('dotenv').config();
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const session  = require('express-session');
const passport = require('./auth');
const multer   = require('multer');
const db       = require('./database');

const RECEIPTS_DIR = path.join(__dirname, 'public', 'uploads', 'receipts');
if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

const receiptStorage = multer.diskStorage({
  destination: RECEIPTS_DIR,
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const uploadReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (/^image\/(jpeg|jpg|png|webp|heic|heif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Formato de imagen no válido'));
  },
});

const PRODUCT_IMAGES_DIR = path.join(__dirname, 'public', 'uploads', 'products');
if (!fs.existsSync(PRODUCT_IMAGES_DIR)) fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });

const productImageStorage = multer.diskStorage({
  destination: PRODUCT_IMAGES_DIR,
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `prod-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const uploadProductImage = multer({
  storage: productImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (/^image\//i.test(file.mimetype) || /\.heic$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Formato de imagen no válido'));
  },
}).array('photos', 5);

const app  = express();
const PORT = process.env.PORT || 3000;

const VALID_UNITS = ['unidades','kg','g','lt','ml','tsp','tbsp','cup','paquetes','cajas','bolsas','latas','botellas'];

function getValidCategories() {
  return db.getCategories().map(c => c.name);
}
function getValidUnits() {
  return db.getUnits().map(u => u.name);
}

function validateProduct({ name, category, current_qty, min_qty, unit }) {
  if (!name?.trim())                              return 'El nombre es requerido';
  if (!getValidCategories().includes(category))  return 'Categoría inválida';
  if (current_qty == null || isNaN(+current_qty) || +current_qty < 0) return 'Cantidad actual inválida';
  if (min_qty    == null || isNaN(+min_qty)    || +min_qty    < 0) return 'Cantidad mínima inválida';
  if (!getValidUnits().includes(unit))           return 'Unidad inválida';
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

// ── Static assets ──────────────────────────────────────────────────────────────
app.use('/css',      express.static(path.join(__dirname, 'public/css')));
app.use('/js',       express.static(path.join(__dirname, 'public/js')));
app.use('/locales',  express.static(path.join(__dirname, 'public/locales')));
app.use('/uploads',  express.static(path.join(__dirname, 'public/uploads')));

const CATALOG_CATEGORIES = ['Alimentos', 'Bebidas', 'Aseo Personal', 'Aseo del Hogar', 'Alacena'];

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

app.get('/catalog', requireAuthPage, (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'catalog.html'))
);

app.get('/settings', requireAuthPage, (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'settings.html'))
);

app.get('/history', requireAuthPage, (req, res) => {
  if (!req.session.activeInventoryId) return res.redirect('/inventories');
  res.sendFile(path.join(__dirname, 'public', 'history.html'));
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

// ── Products ───────────────────────────────────────────────────────────────────
app.use(['/api/products', '/api/stats', '/api/shopping', '/api/stores', '/api/purchases'], requireInventory);

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
    const { name, category, current_qty, min_qty, unit, catalog_product_id } = req.body;
    res.status(201).json(db.create({
      name: name.trim(), category, current_qty: +current_qty,
      min_qty: +min_qty, unit, inventoryId: req.inventoryId,
      catalogProductId: catalog_product_id || null,
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

// ── Product images ─────────────────────────────────────────────────────────────
app.get('/api/products/:id/images', (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
    const p = db.getById(productId);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });
    res.json(db.getProductImages(productId));
  } catch { res.status(500).json({ error: 'Error al obtener imágenes' }); }
});

app.post('/api/products/:id/images', requireEditorOrOwner, (req, res) => {
  const productId = parseInt(req.params.id);
  if (isNaN(productId)) return res.status(400).json({ error: 'ID inválido' });
  uploadProductImage(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const p = db.getById(productId);
      if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
      if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });

      const existing = db.getProductImageCount(productId);
      const incoming = (req.files || []).length;
      if (existing + incoming > 5) {
        // Clean up uploaded files since we won't use them
        (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
        return res.status(400).json({ error: 'Máximo 5 fotos por producto' });
      }

      const saved = (req.files || []).map(f => {
        const imagePath = '/uploads/products/' + f.filename;
        return db.addProductImage(productId, imagePath);
      });
      res.status(201).json(saved);
    } catch { res.status(500).json({ error: 'Error al guardar imágenes' }); }
  });
});

app.delete('/api/products/:id/images/:imageId', requireEditorOrOwner, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const imageId   = parseInt(req.params.imageId);
    if (isNaN(productId) || isNaN(imageId)) return res.status(400).json({ error: 'ID inválido' });
    const p = db.getById(productId);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    if (p.inventory_id !== req.inventoryId) return res.status(403).json({ error: 'Sin acceso' });

    const { deleted, image_path } = db.deleteProductImage(imageId, productId);
    if (!deleted) return res.status(404).json({ error: 'Imagen no encontrada' });

    if (image_path) {
      const filePath = path.join(__dirname, 'public', image_path);
      fs.unlink(filePath, () => {}); // ignore errors if file missing
    }
    res.json({ message: 'Imagen eliminada' });
  } catch { res.status(500).json({ error: 'Error al eliminar imagen' }); }
});

app.get('/api/stats', (req, res) => {
  try { res.json(db.getStats(req.inventoryId)); }
  catch { res.status(500).json({ error: 'Error al obtener estadísticas' }); }
});

// ── Catalog ────────────────────────────────────────────────────────────────────
app.get('/api/catalog', (req, res) => {
  try {
    const inventoryId = req.session.activeInventoryId || null;
    res.json(db.getCatalogProducts(inventoryId));
  } catch { res.status(500).json({ error: 'Error al obtener el catálogo' }); }
});

app.post('/api/catalog', (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!CATALOG_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Categoría inválida' });
    const result = db.addCatalogProduct({ name, category, userId: req.user.id });
    if (result.error) return res.status(409).json({ error: result.error });
    res.status(201).json(result.product);
  } catch { res.status(500).json({ error: 'Error al agregar el producto al catálogo' }); }
});

app.post('/api/catalog/:id/add', (req, res) => {
  try {
    const catalogProductId = parseInt(req.params.id);
    if (isNaN(catalogProductId)) return res.status(400).json({ error: 'ID inválido' });

    const inventoryId = req.session.activeInventoryId;
    if (!inventoryId) return res.status(400).json({ error: 'No hay inventario activo' });

    const member = db.getMember(inventoryId, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso al inventario' });
    if (member.role === 'reader') return res.status(403).json({ error: 'Se requiere rol de editor o dueño' });

    const { current_qty, min_qty, unit } = req.body;
    if (current_qty == null || isNaN(+current_qty) || +current_qty < 0) return res.status(400).json({ error: 'Cantidad actual inválida' });
    if (min_qty    == null || isNaN(+min_qty)    || +min_qty    < 0) return res.status(400).json({ error: 'Cantidad mínima inválida' });

    const result = db.addCatalogProductToInventory({
      catalogProductId,
      inventoryId,
      currentQty: +current_qty,
      minQty:     +min_qty,
      unit:       unit || 'unidades',
    });
    if (result.error) return res.status(409).json({ error: result.error });
    res.status(201).json(result.product);
  } catch { res.status(500).json({ error: 'Error al agregar al inventario' }); }
});

// ── Settings: categories ───────────────────────────────────────────────────────
app.get('/api/settings/categories', (req, res) => {
  try { res.json(db.getCategories()); }
  catch { res.status(500).json({ error: 'Error al obtener categorías' }); }
});

app.post('/api/settings/categories', (req, res) => {
  try {
    const { name, emoji } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = db.createCategory({ name, emoji });
    if (result.error) return res.status(409).json({ error: result.error });
    res.status(201).json(result.category);
  } catch { res.status(500).json({ error: 'Error al crear la categoría' }); }
});

app.put('/api/settings/categories/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const { name, emoji } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = db.updateCategory(id, { name, emoji });
    if (result.error) return res.status(409).json({ error: result.error });
    res.json(result.category);
  } catch { res.status(500).json({ error: 'Error al actualizar la categoría' }); }
});

app.delete('/api/settings/categories/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const ok = db.deleteCategory(id);
    if (!ok) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ message: 'Categoría eliminada' });
  } catch { res.status(500).json({ error: 'Error al eliminar la categoría' }); }
});

// ── Settings: units ────────────────────────────────────────────────────────────
app.get('/api/settings/units', (req, res) => {
  try { res.json(db.getUnits()); }
  catch { res.status(500).json({ error: 'Error al obtener unidades' }); }
});

app.post('/api/settings/units', (req, res) => {
  try {
    const { name, abbreviation, type } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!['peso','volumen','cantidad'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });
    const result = db.createUnit({ name, abbreviation, type });
    if (result.error) return res.status(409).json({ error: result.error });
    res.status(201).json(result.unit);
  } catch { res.status(500).json({ error: 'Error al crear la unidad' }); }
});

app.put('/api/settings/units/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const { name, abbreviation, type } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!['peso','volumen','cantidad'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });
    const result = db.updateUnit(id, { name, abbreviation, type });
    if (result.error) return res.status(409).json({ error: result.error });
    res.json(result.unit);
  } catch { res.status(500).json({ error: 'Error al actualizar la unidad' }); }
});

app.delete('/api/settings/units/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const ok = db.deleteUnit(id);
    if (!ok) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json({ message: 'Unidad eliminada' });
  } catch { res.status(500).json({ error: 'Error al eliminar la unidad' }); }
});

// ── Settings: catalog products ─────────────────────────────────────────────────
app.put('/api/settings/catalog/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const { name, category } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!CATALOG_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Categoría inválida' });
    const result = db.updateCatalogProduct(id, { name, category });
    if (result.error) return res.status(409).json({ error: result.error });
    res.json(result.product);
  } catch { res.status(500).json({ error: 'Error al actualizar el producto' }); }
});

app.delete('/api/settings/catalog/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const ok = db.deleteCatalogProduct(id);
    if (!ok) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado' });
  } catch { res.status(500).json({ error: 'Error al eliminar el producto del catálogo' }); }
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

// ── Inventory currency ─────────────────────────────────────────────────────────
const VALID_CURRENCIES = ['CAD','USD','COP','EUR','MXN','BRL','GBP'];

app.put('/api/inventories/:id/currency', requireMember, requireOwner, (req, res) => {
  try {
    const { currency } = req.body;
    if (!VALID_CURRENCIES.includes(currency)) return res.status(400).json({ error: 'Moneda inválida' });
    const inv = db.updateInventoryCurrency(req.inventoryId, currency);
    res.json({ currency: inv.currency });
  } catch { res.status(500).json({ error: 'Error al actualizar la moneda' }); }
});

// ── Stores ─────────────────────────────────────────────────────────────────────
app.get('/api/stores', (req, res) => {
  try { res.json(db.getStores(req.inventoryId)); }
  catch { res.status(500).json({ error: 'Error al obtener establecimientos' }); }
});

app.post('/api/stores', requireEditorOrOwner, (req, res) => {
  try {
    const { name, emoji } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    res.status(201).json(db.createStore({ inventoryId: req.inventoryId, name: name.trim(), emoji: emoji || '🏪' }));
  } catch { res.status(500).json({ error: 'Error al crear el establecimiento' }); }
});

app.put('/api/stores/:storeId', requireEditorOrOwner, (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return res.status(400).json({ error: 'ID inválido' });
    const store = db.getStore(storeId);
    if (!store || store.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Establecimiento no encontrado' });
    const { name, emoji } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    res.json(db.updateStore(storeId, { name: name.trim(), emoji: emoji || '🏪' }));
  } catch { res.status(500).json({ error: 'Error al actualizar el establecimiento' }); }
});

app.delete('/api/stores/:storeId', requireEditorOrOwner, (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return res.status(400).json({ error: 'ID inválido' });
    const store = db.getStore(storeId);
    if (!store || store.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Establecimiento no encontrado' });
    db.deleteStore(storeId);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error al eliminar el establecimiento' }); }
});

// ── Purchases ──────────────────────────────────────────────────────────────────
app.get('/api/purchases/summary', (req, res) => {
  try { res.json(db.getMonthlySummary(req.inventoryId)); }
  catch { res.status(500).json({ error: 'Error al obtener resumen' }); }
});

app.get('/api/purchases', (req, res) => {
  try {
    const { month, store_id } = req.query;
    res.json(db.getPurchaseSessions(req.inventoryId, {
      month:   month    || null,
      storeId: store_id ? parseInt(store_id) : null,
    }));
  } catch { res.status(500).json({ error: 'Error al obtener historial' }); }
});

app.post('/api/purchases', requireEditorOrOwner, (req, res) => {
  try {
    const { items, currency, purchase_date } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No hay productos' });
    const session = db.createPurchaseSession({
      inventoryId:  req.inventoryId,
      userId:       req.user.id,
      items,
      currency:     currency     || 'USD',
      purchaseDate: purchase_date || new Date().toISOString().slice(0,10),
      receiptImage: null,
    });
    res.status(201).json(session);
  } catch { res.status(500).json({ error: 'Error al registrar la compra' }); }
});

app.get('/api/purchases/:sessionId', (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ error: 'ID inválido' });
    const session = db.getPurchaseSession(sessionId);
    if (!session || session.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json(session);
  } catch { res.status(500).json({ error: 'Error al obtener la sesión' }); }
});

app.post('/api/purchases/:sessionId/receipt', requireEditorOrOwner,
  uploadReceipt.single('receipt'),
  (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) return res.status(400).json({ error: 'ID inválido' });
      const session = db.getPurchaseSession(sessionId);
      if (!session || session.inventory_id !== req.inventoryId) return res.status(404).json({ error: 'Sesión no encontrada' });
      if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
      const imagePath = '/uploads/receipts/' + req.file.filename;
      db.updateReceiptImage(sessionId, imagePath);
      res.json({ receipt_image: imagePath });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Error al subir la imagen' });
    }
  }
);

app.listen(PORT, () => {
  console.log('\n🏠  Inventario Hogar');
  console.log(`📡  Servidor corriendo en http://localhost:${PORT}`);
  console.log('     Presiona Ctrl+C para detener\n');
});
