const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'inventario.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id  TEXT    NOT NULL UNIQUE,
    name       TEXT    NOT NULL,
    email      TEXT,
    photo      TEXT,
    created_at TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS inventories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    owner_id   INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS inventory_members (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
    role         TEXT    NOT NULL CHECK(role IN ('owner','editor','reader')),
    joined_at    TEXT    DEFAULT (datetime('now','localtime')),
    UNIQUE(inventory_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    code         TEXT    NOT NULL UNIQUE,
    role         TEXT    NOT NULL CHECK(role IN ('editor','reader')),
    created_by   INTEGER NOT NULL REFERENCES users(id),
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    emoji      TEXT    NOT NULL DEFAULT '📦',
    created_at TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS units (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,
    abbreviation TEXT    NOT NULL DEFAULT '',
    type         TEXT    NOT NULL DEFAULT 'cantidad',
    created_at   TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS catalog_products (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,
    category     TEXT    NOT NULL,
    default_unit TEXT    NOT NULL DEFAULT 'unidades',
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT    NOT NULL,
    category           TEXT    NOT NULL,
    current_qty        REAL    NOT NULL DEFAULT 0,
    min_qty            REAL    NOT NULL DEFAULT 0,
    unit               TEXT    NOT NULL DEFAULT 'unidades',
    inventory_id       INTEGER REFERENCES inventories(id)       ON DELETE CASCADE,
    catalog_product_id INTEGER REFERENCES catalog_products(id)  ON DELETE SET NULL,
    created_at         TEXT    DEFAULT (datetime('now','localtime')),
    updated_at         TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS shopping_list_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    product_id   INTEGER NOT NULL REFERENCES products(id)    ON DELETE CASCADE,
    checked      INTEGER NOT NULL DEFAULT 0,
    checked_at   TEXT,
    UNIQUE(inventory_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS stores (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    emoji        TEXT    NOT NULL DEFAULT '🏪',
    created_at   TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS purchase_sessions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id   INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    total_amount   REAL    NOT NULL DEFAULT 0,
    currency       TEXT    NOT NULL DEFAULT 'USD',
    purchase_date  TEXT    NOT NULL,
    receipt_image  TEXT,
    created_at     TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS purchase_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL REFERENCES purchase_sessions(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES products(id)  ON DELETE SET NULL,
    product_name    TEXT    NOT NULL,
    store_id        INTEGER REFERENCES stores(id)    ON DELETE SET NULL,
    quantity_bought REAL    NOT NULL DEFAULT 0,
    unit            TEXT    NOT NULL DEFAULT 'unidades',
    unit_price      REAL,
    subtotal        REAL,
    created_at      TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_path TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS tax_types (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    rate         REAL    NOT NULL DEFAULT 0,
    categories   TEXT    NOT NULL DEFAULT '[]',
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS budget_config (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id      INTEGER NOT NULL UNIQUE REFERENCES inventories(id) ON DELETE CASCADE,
    monthly_amount    REAL    NOT NULL DEFAULT 0,
    alert_percentages TEXT    NOT NULL DEFAULT '[]',
    created_at        TEXT    DEFAULT (datetime('now','localtime')),
    updated_at        TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS budget_resets (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id   INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    reset_date     TEXT    NOT NULL,
    spent_at_reset REAL    NOT NULL DEFAULT 0,
    created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS list_templates (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS list_template_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id  INTEGER NOT NULL REFERENCES list_templates(id) ON DELETE CASCADE,
    product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT    NOT NULL,
    quantity     REAL    NOT NULL DEFAULT 1,
    unit         TEXT    NOT NULL DEFAULT 'unidades'
  );
`);

// ── Migrations ────────────────────────────────────────────────────────────────
const invCols = db.prepare('PRAGMA table_info(inventories)').all().map(c => c.name);
if (!invCols.includes('currency')) {
  db.exec("ALTER TABLE inventories ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'");
}

const productCols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
if (!productCols.includes('inventory_id')) {
  db.exec('ALTER TABLE products ADD COLUMN inventory_id INTEGER REFERENCES inventories(id) ON DELETE CASCADE');
}
if (!productCols.includes('catalog_product_id')) {
  db.exec('ALTER TABLE products ADD COLUMN catalog_product_id INTEGER REFERENCES catalog_products(id) ON DELETE SET NULL');
}
if (!productCols.includes('expiry_date')) {
  db.exec('ALTER TABLE products ADD COLUMN expiry_date TEXT');
}

const sessionCols = db.prepare('PRAGMA table_info(purchase_sessions)').all().map(c => c.name);
if (!sessionCols.includes('subtotal_before_tax')) db.exec('ALTER TABLE purchase_sessions ADD COLUMN subtotal_before_tax REAL');
if (!sessionCols.includes('total_tax'))           db.exec('ALTER TABLE purchase_sessions ADD COLUMN total_tax REAL');
if (!sessionCols.includes('tax_breakdown'))       db.exec('ALTER TABLE purchase_sessions ADD COLUMN tax_breakdown TEXT');

const itemCols = db.prepare('PRAGMA table_info(purchase_items)').all().map(c => c.name);
if (!itemCols.includes('tax_id'))     db.exec('ALTER TABLE purchase_items ADD COLUMN tax_id INTEGER REFERENCES tax_types(id) ON DELETE SET NULL');
if (!itemCols.includes('tax_rate'))   db.exec('ALTER TABLE purchase_items ADD COLUMN tax_rate REAL');
if (!itemCols.includes('tax_amount')) db.exec('ALTER TABLE purchase_items ADD COLUMN tax_amount REAL');

// ── Seed: categories ──────────────────────────────────────────────────────────
{
  const ins = db.prepare('INSERT OR IGNORE INTO categories (name, emoji) VALUES (?, ?)');
  [
    ['Alimentos',     '🍎'],
    ['Bebidas',       '🥤'],
    ['Aseo Personal', '🧴'],
    ['Aseo del Hogar','🧹'],
    ['Alacena',       '🫙'],
    ['Aseo',          '🧼'],
    ['Otros',         '📦'],
  ].forEach(([name, emoji]) => ins.run(name, emoji));
}

// ── Seed: units ───────────────────────────────────────────────────────────────
{
  const ins = db.prepare('INSERT OR IGNORE INTO units (name, abbreviation, type) VALUES (?, ?, ?)');
  [
    ['unidades', '',     'cantidad'],
    ['kg',       'kg',  'peso'],
    ['g',        'g',   'peso'],
    ['lt',       'lt',  'volumen'],
    ['ml',       'ml',  'volumen'],
    ['tsp',      'tsp', 'volumen'],
    ['tbsp',     'tbsp','volumen'],
    ['cup',      'cup', 'volumen'],
    ['paquetes', '',    'cantidad'],
    ['cajas',    '',    'cantidad'],
    ['bolsas',   '',    'cantidad'],
    ['latas',    '',    'cantidad'],
    ['botellas', '',    'cantidad'],
  ].forEach(([name, abbr, type]) => ins.run(name, abbr, type));
}

// ── Catalog seed (100 products, INSERT OR IGNORE so reruns are safe) ──────────
const CATALOG_SEED = [
  // Alimentos (30)
  ['Arroz',                'Alimentos'],
  ['Harina de trigo',      'Alimentos'],
  ['Harina de maíz',       'Alimentos'],
  ['Pasta',                'Alimentos'],
  ['Avena',                'Alimentos'],
  ['Lentejas',             'Alimentos'],
  ['Frijoles',             'Alimentos'],
  ['Garbanzos',            'Alimentos'],
  ['Azúcar',               'Alimentos'],
  ['Sal',                  'Alimentos'],
  ['Aceite vegetal',       'Alimentos'],
  ['Aceite de oliva',      'Alimentos'],
  ['Vinagre',              'Alimentos'],
  ['Salsa de tomate',      'Alimentos'],
  ['Mayonesa',             'Alimentos'],
  ['Mostaza',              'Alimentos'],
  ['Atún en lata',         'Alimentos'],
  ['Sardinas',             'Alimentos'],
  ['Leche',                'Alimentos'],
  ['Leche en polvo',       'Alimentos'],
  ['Huevos',               'Alimentos'],
  ['Mantequilla',          'Alimentos'],
  ['Queso',                'Alimentos'],
  ['Yogur',                'Alimentos'],
  ['Pan',                  'Alimentos'],
  ['Galletas',             'Alimentos'],
  ['Cereal',               'Alimentos'],
  ['Café',                 'Alimentos'],
  ['Té',                   'Alimentos'],
  ['Chocolate en polvo',   'Alimentos'],
  // Bebidas (10)
  ['Agua embotellada',     'Bebidas'],
  ['Jugo de naranja',      'Bebidas'],
  ['Jugo de manzana',      'Bebidas'],
  ['Refresco cola',        'Bebidas'],
  ['Refresco lima',        'Bebidas'],
  ['Agua saborizada',      'Bebidas'],
  ['Bebida energética',    'Bebidas'],
  ['Leche de almendra',    'Bebidas'],
  ['Leche de soya',        'Bebidas'],
  ['Agua con gas',         'Bebidas'],
  // Aseo Personal (20)
  ['Jabón de baño',        'Aseo Personal'],
  ['Shampoo',              'Aseo Personal'],
  ['Acondicionador',       'Aseo Personal'],
  ['Pasta dental',         'Aseo Personal'],
  ['Cepillo de dientes',   'Aseo Personal'],
  ['Hilo dental',          'Aseo Personal'],
  ['Desodorante',          'Aseo Personal'],
  ['Papel higiénico',      'Aseo Personal'],
  ['Toallas húmedas',      'Aseo Personal'],
  ['Algodón',              'Aseo Personal'],
  ['Crema corporal',       'Aseo Personal'],
  ['Crema facial',         'Aseo Personal'],
  ['Protector solar',      'Aseo Personal'],
  ['Rastrillos',           'Aseo Personal'],
  ['Espuma de afeitar',    'Aseo Personal'],
  ['Perfume',              'Aseo Personal'],
  ['Maquillaje base',      'Aseo Personal'],
  ['Labial',               'Aseo Personal'],
  ['Tampones',             'Aseo Personal'],
  ['Toallas sanitarias',   'Aseo Personal'],
  // Aseo del Hogar (20)
  ['Detergente ropa',      'Aseo del Hogar'],
  ['Suavizante ropa',      'Aseo del Hogar'],
  ['Jabón lavar platos',   'Aseo del Hogar'],
  ['Esponja',              'Aseo del Hogar'],
  ['Cloro',                'Aseo del Hogar'],
  ['Desinfectante piso',   'Aseo del Hogar'],
  ['Limpiavidrios',        'Aseo del Hogar'],
  ['Limpiador multiusos',  'Aseo del Hogar'],
  ['Quitamanchas',         'Aseo del Hogar'],
  ['Bolsas de basura',     'Aseo del Hogar'],
  ['Papel cocina',         'Aseo del Hogar'],
  ['Servilletas',          'Aseo del Hogar'],
  ['Guantes de caucho',    'Aseo del Hogar'],
  ['Escoba',               'Aseo del Hogar'],
  ['Trapeador',            'Aseo del Hogar'],
  ['Recogedor',            'Aseo del Hogar'],
  ['Ambientador spray',    'Aseo del Hogar'],
  ['Velas',                'Aseo del Hogar'],
  ['Fósforos',             'Aseo del Hogar'],
  ['Insecticida',          'Aseo del Hogar'],
  // Alacena (20)
  ['Pimienta negra',       'Alacena'],
  ['Comino',               'Alacena'],
  ['Orégano',              'Alacena'],
  ['Ajo en polvo',         'Alacena'],
  ['Cebolla en polvo',     'Alacena'],
  ['Curry',                'Alacena'],
  ['Canela',               'Alacena'],
  ['Vainilla',             'Alacena'],
  ['Polvo de hornear',     'Alacena'],
  ['Bicarbonato',          'Alacena'],
  ['Maicena',              'Alacena'],
  ['Gelatina',             'Alacena'],
  ['Miel',                 'Alacena'],
  ['Mermelada',            'Alacena'],
  ['Mantequilla de maní',  'Alacena'],
  ['Chocolate negro',      'Alacena'],
  ['Caldo de pollo',       'Alacena'],
  ['Sazonador',            'Alacena'],
  ['Laurel',               'Alacena'],
  ['Tomillo',              'Alacena'],
];

{
  const ins = db.prepare('INSERT OR IGNORE INTO catalog_products (name, category) VALUES (?, ?)');
  CATALOG_SEED.forEach(([name, category]) => ins.run(name, category));
}

// ── Category mapping: catalog → inventory (for legacy products) ───────────────
const CATALOG_TO_INV_CATEGORY = {
  'Alimentos':    'Alimentos',
  'Bebidas':      'Bebidas',
  'Aseo Personal':'Aseo',
  'Aseo del Hogar':'Aseo',
  'Alacena':      'Alacena',
};

// ── Default seed products (applied when a new user registers) ─────────────────
const SEED = [
  ['Aceite de oliva',   'Alimentos', 0.3,  1,    'lt'],
  ['Sal fina',          'Alimentos', 200,  500,  'g'],
  ['Arroz',             'Alacena',   3,    2,    'kg'],
  ['Fideos',            'Alacena',   300,  1000, 'g'],
  ['Azúcar',            'Alacena',   2,    1,    'kg'],
  ['Lentejas',          'Alacena',   800,  500,  'g'],
  ['Leche',             'Bebidas',   8,    4,    'unidades'],
  ['Agua mineral',      'Bebidas',   18,   6,    'botellas'],
  ['Jugo de naranja',   'Bebidas',   0,    2,    'lt'],
  ['Café molido',       'Bebidas',   300,  250,  'g'],
  ['Detergente ropa',   'Aseo',      0.5,  2,    'lt'],
  ['Jabón de manos',    'Aseo',      4,    2,    'unidades'],
  ['Shampoo',           'Aseo',      2,    1,    'unidades'],
  ['Papel higiénico',   'Aseo',      2,    6,    'unidades'],
  ['Cloro multiusos',   'Aseo',      0,    1,    'lt'],
  ['Esponja de cocina', 'Otros',     3,    2,    'unidades'],
];

module.exports = {
  // ── Users ──────────────────────────────────────────────────────────────────
  upsertUser({ google_id, name, email, photo }) {
    const existing = db.prepare('SELECT id FROM users WHERE google_id = ?').get(google_id);
    db.prepare(`
      INSERT INTO users (google_id, name, email, photo) VALUES (?, ?, ?, ?)
      ON CONFLICT(google_id) DO UPDATE SET
        name=excluded.name, email=excluded.email, photo=excluded.photo
    `).run(google_id, name, email, photo);
    const user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(google_id);
    return { ...user, is_new: !existing };
  },

  // ── Inventories ────────────────────────────────────────────────────────────
  getUserInventories(userId) {
    return db.prepare(`
      SELECT i.id, i.name, i.owner_id, i.created_at,
             im.role,
             u.name  AS owner_name,
             (SELECT COUNT(*) FROM inventory_members WHERE inventory_id = i.id) AS member_count
      FROM inventories i
      JOIN inventory_members im ON im.inventory_id = i.id AND im.user_id = ?
      JOIN users u ON u.id = i.owner_id
      ORDER BY (im.role = 'owner') DESC, i.created_at DESC
    `).all(userId);
  },

  getInventory(id) {
    return db.prepare('SELECT * FROM inventories WHERE id = ?').get(id);
  },

  createInventory(name, ownerId) {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO inventories (name, owner_id) VALUES (?, ?)'
    ).run(name, ownerId);
    db.prepare(
      'INSERT INTO inventory_members (inventory_id, user_id, role) VALUES (?, ?, ?)'
    ).run(lastInsertRowid, ownerId, 'owner');
    return this.getInventory(lastInsertRowid);
  },

  createDefaultInventory(userId) {
    const inv = this.createInventory('Mi hogar', userId);
    const ins = db.prepare(
      'INSERT INTO products (name, category, current_qty, min_qty, unit, inventory_id) VALUES (?, ?, ?, ?, ?, ?)'
    );
    SEED.forEach(([n, c, cur, min, u]) => ins.run(n, c, cur, min, u, inv.id));
    return inv;
  },

  // ── Members ────────────────────────────────────────────────────────────────
  getMember(inventoryId, userId) {
    return db.prepare(
      'SELECT * FROM inventory_members WHERE inventory_id = ? AND user_id = ?'
    ).get(inventoryId, userId);
  },

  getMembers(inventoryId) {
    return db.prepare(`
      SELECT im.id, im.user_id, im.role, im.joined_at,
             u.name, u.email, u.photo
      FROM inventory_members im
      JOIN users u ON u.id = im.user_id
      WHERE im.inventory_id = ?
      ORDER BY CASE im.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, u.name
    `).all(inventoryId);
  },

  removeMember(inventoryId, userId) {
    return db.prepare(
      'DELETE FROM inventory_members WHERE inventory_id = ? AND user_id = ?'
    ).run(inventoryId, userId).changes > 0;
  },

  // ── Invite codes ───────────────────────────────────────────────────────────
  generateInviteCode(inventoryId, role, createdBy) {
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
      code = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
    } while (db.prepare('SELECT id FROM invite_codes WHERE code = ? AND active = 1').get(code));
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO invite_codes (inventory_id, code, role, created_by) VALUES (?, ?, ?, ?)'
    ).run(inventoryId, code, role, createdBy);
    return db.prepare('SELECT * FROM invite_codes WHERE id = ?').get(lastInsertRowid);
  },

  getActiveInviteCodes(inventoryId) {
    return db.prepare(
      'SELECT * FROM invite_codes WHERE inventory_id = ? AND active = 1 ORDER BY created_at DESC'
    ).all(inventoryId);
  },

  revokeCode(inventoryId, code) {
    return db.prepare(
      'UPDATE invite_codes SET active = 0 WHERE inventory_id = ? AND code = ?'
    ).run(inventoryId, code).changes > 0;
  },

  joinByCode(code, userId) {
    const invite = db.prepare(
      'SELECT * FROM invite_codes WHERE code = ? AND active = 1'
    ).get(code.toUpperCase());
    if (!invite) return { error: 'Código inválido o expirado' };
    if (this.getMember(invite.inventory_id, userId)) return { error: 'Ya sos miembro de este inventario' };
    db.prepare(
      'INSERT INTO inventory_members (inventory_id, user_id, role) VALUES (?, ?, ?)'
    ).run(invite.inventory_id, userId, invite.role);
    return { inventory: this.getInventory(invite.inventory_id), role: invite.role };
  },

  // ── Products ───────────────────────────────────────────────────────────────
  getAll(inventoryId) {
    return db.prepare(`
      SELECT p.*,
             (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) AS image_count
      FROM products p
      WHERE p.inventory_id = ?
      ORDER BY p.category, p.name
    `).all(inventoryId);
  },

  getByCategory(inventoryId, category) {
    return db.prepare(
      'SELECT * FROM products WHERE inventory_id = ? AND category = ? ORDER BY name'
    ).all(inventoryId, category);
  },

  getById(id) {
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  },

  create({ name, category, current_qty, min_qty, unit, inventoryId, catalogProductId = null, expiry_date = null }) {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO products (name, category, current_qty, min_qty, unit, inventory_id, catalog_product_id, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, category, current_qty, min_qty, unit, inventoryId, catalogProductId, expiry_date || null);
    return this.getById(lastInsertRowid);
  },

  update(id, { name, category, current_qty, min_qty, unit, expiry_date = null }) {
    const { changes } = db.prepare(`
      UPDATE products
      SET name=?, category=?, current_qty=?, min_qty=?, unit=?, expiry_date=?,
          updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(name, category, current_qty, min_qty, unit, expiry_date || null, id);
    return changes > 0 ? this.getById(id) : null;
  },

  remove(id) {
    return db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0;
  },

  // ── Categories ─────────────────────────────────────────────────────────────
  getCategories() {
    return db.prepare('SELECT * FROM categories ORDER BY name').all();
  },

  getCategory(id) {
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  },

  getCategoryByName(name) {
    return db.prepare('SELECT * FROM categories WHERE LOWER(name) = LOWER(?)').get(name);
  },

  createCategory({ name, emoji }) {
    const existing = this.getCategoryByName(name);
    if (existing) return { error: 'Ya existe una categoría con ese nombre' };
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO categories (name, emoji) VALUES (?, ?)'
    ).run(name.trim(), emoji || '📦');
    return { category: this.getCategory(lastInsertRowid) };
  },

  updateCategory(id, { name, emoji }) {
    const existing = db.prepare(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?'
    ).get(name, id);
    if (existing) return { error: 'Ya existe una categoría con ese nombre' };
    db.prepare('UPDATE categories SET name=?, emoji=? WHERE id=?').run(name.trim(), emoji || '📦', id);
    return { category: this.getCategory(id) };
  },

  deleteCategory(id) {
    return db.prepare('DELETE FROM categories WHERE id = ?').run(id).changes > 0;
  },

  // ── Units ──────────────────────────────────────────────────────────────────
  getUnits() {
    return db.prepare('SELECT * FROM units ORDER BY type, name').all();
  },

  getUnit(id) {
    return db.prepare('SELECT * FROM units WHERE id = ?').get(id);
  },

  getUnitByName(name) {
    return db.prepare('SELECT * FROM units WHERE LOWER(name) = LOWER(?)').get(name);
  },

  createUnit({ name, abbreviation, type }) {
    const existing = this.getUnitByName(name);
    if (existing) return { error: 'Ya existe una unidad con ese nombre' };
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO units (name, abbreviation, type) VALUES (?, ?, ?)'
    ).run(name.trim(), abbreviation || '', type || 'cantidad');
    return { unit: this.getUnit(lastInsertRowid) };
  },

  updateUnit(id, { name, abbreviation, type }) {
    const existing = db.prepare(
      'SELECT id FROM units WHERE LOWER(name) = LOWER(?) AND id != ?'
    ).get(name, id);
    if (existing) return { error: 'Ya existe una unidad con ese nombre' };
    db.prepare('UPDATE units SET name=?, abbreviation=?, type=? WHERE id=?')
      .run(name.trim(), abbreviation || '', type || 'cantidad', id);
    return { unit: this.getUnit(id) };
  },

  deleteUnit(id) {
    return db.prepare('DELETE FROM units WHERE id = ?').run(id).changes > 0;
  },

  // ── Catalog ────────────────────────────────────────────────────────────────
  getCatalogProducts(inventoryId = null) {
    if (inventoryId) {
      return db.prepare(`
        SELECT cp.id, cp.name, cp.category, cp.created_at,
          CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END AS in_inventory
        FROM catalog_products cp
        LEFT JOIN products p
          ON p.catalog_product_id = cp.id AND p.inventory_id = ?
        ORDER BY cp.category, cp.name
      `).all(inventoryId);
    }
    return db.prepare(`
      SELECT id, name, category, created_at, 0 AS in_inventory
      FROM catalog_products
      ORDER BY category, name
    `).all();
  },

  getCatalogProduct(id) {
    return db.prepare('SELECT * FROM catalog_products WHERE id = ?').get(id);
  },

  addCatalogProduct({ name, category, userId }) {
    const existing = db.prepare(
      'SELECT id FROM catalog_products WHERE LOWER(name) = LOWER(?)'
    ).get(name);
    if (existing) return { error: 'Ya existe un producto con ese nombre' };
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO catalog_products (name, category, created_by) VALUES (?, ?, ?)'
    ).run(name.trim(), category, userId || null);
    return { product: this.getCatalogProduct(lastInsertRowid) };
  },

  updateCatalogProduct(id, { name, category }) {
    const existing = db.prepare(
      'SELECT id FROM catalog_products WHERE LOWER(name) = LOWER(?) AND id != ?'
    ).get(name, id);
    if (existing) return { error: 'Ya existe un producto con ese nombre' };
    db.prepare('UPDATE catalog_products SET name=?, category=? WHERE id=?')
      .run(name.trim(), category, id);
    return { product: this.getCatalogProduct(id) };
  },

  deleteCatalogProduct(id) {
    return db.prepare('DELETE FROM catalog_products WHERE id = ?').run(id).changes > 0;
  },

  addCatalogProductToInventory({ catalogProductId, inventoryId, currentQty, minQty, unit }) {
    const catalogProduct = this.getCatalogProduct(catalogProductId);
    if (!catalogProduct) return { error: 'Producto no encontrado en el catálogo' };

    const existing = db.prepare(
      'SELECT id FROM products WHERE inventory_id = ? AND catalog_product_id = ?'
    ).get(inventoryId, catalogProductId);
    if (existing) return { error: 'Este producto ya está en el inventario' };

    const invCategory = CATALOG_TO_INV_CATEGORY[catalogProduct.category] || catalogProduct.category;
    const product = this.create({
      name:             catalogProduct.name,
      category:         invCategory,
      current_qty:      currentQty,
      min_qty:          minQty,
      unit:             unit || 'unidades',
      inventoryId,
      catalogProductId,
    });
    return { product };
  },

  // ── Product images ─────────────────────────────────────────────────────────
  getProductImages(productId) {
    return db.prepare(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY created_at'
    ).all(productId);
  },

  addProductImage(productId, imagePath) {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO product_images (product_id, image_path) VALUES (?, ?)'
    ).run(productId, imagePath);
    return db.prepare('SELECT * FROM product_images WHERE id = ?').get(lastInsertRowid);
  },

  deleteProductImage(imageId, productId) {
    const row = db.prepare(
      'SELECT image_path FROM product_images WHERE id = ? AND product_id = ?'
    ).get(imageId, productId);
    if (!row) return { deleted: false, image_path: null };
    const { changes } = db.prepare(
      'DELETE FROM product_images WHERE id = ? AND product_id = ?'
    ).run(imageId, productId);
    return { deleted: changes > 0, image_path: row.image_path };
  },

  getProductImageCount(productId) {
    const { count } = db.prepare(
      'SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?'
    ).get(productId);
    return count;
  },

  getProductStorePrices(productId, inventoryId) {
    return db.prepare(`
      SELECT
        COALESCE(s.name, 'Sin tienda')  AS store_name,
        COALESCE(s.emoji, '')           AS store_emoji,
        pi.unit_price                   AS last_price,
        date(ps.purchase_date)          AS last_date
      FROM purchase_items pi
      JOIN purchase_sessions ps ON ps.id = pi.session_id
      LEFT JOIN stores s ON s.id = pi.store_id
      WHERE pi.product_id = ?
        AND ps.inventory_id = ?
        AND pi.unit_price IS NOT NULL
        AND pi.unit_price > 0
        AND ps.purchase_date = (
          SELECT MAX(ps2.purchase_date)
          FROM purchase_items pi2
          JOIN purchase_sessions ps2 ON ps2.id = pi2.session_id
          WHERE pi2.product_id = pi.product_id
            AND ps2.inventory_id = ?
            AND pi2.unit_price IS NOT NULL
            AND pi2.unit_price > 0
            AND COALESCE(pi2.store_id, -1) = COALESCE(pi.store_id, -1)
        )
      GROUP BY COALESCE(pi.store_id, -1)
      ORDER BY last_price ASC
    `).all(productId, inventoryId, inventoryId);
  },

  getProductPriceHistory(productId, inventoryId) {
    return db.prepare(`
      SELECT
        date(ps.purchase_date) AS date,
        COALESCE(s.name, 'Sin tienda') AS store_name,
        pi.unit_price
      FROM purchase_items pi
      JOIN purchase_sessions ps ON ps.id = pi.session_id
      LEFT JOIN stores s ON s.id = pi.store_id
      WHERE pi.product_id = ?
        AND ps.inventory_id = ?
        AND pi.unit_price IS NOT NULL
        AND pi.unit_price > 0
      ORDER BY ps.purchase_date ASC
    `).all(productId, inventoryId);
  },

  // ── Shopping list ──────────────────────────────────────────────────────────
  getShoppingList(inventoryId) {
    return db.prepare(`
      SELECT p.*,
             COALESCE(s.checked, 0) AS checked,
             s.checked_at,
             (p.min_qty - p.current_qty) AS needed
      FROM products p
      LEFT JOIN shopping_list_items s
        ON s.product_id = p.id AND s.inventory_id = ?
      WHERE p.inventory_id = ? AND p.current_qty < p.min_qty
      ORDER BY
        CASE p.category
          WHEN 'Alimentos' THEN 1 WHEN 'Aseo'    THEN 2
          WHEN 'Alacena'   THEN 3 WHEN 'Bebidas'  THEN 4
          ELSE 5
        END,
        p.name
    `).all(inventoryId, inventoryId);
  },

  setShoppingItem(inventoryId, productId, checked) {
    db.prepare(`
      INSERT INTO shopping_list_items (inventory_id, product_id, checked, checked_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(inventory_id, product_id) DO UPDATE SET
        checked    = excluded.checked,
        checked_at = excluded.checked_at
    `).run(inventoryId, productId, checked ? 1 : 0, checked ? new Date().toISOString() : null);
  },

  clearShoppingList(inventoryId) {
    db.prepare(
      'UPDATE shopping_list_items SET checked = 0, checked_at = NULL WHERE inventory_id = ?'
    ).run(inventoryId);
  },

  // ── Shopping list templates ────────────────────────────────────────────────
  getTemplates(inventoryId) {
    return db.prepare(`
      SELECT t.*, COUNT(ti.id) AS item_count
      FROM list_templates t
      LEFT JOIN list_template_items ti ON ti.template_id = t.id
      WHERE t.inventory_id = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).all(inventoryId);
  },

  getTemplate(id, inventoryId) {
    const template = db.prepare(
      'SELECT * FROM list_templates WHERE id = ? AND inventory_id = ?'
    ).get(id, inventoryId);
    if (!template) return null;
    template.items = db.prepare(
      'SELECT * FROM list_template_items WHERE template_id = ? ORDER BY id'
    ).all(id);
    return template;
  },

  createTemplate(inventoryId, userId, name, items) {
    return db.transaction(() => {
      const { lastInsertRowid } = db.prepare(
        'INSERT INTO list_templates (inventory_id, created_by, name) VALUES (?, ?, ?)'
      ).run(inventoryId, userId, name.trim());
      const ins = db.prepare(
        'INSERT INTO list_template_items (template_id, product_id, product_name, quantity, unit) VALUES (?, ?, ?, ?, ?)'
      );
      items.forEach(item => {
        ins.run(lastInsertRowid, item.productId || null, item.productName, +item.quantity || 1, item.unit);
      });
      const template = db.prepare('SELECT * FROM list_templates WHERE id = ?').get(lastInsertRowid);
      template.items = db.prepare('SELECT * FROM list_template_items WHERE template_id = ?').all(lastInsertRowid);
      return template;
    })();
  },

  deleteTemplate(id, inventoryId) {
    return db.prepare(
      'DELETE FROM list_templates WHERE id = ? AND inventory_id = ?'
    ).run(id, inventoryId).changes > 0;
  },

  getStats(inventoryId) {
    const { total }    = db.prepare('SELECT COUNT(*) as total    FROM products WHERE inventory_id = ?').get(inventoryId);
    const { critical } = db.prepare('SELECT COUNT(*) as critical FROM products WHERE inventory_id = ? AND current_qty < min_qty').get(inventoryId);
    const raw = db.prepare('SELECT category, COUNT(*) as count FROM products WHERE inventory_id = ? GROUP BY category').all(inventoryId);
    const catMap = Object.fromEntries(raw.map(r => [r.category, r.count]));
    const cats = db.prepare('SELECT name FROM categories ORDER BY name').all().map(c => c.name);
    return { total, critical, byCategory: cats.map(cat => ({ category: cat, count: catMap[cat] || 0 })) };
  },

  // ── Inventory currency ─────────────────────────────────────────────────────
  updateInventoryCurrency(inventoryId, currency) {
    db.prepare('UPDATE inventories SET currency = ? WHERE id = ?').run(currency, inventoryId);
    return this.getInventory(inventoryId);
  },

  // ── Stores ─────────────────────────────────────────────────────────────────
  getStores(inventoryId) {
    return db.prepare('SELECT * FROM stores WHERE inventory_id = ? ORDER BY name').all(inventoryId);
  },
  getStore(id) {
    return db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
  },
  createStore({ inventoryId, name, emoji }) {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO stores (inventory_id, name, emoji) VALUES (?, ?, ?)'
    ).run(inventoryId, name, emoji || '🏪');
    return this.getStore(lastInsertRowid);
  },
  updateStore(id, { name, emoji }) {
    db.prepare('UPDATE stores SET name = ?, emoji = ? WHERE id = ?').run(name, emoji || '🏪', id);
    return this.getStore(id);
  },
  deleteStore(id) {
    return db.prepare('DELETE FROM stores WHERE id = ?').run(id).changes > 0;
  },

  // ── Tax types ──────────────────────────────────────────────────────────────
  getTaxTypes(inventoryId) {
    return db.prepare('SELECT * FROM tax_types WHERE inventory_id = ? ORDER BY name').all(inventoryId);
  },
  getTaxType(id) {
    return db.prepare('SELECT * FROM tax_types WHERE id = ?').get(id);
  },
  createTaxType({ inventoryId, name, rate, categories, active }) {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO tax_types (inventory_id, name, rate, categories, active) VALUES (?, ?, ?, ?, ?)'
    ).run(inventoryId, name.trim(), +rate, JSON.stringify(categories || []), active ? 1 : 0);
    return this.getTaxType(lastInsertRowid);
  },
  updateTaxType(id, { name, rate, categories, active }) {
    db.prepare('UPDATE tax_types SET name=?, rate=?, categories=?, active=? WHERE id=?')
      .run(name.trim(), +rate, JSON.stringify(categories || []), active ? 1 : 0, id);
    return this.getTaxType(id);
  },
  deleteTaxType(id) {
    return db.prepare('DELETE FROM tax_types WHERE id = ?').run(id).changes > 0;
  },

  // ── Purchases ──────────────────────────────────────────────────────────────
  createPurchaseSession({ inventoryId, userId, items, taxIds, currency, purchaseDate, receiptImage }) {
    let subtotalBeforeTax = 0;
    let totalTax = 0;
    let taxBreakdown = null;

    items.forEach(item => {
      const base = (item.quantityBought != null && item.unitPrice != null)
        ? +(item.quantityBought) * +(item.unitPrice) : 0;
      subtotalBeforeTax += base;
    });

    if (taxIds?.length) {
      // Invoice-level taxes: look up each tax and apply to the total subtotal
      const groups = {};
      taxIds.forEach(taxId => {
        const tax = db.prepare('SELECT * FROM tax_types WHERE id = ? AND inventory_id = ?').get(+taxId, inventoryId);
        if (tax) {
          const amt = subtotalBeforeTax * (+tax.rate / 100);
          totalTax += amt;
          groups[taxId] = { taxId: tax.id, taxName: tax.name, taxRate: +tax.rate, taxAmount: amt };
        }
      });
      if (Object.keys(groups).length) taxBreakdown = JSON.stringify(Object.values(groups));
    } else {
      // Legacy: per-item tax data
      const groups = {};
      items.forEach(item => {
        const taxAmt = item.taxAmount != null ? +item.taxAmount : 0;
        totalTax += taxAmt;
        if (item.taxId && taxAmt > 0) {
          const k = String(item.taxId);
          if (!groups[k]) groups[k] = { taxId: +item.taxId, taxName: item.taxName || '', taxRate: +item.taxRate || 0, taxAmount: 0 };
          groups[k].taxAmount += taxAmt;
        }
      });
      if (Object.keys(groups).length) taxBreakdown = JSON.stringify(Object.values(groups));
    }

    const totalAmount = subtotalBeforeTax + totalTax;

    db.exec('BEGIN');
    try {
      const { lastInsertRowid: sessionId } = db.prepare(`
        INSERT INTO purchase_sessions
          (inventory_id, user_id, total_amount, currency, purchase_date, receipt_image,
           subtotal_before_tax, total_tax, tax_breakdown)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(inventoryId, userId, totalAmount, currency, purchaseDate, receiptImage || null,
             subtotalBeforeTax || null, totalTax || null, taxBreakdown);

      const insItem = db.prepare(`
        INSERT INTO purchase_items
          (session_id, product_id, product_name, store_id, quantity_bought, unit,
           unit_price, subtotal, tax_id, tax_rate, tax_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updQty = db.prepare(`
        UPDATE products
        SET current_qty = current_qty + ?,
            updated_at  = datetime('now','localtime')
        WHERE id = ? AND inventory_id = ?
      `);

      items.forEach(item => {
        const base = (item.quantityBought != null && item.unitPrice != null)
          ? +(item.quantityBought) * +(item.unitPrice) : null;
        const taxAmt = item.taxAmount != null ? +item.taxAmount : null;
        const sub = base != null ? base + (taxAmt || 0) : null;
        insItem.run(
          sessionId,
          item.productId    || null,
          item.productName,
          item.storeId      || null,
          +(item.quantityBought) || 0,
          item.unit         || 'unidades',
          item.unitPrice    != null ? +item.unitPrice  : null,
          sub,
          item.taxId        || null,
          item.taxRate      != null ? +item.taxRate    : null,
          taxAmt
        );
        if (item.productId && +(item.quantityBought) > 0) {
          updQty.run(+(item.quantityBought), +item.productId, inventoryId);
        }
      });

      db.exec('COMMIT');
      return db.prepare('SELECT * FROM purchase_sessions WHERE id = ?').get(sessionId);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  deletePurchaseSession(sessionId, inventoryId, { revertInventory = false } = {}) {
    const session = db.prepare(
      'SELECT * FROM purchase_sessions WHERE id = ? AND inventory_id = ?'
    ).get(sessionId, inventoryId);
    if (!session) return null;

    db.exec('BEGIN');
    try {
      if (revertInventory) {
        const items = db.prepare('SELECT * FROM purchase_items WHERE session_id = ?').all(sessionId);
        const updQty = db.prepare(`
          UPDATE products
          SET current_qty = MAX(0, current_qty - ?),
              updated_at  = datetime('now','localtime')
          WHERE id = ? AND inventory_id = ?
        `);
        items.forEach(item => {
          if (item.product_id && +item.quantity_bought > 0) {
            updQty.run(+item.quantity_bought, item.product_id, inventoryId);
          }
        });
      }
      db.prepare('DELETE FROM purchase_sessions WHERE id = ?').run(sessionId);
      db.exec('COMMIT');
      return { deleted: true, receipt_image: session.receipt_image };
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  updateReceiptImage(sessionId, imagePath) {
    db.prepare('UPDATE purchase_sessions SET receipt_image = ? WHERE id = ?').run(imagePath, sessionId);
  },

  updatePurchaseSession(sessionId, inventoryId, { purchaseDate, items, taxIds = [] }) {
    const session = db.prepare(
      'SELECT * FROM purchase_sessions WHERE id = ? AND inventory_id = ?'
    ).get(sessionId, inventoryId);
    if (!session) return null;

    let subtotalBeforeTax = 0;
    items.forEach(item => {
      if (item.quantityBought != null && item.unitPrice != null) {
        subtotalBeforeTax += +(item.quantityBought) * +(item.unitPrice);
      }
    });

    let totalTax = 0;
    const taxBreakdownArr = [];
    taxIds.forEach(taxId => {
      const tax = db.prepare('SELECT * FROM tax_types WHERE id = ? AND inventory_id = ?').get(taxId, inventoryId);
      if (tax && tax.active) {
        const taxAmount = +(subtotalBeforeTax * (tax.rate / 100)).toFixed(4);
        totalTax += taxAmount;
        taxBreakdownArr.push({ taxId: tax.id, taxName: tax.name, taxRate: tax.rate, taxAmount });
      }
    });

    const totalAmount = subtotalBeforeTax + totalTax;
    const taxBreakdown = taxBreakdownArr.length ? JSON.stringify(taxBreakdownArr) : null;

    db.exec('BEGIN');
    try {
      db.prepare(`
        UPDATE purchase_sessions
        SET total_amount = ?, purchase_date = ?,
            subtotal_before_tax = ?, total_tax = ?, tax_breakdown = ?
        WHERE id = ?
      `).run(totalAmount, purchaseDate, subtotalBeforeTax || null, totalTax || null, taxBreakdown, sessionId);

      db.prepare('DELETE FROM purchase_items WHERE session_id = ?').run(sessionId);

      const insItem = db.prepare(`
        INSERT INTO purchase_items
          (session_id, product_id, product_name, store_id, quantity_bought, unit, unit_price, subtotal,
           tax_id, tax_rate, tax_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
      `);
      items.forEach(item => {
        const base = (item.quantityBought != null && item.unitPrice != null)
          ? +(item.quantityBought) * +(item.unitPrice) : null;
        insItem.run(
          sessionId,
          item.productId    || null,
          item.productName,
          item.storeId      || null,
          +(item.quantityBought) || 0,
          item.unit         || 'unidades',
          item.unitPrice    != null ? +item.unitPrice : null,
          base
        );
      });

      db.exec('COMMIT');
      return db.prepare('SELECT * FROM purchase_sessions WHERE id = ?').get(sessionId);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  getPurchaseSessions(inventoryId, { month, storeId } = {}) {
    let sql = `
      SELECT ps.id, ps.purchase_date, ps.total_amount, ps.currency,
             ps.receipt_image, ps.subtotal_before_tax, ps.total_tax, ps.tax_breakdown,
             ps.created_at, u.name AS user_name,
             (SELECT COUNT(*) FROM purchase_items WHERE session_id = ps.id) AS item_count
      FROM purchase_sessions ps
      JOIN users u ON u.id = ps.user_id
      WHERE ps.inventory_id = ?
    `;
    const params = [inventoryId];
    if (month)   { sql += ` AND strftime('%Y-%m', ps.purchase_date) = ?`; params.push(month); }
    if (storeId) {
      sql += ` AND ps.id IN (SELECT DISTINCT session_id FROM purchase_items WHERE store_id = ?)`;
      params.push(storeId);
    }
    sql += ` ORDER BY ps.purchase_date DESC, ps.created_at DESC`;
    return db.prepare(sql).all(...params);
  },

  getPurchaseSession(id) {
    const session = db.prepare('SELECT * FROM purchase_sessions WHERE id = ?').get(id);
    if (!session) return null;
    session.items = db.prepare(`
      SELECT pi.*, s.name AS store_name, s.emoji AS store_emoji
      FROM purchase_items pi
      LEFT JOIN stores s ON s.id = pi.store_id
      WHERE pi.session_id = ?
      ORDER BY pi.store_id, pi.product_name
    `).all(id);
    return session;
  },

  getMonthlySummary(inventoryId) {
    return db.prepare(`
      SELECT strftime('%Y-%m', purchase_date) AS month,
             SUM(total_amount) AS total,
             COUNT(*) AS sessions
      FROM purchase_sessions
      WHERE inventory_id = ?
      GROUP BY month
      ORDER BY month DESC
      LIMIT 3
    `).all(inventoryId);
  },

  getDashboardData(inventoryId, period = 'month') {
    const daysMap = { month: 30, '3m': 90, '6m': 180, year: 365 };
    const days = daysMap[period] || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const start = startDate.toISOString().slice(0, 10);

    const now = new Date();
    const thisMonthStr = now.toISOString().slice(0, 7);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = prevDate.toISOString().slice(0, 7);

    const { total }    = db.prepare('SELECT COUNT(*) AS total    FROM products WHERE inventory_id = ?').get(inventoryId);
    const { critical } = db.prepare('SELECT COUNT(*) AS critical FROM products WHERE inventory_id = ? AND current_qty < min_qty').get(inventoryId);

    const { amount: thisMonth }  = db.prepare(`
      SELECT COALESCE(SUM(total_amount),0) AS amount FROM purchase_sessions
      WHERE inventory_id = ? AND strftime('%Y-%m', purchase_date) = ?
    `).get(inventoryId, thisMonthStr);

    const { amount: lastMonthAmt } = db.prepare(`
      SELECT COALESCE(SUM(total_amount),0) AS amount FROM purchase_sessions
      WHERE inventory_id = ? AND strftime('%Y-%m', purchase_date) = ?
    `).get(inventoryId, lastMonthStr);

    let variation = null;
    if (lastMonthAmt > 0) variation = Math.round(((thisMonth - lastMonthAmt) / lastMonthAmt) * 100);

    const monthlySpend = db.prepare(`
      SELECT strftime('%Y-%m', purchase_date) AS month,
             COALESCE(SUM(total_amount),0) AS total
      FROM purchase_sessions
      WHERE inventory_id = ? AND purchase_date >= date('now','localtime','-6 months')
      GROUP BY month ORDER BY month
    `).all(inventoryId);

    const byCategory = db.prepare(`
      SELECT category, COUNT(*) AS count
      FROM products WHERE inventory_id = ?
      GROUP BY category ORDER BY count DESC
    `).all(inventoryId);

    const byStore = db.prepare(`
      SELECT COALESCE(s.name,'Sin establecimiento') AS store_name,
             COALESCE(s.emoji,'🏪') AS store_emoji,
             COALESCE(SUM(pi.subtotal),0) AS total
      FROM purchase_items pi
      LEFT JOIN stores s ON s.id = pi.store_id
      JOIN purchase_sessions ps ON ps.id = pi.session_id
      WHERE ps.inventory_id = ? AND ps.purchase_date >= ?
      GROUP BY pi.store_id ORDER BY total DESC LIMIT 6
    `).all(inventoryId, start);

    const topProducts = db.prepare(`
      SELECT pi.product_name,
             SUM(pi.quantity_bought) AS total_qty,
             COUNT(*) AS purchase_count,
             MAX(pi.unit) AS unit
      FROM purchase_items pi
      JOIN purchase_sessions ps ON ps.id = pi.session_id
      WHERE ps.inventory_id = ? AND ps.purchase_date >= ?
      GROUP BY pi.product_name
      ORDER BY purchase_count DESC, total_qty DESC LIMIT 5
    `).all(inventoryId, start);

    return {
      summary: { total, critical, thisMonth, lastMonth: lastMonthAmt, variation },
      monthlySpend,
      byCategory,
      byStore,
      topProducts,
    };
  },

  // ── Budget ────────────────────────────────────────────────────────────────────

  getBudgetConfig(inventoryId) {
    const row = db.prepare('SELECT * FROM budget_config WHERE inventory_id = ?').get(inventoryId);
    if (!row) return null;
    try { row.alert_percentages = JSON.parse(row.alert_percentages); } catch { row.alert_percentages = []; }
    return row;
  },

  saveBudgetConfig(inventoryId, { monthlyAmount, alertPercentages }) {
    const existing = db.prepare('SELECT id FROM budget_config WHERE inventory_id = ?').get(inventoryId);
    const json = JSON.stringify(alertPercentages || []);
    if (existing) {
      db.prepare(`UPDATE budget_config SET monthly_amount = ?, alert_percentages = ?,
        updated_at = datetime('now','localtime') WHERE inventory_id = ?`
      ).run(monthlyAmount, json, inventoryId);
    } else {
      db.prepare(`INSERT INTO budget_config (inventory_id, monthly_amount, alert_percentages)
        VALUES (?, ?, ?)`).run(inventoryId, monthlyAmount, json);
    }
    return this.getBudgetConfig(inventoryId);
  },

  getBudgetResets(inventoryId) {
    return db.prepare(`
      SELECT br.*, u.name AS user_name
      FROM budget_resets br
      LEFT JOIN users u ON br.created_by = u.id
      WHERE br.inventory_id = ?
      ORDER BY br.created_at DESC LIMIT 20
    `).all(inventoryId);
  },

  addBudgetReset(inventoryId, userId) {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    const lastReset = db.prepare(`
      SELECT reset_date FROM budget_resets
      WHERE inventory_id = ? AND reset_date >= ?
      ORDER BY reset_date DESC LIMIT 1
    `).get(inventoryId, monthStart);
    const fromDate = lastReset ? lastReset.reset_date : monthStart;
    const { spent } = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS spent FROM purchase_sessions
      WHERE inventory_id = ? AND purchase_date >= ? AND purchase_date <= ?
    `).get(inventoryId, fromDate, today);
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO budget_resets (inventory_id, reset_date, spent_at_reset, created_by)
      VALUES (?, ?, ?, ?)
    `).run(inventoryId, today, spent, userId);
    return db.prepare('SELECT * FROM budget_resets WHERE id = ?').get(lastInsertRowid);
  },

  getBudgetSummary(inventoryId) {
    const config = this.getBudgetConfig(inventoryId);
    const today  = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    const now = new Date();
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

    if (!config || !config.monthly_amount) {
      return { config, spent: 0, available: 0, percentage: 0, activeThreshold: null, daysLeft };
    }

    const lastReset = db.prepare(`
      SELECT reset_date FROM budget_resets
      WHERE inventory_id = ? AND reset_date >= ?
      ORDER BY reset_date DESC LIMIT 1
    `).get(inventoryId, monthStart);
    const fromDate = lastReset ? lastReset.reset_date : monthStart;

    const { spent } = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS spent FROM purchase_sessions
      WHERE inventory_id = ? AND purchase_date >= ? AND purchase_date <= ?
    `).get(inventoryId, fromDate, today);

    const budget    = config.monthly_amount;
    const available = budget - spent;
    const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;

    const activeThreshold = (config.alert_percentages || [])
      .filter(p => p.active && percentage >= p.pct)
      .sort((a, b) => b.pct - a.pct)[0] || null;

    return { config, spent, available, percentage, activeThreshold, daysLeft };
  },
};
