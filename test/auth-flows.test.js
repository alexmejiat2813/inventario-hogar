'use strict';
/**
 * Authenticated HTTP flow tests (item #205).
 *
 * No OAuth round-trip: we forge a valid express-session cookie by writing a
 * session row through the same SQLiteStore the server uses and signing the sid
 * with the same SESSION_SECRET (cookie-signature). passport.serializeUser stores
 * the whole user object, so the session's passport.user is the user record and
 * requireInventory reads session.activeInventoryId.
 *
 * Covers: /api/me, purchase create+edit with budget link, role permissions
 * (owner/editor/reader), product-master CRUD, installments, and the
 * "no active inventory" guard.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('http');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const TEST_DB = path.join(os.tmpdir(), `ih-authflow-test-${Date.now()}.db`);
process.env.DB_PATH          = TEST_DB;
process.env.SESSION_SECRET   = 'test-secret-auth-flows';
process.env.GOOGLE_CLIENT_ID     = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.CALLBACK_URL         = 'http://localhost/auth/google/callback';

const app          = require('../server');
const db           = require('../database');
const SQLiteStore  = require('../middleware/session-store');
const signature    = require('cookie-signature');

const store = new SQLiteStore();

let _seq = 0;
function makeUser(name = 'Flow') {
  const n = ++_seq;
  return db.upsertUser({
    google_id: `gflow_${n}`, name: `${name} ${n}`,
    email: `flow${n}@example.com`, photo: null,
  });
}

// Forge a signed session cookie for `user`, optionally with an active inventory.
function authCookie(user, activeInventoryId = null) {
  const sid = crypto.randomBytes(18).toString('hex');
  const sessionData = {
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, path: '/' },
    passport: { user: { id: user.id, name: user.name, email: user.email, photo: null } },
    activeInventoryId,
  };
  return new Promise((resolve, reject) => {
    store.set(sid, sessionData, err => {
      if (err) return reject(err);
      resolve('connect.sid=s%3A' + encodeURIComponent(signature.sign(sid, process.env.SESSION_SECRET)));
    });
  });
}

let server, baseUrl;
before(() => new Promise((resolve, reject) => {
  server = http.createServer(app);
  server.listen(0, '127.0.0.1', () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
  server.on('error', reject);
}));
after(() => new Promise(resolve => {
  server.close(() => {
    try { fs.unlinkSync(TEST_DB); } catch {}
    try { fs.unlinkSync(TEST_DB + '-wal'); } catch {}
    try { fs.unlinkSync(TEST_DB + '-shm'); } catch {}
    resolve();
  });
}));

function req(method, urlPath, { cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(baseUrl + urlPath, {
    method, headers, redirect: 'manual',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('sesión forjada autentica', () => {
  test('GET /api/me devuelve el usuario de la sesión', async () => {
    const user = makeUser();
    const cookie = await authCookie(user);
    const res = await req('GET', '/api/me', { cookie });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, user.id);
  });

  test('sin cookie GET /api/me devuelve 401', async () => {
    const res = await req('GET', '/api/me');
    assert.equal(res.status, 401);
  });
});

describe('requireInventory', () => {
  test('sin inventario activo POST /api/purchases devuelve 400', async () => {
    const user = makeUser();
    const cookie = await authCookie(user, null);
    const res = await req('POST', '/api/purchases', {
      cookie,
      body: { items: [{ productName: 'X', quantityBought: 1, unitPrice: 5, unit: 'u' }], purchase_date: '2026-06-16' },
    });
    assert.equal(res.status, 400);
  });
});

describe('flujo de compra con presupuesto', () => {
  test('owner crea compra con budget_category y la lista', async () => {
    const user = makeUser('Owner');
    const inv  = db.createInventory('Casa', user.id);
    db.createPersonalBudgetCategory(user.id, { name: 'Mercado', flowType: 'expense' });
    const cookie = await authCookie(user, inv.id);

    const create = await req('POST', '/api/purchases', {
      cookie,
      body: {
        items: [{ productName: 'Leche', quantityBought: 2, unitPrice: 10, unit: 'lt' }],
        purchase_date: '2026-06-16', currency: 'USD', budget_category: 'Mercado',
      },
    });
    assert.equal(create.status, 201);
    const session = await create.json();
    assert.equal(session.budget_category_status, 'accepted');

    const list = await req('GET', '/api/purchases', { cookie });
    assert.equal(list.status, 200);
    const sessions = await list.json();
    assert.ok(sessions.some(s => s.id === session.id), 'la compra creada aparece en el historial');

    // tx personal vinculada existe
    const txs = db.getPersonalTransactions(user.id, '2026-06');
    assert.ok(txs.some(t => t.source_purchase_session_id === session.id), 'tx personal vinculada');
  });

  test('editar por ruta /inventories aplica descuento (paridad #209)', async () => {
    const user = makeUser('InvEdit');
    const inv  = db.createInventory('CasaInv', user.id);
    const cookie = await authCookie(user, inv.id);
    const create = await req('POST', '/api/purchases', {
      cookie,
      body: { items: [{ productName: 'Q', quantityBought: 1, unitPrice: 100, unit: 'u' }], purchase_date: '2026-06-16' },
    });
    const session = await create.json();
    assert.equal(session.total_amount, 100);

    // editar con descuento fijo 30 por la ruta que usa el frontend (purchase-edit)
    const edit = await req('PUT', `/api/inventories/${inv.id}/purchases/${session.id}`, {
      cookie,
      body: {
        purchase_date: '2026-06-16',
        items: [{ productName: 'Q', quantityBought: 1, unitPrice: 100, unit: 'u' }],
        tax_ids: [], discount_type: 'fixed', discount_value: 30,
      },
    });
    assert.equal(edit.status, 200);
    const updated = await edit.json();
    assert.ok(Math.abs(updated.total_amount - 70) < 0.01,
      `descuento debe aplicarse, esperado 70, obtenido ${updated.total_amount}`);
  });

  test('owner edita la compra (PUT) y cambia el monto', async () => {
    const user = makeUser('Editor');
    const inv  = db.createInventory('Casa2', user.id);
    const cookie = await authCookie(user, inv.id);
    const create = await req('POST', '/api/purchases', {
      cookie,
      body: { items: [{ productName: 'Pan', quantityBought: 1, unitPrice: 5, unit: 'u' }], purchase_date: '2026-06-16' },
    });
    const session = await create.json();
    const edit = await req('PUT', `/api/purchases/${session.id}`, {
      cookie,
      body: { purchase_date: '2026-06-16', items: [{ productName: 'Pan', quantityBought: 3, unitPrice: 5, unit: 'u' }], tax_ids: [] },
    });
    assert.equal(edit.status, 200);
    const updated = await edit.json();
    assert.ok(Math.abs(updated.total_amount - 15) < 0.01, `esperado 15, obtenido ${updated.total_amount}`);
  });
});

describe('permisos por rol', () => {
  test('reader NO puede crear compra (403)', async () => {
    const owner  = makeUser('O');
    const inv    = db.createInventory('Compartido', owner.id);
    const reader = makeUser('R');
    db._rawDb.prepare(
      'INSERT INTO inventory_members (inventory_id, user_id, role) VALUES (?, ?, ?)'
    ).run(inv.id, reader.id, 'reader');
    const cookie = await authCookie(reader, inv.id);
    const res = await req('POST', '/api/purchases', {
      cookie,
      body: { items: [{ productName: 'X', quantityBought: 1, unitPrice: 5, unit: 'u' }], purchase_date: '2026-06-16' },
    });
    assert.equal(res.status, 403);
  });

  test('editor SÍ puede crear compra (201)', async () => {
    const owner  = makeUser('O2');
    const inv    = db.createInventory('Compartido2', owner.id);
    const editor = makeUser('E');
    db._rawDb.prepare(
      'INSERT INTO inventory_members (inventory_id, user_id, role) VALUES (?, ?, ?)'
    ).run(inv.id, editor.id, 'editor');
    const cookie = await authCookie(editor, inv.id);
    const res = await req('POST', '/api/purchases', {
      cookie,
      body: { items: [{ productName: 'X', quantityBought: 1, unitPrice: 5, unit: 'u' }], purchase_date: '2026-06-16' },
    });
    assert.equal(res.status, 201);
  });

  test('usuario sin membresía no accede al inventario (403)', async () => {
    const owner    = makeUser('O3');
    const inv      = db.createInventory('Privado', owner.id);
    const stranger = makeUser('S');
    const cookie = await authCookie(stranger, inv.id);
    const res = await req('GET', '/api/purchases', { cookie });
    assert.equal(res.status, 403);
  });
});

describe('product-master autenticado', () => {
  test('crea y lista producto maestro', async () => {
    const user = makeUser('PM');
    const cookie = await authCookie(user);
    const create = await req('POST', '/api/product-master', {
      cookie, body: { name: 'Atún', barcode: `bc-${Date.now()}`, brand: 'MarcaX' },
    });
    assert.equal(create.status, 201);
    const list = await req('GET', '/api/product-master', { cookie });
    assert.equal(list.status, 200);
    const products = await list.json();
    assert.ok(products.some(p => p.name === 'Atún'));
  });
});

describe('cuotas (installments) autenticado', () => {
  test('crea plan de cuotas', async () => {
    const user = makeUser('Cuotas');
    const cookie = await authCookie(user);
    const res = await req('POST', '/api/personal-budget/installments', {
      cookie,
      body: {
        name: 'Heladera', totalAmount: 1200, numInstallments: 12,
        amountPerInstallment: 100, startDate: '2026-06-16', currency: 'USD',
      },
    });
    assert.equal(res.status, 201);
    const plan = await res.json();
    assert.equal(plan.name, 'Heladera');
  });
});
