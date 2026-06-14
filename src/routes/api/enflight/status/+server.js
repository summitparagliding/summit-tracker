import { json } from '@sveltejs/kit';
import { getStudentSession, getDb } from '$lib/server/db.js';

export async function POST({ request, cookies }) {
  const tok  = cookies.get('student_session');
  const sess = tok ? getStudentSession(tok) : null;
  if (!sess) return json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch(e) { body = {}; }

  const { status = 'ground', launched_at } = body;
  const studentId = sess.student_id;
  const db  = getDb();
  const now = new Date().toISOString();
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });

  try {
    // Check if row exists first (safe for both constrained and unconstrained DBs)
    const existing = db.prepare(
      'SELECT id, launched_at FROM session_roster WHERE student_id=? AND session_date=?'
    ).get(studentId, day);

    if (!existing) {
      db.prepare(
        `INSERT INTO session_roster (student_id, session_date, status, last_heartbeat, created_at)
         VALUES (?, ?, 'ground', ?, ?)`
      ).run(studentId, day, now, now);
    }

    if (status === 'flying') {
      const la = launched_at || existing?.launched_at || now;
      db.prepare(
        `UPDATE session_roster
         SET status='flying', launched_at=?, last_heartbeat=?, source='gps'
         WHERE student_id=? AND session_date=?`
      ).run(la, now, studentId, day);

    } else if (status === 'landed') {
      db.prepare(
        `UPDATE session_roster
         SET status='landed', landed_at=?, last_heartbeat=?, source='gps'
         WHERE student_id=? AND session_date=?`
      ).run(now, now, studentId, day);

    } else {
      // ground heartbeat — also enforce status='ground' in case it was incorrectly 'landed'
      db.prepare(
        `UPDATE session_roster
         SET status='ground', last_heartbeat=?
         WHERE student_id=? AND session_date=? AND status NOT IN ('flying')`
      ).run(now, studentId, day);
    }

    return json({ ok: true });
  } catch(e) {
    return json({ ok: false, error: e.message }, { status: 500 });
  }
}
