/* Inventario Hogar — Service Worker v2 */
let CACHE = 'ih-v1'; // Default; actualizado en install event

const PRECACHE = [
  // CSS (todas las vistas)
  '/css/styles.css',
  '/css/header.css',
  '/css/products.css',
  '/css/admin.css',
  '/css/catalog.css',
  '/css/cropper.css',
  '/css/history.css',
  '/css/inventories.css',
  '/css/login.css',
  '/css/personal-budget.css',
  '/css/personal-budget-cuotas.css',
  '/css/purchase-edit.css',
  '/css/settings.css',
  '/css/shopping-list.css',
  '/css/shortcuts.css',
  // JS compartido
  '/js/i18n.js',
  '/js/utils.js',
  '/js/header.js',
  '/js/shortcuts.js',
  '/js/mob-drawer.js',
  '/js/back-to-top.js',
  '/js/sw-register.js',
  '/js/cropper.js',
  '/js/lib/lazy-chart.js',
  '/js/lib/purchase-totals.js',
  // JS por vista
  '/js/app.js',
  '/js/dashboard.js',
  '/js/catalog.js',
  '/js/history.js',
  '/js/inventories.js',
  '/js/purchase-edit.js',
  '/js/products.js',
  '/js/settings.js',
  '/js/shopping-list.js',
  '/js/admin.js',
  '/js/login.js',
  '/js/personal-budget.js',
  '/js/personal-budget-cuotas.js',
  '/js/personal-budget-settings.js',
  '/js/vendor/zxing.js',
  // i18n + estáticos
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
    fetch('/cache-version', { cache: 'no-store' })
      .then(r => r.text())
      .then(version => { CACHE = version; return version; })
      .catch(() => CACHE) // Fallback si el endpoint falla
      .then(cache => caches.open(cache))
      // Precache resiliente: un asset faltante/renombrado no debe abortar la
      // instalación entera (addAll es atómico y rompe con un solo 404). (#223)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
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
          if (resp.ok) safePutInCache(request, resp);
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
          if (resp.ok) safePutInCache(request, resp);
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
          if (resp.ok) safePutInCache(request, resp);
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
            if (resp.ok) safePutInCache(request, resp);
            return resp;
          });
          return cached || fresh;
        })
      )
    );
    return;
  }

  // HTML navigation: network-first, fall back to cached shell.
  // No cachear respuestas redirigidas (p. ej. ruta protegida → /login): si no,
  // queda una página de login pegada bajo la URL protegida y se sirve offline. (#225)
  e.respondWith(
    fetch(request)
      .then(resp => {
        if (resp.ok && !resp.redirected) safePutInCache(request, resp);
        return resp;
      })
      .catch(() => caches.match(request))
  );
});

// Purga del cache de respuestas /api/ — invocado por la página en logout o
// cambio de inventario, para no servir datos del usuario/inventario anterior
// en un fallback offline (navegador compartido). (#224)
self.addEventListener('message', e => {
  if (e.data?.type !== 'PURGE_API_CACHE') return;
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.keys().then(reqs => Promise.all(
        reqs
          .filter(r => new URL(r.url).pathname.startsWith('/api/'))
          .map(r => cache.delete(r))
      ))
    )
  );
});

// Clona y cachea sin riesgo de tumbar la respuesta real si el clone()
// falla (puede pasar en una ventana de carrera durante la activacion
// de un SW nuevo) — el fetch a la pagina nunca debe verse afectado.
function safePutInCache(request, resp) {
  try {
    const copy = resp.clone();
    caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
  } catch {}
}

self.addEventListener('push', e => {
  if (!e.data) return;

  try {
    const { title, body, badge, icon, tag } = e.data.json();
    const options = {
      body,
      badge: badge || '/icons/icon.svg',
      icon: icon || '/icons/icon.svg',
      tag: tag || 'notification',
      requireInteraction: true,
    };

    e.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Push parse error:', err);
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
