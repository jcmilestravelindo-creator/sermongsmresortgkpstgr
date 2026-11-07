// =============================================================
// Service Worker - SM GKPS Resort Tangerang
// Naikkan CACHE_NAME setiap kali deploy (v6 -> v7, dst).
// Strategi: NETWORK-FIRST untuk file aplikasi (index.html dll),
// jadi versi terbaru selalu dipakai saat online. Cache hanya
// dipakai sebagai cadangan saat offline.
// =============================================================
const CACHE_NAME = 'gkps-sermon-v8';
const PRECACHE = ['./', './index.html', './manifest.json', './logotema.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    // Hanya tangani file dari domain aplikasi sendiri.
    // Firebase, CDN (unpkg, gstatic, tailwind, dll) dibiarkan langsung ke jaringan.
    if (url.origin !== self.location.origin) return;
    // Jangan pernah cache sw.js itu sendiri.
    if (url.pathname.endsWith('/sw.js')) return;

    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
                }
                return res;
            })
            .catch(() =>
                caches.match(req).then((cached) => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
            )
    );
});
