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

  CREATE TABLE IF NOT EXISTS products (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    category     TEXT    NOT NULL,
    current_qty  REAL    NOT NULL DEFAULT 0,
    min_qty      REAL    NOT NULL DEFAULT 0,
    unit         TEXT    NOT NULL DEFAULT 'unidades',
    inventory_id INTEGER REFERENCES inventories(id) ON DELETE CASCADE,
    created_at   TEXT    DEFAULT (datetime('now','localtime')),
    updated_at   TEXT    DEFAULT (datetime('now','localtime'))
  );
`);

// ── Migration: add inventory_id column if upgrading from v1 ───────────────────
const productCols = db.prepare('PRAGMA table_info(products)').all();
if (!productCols.find(c => c.name === 'inventory_id')) {
  db.exec('ALTER TABLE products ADD COLUMN inventory_id INTEGER REFERENCES inventories(id) ON DELETE CASCADE');
}

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
    return db.prepare(
      'SELECT * FROM products WHERE inventory_id = ? ORDER BY category, name'
    ).all(inventoryId);
  },

  getByCategory(inventoryId, category) {
    return db.prepare(
      'SELECT * FROM products WHERE inventory_id = ? AND category = ? ORDER BY name'
    ).all(inventoryId, category);
  },

  getById(id) {
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  },

  create({ name, category, current_qty, min_qty, unit, inventoryId }) {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO products (name, category, current_qty, min_qty, unit, inventory_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, category, current_qty, min_qty, unit, inventoryId);
    return this.getById(lastInsertRowid);
  },

  update(id, { name, category, current_qty, min_qty, unit }) {
    const { changes } = db.prepare(`
      UPDATE products
      SET name=?, category=?, current_qty=?, min_qty=?, unit=?,
          updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(name, category, current_qty, min_qty, unit, id);
    return changes > 0 ? this.getById(id) : null;
  },

  remove(id) {
    return db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0;
  },

  getStats(inventoryId) {
    const CATEGORIES = ['Alimentos', 'Aseo', 'Alacena', 'Bebidas', 'Otros'];
    const { total }    = db.prepare('SELECT COUNT(*) as total    FROM products WHERE inventory_id = ?').get(inventoryId);
    const { critical } = db.prepare('SELECT COUNT(*) as critical FROM products WHERE inventory_id = ? AND current_qty < min_qty').get(inventoryId);
    const raw = db.prepare('SELECT category, COUNT(*) as count FROM products WHERE inventory_id = ? GROUP BY category').all(inventoryId);
    const catMap = Object.fromEntries(raw.map(r => [r.category, r.count]));
    return { total, critical, byCategory: CATEGORIES.map(cat => ({ category: cat, count: catMap[cat] || 0 })) };
  },
};
