import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Allow PDF/file uploads up to 50 MB
      // Default is 512 KB which truncates large PDFs silently
      bodySizeLimit: 52_428_800,   // 50 MB
    }),
    csrf: {
      checkOrigin: false,
    },
  }
};
