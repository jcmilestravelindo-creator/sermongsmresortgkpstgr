// === Service Worker GSM GKPS — versi network-first ===
// Versi dinaikkan agar SW lama (gkps-app-v2) otomatis dibuang.
const CACHE_NAME = 'gkps-app-v3';

// Hanya cache aset statis dari CDN (yang jarang berubah).
// index.html SENGAJA TIDAK di-precache agar selalu diambil versi terbaru.
const urlsToCache = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://unpkg.com/lucide@latest',
  'https://unpkg.com/html5-qrcode',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800;900&display=swap'
];

// INSTALL: cache aset statis, lalu langsung aktif (skipWaiting).
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll yang toleran: kalau satu CDN gagal, jangan gagalkan semua.
      return Promise.allSettled(urlsToCache.map((u) => cache.add(u)));
    })
  );
});

// ACTIVATE: hapus semua cache lama (termasuk gkps-app-v2), lalu ambil alih.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH:
// - Untuk navigasi/HTML (dokumen): NETWORK-FIRST. Selalu ambil versi baru dari
//   server; kalau offline baru jatuh ke cache. Ini mencegah "terjebak" versi lama.
// - Untuk aset lain (CDN, gambar): CACHE-FIRST agar cepat & hemat kuota.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Hanya tangani GET. Biarkan POST/PUT (Firebase, dsb) langsung ke jaringan.
  if (req.method !== 'GET') return;

  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // NETWORK-FIRST untuk halaman
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // CACHE-FIRST untuk aset statis
  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req).then((res) => {
          // Cache aset yang berhasil (hindari menyimpan respons error/opaque besar)
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached)
      );
    })
  );
});
