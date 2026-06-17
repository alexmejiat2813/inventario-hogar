/* Shared utilities — loaded before every page script */
/* eslint-disable no-unused-vars -- globals used by other page scripts via script tag */

async function apiFetch(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error(`Error ${res.status}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en el servidor');
  return data;
}

function catLang() {
  return (typeof I18N !== 'undefined' && I18N.current) ? I18N.current() : 'es';
}

const CURRENCY_SYMBOLS = { CAD: 'C$', USD: '$', COP: '$', EUR: '€', MXN: '$', BRL: 'R$', GBP: '£' };
function curSym(c) { return CURRENCY_SYMBOLS[c] || '$'; }

const MAX_PHOTOS     = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

// Pide al Service Worker purgar el cache de respuestas /api/ (logout / cambio
// de inventario), para no servir datos del usuario/inventario anterior offline.
function purgeApiCache() {
  try { navigator.serviceWorker?.controller?.postMessage({ type: 'PURGE_API_CACHE' }); }
  catch { /* noop */ }
}
