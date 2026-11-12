// FleetPMTS service worker: makes the app installable and lets it open on a weak
// connection. It only caches the app itself — never /api/ data, which is always live.
const CACHE = 'fleetpmts-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: always try the network first; offline, open the cached app (it then shows "Can't reach the server")
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => { const copy = response.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return response; })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Built files have a content hash in their name, so a cached copy is always correct
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit ?? fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return response;
      })),
    );
  }
});
