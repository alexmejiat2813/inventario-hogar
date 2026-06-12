const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'inventario.db');
const db = new DatabaseSync(DB_PATH);
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

  CREATE TABLE IF NOT EXISTS shopping_list_custom_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    checked      INTEGER NOT NULL DEFAULT 0,
    checked_at   TEXT,
    created_at   TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id  INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name     TEXT,
    action        TEXT    NOT NULL,
    resource_type TEXT,
    resource_id   INTEGER,
    details       TEXT,
    created_at    TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT    NOT NULL,
    auth       TEXT    NOT NULL,
    p256dh     TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS personal_budgets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category   TEXT    NOT NULL,
    amount     REAL    NOT NULL DEFAULT 0,
    month      TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now','localtime')),
    UNIQUE(user_id, category, month)
  );

  CREATE TABLE IF NOT EXISTS personal_transactions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inventory_id INTEGER REFERENCES inventories(id) ON DELETE SET NULL,
    type         TEXT    NOT NULL CHECK(type IN ('income','expense')),
    category     TEXT    NOT NULL,
    amount       REAL    NOT NULL,
    description  TEXT,
    date         TEXT    NOT NULL,
    created_at   TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS personal_budget_plans (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             TEXT    NOT NULL,
    inventory_id     INTEGER REFERENCES inventories(id) ON DELETE SET NULL,
    estimated_income REAL    NOT NULL DEFAULT 0,
    created_at       TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS personal_budget_plan_categories (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id  INTEGER NOT NULL REFERENCES personal_budget_plans(id) ON DELETE CASCADE,
    category TEXT    NOT NULL,
    amount   REAL    NOT NULL DEFAULT 0
  );
`);

// ── Indexes ───────────────────────────────────────────────────────────────────
// FKs y columnas de filtro frecuente. SQLite no indexa FKs automaticamente.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_products_inventory       ON products(inventory_id);
  CREATE INDEX IF NOT EXISTS idx_product_images_product   ON product_images(product_id);
  CREATE INDEX IF NOT EXISTS idx_stores_inventory         ON stores(inventory_id);
  CREATE INDEX IF NOT EXISTS idx_psessions_inv_date       ON purchase_sessions(inventory_id, purchase_date);
  CREATE INDEX IF NOT EXISTS idx_pitems_session           ON purchase_items(session_id);
  CREATE INDEX IF NOT EXISTS idx_pitems_product           ON purchase_items(product_id);
  CREATE INDEX IF NOT EXISTS idx_tax_types_inventory      ON tax_types(inventory_id);
  CREATE INDEX IF NOT EXISTS idx_budget_resets_inv_date   ON budget_resets(inventory_id, reset_date);
  CREATE INDEX IF NOT EXISTS idx_templates_inventory      ON list_templates(inventory_id);
  CREATE INDEX IF NOT EXISTS idx_template_items_template  ON list_template_items(template_id);
  CREATE INDEX IF NOT EXISTS idx_custom_items_inventory   ON shopping_list_custom_items(inventory_id);
  CREATE INDEX IF NOT EXISTS idx_audit_inv_created        ON audit_log(inventory_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_members_user             ON inventory_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_push_subs_user             ON push_subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_personal_budgets_user_month  ON personal_budgets(user_id, month);
  CREATE INDEX IF NOT EXISTS idx_personal_tx_user_date        ON personal_transactions(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_pb_plans_user               ON personal_budget_plans(user_id);
  CREATE INDEX IF NOT EXISTS idx_pb_plan_cats_plan           ON personal_budget_plan_categories(plan_id);
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

const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!userCols.includes('last_login_at')) db.exec('ALTER TABLE users ADD COLUMN last_login_at TEXT');

const itemCols = db.prepare('PRAGMA table_info(purchase_items)').all().map(c => c.name);
if (!itemCols.includes('tax_id'))     db.exec('ALTER TABLE purchase_items ADD COLUMN tax_id INTEGER REFERENCES tax_types(id) ON DELETE SET NULL');
if (!itemCols.includes('tax_rate'))   db.exec('ALTER TABLE purchase_items ADD COLUMN tax_rate REAL');
if (!itemCols.includes('tax_amount')) db.exec('ALTER TABLE purchase_items ADD COLUMN tax_amount REAL');

const tplItemCols = db.prepare('PRAGMA table_info(list_template_items)').all().map(c => c.name);
if (!tplItemCols.includes('store_id'))   db.exec('ALTER TABLE list_template_items ADD COLUMN store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL');
if (!tplItemCols.includes('unit_price')) db.exec('ALTER TABLE list_template_items ADD COLUMN unit_price REAL');

const pbCols = db.prepare('PRAGMA table_info(personal_budgets)').all().map(c => c.name);
if (!pbCols.includes('frequency'))    db.exec("ALTER TABLE personal_budgets ADD COLUMN frequency TEXT NOT NULL DEFAULT 'Mensual'");
if (!pbCols.includes('due_date'))     db.exec('ALTER TABLE personal_budgets ADD COLUMN due_date TEXT');
if (!pbCols.includes('flow_type'))    db.exec("ALTER TABLE personal_budgets ADD COLUMN flow_type TEXT NOT NULL DEFAULT 'expense'");
if (!pbCols.includes('inventory_id')) db.exec('ALTER TABLE personal_budgets ADD COLUMN inventory_id INTEGER REFERENCES inventories(id) ON DELETE SET NULL');

if (!sessionCols.includes('budget_category')) db.exec('ALTER TABLE purchase_sessions ADD COLUMN budget_category TEXT');

const ptCols = db.prepare('PRAGMA table_info(personal_transactions)').all().map(c => c.name);
if (!ptCols.includes('source')) {
  db.exec("ALTER TABLE personal_transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
}
if (!ptCols.includes('source_purchase_session_id')) {
  db.exec('ALTER TABLE personal_transactions ADD COLUMN source_purchase_session_id INTEGER REFERENCES purchase_sessions(id) ON DELETE SET NULL');
}

// ── Categorías: una sola tabla manda en todas las vistas ──────────────────────
// [name ES (canónico/almacenado en productos), name EN, name FR, emoji].
const BASE_CATEGORIES = [
  ['Alimentos',      'Food',              'Alimentation',     '🍎'],
  ['Bebidas',        'Drinks',            'Boissons',         '🥤'],
  ['Aseo Personal',  'Personal care',     'Soins personnels', '🧴'],
  ['Aseo del Hogar', 'Household cleaning', 'Entretien maison', '🧹'],
  ['Alacena',        'Pantry',            'Garde-manger',     '🫙'],
  ['Aseo',           'Cleaning',          'Nettoyage',        '🧼'],
  ['Otros',          'Other',             'Autres',           '📦'],
];

// Migración: traducciones (name_en/name_fr) + integridad. Asegura que TODA
// categoría usada por productos o catálogo exista como fila, para que aparezca
// como filtro con su ícono en cada vista (no se "pierde" ni queda sin emoji).
{
  const catCols = db.prepare('PRAGMA table_info(categories)').all().map(c => c.name);
  if (!catCols.includes('name_en')) db.exec('ALTER TABLE categories ADD COLUMN name_en TEXT');
  if (!catCols.includes('name_fr')) db.exec('ALTER TABLE categories ADD COLUMN name_fr TEXT');

  // Backfill de las 7 base (idempotente, respeta lo que el usuario ya editó).
  const upBase = db.prepare(`
    UPDATE categories SET
      name_en = COALESCE(name_en, ?),
      name_fr = COALESCE(name_fr, ?),
      emoji   = CASE WHEN emoji IS NULL OR emoji = '' OR emoji = '📦' THEN ? ELSE emoji END
    WHERE name = ?
  `);
  BASE_CATEGORIES.forEach(([es, en, fr, emoji]) => upBase.run(en, fr, emoji, es));

  // Auto-crear categorías usadas por productos/catálogo que falten en la tabla.
  const used = db.prepare(`
    SELECT DISTINCT category AS name FROM products        WHERE category IS NOT NULL AND category <> ''
    UNION
    SELECT DISTINCT category AS name FROM catalog_products WHERE category IS NOT NULL AND category <> ''
  `).all();
  const hasCat = db.prepare('SELECT 1 AS x FROM categories WHERE LOWER(name) = LOWER(?)');
  const insCat = db.prepare('INSERT INTO categories (name, emoji) VALUES (?, ?)');
  used.forEach(({ name }) => { if (!hasCat.get(name)) insCat.run(name, '📦'); });
}

// ── Catalog seed (100 products) — ver bloque "Seeds de primera ejecución" ─────
// [i18n_key, nombre ES (canónico en DB), categoría]. El frontend muestra
// locales catalogSeed.<i18n_key>; si el usuario renombra, la key se limpia.
const CATALOG_SEED = [
  // Alimentos (30)
  ['arroz',               'Arroz',                'Alimentos'],
  ['harina_de_trigo',     'Harina de trigo',      'Alimentos'],
  ['harina_de_maiz',      'Harina de maíz',       'Alimentos'],
  ['pasta',               'Pasta',                'Alimentos'],
  ['avena',               'Avena',                'Alimentos'],
  ['lentejas',            'Lentejas',             'Alimentos'],
  ['frijoles',            'Frijoles',             'Alimentos'],
  ['garbanzos',           'Garbanzos',            'Alimentos'],
  ['azucar',              'Azúcar',               'Alimentos'],
  ['sal',                 'Sal',                  'Alimentos'],
  ['aceite_vegetal',      'Aceite vegetal',       'Alimentos'],
  ['aceite_de_oliva',     'Aceite de oliva',      'Alimentos'],
  ['vinagre',             'Vinagre',              'Alimentos'],
  ['salsa_de_tomate',     'Salsa de tomate',      'Alimentos'],
  ['mayonesa',            'Mayonesa',             'Alimentos'],
  ['mostaza',             'Mostaza',              'Alimentos'],
  ['atun_en_lata',        'Atún en lata',         'Alimentos'],
  ['sardinas',            'Sardinas',             'Alimentos'],
  ['leche',               'Leche',                'Alimentos'],
  ['leche_en_polvo',      'Leche en polvo',       'Alimentos'],
  ['huevos',              'Huevos',               'Alimentos'],
  ['mantequilla',         'Mantequilla',          'Alimentos'],
  ['queso',               'Queso',                'Alimentos'],
  ['yogur',               'Yogur',                'Alimentos'],
  ['pan',                 'Pan',                  'Alimentos'],
  ['galletas',            'Galletas',             'Alimentos'],
  ['cereal',              'Cereal',               'Alimentos'],
  ['cafe',                'Café',                 'Alimentos'],
  ['te',                  'Té',                   'Alimentos'],
  ['chocolate_en_polvo',  'Chocolate en polvo',   'Alimentos'],
  // Bebidas (10)
  ['agua_embotellada',    'Agua embotellada',     'Bebidas'],
  ['jugo_de_naranja',     'Jugo de naranja',      'Bebidas'],
  ['jugo_de_manzana',     'Jugo de manzana',      'Bebidas'],
  ['refresco_cola',       'Refresco cola',        'Bebidas'],
  ['refresco_lima',       'Refresco lima',        'Bebidas'],
  ['agua_saborizada',     'Agua saborizada',      'Bebidas'],
  ['bebida_energetica',   'Bebida energética',    'Bebidas'],
  ['leche_de_almendra',   'Leche de almendra',    'Bebidas'],
  ['leche_de_soya',       'Leche de soya',        'Bebidas'],
  ['agua_con_gas',        'Agua con gas',         'Bebidas'],
  // Aseo Personal (20)
  ['jabon_de_bano',       'Jabón de baño',        'Aseo Personal'],
  ['shampoo',             'Shampoo',              'Aseo Personal'],
  ['acondicionador',      'Acondicionador',       'Aseo Personal'],
  ['pasta_dental',        'Pasta dental',         'Aseo Personal'],
  ['cepillo_de_dientes',  'Cepillo de dientes',   'Aseo Personal'],
  ['hilo_dental',         'Hilo dental',          'Aseo Personal'],
  ['desodorante',         'Desodorante',          'Aseo Personal'],
  ['papel_higienico',     'Papel higiénico',      'Aseo Personal'],
  ['toallas_humedas',     'Toallas húmedas',      'Aseo Personal'],
  ['algodon',             'Algodón',              'Aseo Personal'],
  ['crema_corporal',      'Crema corporal',       'Aseo Personal'],
  ['crema_facial',        'Crema facial',         'Aseo Personal'],
  ['protector_solar',     'Protector solar',      'Aseo Personal'],
  ['rastrillos',          'Rastrillos',           'Aseo Personal'],
  ['espuma_de_afeitar',   'Espuma de afeitar',    'Aseo Personal'],
  ['perfume',             'Perfume',              'Aseo Personal'],
  ['maquillaje_base',     'Maquillaje base',      'Aseo Personal'],
  ['labial',              'Labial',               'Aseo Personal'],
  ['tampones',            'Tampones',             'Aseo Personal'],
  ['toallas_sanitarias',  'Toallas sanitarias',   'Aseo Personal'],
  // Aseo del Hogar (20)
  ['detergente_ropa',     'Detergente ropa',      'Aseo del Hogar'],
  ['suavizante_ropa',     'Suavizante ropa',      'Aseo del Hogar'],
  ['jabon_lavar_platos',  'Jabón lavar platos',   'Aseo del Hogar'],
  ['esponja',             'Esponja',              'Aseo del Hogar'],
  ['cloro',               'Cloro',                'Aseo del Hogar'],
  ['desinfectante_piso',  'Desinfectante piso',   'Aseo del Hogar'],
  ['limpiavidrios',       'Limpiavidrios',        'Aseo del Hogar'],
  ['limpiador_multiusos', 'Limpiador multiusos',  'Aseo del Hogar'],
  ['quitamanchas',        'Quitamanchas',         'Aseo del Hogar'],
  ['bolsas_de_basura',    'Bolsas de basura',     'Aseo del Hogar'],
  ['papel_cocina',        'Papel cocina',         'Aseo del Hogar'],
  ['servilletas',         'Servilletas',          'Aseo del Hogar'],
  ['guantes_de_caucho',   'Guantes de caucho',    'Aseo del Hogar'],
  ['escoba',              'Escoba',               'Aseo del Hogar'],
  ['trapeador',           'Trapeador',            'Aseo del Hogar'],
  ['recogedor',           'Recogedor',            'Aseo del Hogar'],
  ['ambientador_spray',   'Ambientador spray',    'Aseo del Hogar'],
  ['velas',               'Velas',                'Aseo del Hogar'],
  ['fosforos',            'Fósforos',             'Aseo del Hogar'],
  ['insecticida',         'Insecticida',          'Aseo del Hogar'],
  // Alacena (20)
  ['pimienta_negra',      'Pimienta negra',       'Alacena'],
  ['comino',              'Comino',               'Alacena'],
  ['oregano',             'Orégano',              'Alacena'],
  ['ajo_en_polvo',        'Ajo en polvo',         'Alacena'],
  ['cebolla_en_polvo',    'Cebolla en polvo',     'Alacena'],
  ['curry',               'Curry',                'Alacena'],
  ['canela',              'Canela',               'Alacena'],
  ['vainilla',            'Vainilla',             'Alacena'],
  ['polvo_de_hornear',    'Polvo de hornear',     'Alacena'],
  ['bicarbonato',         'Bicarbonato',          'Alacena'],
  ['maicena',             'Maicena',              'Alacena'],
  ['gelatina',            'Gelatina',             'Alacena'],
  ['miel',                'Miel',                 'Alacena'],
  ['mermelada',           'Mermelada',            'Alacena'],
  ['mantequilla_de_mani', 'Mantequilla de maní',  'Alacena'],
  ['chocolate_negro',     'Chocolate negro',      'Alacena'],
  ['caldo_de_pollo',      'Caldo de pollo',       'Alacena'],
  ['sazonador',           'Sazonador',            'Alacena'],
  ['laurel',              'Laurel',               'Alacena'],
  ['tomillo',             'Tomillo',              'Alacena'],
];

// ── Migración: i18n_key en catalog_products ───────────────────────────────────
// Identifica productos sembrados para mostrarlos traducidos en el frontend
// (locales catalogSeed.<key>). Backfill por nombre exacto del seed original:
// los renombrados por el usuario no coinciden y quedan sin key (se muestran
// con su nombre tal cual, que es lo correcto).
{
  const catCols = db.prepare('PRAGMA table_info(catalog_products)').all().map(c => c.name);
  if (!catCols.includes('i18n_key')) {
    db.exec('ALTER TABLE catalog_products ADD COLUMN i18n_key TEXT');
    const upd = db.prepare('UPDATE catalog_products SET i18n_key = ? WHERE name = ? AND i18n_key IS NULL');
    CATALOG_SEED.forEach(([key, name]) => upd.run(key, name));
  }
}

// ── Seeds de primera ejecución ────────────────────────────────────────────────
// PRAGMA user_version marca si los seeds ya corrieron (v1). Antes corrían con
// INSERT OR IGNORE en CADA arranque: un producto del catálogo borrado o
// renombrado por el usuario "resucitaba" tras cada deploy/restart.
// En DBs ya pobladas (pre-fix) solo se marca el flag SIN resembrar, para
// respetar lo que el usuario haya borrado.
{
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version < 1) {
    const isEmpty = table => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n === 0;

    if (isEmpty('categories')) {
      const ins = db.prepare('INSERT OR IGNORE INTO categories (name, name_en, name_fr, emoji) VALUES (?, ?, ?, ?)');
      BASE_CATEGORIES.forEach(([es, en, fr, emoji]) => ins.run(es, en, fr, emoji));
    }

    if (isEmpty('units')) {
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

    if (isEmpty('catalog_products')) {
      const ins = db.prepare('INSERT OR IGNORE INTO catalog_products (i18n_key, name, category) VALUES (?, ?, ?)');
      CATALOG_SEED.forEach(([key, name, category]) => ins.run(key, name, category));
    }

    db.exec('PRAGMA user_version = 1');
  }
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
      INSERT INTO users (google_id, name, email, photo, last_login_at)
      VALUES (?, ?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(google_id) DO UPDATE SET
        name=excluded.name, email=excluded.email, photo=excluded.photo,
        last_login_at=datetime('now','localtime')
    `).run(google_id, name, email, photo);
    const user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(google_id);
    return { ...user, is_new: !existing };
  },

  // ── Inventories ────────────────────────────────────────────────────────────
  getUserInventories(userId) {
    return db.prepare(`
      SELECT i.id, i.name, i.owner_id, i.created_at, i.currency,
             im.role,
             u.name  AS owner_name,
             (SELECT COUNT(*) FROM inventory_members WHERE inventory_id = i.id) AS member_count,
             (SELECT COUNT(*) FROM products WHERE inventory_id = i.id) AS product_count,
             (SELECT COUNT(*) FROM products WHERE inventory_id = i.id AND current_qty < min_qty) AS critical_count
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

  updateMemberRole(inventoryId, userId, role) {
    const { changes } = db.prepare(
      'UPDATE inventory_members SET role = ? WHERE inventory_id = ? AND user_id = ?'
    ).run(role, inventoryId, userId);
    return changes > 0;
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
             (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) AS image_count,
             (SELECT image_path FROM product_images WHERE product_id = p.id ORDER BY created_at LIMIT 1) AS first_image,
             (SELECT json_group_array(image_path) FROM (SELECT image_path FROM product_images WHERE product_id = p.id ORDER BY created_at)) AS images
      FROM products p
      WHERE p.inventory_id = ?
      ORDER BY p.category, p.name
    `).all(inventoryId);
  },

  getByCategory(inventoryId, category) {
    return db.prepare(`
      SELECT p.*,
             (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) AS image_count,
             (SELECT image_path FROM product_images WHERE product_id = p.id ORDER BY created_at LIMIT 1) AS first_image,
             (SELECT json_group_array(image_path) FROM (SELECT image_path FROM product_images WHERE product_id = p.id ORDER BY created_at)) AS images
      FROM products p
      WHERE p.inventory_id = ? AND p.category = ?
      ORDER BY p.name
    `).all(inventoryId, category);
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

  createCategory({ name, name_en = null, name_fr = null, emoji }) {
    const existing = this.getCategoryByName(name);
    if (existing) return { error: 'Ya existe una categoría con ese nombre' };
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO categories (name, name_en, name_fr, emoji) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), name_en?.trim() || null, name_fr?.trim() || null, emoji || '📦');
    return { category: this.getCategory(lastInsertRowid) };
  },

  updateCategory(id, { name, name_en = null, name_fr = null, emoji }) {
    const existing = db.prepare(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?'
    ).get(name, id);
    if (existing) return { error: 'Ya existe una categoría con ese nombre' };
    const current = this.getCategory(id);
    const newName = name.trim();
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE categories SET name=?, name_en=?, name_fr=?, emoji=? WHERE id=?')
        .run(newName, name_en?.trim() || null, name_fr?.trim() || null, emoji || '📦', id);
      // Cascade rename: los productos y el catálogo guardan la categoría como
      // texto. Si cambia el nombre, propagar para no orfanar registros.
      if (current && current.name !== newName) {
        db.prepare('UPDATE products SET category = ? WHERE category = ?').run(newName, current.name);
        db.prepare('UPDATE catalog_products SET category = ? WHERE category = ?').run(newName, current.name);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return { category: this.getCategory(id) };
  },

  deleteCategory(id) {
    const cat = this.getCategory(id);
    if (!cat) return { error: 'not_found' };
    // En uso por productos o catálogo: no borrar (la migración la recrearía en
    // el próximo arranque). Para fusionar/limpiar, renombrar es el camino.
    const used =
      db.prepare('SELECT 1 AS x FROM products        WHERE category = ? LIMIT 1').get(cat.name) ||
      db.prepare('SELECT 1 AS x FROM catalog_products WHERE category = ? LIMIT 1').get(cat.name);
    if (used) return { error: 'in_use' };
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return { ok: true };
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
        SELECT cp.id, cp.name, cp.i18n_key, cp.category, cp.created_at,
          CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END AS in_inventory
        FROM catalog_products cp
        LEFT JOIN products p
          ON p.catalog_product_id = cp.id AND p.inventory_id = ?
        ORDER BY cp.category, cp.name
      `).all(inventoryId);
    }
    return db.prepare(`
      SELECT id, name, i18n_key, category, created_at, 0 AS in_inventory
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
    // Si el usuario renombra un producto sembrado, deja de traducirse:
    // se limpia i18n_key y se muestra el nombre que el usuario escribió.
    const current = this.getCatalogProduct(id);
    const renamed = current && current.name !== name.trim();
    db.prepare('UPDATE catalog_products SET name=?, category=?, i18n_key = CASE WHEN ? THEN NULL ELSE i18n_key END WHERE id=?')
      .run(name.trim(), category, renamed ? 1 : 0, id);
    return { product: this.getCatalogProduct(id) };
  },

  deleteCatalogProduct(id) {
    return db.prepare('DELETE FROM catalog_products WHERE id = ?').run(id).changes > 0;
  },

  addCatalogProductToInventory({ catalogProductId, inventoryId, currentQty, minQty, unit, displayName = null }) {
    const catalogProduct = this.getCatalogProduct(catalogProductId);
    if (!catalogProduct) return { error: 'Producto no encontrado en el catálogo' };

    const existing = db.prepare(
      'SELECT id FROM products WHERE inventory_id = ? AND catalog_product_id = ?'
    ).get(inventoryId, catalogProductId);
    if (existing) return { error: 'Este producto ya está en el inventario' };

    const product = this.create({
      // displayName: nombre traducido al idioma del usuario al momento de
      // agregar (el catálogo guarda el canónico ES como dato).
      name:             (displayName && displayName.trim()) || catalogProduct.name,
      // Categoría unificada: se preserva la del catálogo (la tabla categories
      // garantiza que exista como filtro en todas las vistas).
      category:         catalogProduct.category,
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

  // Inventario dueño de un archivo subido (por su web path), para autorizar
  // el acceso a /uploads. Devuelve inventory_id o null.
  getUploadOwnerInventory(webPath) {
    const img = db.prepare(`
      SELECT p.inventory_id AS inv
      FROM product_images pi JOIN products p ON p.id = pi.product_id
      WHERE pi.image_path = ? LIMIT 1
    `).get(webPath);
    if (img) return img.inv;
    const rec = db.prepare(
      'SELECT inventory_id AS inv FROM purchase_sessions WHERE receipt_image = ? LIMIT 1'
    ).get(webPath);
    return rec ? rec.inv : null;
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
             (p.min_qty - p.current_qty) AS needed,
             (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) AS image_count,
             (SELECT json_group_array(image_path) FROM (SELECT image_path FROM product_images WHERE product_id = p.id ORDER BY created_at)) AS images
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
    db.prepare('UPDATE shopping_list_items SET checked = 0, checked_at = NULL WHERE inventory_id = ?').run(inventoryId);
    db.prepare('UPDATE shopping_list_custom_items SET checked = 0, checked_at = NULL WHERE inventory_id = ?').run(inventoryId);
  },

  // ── Custom shopping items ──────────────────────────────────────
  // ── Audit log ──────────────────────────────────────────────────────────────────
  /** Fire-and-forget — never throws. Call after main operation succeeds. */
  audit(inventoryId, userId, userName, action, resourceType, resourceId, details) {
    try {
      db.prepare(`
        INSERT INTO audit_log (inventory_id, user_id, user_name, action, resource_type, resource_id, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        inventoryId,
        userId   ?? null,
        userName ?? null,
        action,
        resourceType ?? null,
        resourceId   ?? null,
        details ? JSON.stringify(details) : null,
      );
    } catch {}
  },

  getAuditLog(inventoryId, limit = 30) {
    return db.prepare(`
      SELECT id, user_name, action, resource_type, resource_id, details, created_at
      FROM audit_log
      WHERE inventory_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(inventoryId, limit);
  },

  // ── Custom shopping items ──────────────────────────────────────
  getCustomShoppingItems(inventoryId) {
    return db.prepare(
      'SELECT * FROM shopping_list_custom_items WHERE inventory_id = ? ORDER BY created_at ASC'
    ).all(inventoryId);
  },

  addCustomShoppingItem(inventoryId, name) {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO shopping_list_custom_items (inventory_id, name) VALUES (?, ?)'
    ).run(inventoryId, name.trim());
    return db.prepare('SELECT * FROM shopping_list_custom_items WHERE id = ?').get(lastInsertRowid);
  },

  setCustomShoppingItem(inventoryId, itemId, checked) {
    db.prepare(`
      UPDATE shopping_list_custom_items
      SET checked = ?, checked_at = ?
      WHERE id = ? AND inventory_id = ?
    `).run(checked ? 1 : 0, checked ? new Date().toISOString() : null, itemId, inventoryId);
  },

  deleteCustomShoppingItem(inventoryId, itemId) {
    return db.prepare(
      'DELETE FROM shopping_list_custom_items WHERE id = ? AND inventory_id = ?'
    ).run(itemId, inventoryId).changes > 0;
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
    db.exec('BEGIN');
    try {
      const { lastInsertRowid } = db.prepare(
        'INSERT INTO list_templates (inventory_id, created_by, name) VALUES (?, ?, ?)'
      ).run(inventoryId, userId, name.trim());
      const ins = db.prepare(
        'INSERT INTO list_template_items (template_id, product_id, product_name, quantity, unit, store_id, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      items.forEach(item => {
        ins.run(lastInsertRowid, item.productId || null, item.productName, +item.quantity || 1, item.unit || 'unidades', item.storeId || null, item.unitPrice != null ? +item.unitPrice : null);
      });
      const template = db.prepare('SELECT * FROM list_templates WHERE id = ?').get(lastInsertRowid);
      template.items = db.prepare('SELECT * FROM list_template_items WHERE template_id = ?').all(lastInsertRowid);
      db.exec('COMMIT');
      return template;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  deleteTemplate(id, inventoryId) {
    return db.prepare(
      'DELETE FROM list_templates WHERE id = ? AND inventory_id = ?'
    ).run(id, inventoryId).changes > 0;
  },

  getExpiringProducts(inventoryId, days = 7) {
    return db.prepare(`
      SELECT id, name, category, expiry_date,
             CAST(julianday(expiry_date) - julianday('now','localtime') AS INTEGER) AS days_left
      FROM products
      WHERE inventory_id = ?
        AND expiry_date IS NOT NULL
        AND expiry_date != ''
        AND julianday(expiry_date) <= julianday('now','localtime') + ?
      ORDER BY expiry_date ASC
    `).all(inventoryId, days);
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
  renameInventory(id, name) {
    db.prepare('UPDATE inventories SET name = ? WHERE id = ?').run(name.trim(), id);
    return this.getInventory(id);
  },

  deleteInventory(id) {
    return db.prepare('DELETE FROM inventories WHERE id = ?').run(id).changes > 0;
  },

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
  createPurchaseSession({ inventoryId, userId, items, taxIds, currency, purchaseDate, receiptImage, budgetCategory = null }) {
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
      const insCatalog = db.prepare(`
        INSERT OR IGNORE INTO catalog_products (name, category, default_unit, created_by)
        VALUES (?, 'Otros', 'unidades', ?)
      `);
      const insProduct = db.prepare(`
        INSERT INTO products (name, category, current_qty, min_qty, unit, inventory_id, catalog_product_id)
        VALUES (?, 'Otros', 0, 0, 'unidades', ?, ?)
      `);
      const getCatalog = db.prepare('SELECT id FROM catalog_products WHERE LOWER(name) = LOWER(?)');

      items.forEach(item => {
        const base = (item.quantityBought != null && item.unitPrice != null)
          ? +(item.quantityBought) * +(item.unitPrice) : null;
        const taxAmt = item.taxAmount != null ? +item.taxAmount : null;
        const sub = base != null ? base + (taxAmt || 0) : null;

        let resolvedProductId = item.productId || null;

        if (!resolvedProductId && item.saveToCatalog && item.productName?.trim()) {
          const name = item.productName.trim();
          insCatalog.run(name, userId);
          const cat = getCatalog.get(name);
          const { lastInsertRowid: prodId } = insProduct.run(name, inventoryId, cat?.id || null);
          resolvedProductId = prodId;
        }

        insItem.run(
          sessionId,
          resolvedProductId,
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
        if (resolvedProductId && +(item.quantityBought) > 0) {
          updQty.run(+(item.quantityBought), resolvedProductId, inventoryId);
        }
      });

      if (budgetCategory && userId) {
        const normalizedCategory = budgetCategory.trim();
        const invName = db.prepare('SELECT name FROM inventories WHERE id = ?').get(inventoryId)?.name || '';
        db.prepare(`
          INSERT INTO personal_transactions
            (user_id, inventory_id, type, category, amount, description, date, source, source_purchase_session_id)
          VALUES (?, ?, 'expense', ?, ?, ?, ?, 'purchase', ?)
        `).run(userId, inventoryId, normalizedCategory, totalAmount,
               `Compra Automatizada Inventario: ${invName}`, purchaseDate, sessionId);
      }

      db.exec('COMMIT');

      const session = db.prepare('SELECT * FROM purchase_sessions WHERE id = ?').get(sessionId);
      return { ...session, budget_category: budgetCategory };
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
    // 'year' = calendar year to date; others = rolling window
    const now = new Date();
    let start;
    if (period === 'year') {
      start = now.getFullYear() + '-01-01';
    } else {
      const daysMap = { month: 30, '3m': 90, '6m': 180 };
      const days = daysMap[period] || 30;
      const d = new Date();
      d.setDate(d.getDate() - days);
      start = d.toISOString().slice(0, 10);
    }

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
      WHERE inventory_id = ? AND purchase_date >= ?
      GROUP BY month ORDER BY month
    `).all(inventoryId, start);

    // Gasto por categoria en el periodo (segun compras, no inventario)
    const byCategory = db.prepare(`
      SELECT COALESCE(pr.category, 'Otros') AS category,
             COALESCE(SUM(pi.subtotal), 0) AS total
      FROM purchase_items pi
      JOIN purchase_sessions ps ON ps.id = pi.session_id
      LEFT JOIN products pr ON pr.id = pi.product_id
      WHERE ps.inventory_id = ? AND ps.purchase_date >= ?
      GROUP BY COALESCE(pr.category, 'Otros')
      HAVING total > 0
      ORDER BY total DESC
    `).all(inventoryId, start);

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
      ORDER BY total_qty DESC, purchase_count DESC LIMIT 5
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

  // ── Admin: metricas globales de la aplicacion ────────────────────────────────
  getAdminStats() {
    const count = sql => db.prepare(sql).get().n;
    return {
      users:        count('SELECT COUNT(*) AS n FROM users'),
      newUsers30:   count("SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now','localtime','-30 days')"),
      active7:      count("SELECT COUNT(*) AS n FROM users WHERE last_login_at >= datetime('now','localtime','-7 days')"),
      active30:     count("SELECT COUNT(*) AS n FROM users WHERE last_login_at >= datetime('now','localtime','-30 days')"),
      inventories:  count('SELECT COUNT(*) AS n FROM inventories'),
      products:     count('SELECT COUNT(*) AS n FROM products'),
      purchases:    count('SELECT COUNT(*) AS n FROM purchase_sessions'),
      recentUsers:  db.prepare(`
        SELECT name, email, created_at, last_login_at
        FROM users ORDER BY COALESCE(last_login_at, created_at) DESC LIMIT 10
      `).all(),
    };
  },

  // ── Push notifications ──────────────────────────────────────────────────────────
  savePushSubscription(userId, subscription) {
    const { endpoint, keys: { auth, p256dh } } = subscription;
    return db.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, auth, p256dh)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        endpoint = excluded.endpoint,
        auth     = excluded.auth,
        p256dh   = excluded.p256dh
    `).run(userId, endpoint, auth, p256dh);
  },

  getPushSubscription(userId) {
    return db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').get(userId);
  },

  getPushSubscriptionsForAlert() {
    return db.prepare(`
      SELECT ps.*, u.name, u.email
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      ORDER BY ps.created_at DESC
    `).all();
  },

  deletePushSubscription(userId) {
    return db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
  },

  // ── Personal Budget ────────────────────────────────────────────────────────
  getPersonalBudgets(userId, month) {
    return db.prepare(
      'SELECT * FROM personal_budgets WHERE user_id = ? AND month = ? ORDER BY category'
    ).all(userId, month);
  },

  getPersonalBudgetExpenseCategories(userId) {
    return db.prepare(`
      SELECT DISTINCT category FROM personal_budgets
      WHERE user_id = ? AND flow_type = 'expense'
      ORDER BY category
    `).all(userId).map(r => r.category);
  },

  addPersonalBudget(userId, { category, amount, month, frequency = 'Mensual', due_date = null, flow_type = 'expense', inventory_id = null }) {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO personal_budgets (user_id, category, amount, month, frequency, due_date, flow_type, inventory_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, category, +amount, month, frequency, due_date, flow_type, inventory_id);
    return db.prepare('SELECT * FROM personal_budgets WHERE id = ?').get(lastInsertRowid);
  },

  getWeeklyFixedCosts(userId) {
    const FACTOR = { 'Mensual': 12 / 52, 'Quincenal': 24 / 52, 'Semestral': 2 / 52, 'Anual': 1 / 52, 'Bianual': 1 / 104 };
    const rows = db.prepare(`
      SELECT pb.*, i.name AS inventory_name
      FROM personal_budgets pb
      LEFT JOIN inventories i ON i.id = pb.inventory_id
      WHERE pb.user_id = ? ORDER BY pb.flow_type DESC, pb.category
    `).all(userId);
    let expense_weekly = 0, income_weekly = 0;
    const items = rows.map(row => {
      const weekly = row.amount * (FACTOR[row.frequency] ?? (12 / 52));
      if ((row.flow_type || 'expense') === 'income') income_weekly += weekly;
      else                                            expense_weekly += weekly;
      return { ...row, weekly_equivalent: weekly };
    });
    const net_weekly = Math.max(0, expense_weekly - income_weekly);
    return { total_weekly: net_weekly, expense_weekly, income_weekly, items };
  },

  deletePersonalBudget(userId, id) {
    return db.prepare(
      'DELETE FROM personal_budgets WHERE id = ? AND user_id = ?'
    ).run(id, userId).changes > 0;
  },

  updatePersonalBudget(userId, id, { category, amount, month, frequency = 'Mensual', due_date = null, flow_type = 'expense', inventory_id = null }) {
    const changed = db.prepare(`
      UPDATE personal_budgets
      SET category = ?, amount = ?, month = ?, frequency = ?, due_date = ?, flow_type = ?, inventory_id = ?
      WHERE id = ? AND user_id = ?
    `).run(category, +amount, month, frequency, due_date, flow_type, inventory_id, id, userId).changes;
    if (!changed) return null;
    return db.prepare('SELECT * FROM personal_budgets WHERE id = ?').get(id);
  },

  getPersonalTransactions(userId, month) {
    return db.prepare(`
      SELECT t.*, i.name AS inventory_name
      FROM personal_transactions t
      LEFT JOIN inventories i ON i.id = t.inventory_id
      WHERE t.user_id = ? AND strftime('%Y-%m', t.date) = ?
      ORDER BY t.date DESC, t.created_at DESC
    `).all(userId, month);
  },

  addPersonalTransaction(userId, { inventoryId, type, category, amount, description, date }) {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO personal_transactions
        (user_id, inventory_id, type, category, amount, description, date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, inventoryId || null, type, category, +amount, description || null, date);
    return db.prepare('SELECT * FROM personal_transactions WHERE id = ?').get(lastInsertRowid);
  },

  updatePersonalTransaction(userId, id, { type, category, amount, description, date, inventoryId }) {
    const { changes } = db.prepare(`
      UPDATE personal_transactions
         SET type = ?, category = ?, amount = ?, description = ?, date = ?, inventory_id = ?
       WHERE id = ? AND user_id = ?
    `).run(type, category, +amount, description || null, date, inventoryId || null, id, userId);
    if (!changes) return null;
    return db.prepare('SELECT * FROM personal_transactions WHERE id = ?').get(id);
  },

  deletePersonalTransaction(userId, id) {
    return db.prepare(
      'DELETE FROM personal_transactions WHERE id = ? AND user_id = ?'
    ).run(id, userId).changes > 0;
  },

  // ── Personal Budget Plans ──────────────────────────────────────────────────
  getPersonalBudgetPlans(userId) {
    return db.prepare(
      'SELECT * FROM personal_budget_plans WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId);
  },

  getPersonalBudgetDynamicStats(userId, month) {
    const incomeRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM personal_transactions
      WHERE user_id = ? AND type = 'income' AND strftime('%Y-%m', date) = ?
    `).get(userId, month);
    const expenseRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM personal_transactions
      WHERE user_id = ? AND type = 'expense' AND strftime('%Y-%m', date) = ?
    `).get(userId, month);
    const income_real  = incomeRow.total;
    const expense_real = expenseRow.total;
    return { income_real, expense_real, balance_real: income_real - expense_real };
  },

  createPersonalBudgetPlan(userId, { name, inventoryId }) {
    const { lastInsertRowid } = db.prepare(`
        INSERT INTO personal_budget_plans (user_id, name, inventory_id, estimated_income)
        VALUES (?, ?, ?, 0)
      `).run(userId, name.trim(), inventoryId || null);

      const plan = db.prepare('SELECT * FROM personal_budget_plans WHERE id = ?').get(lastInsertRowid);
      return plan;
  },

  deletePersonalBudgetPlan(userId, id) {
    return db.prepare(
      'DELETE FROM personal_budget_plans WHERE id = ? AND user_id = ?'
    ).run(id, userId).changes > 0;
  },
};
