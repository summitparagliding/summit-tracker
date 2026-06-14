// SELF-DESTRUCT — service worker disabled to prevent stale-cache issues.
// This file replaces the old SW. On install, it claims clients, clears all
// caches it created, and unregisters itself.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll();
      for (const c of clients) c.navigate(c.url);
    } catch (e) { /* ignore */ }
  })());
});
self.addEventListener('fetch', () => { /* pass-through, no caching */ });
