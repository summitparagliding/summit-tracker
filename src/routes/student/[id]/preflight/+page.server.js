import { startFlight, getStudentEquipment, getDb } from '$lib/server/db.js';
import { fail, redirect } from '@sveltejs/kit';

export function load({ params }) {
  const eq = getStudentEquipment(Number(params.id)) || {};
  const defaultGlider = [eq.glider_make, eq.glider_model, eq.glider_size].filter(Boolean).join(' ') || '';
  return { defaultGlider };
}

export const actions = {
  default: async ({ request, params, cookies }) => {
    // Prevent duplicate flights — abandon ALL stale open flights first
    // This handles: preflight (never flew), active (crashed mid-flight), postflight_pending
    const db = getDb();
    const stale = db.prepare(
      "SELECT id FROM flights WHERE student_id=? AND status IN ('preflight','active','postflight_pending')"
    ).all(Number(params.id));
    for (const s of stale) {
      db.prepare("UPDATE flights SET status='abandoned' WHERE id=?").run(s.id);
    }
    const fd = await request.formData();
    const site = fd.get('site');
    if (!site) return fail(400, { error: 'Please select your launch site.' });

    const id = startFlight({
      student_id:       Number(params.id),
      date:             new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }),
      site,
      wind_speed:       fd.get('wind_speed') || null,
      wind_direction:   fd.get('wind_direction') || null,
      glider:           fd.get('glider')?.trim() || null,
      conditions_notes:  fd.get('conditions_notes') || null,
      mental_condition:  Number(fd.get('mental_condition')) || null,
      confidence_rating: Number(fd.get('confidence_rating')) || null
    });

    // Put student in 'ground' (En attente / Waiting Launch)
    // Delete any stale entries first (avoids timezone date-mismatch duplicates),
    // then insert fresh with 'ground' status
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
      const sid   = Number(params.id);
      db.prepare('DELETE FROM session_roster WHERE student_id=?').run(sid);
      db.prepare(`INSERT INTO session_roster (session_date, student_id, status) VALUES (?, ?, 'ground')`).run(today, sid);
    } catch(e) { console.error('[preflight roster]', e.message); }

    throw redirect(303, `/student/${params.id}/active-flight/${id}`);
  }
};
