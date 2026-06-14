<script>
  import '../app.css';
  import { onMount } from 'svelte';

  onMount(async () => {
    // The service worker was causing stale cache problems (users seeing old JS).
    // Aggressively unregister any existing SW and clear all caches so users
    // always get fresh code on every deploy.
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
        if ('caches' in window) {
          const keys = await caches.keys();
          for (const k of keys) await caches.delete(k);
        }
      } catch(e) { /* ignore */ }
    }
    // Best-effort: release any orientation lock so the device can rotate freely.
    try {
      if (screen.orientation && typeof screen.orientation.unlock === 'function') {
        screen.orientation.unlock();
      }
    } catch(e) { /* not supported / not installed as PWA — ignore */ }
  });
</script>

<svelte:head>
  <!-- Original school icon (winged bird) -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/icon-16.png" />

  <!-- PWA manifest is linked in app.html -->
  <meta name="theme-color" content="#003C4E" />

  <!-- iOS -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Summit" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

  <meta name="format-detection" content="telephone=no" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

<slot />
