'use strict';
/**
 * #210: /api/backup debe ser alcanzable por cron externo vía X-Backup-Secret,
 * sin sesión. Antes quedaba detrás del guard global requireAuthApi y devolvía
 * 401 antes de validar el secret. Ahora está montado antes del guard.
 *
 * Verificamos REACHABILITY sin ejecutar un backup real: con BACKUP_SECRET
 * configurado, un secret inválido debe devolver 403 (el handler corrió), no el
 * 401 del guard global.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('http');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

const TEST_DB = path.join(os.tmpdir(), `ih-backup-test-${Date.now()}.db`);
process.env.DB_PATH          = TEST_DB;
process.env.SESSION_SECRET   = 'test-secret-backup';
process.env.GOOGLE_CLIENT_ID     = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.CALLBACK_URL         = 'http://localhost/auth/google/callback';
process.env.BACKUP_SECRET        = 'super-secret-cron-token';

const app = require('../server');

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

function postBackup(headers = {}) {
  return fetch(baseUrl + '/api/backup', { method: 'POST', headers, redirect: 'manual' });
}

describe('/api/backup — alcanzable por secret sin sesión (#210)', () => {
  test('sin header de secret → 403 del handler (no 401 del guard global)', async () => {
    const res = await postBackup();
    assert.equal(res.status, 403, 'el handler debe correr y rechazar, no el guard de auth');
  });

  test('secret incorrecto → 403', async () => {
    const res = await postBackup({ 'x-backup-secret': 'wrong' });
    assert.equal(res.status, 403);
  });
});
