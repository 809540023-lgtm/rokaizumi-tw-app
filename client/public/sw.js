/*
 * Kill-switch service worker.
 *
 * The previous PWA service worker cached the app shell and could serve a stale
 * bundle, causing 404s when navigating to product / category pages. This version
 * cleans up: it clears all caches, unregisters itself, and reloads open tabs so
 * every visitor loads the latest version directly from the network.
 */

self.addEventListener('install', () => {
  // Activate immediately without waiting.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Delete every cache this origin created.
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));

        // Unregister this service worker so it stops intercepting requests.
        await self.registration.unregister();

        // Reload any open tabs so they fetch fresh content from the network.
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((client) => {
          try {
            client.navigate(client.url);
          } catch (e) {
            /* ignore */
          }
        });
      } catch (e) {
        /* ignore cleanup errors */
      }
    })()
  );
});

// Do not intercept any requests: let the browser handle them over the network.
self.addEventListener('fetch', () => {});
