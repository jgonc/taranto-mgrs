/* Keeps the app itself (pages, scripts, icons) available without a connection.
   Map tiles are deliberately NOT stored here: the tile providers do not permit offline use of their
   servers, so tile requests go straight to the network and only the browser's ordinary cache applies.

   Updates are all-or-nothing: each release has its own cache, filled in one go with fresh copies of every
   file, and the app is served only from that cache. This prevents a new script running against an old page.
   CHANGE THE VERSION BELOW ON EVERY RELEASE, or phones will keep the previous one. */
const SHELL = 'tmgrs-shell-v11';
const FILES = ['./', 'index.html', 'app.js', 'geo.js', 'manifest.webmanifest', 'vendor/leaflet.js', 'vendor/leaflet.css',
  'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(FILES.map(f =>
    fetch(new Request(f, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error('Could not fetch ' + f); return c.put(f, r); })
  ))).then(() => self.skipWaiting()));
});
// Removes every older cache, including the tile store kept by earlier versions.
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // tiles, search and other hosts: untouched
  e.respondWith(caches.open(SHELL).then(c => c.match(req, { ignoreSearch: true })).then(hit => hit || fetch(req)));
});
