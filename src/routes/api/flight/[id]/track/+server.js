import { json, error } from '@sveltejs/kit';
import { getFlight, updateFlightGPS } from '$lib/server/db.js';

export async function POST({ params, request, locals }) {
  if (!locals.student) throw error(401, 'Unauthorized');

  const flight = getFlight(Number(params.id));
  if (!flight) throw error(404, 'Flight not found');
  if (flight.student_id !== locals.student.id) throw error(403, 'Forbidden');

  const body = await request.json();
  const { fixes } = body;
  if (!fixes || !fixes.length) throw error(400, 'No GPS fixes provided');

  // Build GeoJSON from fixes array [{lat, lon, alt, t}]
  const geojson = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: fixes.map(f => [
        Math.round(f.lon * 100000) / 100000,
        Math.round(f.lat * 100000) / 100000,
        Math.round(f.alt || 0)
      ])
    },
    properties: { source: body.source || 'browser' }
  };

  // Calculate stats
  let distance = 0;
  for (let i = 1; i < fixes.length; i++) {
    distance += haversine(fixes[i-1].lat, fixes[i-1].lon, fixes[i].lat, fixes[i].lon);
  }
  const maxAlt  = Math.max(...fixes.map(f => f.alt || 0));
  const takeoff = fixes[0];
  const landing = fixes[fixes.length - 1];
  const duration = Math.round((landing.t - takeoff.t) / 1000);

  updateFlightGPS(Number(params.id), {
    duration_seconds: duration > 0 ? duration : null,
    distance_km:      Math.round(distance * 100) / 100,
    max_altitude_m:   Math.round(maxAlt),
    takeoff_lat:      takeoff.lat,
    takeoff_lon:      takeoff.lon,
    landing_lat:      landing.lat,
    landing_lon:      landing.lon,
    track_geojson:    JSON.stringify(geojson)
  });

  return json({ ok: true, points: fixes.length, distance_km: Math.round(distance * 100) / 100 });
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
