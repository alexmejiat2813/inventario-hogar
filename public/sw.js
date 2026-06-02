/* Inventario Hogar — Service Worker */
const CACHE = 'ih-v2';

const PRECACHE = [
  '/css/styles.css',
  '/js/i18n.js',
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

  // Only handle GET from same origin
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API and auth: always network-only (never serve stale data)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // Static assets (CSS, JS, locales, icons, manifest): cache-first
  if (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/locales/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  ) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          if (resp.ok) {
            caches.open(CACHE).then(c => c.put(request, resp.clone()));
          }
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

  // HTML navigation: network-first, fall back to cache
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
});
