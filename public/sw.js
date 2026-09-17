// sw.js — SELF-DESTRUCTING KILL SWITCH. Read before deleting.
//
// This project no longer ships a service worker (see vite.config.js), but
// devices that visited while `vite-plugin-pwa` was deployed still have that
// worker registered at this exact path and scope. It will keep serving a
// precached shell and its own copy of every game chunk, which is why those
// devices stayed broken/stale no matter how many times they were reloaded or
// had their browser cache cleared — a worker and its Cache Storage are a
// separate store that site-data clearing does not always reach.
//
// We cannot unregister a worker from their device directly, so this file does
// it from the inside. The browser byte-compares this script on each update
// check; it now differs from the old workbox bundle, so it installs, takes
// over, wipes every cache and then unregisters itself. On the next visit
// there is no registration, nothing calls register(), and this file is never
// fetched again.
//
// It deliberately does NOT reload or navigate open clients. A worker that
// reloads the page can loop if its own unregistration ever fails, and an
// infinite reload is far worse for a classroom than one extra stale session:
// with every cache already deleted, the old worker's fetch handler misses and
// falls through to the network, so the next normal navigation is fresh anyway.

self.addEventListener('install', () => {
  // Replace the old worker immediately rather than waiting for all tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Drop every cache the old worker created, including the precached app shell.
      try {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      } catch {
        /* Cache Storage may be unavailable (private mode) — keep going. */
      }

      // 2. Take control of open pages so the deletion above applies to them too.
      try {
        await self.clients.claim();
      } catch {
        /* non-fatal */
      }

      // 3. Remove the registration itself. With no caches and no registration,
      //    the next load goes straight to the network.
      try {
        await self.registration.unregister();
      } catch {
        /* non-fatal */
      }
    })()
  );
});
