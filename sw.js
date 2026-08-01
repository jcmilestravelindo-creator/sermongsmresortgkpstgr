// === Service Worker GSM GKPS — versi network-first ===
// Versi dinaikkan agar SW lama (gkps-app-v2/v3) otomatis dibuang.
const CACHE_NAME = 'gkps-app-v8';
// INSTALL: langsung aktif tanpa precache.
// (Precache CDN lewat cache.add() memicu error CORS pada beberapa CDN seperti
//  cdn.tailwindcss.com, jadi aset dibiarkan ter-cache secara alami saat fetch.)
self.addEventListener('install', (event) => {
  self.skipWaiting();
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
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Hanya cache respons same-origin yang sukses, untuk menghindari
        // masalah CORS/opaque dari CDN pihak ketiga.
        try {
          var sameOrigin = new URL(req.url).origin === self.location.origin;
          if (res && res.status === 200 && sameOrigin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
        } catch (e) {}
        return res;
      }).catch(() => cached);
    })
  );
});
