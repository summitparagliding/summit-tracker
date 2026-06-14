import { json } from '@sveltejs/kit';
import { getFlightMedia } from '$lib/server/db.js';

export async function GET({ params }) {
  try {
    const raw = getFlightMedia(Number(params.id));
    // Return media with streaming URLs for any r2_key files
    const media = raw.map(m => ({
      ...m,
      url: m.r2_key ? `/api/file?key=${encodeURIComponent(m.r2_key)}` : m.url,
      download_url: m.r2_key ? `/api/file?key=${encodeURIComponent(m.r2_key)}&dl=1` : m.url,
    }));
    return json(media);
  } catch(e) {
    console.error('[media]', e.message);
    return json([]);
  }
}
