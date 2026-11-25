/* Keeps the app itself (pages, scripts, icons) available without a connection.
   Map tiles are deliberately NOT stored here: the tile providers do not permit offline use of their
   servers, so tile requests go straight to the network and only the browser's ordinary cache applies. */
const SHELL = 'tmgrs-shell-v6';
const FILES = ['./', 'index.html', 'app.js', 'geo.js', 'manifest.webmanifest', 'vendor/leaflet.js', 'vendor/leaflet.css',
  'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
// Removes every older cache, including the tile store kept by earlier versions.
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // tiles and other hosts: untouched
  e.respondWith(caches.open(SHELL).then(async c => {                         // shell: cached copy now, refresh in background
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
