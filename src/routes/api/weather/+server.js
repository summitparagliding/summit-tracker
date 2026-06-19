// Server-side proxy for Open-Meteo.
//
// Why this exists: the weather components used to call
// https://api.open-meteo.com/v1/forecast directly from the browser. From many
// student devices on shared IPs that intermittently fails CORS / hits the free
// rate limit, and the browser surfaces it as the generic "Failed to fetch".
//
// By forwarding through our own origin the browser only ever talks to
// /api/weather (same-origin, no CORS), and the real outbound request happens
// here on the server where there is no CORS and we can cache + fall back.
//
// The client passes the exact same query string it would have sent to
// /v1/forecast, e.g. /api/weather?latitude=..&longitude=..&hourly=..&models=gem_seamless
import { json } from '@sveltejs/kit';

const TTL = 5 * 60 * 1000; // 5 minutes — keep forecasts fresh while avoiding rate limits
const cache = new Map();     // qs -> { t, body }

export async function GET({ url, fetch }) {
  const qs = url.searchParams.toString();
  const now = Date.now();
  const hit = cache.get(qs);

  // Fresh cache hit
  if (hit && now - hit.t < TTL) {
    return new Response(hit.body, {
      headers: { 'content-type': 'application/json', 'x-weather-cache': 'hit' }
    });
  }

  const base = 'https://api.open-meteo.com/v1/forecast?' + qs;

  try {
    let res = await fetch(base);
    // GEM model occasionally unavailable -> fall back to best_match
    if (!res.ok && qs.includes('gem_seamless')) {
      res = await fetch(base.replace('gem_seamless', 'best_match'));
    }
    const body = await res.text();

    if (res.ok) {
      cache.set(qs, { t: now, body });
      return new Response(body, {
        headers: { 'content-type': 'application/json', 'x-weather-cache': 'miss' }
      });
    }

    // Upstream returned an error: serve stale cache if we have any
    if (hit) {
      return new Response(hit.body, {
        headers: { 'content-type': 'application/json', 'x-weather-cache': 'stale' }
      });
    }
    return new Response(body, {
      status: res.status,
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    // Network failure reaching Open-Meteo: serve stale cache if we have it
    if (hit) {
      return new Response(hit.body, {
        headers: { 'content-type': 'application/json', 'x-weather-cache': 'stale-error' }
      });
    }
    return json(
      { error: true, reason: 'Weather upstream unreachable: ' + (e?.message || String(e)) },
      { status: 502 }
    );
  }
}
