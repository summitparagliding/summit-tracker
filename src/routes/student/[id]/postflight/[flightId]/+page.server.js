import {
  getFlight, completeFlight, updateFlightGPS,
  getFlightsForStudent, getExerciseLogsForStudent,
  logExercise, getDb
} from '$lib/server/db.js';
import { parseIGC, parseKML } from '$lib/server/igc.js';
import { fail, error, redirect } from '@sveltejs/kit';

export function load({ params }) {
  const studentId = Number(params.id);
  const flightId  = Number(params.flightId);

  let flight = null;
  try { flight = getFlight(flightId); } catch(e) { console.error('[postflight load getFlight]', e.message); }
  if (!flight) throw error(404, 'Flight not found');

  let flightNum = 1;
  try {
    const done = getFlightsForStudent(studentId).filter(f => f.status === 'complete');
    flightNum = done.length + 1;
  } catch(e) { console.error('[postflight load flightNum]', e.message); }

  let exercises = [];
  try {
    exercises = getExerciseLogsForStudent(studentId).map(row => ({
      id:        row.ex_id,
      title:     row.exercise_title,
      title_fr:  row.exercise_title_fr || null,
      category:  row.category,
      order_idx: row.order_idx,
      status:    row.status || 'not_started',
    }));
  } catch(e) { console.error('[postflight load exercises]', e.message); }

  return { flight, flightNum, exercises };
}

export const actions = {
  complete: async ({ request, params }) => {
    const studentId = Number(params.id);
    const flightId  = Number(params.flightId);
    let fd;
    try { fd = await request.formData(); }
    catch(e) { return fail(400, { error: 'Erreur de formulaire.' }); }

    // ── GPS file ──────────────────────────────────────────────
    const file = fd.get('track_file');
    if (file && file.size > 0) {
      try {
        const content = await file.text();
        const parsed  = file.name.toLowerCase().endsWith('.kml')
          ? parseKML(content) : parseIGC(content);
        updateFlightGPS(flightId, {
          duration_seconds: parsed.duration_seconds,
          distance_km:      parsed.distance_km,
          max_altitude_m:   parsed.max_altitude_m,
          takeoff_lat:  parsed.takeoff?.lat  ?? null,
          takeoff_lon:  parsed.takeoff?.lon  ?? null,
          landing_lat:  parsed.landing?.lat  ?? null,
          landing_lon:  parsed.landing?.lon  ?? null,
          track_geojson: parsed.track_geojson
        });
      } catch(e) {
        console.error('[postflight GPS file]', e.message);
        return fail(400, { error: `Erreur fichier GPS: ${e.message}` });
      }
    }

    // ── Manual duration ───────────────────────────────────────
    const manualDur = fd.get('manual_duration');
    if (!(file?.size) && manualDur) {
      try {
        const parts = String(manualDur).split(':').map(Number);
        const secs  = parts.length === 2 ? (parts[0]*3600 + parts[1]*60) : parts[0]*60;
        updateFlightGPS(flightId, {
          duration_seconds: secs || null,
          distance_km:   parseFloat(fd.get('manual_distance')) || null,
          max_altitude_m: parseInt(fd.get('manual_altitude'))  || null,
          takeoff_lat: null, takeoff_lon: null,
          landing_lat: null, landing_lon: null, track_geojson: null
        });
      } catch(e) { console.error('[postflight manual GPS]', e.message); }
    }

    // ── Exercise logs (non-fatal) ─────────────────────────────
    try {
      const exerciseIds = fd.getAll('exercise_log_id').map(Number).filter(n => n > 0);
      if (exerciseIds.length) {
        const today = new Date().toISOString().slice(0, 10);
        const db = getDb();
        for (const exId of exerciseIds) {
          const exists = db.prepare(
            "SELECT id FROM exercise_logs WHERE student_id=? AND exercise_id=? AND status IN ('pending','passed')"
          ).get(studentId, exId);
          if (!exists) logExercise({ student_id: studentId, exercise_id: exId, date: today, attempt_notes: 'Vol', status: 'pending' });
        }
      }
    } catch(e) { console.error('[postflight exercises]', e.message); }

    // ── Complete flight ───────────────────────────────────────
    try {
      const flightType     = fd.get('flight_type') || null;
      const exerciseTitles = fd.getAll('exercises_done');
      const airSecs        = parseInt(fd.get('airborne_seconds')) || null;
      const flightNum      = Number(fd.get('flight_num')) || 1;

      completeFlight(flightId, {
        launch_quality:    Number(fd.get('launch_quality'))    || null,
        landing_quality:   Number(fd.get('landing_quality'))   || null,
        flight_type:       flightType,
        launch_type:       fd.get('launch_type')   || null,
        thermals_caught:   parseInt(fd.get('thermals_caught')) || null,
        meters_gained:     parseInt(fd.get('meters_gained'))   || null,
        exercises_done:    exerciseTitles.length ? JSON.stringify(exerciseTitles) : null,
        what_went_well:    fd.get('what_went_well')    || null,
        what_to_improve:   fd.get('what_to_improve')   || null,
        next_goals:        flightNum >= 3 ? (fd.get('next_goals') || null) : null,
        personal_notes:    fd.get('personal_notes')    || null,
        landing_site:      fd.get('landing_site')      || null,
        start_time:        fd.get('start_time')        || null,
        confidence_rating: Number(fd.get('confidence_rating')) || null,
        end_time:          fd.get('end_time') || new Date().toTimeString().slice(0,5),
        duration_seconds:  airSecs || null,
      });
    } catch(e) {
      console.error('[postflight completeFlight]', e.message);
      return fail(500, { error: `Erreur sauvegarde: ${e.message}` });
    }

    // ── Roster → landed (non-fatal) ───────────────────────────
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
      const utc   = new Date().toISOString().slice(0,10);
      getDb().prepare(
        "UPDATE session_roster SET status='landed' WHERE student_id=? AND session_date IN (?,?)"
      ).run(studentId, today, utc);
    } catch(e) { console.error('[postflight roster]', e.message); }

    throw redirect(303, `/student/${studentId}/flights?completed=1`);
  }
};
