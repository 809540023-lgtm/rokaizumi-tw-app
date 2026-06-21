/*
 * Passthrough service worker.
 *
 * The previous PWA service worker cached the app shell and served stale content.
 * This version takes over, clears all old caches once, then does nothing else:
 * every request goes straight to the network. It does NOT cache, unregister, or
 * reload, so there is no reload loop and the app always loads the latest version.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (e) {
        /* ignore */
      }
      await self.clients.claim();
    })()
  );
});

// Passthrough: do not intercept; let the browser fetch everything from the network.
self.addEventListener('fetch', () => {});
