'use strict';
/**
 * Smoke tests for HTTP routes.
 * Verifies server starts, public routes return expected status codes,
 * and protected API routes reject unauthenticated requests.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('http');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

// Set env vars BEFORE requiring server (module cache)
const TEST_DB = path.join(os.tmpdir(), `ih-server-test-${Date.now()}.db`);
process.env.DB_PATH          = TEST_DB;
process.env.SESSION_SECRET   = 'test-secret-for-smoke-tests';
process.env.GOOGLE_CLIENT_ID     = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.CALLBACK_URL         = 'http://localhost/auth/google/callback';

const app = require('../server');

let server;
let baseUrl;

before(() => new Promise((resolve, reject) => {
  server = http.createServer(app);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
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

// ── Helper ─────────────────────────────────────────────────────

async function get(urlPath, options = {}) {
  const url = baseUrl + urlPath;
  const res = await fetch(url, { redirect: 'manual', ...options });
  return res;
}

// ── Public routes ──────────────────────────────────────────────

describe('public routes', () => {
  test('GET /login returns 200', async () => {
    const res = await get('/login');
    assert.equal(res.status, 200);
  });

  test('GET /css/styles.css returns 200', async () => {
    const res = await get('/css/styles.css');
    assert.equal(res.status, 200);
  });

  test('GET /manifest.json returns 200', async () => {
    const res = await get('/manifest.json');
    assert.equal(res.status, 200);
  });

  test('GET /sw.js returns 200', async () => {
    const res = await get('/sw.js');
    assert.equal(res.status, 200);
  });
});

describe('security headers', () => {
  test('responses include CSP and hardening headers', async () => {
    const res = await get('/login');
    assert.ok(res.headers.get('content-security-policy'), 'Missing Content-Security-Policy');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.ok(res.headers.get('referrer-policy'), 'Missing Referrer-Policy');
  });
});

describe('uploads are private', () => {
  test('GET /uploads/* returns 401 without auth', async () => {
    const res = await get('/uploads/products/whatever.jpg');
    assert.equal(res.status, 401);
  });
});

// ── Redirect for unauthenticated pages ─────────────────────────

describe('page routes redirect when unauthenticated', () => {
  test('GET / redirects to /login', async () => {
    const res = await get('/');
    assert.ok([301, 302, 307, 308].includes(res.status),
      `Expected redirect, got ${res.status}`);
  });

  test('GET /inventory redirects when not authenticated', async () => {
    const res = await get('/inventory');
    assert.ok([301, 302, 307, 308].includes(res.status),
      `Expected redirect, got ${res.status}`);
  });
});

// ── API returns 401 without auth ───────────────────────────────

describe('API routes require authentication', () => {
  const protectedRoutes = [
    '/api/me',
    '/api/inventories',
    '/api/active-inventory',
    '/api/admin/stats',
  ];

  for (const route of protectedRoutes) {
    test(`GET ${route} returns 401`, async () => {
      const res = await get(route);
      assert.equal(res.status, 401,
        `Expected 401 for ${route}, got ${res.status}`);
    });
  }

  test('POST /api/inventories returns 401 without auth', async () => {
    const res = await fetch(baseUrl + '/api/inventories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    assert.equal(res.status, 401);
  });
});

// ── Rate limiting ──────────────────────────────────────────────

describe('rate limiting', () => {
  test('API returns X-RateLimit headers', async () => {
    const res = await get('/api/me');
    assert.ok(res.headers.has('x-ratelimit-limit'),
      'Missing X-RateLimit-Limit header');
    assert.ok(res.headers.has('x-ratelimit-remaining'),
      'Missing X-RateLimit-Remaining header');
  });
});

// ── API 404 handler ────────────────────────────────────────────

describe('API 404 handler', () => {
  test('unknown API route returns 404 JSON', async () => {
    const res = await get('/api/this-route-does-not-exist');
    // Could be 401 (auth check first) or 404 — both are acceptable
    assert.ok([401, 404].includes(res.status));
    const body = await res.json();
    assert.ok(body.error, 'Expected JSON error field');
  });
});
