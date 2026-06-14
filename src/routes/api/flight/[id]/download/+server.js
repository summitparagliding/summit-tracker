import { getDb } from '$lib/server/db.js';
import { error } from '@sveltejs/kit';

export async function GET({ params, locals }) {
  const flightId = Number(params.id);
  const db = getDb();

  const flight = db.prepare(`
    SELECT f.*, s.name as student_name
    FROM flights f JOIN students s ON s.id = f.student_id
    WHERE f.id = ?
  `).get(flightId);

  if (!flight) throw error(404, 'Flight not found');

  // Auth: student owns it, or instructor
  const isInstructor = !!locals.instructor;
  const isOwner      = locals.student && locals.student.id === flight.student_id;
  if (!isInstructor && !isOwner) throw error(403, 'Unauthorized');

  if (!flight.track_geojson) throw error(404, 'No GPS track for this flight');

  const geo = JSON.parse(flight.track_geojson);
  const coords = geo?.geometry?.coordinates ?? [];
  if (!coords.length) throw error(404, 'Empty track');

  // Synthesize timestamps: distribute points evenly across flight duration
  const durSecs = flight.duration_seconds || (coords.length * 2);
  const dateStr = flight.date || new Date().toISOString().slice(0, 10);
  const startTime = flight.start_time || '00:00';
  const [sh, sm] = startTime.split(':').map(Number);
  const startMs = (sh * 3600 + (sm || 0) * 60) * 1000;

  // Build GPX
  const trkpts = coords.map((c, i) => {
    const [lon, lat, alt = 0] = c;
    const tMs  = startMs + Math.round((i / (coords.length - 1)) * durSecs * 1000);
    const tSec = Math.floor(tMs / 1000);
    const hh   = String(Math.floor(tSec / 3600) % 24).padStart(2, '0');
    const mm   = String(Math.floor((tSec % 3600) / 60)).padStart(2, '0');
    const ss   = String(tSec % 60).padStart(2, '0');
    return `    <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">
      <ele>${alt.toFixed(1)}</ele>
      <time>${dateStr}T${hh}:${mm}:${ss}Z</time>
    </trkpt>`;
  }).join('\n');

  const siteName = flight.site ? flight.site.replace(/_/g, ' ') : 'Unknown site';
  const flightNum = db.prepare(
    "SELECT COUNT(*) as n FROM flights WHERE student_id=? AND status='complete' AND id<=?"
  ).get(flight.student_id, flightId).n;

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Summit Paragliding"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Flight #${flightNum} — ${flight.student_name}</name>
    <desc>Summit Paragliding · ${siteName} · ${dateStr}</desc>
    <time>${dateStr}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00Z</time>
  </metadata>
  <trk>
    <name>Vol #${flightNum} — ${siteName} — ${dateStr}</name>
    <type>paragliding</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  const filename = `summit-vol${flightNum}-${flight.student_name.replace(/\s+/g, '-')}-${dateStr}.gpx`;

  return new Response(gpx, {
    headers: {
      'Content-Type':        'application/gpx+xml',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
