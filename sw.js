/**
 * sw.js — Service Worker
 * ─────────────────────────────────────────────────────────────
 * PWA Caching untuk MKSLB Stream Deck
 * Strategi: Cache First untuk aset statik, Network First untuk data
 * ─────────────────────────────────────────────────────────────
 */

const CACHE_NAME    = 'mkslb-stream-deck-v1.0.0';
const OFFLINE_URL   = './index.html';

// Aset yang akan di-cache semasa install
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './obs-api.js',
  './ui-controller.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* ════════════════════════════════
   INSTALL — Pre-cache semua aset
════════════════════════════════ */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching aset…');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      // Aktifkan SW baru serta-merta tanpa tunggu tab lama ditutup
      return self.skipWaiting();
    })
  );
});

/* ════════════════════════════════
   ACTIVATE — Bersihkan cache lama
════════════════════════════════ */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Membuang cache lama:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Ambil alih semua tab dengan serta-merta
      return self.clients.claim();
    })
  );
});

/* ════════════════════════════════
   FETCH — Strategi Cache First
   (Untuk aset tempatan, bukan WebSocket)
════════════════════════════════ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Abaikan WebSocket dan permintaan bukan GET
  if (request.method !== 'GET') return;
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // Abaikan permintaan dari CDN / external (esm.sh, dll)
  if (!url.pathname.startsWith('/') || url.origin !== self.location.origin) {
    // Biarkan browser handle sendiri
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve dari cache, dan update cache di background (Stale-While-Revalidate)
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse); // Gunakan cache jika network gagal

        return cachedResponse; // Return cache dulu (fast)
      }

      // Tiada dalam cache — fetch dari network
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          // Simpan dalam cache untuk kemudian
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          if (request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});

/* ════════════════════════════════
   MESSAGE — Handle update requests
════════════════════════════════ */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
