'use strict';

/**
 * Small resilient HTTP-JSON client for external integrations (Open Food Facts,
 * FX rates). Adds what raw fetch/https.get lack in request handlers:
 *   - timeout (AbortController) so a slow upstream can't hang the request,
 *   - limited retry on timeout/network errors (not on HTTP status codes),
 *   - short in-memory response cache to absorb bursts and repeated lookups.
 *
 * Returns `{ status, data }`. Throws HttpError only for timeout / network /
 * parse failures — HTTP non-2xx is returned so callers can branch on status.
 * `fetchImpl` is injectable for tests (defaults to global fetch).
 */

class HttpError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'HttpError';
    this.kind = kind; // 'timeout' | 'network' | 'parse'
  }
}

const cache = new Map(); // url -> { expires, value: { status, data } }

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, {
  timeoutMs    = 5000,
  retries      = 1,
  retryDelayMs = 200,
  cacheTtlMs   = 0,
  headers      = {},
  fetchImpl    = globalThis.fetch,
} = {}) {
  if (cacheTtlMs > 0) {
    const hit = cache.get(url);
    if (hit && hit.expires > Date.now()) return hit.value;
  }

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetchImpl(url, { headers, signal: controller.signal });
      let data;
      try {
        data = await resp.json();
      } catch {
        throw new HttpError('parse', `Invalid JSON from ${url}`);
      }
      const value = { status: resp.status, data };
      if (cacheTtlMs > 0 && resp.status >= 200 && resp.status < 300) {
        cache.set(url, { expires: Date.now() + cacheTtlMs, value });
      }
      return value;
    } catch (err) {
      // Parse errors are not retryable.
      if (err instanceof HttpError && err.kind === 'parse') throw err;
      lastErr = (err && err.name === 'AbortError')
        ? new HttpError('timeout', `Timeout after ${timeoutMs}ms: ${url}`)
        : new HttpError('network', `Network error: ${url} (${err && err.message})`);
      if (attempt < retries) await sleep(retryDelayMs);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

// Test helpers.
function _clearCache() { cache.clear(); }
function _cacheSize()  { return cache.size; }

module.exports = { fetchJson, HttpError, _clearCache, _cacheSize };
