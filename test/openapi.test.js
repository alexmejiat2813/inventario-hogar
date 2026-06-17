'use strict';
/**
 * OpenAPI living-contract tests (item #201).
 *
 * The spec is generated from the mounted routes (lib/openapi.js), so it cannot
 * silently fall behind the real API. These tests assert:
 *   1. Every documented path+method is actually mounted (no stale spec).
 *   2. A minimal set of critical endpoints is present (spec stays complete).
 *   3. The served /openapi.json matches the generated spec and is public.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('http');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

const TEST_DB = path.join(os.tmpdir(), `ih-openapi-test-${Date.now()}.db`);
process.env.DB_PATH          = TEST_DB;
process.env.SESSION_SECRET   = 'test-secret-openapi';
process.env.GOOGLE_CLIENT_ID     = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.CALLBACK_URL         = 'http://localhost/auth/google/callback';

const app = require('../server');
const { buildSpec, toOpenApiPath } = require('../lib/openapi');
const { listRoutes } = require('../lib/route-inventory');

// Documented "{param}" path → Express ":param" for comparison with mounted routes.
function toExpressPath(p) {
  return p.replace(/\{([^}]+)\}/g, ':$1');
}

const spec = buildSpec(app);
const mounted = new Set(listRoutes(app).map(r => `${r.method} ${r.path}`));

describe('openapi — no stale documentation', () => {
  test('cada path+method documentado existe montado en la app', () => {
    const stale = [];
    for (const [docPath, methods] of Object.entries(spec.paths)) {
      for (const method of Object.keys(methods)) {
        const key = `${method.toUpperCase()} ${toExpressPath(docPath)}`;
        if (!mounted.has(key)) stale.push(key);
      }
    }
    assert.deepEqual(stale, [], `spec documenta rutas inexistentes: ${stale.join(', ')}`);
  });
});

describe('openapi — cobertura minima de endpoints criticos', () => {
  const critical = [
    'GET /api/me',
    'GET /api/inventories/',
    'POST /api/inventories/',
    'GET /api/purchases/',
    'POST /api/purchases/',
    'PUT /api/purchases/:sessionId',
    'GET /api/purchases/budget-link',
    'PUT /api/purchases/budget-link',
    'POST /api/personal-budget/transaction',
    'POST /api/personal-budget/installments',
    'GET /api/personal-budget/installments/fx-rate',
    'POST /api/product-master/scan-register',
    'POST /api/backup/',
    'GET /health',
    'GET /auth/google',
  ];

  const documented = new Set();
  for (const [docPath, methods] of Object.entries(spec.paths)) {
    for (const method of Object.keys(methods)) {
      documented.add(`${method.toUpperCase()} ${toExpressPath(docPath)}`);
    }
  }

  for (const route of critical) {
    test(`${route} esta documentado`, () => {
      // sanity: el critico tambien debe estar realmente montado
      assert.ok(mounted.has(route), `${route} no esta montado (test desactualizado)`);
      assert.ok(documented.has(route), `${route} falta en openapi.json`);
    });
  }
});

describe('openapi — metadatos y seguridad', () => {
  test('version coincide con package.json', () => {
    const pkg = require('../package.json');
    assert.equal(spec.info.version, pkg.version);
  });

  test('rutas /api requieren cookieAuth, /health y /auth/google son publicas', () => {
    assert.ok(spec.paths['/api/me'].get.security, '/api/me debe declarar security');
    assert.ok(!spec.paths['/health'].get.security, '/health no debe requerir auth');
    assert.ok(!spec.paths['/auth/google'].get.security, '/auth/google no debe requerir auth');
  });
});

describe('openapi — servido dinamicamente', () => {
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

  test('GET /openapi.json es publico (200) y devuelve el spec generado', async () => {
    const res = await fetch(baseUrl + '/openapi.json', { redirect: 'manual' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.openapi, '3.0.0');
    assert.equal(Object.keys(body.paths).length, Object.keys(spec.paths).length);
    assert.ok(body.paths['/api/me'], 'debe incluir /api/me');
  });

  // Guard against the duplicated helper drifting from the generator.
  test('toOpenApiPath convierte :param a {param}', () => {
    assert.equal(toOpenApiPath('/api/purchases/:sessionId'), '/api/purchases/{sessionId}');
  });
});
