import { json } from '@sveltejs/kit';
import { getAllFlights } from '$lib/server/db.js';

export async function GET() {
  try {
    // Return lean flight summaries — no media
    const flights = getAllFlights()
      .filter(f => f.status === 'complete')
      .map(f => ({
        id: f.id, student_id: f.student_id, student_name: f.student_name,
        date: f.date, site: f.site, duration_seconds: f.duration_seconds,
        distance_km: f.distance_km, flight_type: f.flight_type,
        has_track: !!f.track_geojson,
      }));
    return json(flights);
  } catch(e) {
    return json([]);
  }
}
