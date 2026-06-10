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

// ── Cleanup ────────────────────────────────────────────────────

after(() => {
  try { fs.unlinkSync(TEST_DB); } catch {}
  // WAL journal files
  try { fs.unlinkSync(TEST_DB + '-wal'); } catch {}
  try { fs.unlinkSync(TEST_DB + '-shm'); } catch {}
});
