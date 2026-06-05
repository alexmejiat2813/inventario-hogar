/* Inventario Hogar — Service Worker */
const CACHE = 'ih-v13';

const PRECACHE = [
  '/css/styles.css',
  '/js/i18n.js',
  '/js/cropper.js',
  '/js/app.js',
  '/js/dashboard.js',
  '/js/catalog.js',
  '/js/history.js',
  '/js/inventories.js',
  '/js/purchase-edit.js',
  '/js/settings.js',
  '/js/shopping-list.js',
  '/locales/es.json',
  '/locales/en.json',
  '/locales/fr.json',
  '/manifest.json',
  '/icons/icon.svg',
];

// GET API paths safe to cache (network-first → stale fallback when offline)
function isCacheableApi(pathname) {
  return (
    pathname === '/api/me'               ||
    pathname === '/api/active-inventory' ||
    pathname === '/api/stores'           ||
    pathname.startsWith('/api/shopping') ||
    pathname.startsWith('/api/settings/taxes')
  );
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin GETs
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Auth: always network-only
  if (url.pathname.startsWith('/auth/')) return;

  // Cacheable API endpoints: network-first, stale fallback when offline
  if (url.pathname.startsWith('/api/') && isCacheableApi(url.pathname)) {
    e.respondWith(
      fetch(request)
        .then(resp => {
          if (resp.ok) {
            caches.open(CACHE).then(c => c.put(request, resp.clone()));
          }
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Other API routes: network-only (never serve stale)
  if (url.pathname.startsWith('/api/')) return;

  // App shell (CSS, JS, locales): NETWORK-FIRST.
  // Garantiza que tras un deploy el codigo nuevo se sirve siempre (no
  // queda JS/CSS viejo pegado de cache). Cache solo como fallback offline.
  if (
    url.pathname.startsWith('/css/')     ||
    url.pathname.startsWith('/js/')      ||
    url.pathname.startsWith('/locales/')
  ) {
    e.respondWith(
      fetch(request)
        .then(resp => {
          if (resp.ok) caches.open(CACHE).then(c => c.put(request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Estaticos que casi no cambian (iconos, manifest): cache-first
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          if (resp.ok) caches.open(CACHE).then(c => c.put(request, resp.clone()));
          return resp;
        });
      })
    );
    return;
  }

  // Uploaded images: stale-while-revalidate
  if (url.pathname.startsWith('/uploads/')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(request).then(cached => {
          const fresh = fetch(request).then(resp => {
            if (resp.ok) cache.put(request, resp.clone());
            return resp;
          });
          return cached || fresh;
        })
      )
    );
    return;
  }

  // HTML navigation: network-first, fall back to cached shell
  e.respondWith(
    fetch(request)
      .then(resp => {
        if (resp.ok) caches.open(CACHE).then(c => c.put(request, resp.clone()));
        return resp;
      })
      .catch(() => caches.match(request))
  );
});
