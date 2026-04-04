self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // A minimal fetch listener is required by some browsers to trigger the PWA install prompt.
  // We can just pass through all requests for now, or implement basic caching.
});
