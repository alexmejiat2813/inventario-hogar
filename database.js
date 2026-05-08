// Requires Node.js 24+ (node:sqlite is stable since v24)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'inventario.db'));

db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    current_qty REAL    NOT NULL DEFAULT 0,
    min_qty     REAL    NOT NULL DEFAULT 0,
    unit        TEXT    NOT NULL DEFAULT 'unidades',
    created_at  TEXT    DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT    DEFAULT (datetime('now', 'localtime'))
  )
`);

// Seed data on first run
const { count } = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (count === 0) {
  const ins = db.prepare(
    'INSERT INTO products (name, category, current_qty, min_qty, unit) VALUES (?, ?, ?, ?, ?)'
  );
  [
    // Críticos (debajo del mínimo)
    ['Aceite de oliva',    'Alimentos', 0.3,  1,    'lt'],
    ['Sal fina',           'Alimentos', 200,  500,  'g'],
    ['Jugo de naranja',    'Bebidas',   0,    2,    'lt'],
    ['Detergente ropa',    'Aseo',      0.5,  2,    'lt'],
    ['Cloro multiusos',    'Aseo',      0,    1,    'lt'],
    ['Papel higiénico',    'Aseo',      2,    6,    'unidades'],
    ['Fideos',             'Alacena',   300,  1000, 'g'],
    // Bien abastecidos
    ['Arroz',              'Alacena',   3,    2,    'kg'],
    ['Azúcar',             'Alacena',   2,    1,    'kg'],
    ['Lentejas',           'Alacena',   800,  500,  'g'],
    ['Leche',              'Bebidas',   8,    4,    'unidades'],
    ['Agua mineral',       'Bebidas',   18,   6,    'botellas'],
    ['Café molido',        'Bebidas',   300,  250,  'g'],
    ['Jabón de manos',     'Aseo',      4,    2,    'unidades'],
    ['Shampoo',            'Aseo',      2,    1,    'unidades'],
    ['Esponja de cocina',  'Otros',     3,    2,    'unidades'],
  ].forEach(row => ins.run(...row));
}

module.exports = {
  getAll() {
    return db.prepare(
      'SELECT * FROM products ORDER BY category, name'
    ).all();
  },

  getByCategory(category) {
    return db.prepare(
      'SELECT * FROM products WHERE category = ? ORDER BY name'
    ).all(category);
  },

  getById(id) {
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  },

  create({ name, category, current_qty, min_qty, unit }) {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO products (name, category, current_qty, min_qty, unit) VALUES (?, ?, ?, ?, ?)'
    ).run(name, category, current_qty, min_qty, unit);
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

  getStats() {
    const CATEGORIES = ['Alimentos', 'Aseo', 'Alacena', 'Bebidas', 'Otros'];
    const { total }    = db.prepare('SELECT COUNT(*) as total FROM products').get();
    const { critical } = db.prepare(
      'SELECT COUNT(*) as critical FROM products WHERE current_qty < min_qty'
    ).get();
    const raw = db.prepare(
      'SELECT category, COUNT(*) as count FROM products GROUP BY category'
    ).all();
    const catMap = Object.fromEntries(raw.map(r => [r.category, r.count]));
    const byCategory = CATEGORIES.map(cat => ({ category: cat, count: catMap[cat] || 0 }));
    return { total, critical, byCategory };
  },
};
