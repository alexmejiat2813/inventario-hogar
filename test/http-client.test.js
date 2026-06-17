'use strict';
/**
 * Unit tests for lib/http-client.js (item #202). No real network: a fake
 * fetchImpl is injected to exercise timeout, retry, cache and status handling.
 */

const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { fetchJson, HttpError, _clearCache, _cacheSize } = require('../lib/http-client');

function jsonResponse(status, body) {
  return { status, json: async () => body };
}

// A fetch that aborts (rejects with AbortError) when the signal fires, to
// simulate a hanging upstream hitting the timeout.
function hangingFetch() {
  return (url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
    });
  });
}

beforeEach(() => _clearCache());

describe('fetchJson — exito y status', () => {
  test('devuelve { status, data } en 200', async () => {
    const fetchImpl = async () => jsonResponse(200, { rates: { COP: 3000 } });
    const r = await fetchJson('http://x/a', { fetchImpl });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, { rates: { COP: 3000 } });
  });

  test('propaga status no-2xx sin lanzar (caller decide)', async () => {
    const fetchImpl = async () => jsonResponse(404, { error: 'nope' });
    const r = await fetchJson('http://x/b', { fetchImpl });
    assert.equal(r.status, 404);
  });
});

describe('fetchJson — timeout', () => {
  test('aborta y lanza HttpError kind=timeout', async () => {
    await assert.rejects(
      fetchJson('http://x/slow', { fetchImpl: hangingFetch(), timeoutMs: 30, retries: 0 }),
      err => err instanceof HttpError && err.kind === 'timeout',
    );
  });
});

describe('fetchJson — retry', () => {
  test('reintenta en error de red y termina exitoso', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (calls === 1) throw new Error('ECONNRESET');
      return jsonResponse(200, { ok: true });
    };
    const r = await fetchJson('http://x/retry', { fetchImpl, retries: 1, retryDelayMs: 1 });
    assert.equal(calls, 2);
    assert.equal(r.data.ok, true);
  });

  test('agota reintentos y lanza HttpError kind=network', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls++; throw new Error('ENOTFOUND'); };
    await assert.rejects(
      fetchJson('http://x/fail', { fetchImpl, retries: 2, retryDelayMs: 1 }),
      err => err instanceof HttpError && err.kind === 'network',
    );
    assert.equal(calls, 3); // intento inicial + 2 reintentos
  });
});

describe('fetchJson — cache', () => {
  test('segunda llamada con TTL no vuelve a pegar al upstream', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls++; return jsonResponse(200, { n: calls }); };
    const url = 'http://x/cached';
    const r1 = await fetchJson(url, { fetchImpl, cacheTtlMs: 10000 });
    const r2 = await fetchJson(url, { fetchImpl, cacheTtlMs: 10000 });
    assert.equal(calls, 1, 'solo un fetch real');
    assert.equal(r1.data.n, 1);
    assert.equal(r2.data.n, 1, 'segunda respuesta viene del cache');
    assert.equal(_cacheSize(), 1);
  });

  test('no cachea respuestas no-2xx', async () => {
    const fetchImpl = async () => jsonResponse(500, { e: 1 });
    await fetchJson('http://x/err', { fetchImpl, cacheTtlMs: 10000 });
    assert.equal(_cacheSize(), 0);
  });

  test('TTL=0 (default) no cachea', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls++; return jsonResponse(200, {}); };
    await fetchJson('http://x/nocache', { fetchImpl });
    await fetchJson('http://x/nocache', { fetchImpl });
    assert.equal(calls, 2);
  });
});

describe('fetchJson — parse', () => {
  test('JSON invalido lanza HttpError kind=parse sin reintentar', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls++; return { status: 200, json: async () => { throw new Error('bad'); } }; };
    await assert.rejects(
      fetchJson('http://x/parse', { fetchImpl, retries: 3 }),
      err => err instanceof HttpError && err.kind === 'parse',
    );
    assert.equal(calls, 1, 'parse error no se reintenta');
  });
});
