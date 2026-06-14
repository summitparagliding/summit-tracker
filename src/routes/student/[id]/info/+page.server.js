import { getAllSitePhotos } from '$lib/server/db.js';

export function load() {
  try {
    return { sitePhotos: getAllSitePhotos(), windguruUrl: process.env.WINDGURU_EMBED_URL || '' };
  } catch(e) {
    if (e?.status) throw e; // re-throw SvelteKit redirects/errors
    console.error("[info load]", e.message);
    return {};
  }
}
