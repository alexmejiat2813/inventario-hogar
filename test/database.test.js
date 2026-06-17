'use strict';
/**
 * Unit tests for database.js
 * Uses a temp SQLite file; deleted after suite.
 */

const { describe, test, after } = require('node:test');
const assert = require('node:assert/strict');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

// Must set DB_PATH BEFORE requiring database.js (module cache)
const TEST_DB = path.join(os.tmpdir(), `ih-test-${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;

const db = require('../database');

// ── Helpers ────────────────────────────────────────────────────

let _userSeq = 0;
function makeUser() {
  const n = ++_userSeq;
  return db.upsertUser({
    google_id: `google_test_${n}`,
    name:      `Test User ${n}`,
    email:     `test${n}@example.com`,
    photo:     null,
  });
}

function makeInventory(userId = null) {
  const u = userId ?? makeUser().id;
  return { inv: db.createInventory(`Inventario ${Date.now()}`, u), userId: u };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Users ──────────────────────────────────────────────────────

describe('users', () => {
  test('upsertUser creates new user with is_new=true', () => {
    const u = makeUser();
    assert.ok(typeof u.id === 'number');
    assert.ok(u.is_new);
    assert.equal(u.email, `test${_userSeq}@example.com`);
  });

  test('upsertUser updates existing user, is_new=false', () => {
    const u1 = db.upsertUser({ google_id: 'dup-google', name: 'Old', email: 'old@x.com', photo: null });
    const u2 = db.upsertUser({ google_id: 'dup-google', name: 'New', email: 'new@x.com', photo: null });
    assert.equal(u1.id, u2.id);
    assert.equal(u2.name, 'New');
    assert.equal(u2.is_new, false);
  });
});

// ── Inventories ────────────────────────────────────────────────

describe('inventories', () => {
  test('createInventory adds owner as member with role=owner', () => {
    const { inv, userId } = makeInventory();
    const member = db.getMember(inv.id, userId);
    assert.equal(member.role, 'owner');
  });

  test('joinByCode with unknown code returns error', () => {
    const u = makeUser();
    const r = db.joinByCode('ZZZZZZ', u.id);
    assert.ok(r.error);
  });

  test('joinByCode with valid code adds member', () => {
    const { inv, userId } = makeInventory();
    const code = db.generateInviteCode(inv.id, 'editor', userId);
    const u2   = makeUser();
    const r    = db.joinByCode(code.code, u2.id);
    assert.ok(!r.error);
    assert.equal(r.role, 'editor');
    const member = db.getMember(inv.id, u2.id);
    assert.equal(member.role, 'editor');
  });

  test('renameInventory updates name', () => {
    const { inv } = makeInventory();
    db.renameInventory(inv.id, 'Renamed');
    assert.equal(db.getInventory(inv.id).name, 'Renamed');
  });

  test('deleteInventory cascades to products', () => {
    const { inv, userId } = makeInventory();
    db.create({ name: 'Leche', category: 'Bebidas', current_qty: 1, min_qty: 0, unit: 'lt', inventoryId: inv.id });
    db.deleteInventory(inv.id);
    assert.equal(db.getInventory(inv.id), undefined);
    assert.equal(db.getAll(inv.id).length, 0);
  });
});

// ── Members ────────────────────────────────────────────────────

describe('members', () => {
  test('updateMemberRole changes role', () => {
    const { inv, userId } = makeInventory();
    const u2 = makeUser();
    db.generateInviteCode(inv.id, 'reader', userId);
    const codes = db.getActiveInviteCodes(inv.id);
    db.joinByCode(codes[0].code, u2.id);
    db.updateMemberRole(inv.id, u2.id, 'editor');
    assert.equal(db.getMember(inv.id, u2.id).role, 'editor');
  });

  test('removeMember removes the member', () => {
    const { inv, userId } = makeInventory();
    const u2 = makeUser();
    const code = db.generateInviteCode(inv.id, 'reader', userId);
    db.joinByCode(code.code, u2.id);
    db.removeMember(inv.id, u2.id);
    assert.equal(db.getMember(inv.id, u2.id), undefined);
  });
});

// ── Products ───────────────────────────────────────────────────

describe('products', () => {
  test('getShoppingList returns only low-stock products', () => {
    const { inv } = makeInventory();
    db.create({ name: 'Critico', category: 'Bebidas', current_qty: 0, min_qty: 2, unit: 'lt', inventoryId: inv.id });
    db.create({ name: 'OK',      category: 'Bebidas', current_qty: 5, min_qty: 2, unit: 'lt', inventoryId: inv.id });
    const list = db.getShoppingList(inv.id);
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'Critico');
  });

  test('getExpiringProducts returns products expiring within N days only', () => {
    const { inv } = makeInventory();
    db.create({ name: 'Soon',  category: 'Alimentos', current_qty: 1, min_qty: 0, unit: 'unidades', inventoryId: inv.id, expiry_date: daysFromNow(3)  });
    db.create({ name: 'Later', category: 'Alimentos', current_qty: 1, min_qty: 0, unit: 'unidades', inventoryId: inv.id, expiry_date: daysFromNow(20) });
    db.create({ name: 'None',  category: 'Alimentos', current_qty: 1, min_qty: 0, unit: 'unidades', inventoryId: inv.id });
    const expiring = db.getExpiringProducts(inv.id, 7);
    assert.equal(expiring.length, 1);
    assert.equal(expiring[0].name, 'Soon');
  });

  test('getExpiringProducts includes already-expired products', () => {
    const { inv } = makeInventory();
    db.create({ name: 'Expired', category: 'Alimentos', current_qty: 1, min_qty: 0, unit: 'unidades', inventoryId: inv.id, expiry_date: daysFromNow(-2) });
    const expiring = db.getExpiringProducts(inv.id, 7);
    assert.ok(expiring.some(p => p.name === 'Expired'));
    assert.ok(expiring.find(p => p.name === 'Expired').days_left < 0);
  });
});

// ── Purchases & Taxes (P0 regression) ─────────────────────────

describe('purchases — tax calculation (P0 regression)', () => {
  test('invoice-level taxIds apply correctly (was broken before fix)', () => {
    const { inv, userId } = makeInventory();
    const tax = db.createTaxType({ inventoryId: inv.id, name: 'IVA', rate: 10, categories: [], active: true });

    const session = db.createPurchaseSession({
      inventoryId:  inv.id,
      userId,
      items:        [{ productName: 'Arroz', quantityBought: 2, unitPrice: 100, unit: 'kg', productId: null, storeId: null }],
      taxIds:       [tax.id],
      currency:     'USD',
      purchaseDate: today(),
      receiptImage: null,
    });

    // subtotal = 200, IVA 10% = 20, total = 220
    assert.equal(+session.subtotal_before_tax.toFixed(2), 200);
    assert.ok(Math.abs(+session.total_tax - 20) < 0.01,
      `Expected total_tax ~20, got ${session.total_tax}`);
    assert.ok(Math.abs(+session.total_amount - 220) < 0.01,
      `Expected total_amount ~220, got ${session.total_amount}`);
  });

  test('no taxIds uses per-item tax data', () => {
    const { inv, userId } = makeInventory();
    const session = db.createPurchaseSession({
      inventoryId:  inv.id,
      userId,
      items:        [{ productName: 'X', quantityBought: 1, unitPrice: 50, unit: 'u', productId: null, storeId: null, taxAmount: 5 }],
      taxIds:       [],
      currency:     'USD',
      purchaseDate: today(),
      receiptImage: null,
    });
    assert.ok(Math.abs(+session.total_amount - 55) < 0.01,
      `Expected 55, got ${session.total_amount}`);
  });

  test('deletePurchaseSession with revert reduces product qty', () => {
    const { inv, userId } = makeInventory();
    const prod = db.create({ name: 'Leche', category: 'Bebidas', current_qty: 0, min_qty: 0, unit: 'lt', inventoryId: inv.id });
    const session = db.createPurchaseSession({
      inventoryId:  inv.id, userId,
      items:        [{ productName: 'Leche', productId: prod.id, quantityBought: 3, unitPrice: 10, unit: 'lt', storeId: null }],
      taxIds:       [], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    const qtyAfterPurchase = db.getById(prod.id).current_qty;
    assert.equal(qtyAfterPurchase, 3);
    db.deletePurchaseSession(session.id, inv.id, { revertInventory: true });
    const qtyAfterDelete = db.getById(prod.id).current_qty;
    assert.equal(qtyAfterDelete, 0);
  });
});

// ── Budget ─────────────────────────────────────────────────────

describe('budget', () => {
  test('getBudgetSummary returns 0% when no purchases', () => {
    const { inv } = makeInventory();
    db.saveBudgetConfig(inv.id, { monthlyAmount: 1000, alertPercentages: [] });
    const s = db.getBudgetSummary(inv.id);
    assert.equal(s.spent, 0);
    assert.equal(s.percentage, 0);
    assert.equal(s.available, 1000);
  });

  test('getBudgetSummary calculates percentage after purchase', () => {
    const { inv, userId } = makeInventory();
    db.saveBudgetConfig(inv.id, { monthlyAmount: 200, alertPercentages: [] });
    db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items:       [{ productName: 'A', quantityBought: 1, unitPrice: 100, unit: 'u', productId: null, storeId: null }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    const s = db.getBudgetSummary(inv.id);
    assert.equal(s.percentage, 50);
    assert.equal(+s.available.toFixed(0), 100);
  });

  test('getBudgetSummary returns null config when not configured', () => {
    const { inv } = makeInventory();
    const s = db.getBudgetSummary(inv.id);
    assert.equal(s.config, null);
    assert.equal(s.percentage, 0);
  });
});

// ── Audit log ──────────────────────────────────────────────────

describe('audit log', () => {
  test('audit records entry with correct fields', () => {
    const { inv, userId } = makeInventory();
    db.audit(inv.id, userId, 'Tester', 'product.create', 'product', 42, { name: 'Arroz' });
    const log = db.getAuditLog(inv.id);
    assert.ok(log.length >= 1);
    const entry = log[0];
    assert.equal(entry.action, 'product.create');
    assert.equal(entry.user_name, 'Tester');
    assert.equal(entry.resource_id, 42);
    const details = JSON.parse(entry.details);
    assert.equal(details.name, 'Arroz');
  });

  test('audit never throws on null/bad input', () => {
    assert.doesNotThrow(() => db.audit(null, null, null, 'x', null, null, null));
    assert.doesNotThrow(() => db.audit(-1, -1, 'u', 'x', 'r', -1, { bad: undefined }));
  });

  test('getAuditLog respects limit', () => {
    const { inv, userId } = makeInventory();
    for (let i = 0; i < 5; i++) db.audit(inv.id, userId, 'U', `action.${i}`, 'test', i, null);
    const log = db.getAuditLog(inv.id, 3);
    assert.equal(log.length, 3);
  });
});

// ── Custom shopping items ──────────────────────────────────────

describe('custom shopping items', () => {
  test('add and retrieve custom item', () => {
    const { inv } = makeInventory();
    const item = db.addCustomShoppingItem(inv.id, 'Leche de avena');
    assert.equal(item.name, 'Leche de avena');
    assert.equal(item.checked, 0);
    const list = db.getCustomShoppingItems(inv.id);
    assert.ok(list.some(i => i.id === item.id));
  });

  test('setCustomShoppingItem toggles checked', () => {
    const { inv } = makeInventory();
    const item = db.addCustomShoppingItem(inv.id, 'Mantequilla');
    db.setCustomShoppingItem(inv.id, item.id, true);
    const list = db.getCustomShoppingItems(inv.id);
    const updated = list.find(i => i.id === item.id);
    assert.equal(updated.checked, 1);
  });

  test('deleteCustomShoppingItem removes item', () => {
    const { inv } = makeInventory();
    const item = db.addCustomShoppingItem(inv.id, 'Queso');
    db.deleteCustomShoppingItem(inv.id, item.id);
    const list = db.getCustomShoppingItems(inv.id);
    assert.ok(!list.some(i => i.id === item.id));
  });

  test('clearShoppingList also unchecks custom items', () => {
    const { inv } = makeInventory();
    const item = db.addCustomShoppingItem(inv.id, 'Cerveza');
    db.setCustomShoppingItem(inv.id, item.id, true);
    db.clearShoppingList(inv.id);
    const list = db.getCustomShoppingItems(inv.id);
    assert.equal(list.find(i => i.id === item.id).checked, 0);
  });
});

describe('categorias unificadas + i18n', () => {
  test('categorias base traen traducciones EN/FR', () => {
    const cats = db.getCategories();
    const ali = cats.find(c => c.name === 'Alimentos');
    assert.ok(ali, 'existe Alimentos');
    assert.equal(ali.name_en, 'Food');
    assert.equal(ali.name_fr, 'Alimentation');
  });

  test('createCategory guarda traducciones', () => {
    const r = db.createCategory({ name: 'Frutas', name_en: 'Fruits', name_fr: 'Fruits', emoji: '🍓' });
    assert.ok(!r.error, r.error);
    assert.equal(r.category.name_en, 'Fruits');
    assert.equal(r.category.emoji, '🍓');
  });

  test('updateCategory renombra y hace cascade a productos', () => {
    const { inv } = makeInventory();
    const r = db.createCategory({ name: 'Snacks', name_en: 'Snacks', name_fr: 'Snacks', emoji: '🍿' });
    const p = db.create({ name: 'Papas', category: 'Snacks', current_qty: 1, min_qty: 1, unit: 'unidades', inventoryId: inv.id });
    const u = db.updateCategory(r.category.id, { name: 'Picoteo', name_en: 'Snacks', name_fr: 'Snacks', emoji: '🍿' });
    assert.ok(!u.error, u.error);
    assert.equal(db.getById(p.id).category, 'Picoteo', 'el producto sigue la categoria renombrada');
  });
});

describe('catalogo i18n (productos sembrados traducibles)', () => {
  test('productos sembrados llevan i18n_key', () => {
    const cat = db.getCatalogProducts();
    const arroz = cat.find(p => p.name === 'Arroz');
    assert.ok(arroz, 'el seed incluye Arroz');
    assert.equal(arroz.i18n_key, 'arroz');
  });

  test('renombrar un producto sembrado limpia i18n_key', () => {
    const arroz = db.getCatalogProducts().find(p => p.name === 'Arroz');
    const res = db.updateCatalogProduct(arroz.id, { name: 'Riz basmati', category: 'Alimentos' });
    assert.ok(!res.error, res.error);
    assert.equal(res.product.i18n_key, null, 'al renombrar deja de traducirse');
    // restaurar para no afectar otros tests
    db.updateCatalogProduct(arroz.id, { name: 'Arroz', category: 'Alimentos' });
  });

  test('addCatalogProductToInventory usa displayName si se pasa', () => {
    const { inv } = makeInventory();
    const frijoles = db.getCatalogProducts().find(p => p.name === 'Frijoles');
    const r = db.addCatalogProductToInventory({
      catalogProductId: frijoles.id, inventoryId: inv.id,
      currentQty: 1, minQty: 1, unit: 'unidades', displayName: 'Haricots',
    });
    assert.ok(!r.error, r.error);
    assert.equal(r.product.name, 'Haricots', 'guarda el nombre en el idioma del usuario');
  });
});

describe('list templates (regression: node:sqlite no tiene db.transaction)', () => {
  test('createTemplate persiste plantilla e items', () => {
    const { inv, userId } = makeInventory();
    const tpl = db.createTemplate(inv.id, userId, 'Compra semanal', [
      { productId: null, productName: 'Arroz',  quantity: 2, unit: 'kg' },
      { productId: null, productName: 'Fideos', quantity: 1, unit: 'paquetes' },
    ]);
    assert.ok(tpl.id);
    assert.equal(tpl.items.length, 2);

    const list = db.getTemplates(inv.id);
    assert.equal(list.length, 1);
    assert.equal(list[0].item_count, 2);

    const full = db.getTemplate(tpl.id, inv.id);
    assert.equal(full.items[0].product_name, 'Arroz');
    assert.equal(full.items[0].quantity, 2);
  });

  test('createTemplate sin unit usa default unidades', () => {
    const { inv, userId } = makeInventory();
    const tpl = db.createTemplate(inv.id, userId, 'Sin unidad', [
      { productName: 'Sal', quantity: 1 },
    ]);
    assert.equal(tpl.items[0].unit, 'unidades');
  });

  test('deleteTemplate elimina la plantilla', () => {
    const { inv, userId } = makeInventory();
    const tpl = db.createTemplate(inv.id, userId, 'Temporal', [
      { productName: 'Pan', quantity: 1, unit: 'unidades' },
    ]);
    assert.equal(db.deleteTemplate(tpl.id, inv.id), true);
    assert.equal(db.getTemplates(inv.id).length, 0);
  });
});

describe('admin metrics', () => {
  test('upsertUser registra last_login_at', () => {
    const u = makeUser();
    assert.ok(u.last_login_at, 'last_login_at debe setearse al hacer login');
  });

  test('getAdminStats devuelve conteos coherentes', () => {
    const before = db.getAdminStats();
    const { inv } = makeInventory();
    db.create({ name: 'Cafe', category: 'Alimentos', current_qty: 1, min_qty: 1, unit: 'unidades', inventoryId: inv.id });
    const after = db.getAdminStats();
    assert.equal(after.users, before.users + 1);
    assert.equal(after.inventories, before.inventories + 1);
    assert.equal(after.products, before.products + 1);
    assert.ok(after.active7 >= 1, 'usuario recien logueado cuenta como activo');
    assert.ok(Array.isArray(after.recentUsers));
    assert.ok(after.recentUsers.length >= 1);
  });

  test('isAdmin respeta ADMIN_EMAILS (case-insensitive, lista)', () => {
    const { isAdmin } = require('../middleware/auth');
    const prev = process.env.ADMIN_EMAILS;
    try {
      process.env.ADMIN_EMAILS = 'Admin@Example.com, otro@example.com';
      assert.equal(isAdmin({ email: 'admin@example.com' }), true);
      assert.equal(isAdmin({ email: 'otro@example.com' }), true);
      assert.equal(isAdmin({ email: 'nadie@example.com' }), false);
      process.env.ADMIN_EMAILS = '';
      assert.equal(isAdmin({ email: 'admin@example.com' }), false);
      assert.equal(isAdmin(null), false);
    } finally {
      if (prev === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = prev;
    }
  });
});

describe('seeds de primera ejecucion (regression: catalogo resucitaba)', () => {
  test('producto del catalogo borrado NO reaparece al reiniciar el server', () => {
    const { execFileSync } = require('child_process');

    const arroz = db.getCatalogProducts().find(p => p.name === 'Arroz');
    assert.ok(arroz, 'el seed inicial debe incluir Arroz');
    assert.equal(db.deleteCatalogProduct(arroz.id), true);

    // Re-inicializar database.js en un proceso nuevo = restart del server.
    // Antes del fix, el seed con INSERT OR IGNORE corria en cada arranque
    // y resucitaba los productos borrados.
    const out = execFileSync(process.execPath, ['-e', `
      const d = require('./database.js');
      const back = d.getCatalogProducts().find(p => p.name === 'Arroz');
      process.stdout.write(back ? 'RESUCITADO' : 'OK');
    `], { env: { ...process.env, DB_PATH: TEST_DB }, cwd: path.join(__dirname, '..') }).toString();

    assert.equal(out, 'OK', 'el producto borrado no debe resembrarse al reiniciar');
  });
});

// ── Budget — additional ────────────────────────────────────────

describe('budget — config y porcentajes', () => {
  test('saveBudgetConfig sobrescribe config previa', () => {
    const { inv } = makeInventory();
    db.saveBudgetConfig(inv.id, { monthlyAmount: 100, alertPercentages: [] });
    db.saveBudgetConfig(inv.id, { monthlyAmount: 500, alertPercentages: [] });
    const s = db.getBudgetSummary(inv.id);
    assert.equal(s.config.monthly_amount, 500);
  });

  test('porcentaje > 100 cuando gasto supera el budget', () => {
    const { inv, userId } = makeInventory();
    db.saveBudgetConfig(inv.id, { monthlyAmount: 50, alertPercentages: [] });
    db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'Caro', quantityBought: 1, unitPrice: 100, unit: 'u', productId: null, storeId: null }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    const s = db.getBudgetSummary(inv.id);
    assert.ok(s.percentage > 100, `esperado >100, obtenido ${s.percentage}`);
  });

  test('solo cuenta compras del mes actual', () => {
    const { inv, userId } = makeInventory();
    db.saveBudgetConfig(inv.id, { monthlyAmount: 200, alertPercentages: [] });
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'Viejo', quantityBought: 1, unitPrice: 100, unit: 'u', productId: null, storeId: null }],
      taxIds: [], currency: 'USD', purchaseDate: lastMonth.toISOString().slice(0, 10), receiptImage: null,
    });
    const s = db.getBudgetSummary(inv.id);
    assert.equal(s.spent, 0, 'compras del mes anterior no deben sumarse');
  });
});

// ── Purchases — IDOR boundary ─────────────────────────────────

describe('purchases — aislamiento entre inventarios', () => {
  test('getPurchaseSessions no devuelve sesiones de otro inventario', () => {
    const { inv: inv1, userId } = makeInventory();
    const { inv: inv2 } = makeInventory(userId);
    db.createPurchaseSession({
      inventoryId: inv1.id, userId,
      items: [{ productName: 'Solo inv1', quantityBought: 1, unitPrice: 10, unit: 'u', productId: null, storeId: null }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    const sessions = db.getPurchaseSessions(inv2.id);
    assert.ok(!sessions.some(s => s.inventory_id === inv1.id));
  });

  test('createPurchaseSession suma stock al producto', () => {
    const { inv, userId } = makeInventory();
    const prod = db.create({ name: 'Pan', category: 'Alimentos', current_qty: 2, min_qty: 1, unit: 'u', inventoryId: inv.id });
    db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'Pan', productId: prod.id, quantityBought: 3, unitPrice: 5, unit: 'u', storeId: null }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    assert.equal(db.getById(prod.id).current_qty, 5);
  });

  test('deletePurchaseSession sin revert preserva stock', () => {
    const { inv, userId } = makeInventory();
    const prod = db.create({ name: 'Jugo', category: 'Bebidas', current_qty: 0, min_qty: 0, unit: 'lt', inventoryId: inv.id });
    const session = db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'Jugo', productId: prod.id, quantityBought: 4, unitPrice: 8, unit: 'lt', storeId: null }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    db.deletePurchaseSession(session.id, inv.id, { revertInventory: false });
    assert.equal(db.getById(prod.id).current_qty, 4, 'sin revert stock no cambia');
  });
});

// ── Stats ──────────────────────────────────────────────────────

describe('stats', () => {
  test('getStats retorna total y critical correctos', () => {
    const { inv } = makeInventory();
    db.create({ name: 'Critico', category: 'Bebidas',   current_qty: 0, min_qty: 2, unit: 'lt', inventoryId: inv.id });
    db.create({ name: 'OK',      category: 'Bebidas',   current_qty: 5, min_qty: 2, unit: 'lt', inventoryId: inv.id });
    db.create({ name: 'Justo',   category: 'Alimentos', current_qty: 1, min_qty: 1, unit: 'u',  inventoryId: inv.id });
    const stats = db.getStats(inv.id);
    assert.equal(stats.total, 3);
    assert.equal(stats.critical, 1, 'solo qty < min cuenta como critico');
  });

  test('getStats.byCategory incluye categorias con productos', () => {
    const { inv } = makeInventory();
    db.create({ name: 'A', category: 'Bebidas',   current_qty: 1, min_qty: 0, unit: 'u', inventoryId: inv.id });
    db.create({ name: 'B', category: 'Alimentos', current_qty: 1, min_qty: 0, unit: 'u', inventoryId: inv.id });
    const stats = db.getStats(inv.id);
    assert.ok(Array.isArray(stats.byCategory));
    const byCatNames = stats.byCategory.map(c => c.category);
    assert.ok(byCatNames.includes('Bebidas'));
    assert.ok(byCatNames.includes('Alimentos'));
  });

  test('stats.byCategory.count es correcto', () => {
    const { inv } = makeInventory();
    db.createCategory({ name: 'Limpieza', name_en: 'Cleaning', name_fr: 'Nettoyage', emoji: '🧹' });
    db.create({ name: 'X1', category: 'Limpieza', current_qty: 1, min_qty: 0, unit: 'u', inventoryId: inv.id });
    db.create({ name: 'X2', category: 'Limpieza', current_qty: 1, min_qty: 0, unit: 'u', inventoryId: inv.id });
    const stats = db.getStats(inv.id);
    const lim = stats.byCategory.find(c => c.category === 'Limpieza');
    assert.ok(lim, 'Limpieza debe aparecer en byCategory');
    assert.equal(lim.count, 2);
  });
});

// ── Stores ─────────────────────────────────────────────────────

describe('stores', () => {
  test('createStore y getStores', () => {
    const { inv } = makeInventory();
    db.createStore({ inventoryId: inv.id, name: 'MiSuper', emoji: '🛒' });
    const stores = db.getStores(inv.id);
    assert.ok(stores.some(s => s.name === 'MiSuper'));
  });

  test('updateStore cambia el nombre', () => {
    const { inv } = makeInventory();
    const store = db.createStore({ inventoryId: inv.id, name: 'Original', emoji: '📦' });
    db.updateStore(store.id, { name: 'Renombrado', emoji: '📦' });
    const updated = db.getStore(store.id);
    assert.equal(updated.name, 'Renombrado');
  });

  test('deleteStore elimina la tienda', () => {
    const { inv } = makeInventory();
    const store = db.createStore({ inventoryId: inv.id, name: 'Temp', emoji: '' });
    const ok = db.deleteStore(store.id);
    assert.equal(ok, true);
    assert.equal(db.getStore(store.id), undefined);
  });

  test('getStores solo devuelve tiendas del inventario', () => {
    const { inv: inv1 } = makeInventory();
    const { inv: inv2 } = makeInventory();
    db.createStore({ inventoryId: inv1.id, name: 'De inv1', emoji: '' });
    db.createStore({ inventoryId: inv2.id, name: 'De inv2', emoji: '' });
    const s1 = db.getStores(inv1.id);
    assert.ok(s1.some(s => s.name === 'De inv1'));
    assert.ok(!s1.some(s => s.name === 'De inv2'), 'inv1 no debe ver tiendas de inv2');
  });
});

// ── Store prices ───────────────────────────────────────────────

describe('store prices', () => {
  test('getProductStorePrices vacio sin historial', () => {
    const { inv } = makeInventory();
    const prod = db.create({ name: 'SinHistorial', category: 'Bebidas', current_qty: 1, min_qty: 0, unit: 'lt', inventoryId: inv.id });
    const prices = db.getProductStorePrices(prod.id, inv.id);
    assert.deepEqual(prices, []);
  });

  test('getProductStorePrices devuelve orden ascendente por precio', () => {
    const { inv, userId } = makeInventory();
    const prod = db.create({ name: 'Cereal', category: 'Alimentos', current_qty: 1, min_qty: 0, unit: 'u', inventoryId: inv.id });
    const cara   = db.createStore({ inventoryId: inv.id, name: 'Cara',   emoji: '' });
    const barata = db.createStore({ inventoryId: inv.id, name: 'Barata', emoji: '' });
    db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'Cereal', productId: prod.id, quantityBought: 1, unitPrice: 100, unit: 'u', storeId: cara.id }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'Cereal', productId: prod.id, quantityBought: 1, unitPrice: 50, unit: 'u', storeId: barata.id }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    const prices = db.getProductStorePrices(prod.id, inv.id);
    assert.ok(prices.length >= 2);
    assert.ok(prices[0].last_price <= prices[1].last_price, 'orden ascendente por precio');
    assert.equal(prices[0].store_name, 'Barata', 'la mas barata primero');
  });
});

// ── Category constraints ───────────────────────────────────────

describe('category constraints', () => {
  test('deleteCategory retorna error cuando hay productos que la usan', () => {
    const { inv } = makeInventory();
    const r = db.createCategory({ name: 'CatUsada', name_en: 'Used', name_fr: 'Utilisée', emoji: '📦' });
    db.create({ name: 'ProdEnCat', category: 'CatUsada', current_qty: 1, min_qty: 0, unit: 'u', inventoryId: inv.id });
    const del = db.deleteCategory(r.category.id);
    assert.ok(del.error, 'debe retornar error cuando la categoría está en uso');
  });

  test('deleteCategory funciona cuando no está en uso', () => {
    const r = db.createCategory({ name: 'CatVacia', name_en: 'Empty', name_fr: 'Vide', emoji: '🗂️' });
    const del = db.deleteCategory(r.category.id);
    assert.ok(!del.error, `error inesperado: ${del.error}`);
    assert.equal(del.ok, true);
  });
});

// ── Templates — guard regression #77 (store_id + unit_price) ──

describe('templates — store_id y unit_price', () => {
  test('createTemplate preserva store_id y unit_price por item', () => {
    const { inv, userId } = makeInventory();
    const store = db.createStore({ inventoryId: inv.id, name: 'StoreGuard', emoji: '' });
    const tpl = db.createTemplate(inv.id, userId, 'Con precios', [
      { productId: null, productName: 'Pan', quantity: 2, unit: 'unidades', storeId: store.id, unitPrice: 3.5 },
    ]);
    const full = db.getTemplate(tpl.id, inv.id);
    assert.equal(full.items[0].store_id, store.id, 'store_id debe persistir');
    assert.ok(Math.abs(full.items[0].unit_price - 3.5) < 0.001, 'unit_price debe persistir');
  });

  test('createTemplate sin storeId/unitPrice guarda null', () => {
    const { inv, userId } = makeInventory();
    const tpl = db.createTemplate(inv.id, userId, 'Sin precio', [
      { productId: null, productName: 'Sal', quantity: 1, unit: 'unidades' },
    ]);
    const full = db.getTemplate(tpl.id, inv.id);
    assert.equal(full.items[0].store_id, null);
    assert.equal(full.items[0].unit_price, null);
  });
});

// ── Núcleo financiero integrado ────────────────────────────────

describe('createPurchaseSession — integración presupuestaria', () => {
  function makeSession(inv, userId, opts = {}) {
    return db.createPurchaseSession({
      inventoryId:  inv.id,
      userId,
      items:        opts.items ?? [{ productName: 'Leche', quantityBought: 1, unitPrice: 5, unit: 'lt' }],
      taxIds:       [],
      currency:     'USD',
      purchaseDate: today(),
      receiptImage: null,
      budgetCategory: opts.budgetCategory ?? null,
    });
  }

  test('sin budgetCategory no inserta personal_transaction', () => {
    const { inv, userId } = makeInventory();
    const session = makeSession(inv, userId);
    assert.equal(session.budget_tx_omitted, false);
    assert.equal(session.budget_category, null);
    const txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    assert.equal(txs.filter(t => t.source === 'purchase').length, 0);
  });

  test('con budgetCategory y monto>0 inserta personal_transaction vinculada', () => {
    const { inv, userId } = makeInventory();
    db.createPersonalBudgetCategory(userId, { name: 'Mercado', flowType: 'expense' });
    const session = makeSession(inv, userId, { budgetCategory: 'Mercado' });
    assert.equal(session.budget_tx_omitted, false);
    assert.equal(session.budget_category, 'Mercado');
    const txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    const linked = txs.filter(t => t.source === 'purchase' && t.source_purchase_session_id === session.id);
    assert.equal(linked.length, 1);
    assert.ok(Math.abs(linked[0].amount - 5) < 0.001);
    assert.equal(linked[0].category, 'Mercado');
  });

  test('con budgetCategory y totalAmount=0 omite personal_transaction y retorna budget_tx_omitted=true', () => {
    const { inv, userId } = makeInventory();
    db.createPersonalBudgetCategory(userId, { name: 'Gratis', flowType: 'expense' });
    const session = makeSession(inv, userId, {
      items: [{ productName: 'Muestra', quantityBought: 1, unitPrice: 0, unit: 'unidades' }],
      budgetCategory: 'Gratis',
    });
    assert.equal(session.budget_tx_omitted, true);
    const txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    assert.equal(txs.filter(t => t.source === 'purchase').length, 0);
  });

  test('updatePurchaseSession sincroniza monto en personal_transaction vinculada', () => {
    const { inv, userId } = makeInventory();
    db.createPersonalBudgetCategory(userId, { name: 'Hogar', flowType: 'expense' });
    const prod = db.create({ name: 'Jabon', category: 'Limpieza', current_qty: 10, min_qty: 0, unit: 'unidades', inventoryId: inv.id });
    const session = makeSession(inv, userId, { budgetCategory: 'Hogar' });
    db.updatePurchaseSession(session.id, inv.id, {
      purchaseDate: today(),
      items: [{ productId: prod.id, productName: 'Jabon', quantityBought: 2, unitPrice: 20, unit: 'unidades', storeId: null }],
      taxIds: [],
    });
    const txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    const linked = txs.filter(t => t.source_purchase_session_id === session.id);
    assert.equal(linked.length, 1);
    assert.ok(Math.abs(linked[0].amount - 40) < 0.001, `esperado 40, recibido ${linked[0].amount}`);
  });

  test('deletePurchaseSession elimina personal_transaction vinculada en cascada', () => {
    const { inv, userId } = makeInventory();
    db.createPersonalBudgetCategory(userId, { name: 'Cascada', flowType: 'expense' });
    const session = makeSession(inv, userId, { budgetCategory: 'Cascada' });
    db.deletePurchaseSession(session.id, inv.id, { revertInventory: false });
    const txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    assert.equal(txs.filter(t => t.source_purchase_session_id === session.id).length, 0);
  });
});

describe('getPersonalBudgetExpenseCategories — fuente unificada', () => {
  test('retorna categorias de personal_budget_categories', () => {
    const u = makeUser();
    db.createPersonalBudgetCategory(u.id, { name: 'SettingsCat', flowType: 'expense' });
    const cats = db.getPersonalBudgetExpenseCategories(u.id);
    assert.ok(cats.includes('SettingsCat'));
  });

  test('no incluye categorias de tipo income', () => {
    const u = makeUser();
    db.createPersonalBudgetCategory(u.id, { name: 'Salario', flowType: 'income' });
    const cats = db.getPersonalBudgetExpenseCategories(u.id);
    assert.ok(!cats.includes('Salario'));
  });

  test('merge con categorias de personal_budgets legacy', () => {
    const u = makeUser();
    db.addPersonalBudget(u.id, { category: 'LegacyCat', amount: 100, month: today().slice(0, 7), flow_type: 'expense' });
    const cats = db.getPersonalBudgetExpenseCategories(u.id);
    assert.ok(cats.includes('LegacyCat'));
  });

  test('lista vacia cuando usuario no tiene categorias', () => {
    const u = makeUser();
    const cats = db.getPersonalBudgetExpenseCategories(u.id);
    assert.equal(cats.length, 0);
  });
});

describe('personal_budget_categories — CRUD', () => {
  test('createPersonalBudgetCategory crea categoria y la retorna', () => {
    const u = makeUser();
    const res = db.createPersonalBudgetCategory(u.id, { name: 'Entretenimiento', flowType: 'expense' });
    assert.ok(!res.error, `error inesperado: ${res.error}`);
    assert.equal(res.category.name, 'Entretenimiento');
    assert.equal(res.category.flow_type, 'expense');
    assert.equal(res.category.user_id, u.id);
  });

  test('createPersonalBudgetCategory rechaza duplicado case-insensitive', () => {
    const u = makeUser();
    db.createPersonalBudgetCategory(u.id, { name: 'Gym', flowType: 'expense' });
    const dup = db.createPersonalBudgetCategory(u.id, { name: 'gym', flowType: 'expense' });
    assert.ok(dup.error, 'debe retornar error en duplicado');
  });

  test('deletePersonalBudgetCategory bloqueado si categoria tiene transacciones', () => {
    const u = makeUser();
    const res = db.createPersonalBudgetCategory(u.id, { name: 'EnUso', flowType: 'expense' });
    const catId = res.category.id;
    db.addPersonalTransaction(u.id, {
      type: 'expense', category: 'EnUso', amount: 50,
      description: 'test', date: today(), inventoryId: null,
    });
    const result = db.deletePersonalBudgetCategory(u.id, catId);
    assert.equal(result.error, 'in_use', 'debe retornar error in_use');
  });

  test('deletePersonalBudgetCategory elimina si no hay transacciones', () => {
    const u = makeUser();
    const res = db.createPersonalBudgetCategory(u.id, { name: 'SinUso', flowType: 'expense' });
    const catId = res.category.id;
    const result = db.deletePersonalBudgetCategory(u.id, catId);
    assert.ok(!result.error, `error inesperado: ${result.error}`);
    assert.equal(db.getPersonalBudgetCategories(u.id).find(c => c.id === catId), undefined);
  });
});

describe('personal_budget_settings — umbrales', () => {
  test('getPersonalBudgetSettings crea fila default si no existe y es idempotente', () => {
    const u = makeUser();
    const s1 = db.getPersonalBudgetSettings(u.id);
    const s2 = db.getPersonalBudgetSettings(u.id);
    assert.ok(typeof s1.alert_warn_pct === 'number', 'alert_warn_pct debe ser numero');
    assert.equal(s1.alert_warn_pct, s2.alert_warn_pct);
  });

  test('updatePersonalBudgetThresholds persiste y recupera valores', () => {
    const u = makeUser();
    db.updatePersonalBudgetThresholds(u.id, { warnPct: 0.55, critPct: 0.90 });
    const s = db.getPersonalBudgetSettings(u.id);
    assert.ok(Math.abs(s.alert_warn_pct - 0.55) < 0.001);
    assert.ok(Math.abs(s.alert_crit_pct - 0.90) < 0.001);
  });
});

// ── createPurchaseSession — descuentos e isTaxable ────────────

describe('createPurchaseSession — descuentos e isTaxable', () => {
  test('descuento fixed reduce total_amount', () => {
    const { inv, userId } = makeInventory();
    const session = db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'A', quantityBought: 2, unitPrice: 100, unit: 'u', productId: null, storeId: null }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
      discountType: 'fixed', discountValue: 30,
    });
    // subtotal 200 − 30 = 170
    assert.ok(Math.abs(session.total_amount - 170) < 0.01,
      `esperado 170, obtenido ${session.total_amount}`);
  });

  test('descuento percentage reduce total_amount', () => {
    const { inv, userId } = makeInventory();
    const session = db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'B', quantityBought: 1, unitPrice: 200, unit: 'u', productId: null, storeId: null }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
      discountType: 'percentage', discountValue: 10,
    });
    // subtotal 200 − 10% = 180
    assert.ok(Math.abs(session.total_amount - 180) < 0.01,
      `esperado 180, obtenido ${session.total_amount}`);
  });

  test('descuento mayor al total no produce total negativo', () => {
    const { inv, userId } = makeInventory();
    const session = db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'C', quantityBought: 1, unitPrice: 50, unit: 'u', productId: null, storeId: null }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
      discountType: 'fixed', discountValue: 9999,
    });
    assert.equal(session.total_amount, 0);
  });

  test('isTaxable=false excluye item del tax base con taxIds', () => {
    const { inv, userId } = makeInventory();
    const tax = db.createTaxType({ inventoryId: inv.id, name: 'IVA21', rate: 21, categories: [], active: true });
    const session = db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [
        { productName: 'Gravado',   quantityBought: 1, unitPrice: 100, unit: 'u', isTaxable: true  },
        { productName: 'Exento',    quantityBought: 1, unitPrice: 100, unit: 'u', isTaxable: false },
      ],
      taxIds: [tax.id], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    // solo el primero tributa: IVA 21% de 100 = 21
    assert.ok(Math.abs(session.total_tax - 21) < 0.01,
      `esperado total_tax ~21, obtenido ${session.total_tax}`);
    assert.ok(Math.abs(session.total_amount - 221) < 0.01,
      `esperado total_amount ~221, obtenido ${session.total_amount}`);
  });
});

// ── updatePurchaseSession — edge cases ────────────────────────

describe('updatePurchaseSession — edge cases', () => {
  test('sessionId de otro inventario retorna null (IDOR guard)', () => {
    const { inv: inv1, userId } = makeInventory();
    const { inv: inv2 } = makeInventory(userId);
    const session = db.createPurchaseSession({
      inventoryId: inv1.id, userId,
      items: [{ productName: 'X', quantityBought: 1, unitPrice: 10, unit: 'u' }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    const result = db.updatePurchaseSession(session.id, inv2.id, {
      purchaseDate: today(),
      items: [{ productName: 'X', quantityBought: 1, unitPrice: 10, unit: 'u' }],
      taxIds: [],
    });
    assert.equal(result, null);
  });

  test('stock revert + re-apply correcto al cambiar cantidad', () => {
    const { inv, userId } = makeInventory();
    const prod = db.create({ name: 'Arroz', category: 'Alimentos', current_qty: 0, min_qty: 0, unit: 'kg', inventoryId: inv.id });
    const session = db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'Arroz', productId: prod.id, quantityBought: 5, unitPrice: 10, unit: 'kg', storeId: null }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    assert.equal(db.getById(prod.id).current_qty, 5);
    db.updatePurchaseSession(session.id, inv.id, {
      purchaseDate: today(),
      items: [{ productName: 'Arroz', productId: prod.id, quantityBought: 3, unitPrice: 10, unit: 'kg', storeId: null }],
      taxIds: [],
    });
    // debe revertir 5 y aplicar 3 → final = 3
    assert.equal(db.getById(prod.id).current_qty, 3,
      `esperado 3, obtenido ${db.getById(prod.id).current_qty}`);
  });

  test('totalAmount→0 en update elimina personal_transaction existente', () => {
    const { inv, userId } = makeInventory();
    db.createPersonalBudgetCategory(userId, { name: 'BorrarTx', flowType: 'expense' });
    const session = db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'X', quantityBought: 1, unitPrice: 50, unit: 'u' }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
      budgetCategory: 'BorrarTx',
    });
    // hay tx vinculada
    let txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    assert.equal(txs.filter(t => t.source_purchase_session_id === session.id).length, 1);

    // actualizar a monto 0
    db.updatePurchaseSession(session.id, inv.id, {
      purchaseDate: today(),
      items: [{ productName: 'X', quantityBought: 1, unitPrice: 0, unit: 'u' }],
      taxIds: [],
      budgetCategory: 'BorrarTx',
    });
    txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    assert.equal(txs.filter(t => t.source_purchase_session_id === session.id).length, 0,
      'tx debe eliminarse cuando totalAmount es 0');
  });

  test('update con category en sesion sin tx previa inserta nueva personal_transaction', () => {
    const { inv, userId } = makeInventory();
    db.createPersonalBudgetCategory(userId, { name: 'NuevaCat', flowType: 'expense' });
    // crear sin budgetCategory → sin tx
    const session = db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'Y', quantityBought: 1, unitPrice: 80, unit: 'u' }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
    });
    let txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    assert.equal(txs.filter(t => t.source_purchase_session_id === session.id).length, 0);

    // actualizar pasando budgetCategory por primera vez
    db.updatePurchaseSession(session.id, inv.id, {
      purchaseDate: today(),
      items: [{ productName: 'Y', quantityBought: 1, unitPrice: 80, unit: 'u' }],
      taxIds: [],
      budgetCategory: 'NuevaCat',
      userId,
    });
    txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    const linked = txs.filter(t => t.source_purchase_session_id === session.id);
    assert.equal(linked.length, 1, 'debe insertar tx al agregar category en update');
    assert.ok(Math.abs(linked[0].amount - 80) < 0.001);
  });

  test('totalAmount 0→>0 en update crea personal_transaction (compensacion #115)', () => {
    const { inv, userId } = makeInventory();
    db.createPersonalBudgetCategory(userId, { name: 'CrearTx', flowType: 'expense' });
    // crear con category pero monto 0 → tx omitida
    const session = db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'Z', quantityBought: 1, unitPrice: 0, unit: 'u' }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
      budgetCategory: 'CrearTx',
    });
    assert.equal(session.budget_tx_omitted, true);
    let txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    assert.equal(txs.filter(t => t.source_purchase_session_id === session.id).length, 0);

    // subir el monto en update → debe crear la tx vinculada
    db.updatePurchaseSession(session.id, inv.id, {
      purchaseDate: today(),
      items: [{ productName: 'Z', quantityBought: 1, unitPrice: 60, unit: 'u' }],
      taxIds: [],
      budgetCategory: 'CrearTx',
      userId,
    });
    txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    const linked = txs.filter(t => t.source_purchase_session_id === session.id);
    assert.equal(linked.length, 1, 'debe crear tx cuando totalAmount pasa de 0 a >0');
    assert.ok(Math.abs(linked[0].amount - 60) < 0.001);
  });

  test('update sin budgetCategory preserva tx vinculada existente', () => {
    const { inv, userId } = makeInventory();
    db.createPersonalBudgetCategory(userId, { name: 'Preservar', flowType: 'expense' });
    const session = db.createPurchaseSession({
      inventoryId: inv.id, userId,
      items: [{ productName: 'W', quantityBought: 1, unitPrice: 40, unit: 'u' }],
      taxIds: [], currency: 'USD', purchaseDate: today(), receiptImage: null,
      budgetCategory: 'Preservar',
    });
    let txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    assert.equal(txs.filter(t => t.source_purchase_session_id === session.id).length, 1);

    // editar cantidad sin pasar budgetCategory → tx debe seguir vinculada y reflejar nuevo monto
    db.updatePurchaseSession(session.id, inv.id, {
      purchaseDate: today(),
      items: [{ productName: 'W', quantityBought: 3, unitPrice: 40, unit: 'u' }],
      taxIds: [],
      userId,
    });
    txs = db.getPersonalTransactions(userId, today().slice(0, 7));
    const linked = txs.filter(t => t.source_purchase_session_id === session.id);
    assert.equal(linked.length, 1, 'tx no debe eliminarse al editar sin budgetCategory');
    assert.equal(linked[0].category, 'Preservar', 'categoria original preservada');
    assert.ok(Math.abs(linked[0].amount - 120) < 0.001, 'monto actualizado');
  });
});

// ── Migración histórica de categorías — aislamiento por usuario ──

describe('runBudgetCategoryMigration — aislamiento por usuario (#121)', () => {
  test('fallo en un usuario no afecta a los demas ni deja transaccion abierta', () => {
    const raw = db._rawDb;
    const userA = makeUser().id; // va a fallar
    const userB = makeUser().id; // debe migrar ok
    const month = today().slice(0, 7);

    // Datos historicos (addPersonalBudget no toca personal_budget_categories)
    db.addPersonalBudget(userA, { category: 'POISON',     amount: 10, month, flow_type: 'expense' });
    db.addPersonalBudget(userB, { category: 'GoodCatXYZ', amount: 20, month, flow_type: 'expense' });

    // Trigger que aborta el INSERT de la categoria POISON dentro de la tx de userA,
    // simulando un fallo en mitad del forEach de la migracion.
    raw.exec(`
      CREATE TEMP TRIGGER poison_guard BEFORE INSERT ON personal_budget_categories
      WHEN NEW.name = 'POISON'
      BEGIN SELECT RAISE(ABORT, 'poison'); END;
    `);

    let result;
    try {
      result = db.runBudgetCategoryMigration([userA, userB]);
    } finally {
      raw.exec('DROP TRIGGER IF EXISTS poison_guard');
    }

    // userA fallo, userB migro — la migracion no aborta completa
    assert.equal(result.failed, 1, 'userA debe contar como fallo');
    assert.equal(result.migrated, 1, 'userB debe migrar pese al fallo de userA');

    // userB tiene su categoria migrada
    const catsB = db.getPersonalBudgetCategories(userB).map(c => c.name);
    assert.ok(catsB.includes('GoodCatXYZ'), 'categoria de userB debe migrarse');

    // userA hizo rollback — POISON no quedo a medias
    const catsA = db.getPersonalBudgetCategories(userA).map(c => c.name);
    assert.ok(!catsA.includes('POISON'), 'categoria de userA debe haber hecho rollback');

    // No quedo transaccion abierta: un BEGIN/COMMIT nuevo no debe tirar
    // "cannot start a transaction within a transaction".
    assert.doesNotThrow(() => { raw.exec('BEGIN'); raw.exec('COMMIT'); },
      'la DB no debe quedar con una transaccion abierta');
  });

  test('es idempotente — segunda corrida no duplica ni falla', () => {
    const user = makeUser().id;
    const month = today().slice(0, 7);
    db.addPersonalBudget(user, { category: 'Idempotente', amount: 5, month, flow_type: 'expense' });

    db.runBudgetCategoryMigration([user]);
    db.runBudgetCategoryMigration([user]);

    const cats = db.getPersonalBudgetCategories(user).filter(c => c.name === 'Idempotente');
    assert.equal(cats.length, 1, 'no debe duplicar la categoria en corridas repetidas');
  });
});

// ── Filtrado mensual por rango de fechas (índices, #203) ─────────

describe('getPersonalTransactions / DynamicStats — filtro por rango de mes (#203)', () => {
  test('incluye bordes del mes y excluye meses adyacentes', () => {
    const userId = makeUser().id;
    const tx = (date, type, amount) => db.addPersonalTransaction(userId, {
      inventoryId: null, type, category: 'X', amount, description: null, date,
    });
    // Mes objetivo: 2026-06
    tx('2026-06-01', 'expense', 10);  // primer dia (incluido)
    tx('2026-06-30', 'income', 100);  // ultimo dia (incluido)
    tx('2026-05-31', 'expense', 999); // mes anterior (excluido)
    tx('2026-07-01', 'income', 999);  // mes siguiente (excluido)

    const txs = db.getPersonalTransactions(userId, '2026-06');
    const dates = txs.map(t => t.date).sort();
    assert.deepEqual(dates, ['2026-06-01', '2026-06-30'],
      'solo las dos transacciones dentro del mes');

    const stats = db.getPersonalBudgetDynamicStats(userId, '2026-06');
    assert.ok(Math.abs(stats.income_real - 100) < 0.001, 'ingreso del mes');
    assert.ok(Math.abs(stats.expense_real - 10) < 0.001, 'gasto del mes');
    assert.ok(Math.abs(stats.balance_real - 90) < 0.001, 'balance del mes');
  });

  test('mes invalido retorna vacio / ceros sin throw', () => {
    const userId = makeUser().id;
    assert.deepEqual(db.getPersonalTransactions(userId, '2026-6'), []);
    assert.deepEqual(db.getPersonalBudgetDynamicStats(userId, 'bad'),
      { income_real: 0, expense_real: 0, balance_real: 0 });
  });
});

// ── Cleanup ────────────────────────────────────────────────────

after(() => {
  try { fs.unlinkSync(TEST_DB); } catch {}
  // WAL journal files
  try { fs.unlinkSync(TEST_DB + '-wal'); } catch {}
  try { fs.unlinkSync(TEST_DB + '-shm'); } catch {}
});
