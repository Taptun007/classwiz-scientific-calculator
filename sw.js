const CACHE = 'classwiz-studio-v4';
const FILES = ['./', './index.html', './styles.css?v=4', './app.js?v=4', './graph.js?v=4', './manifest.webmanifest?v=4', './icon.svg?v=4'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const copy = response.clone();
        await caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    } catch {
      return await caches.match(event.request) || (event.request.mode === 'navigate' ? await caches.match('./index.html') : Response.error());
    }
  })());
});
