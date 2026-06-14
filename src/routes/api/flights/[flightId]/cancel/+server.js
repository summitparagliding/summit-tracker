import { json } from '@sveltejs/kit';
import { getStudentSession, getDb } from '$lib/server/db.js';

export async function POST({ params, cookies }) {
  const tok  = cookies.get('student_session');
  const sess = tok ? getStudentSession(tok) : null;
  if (!sess) return json({ ok: false }, { status: 401 });
  try {
    const db  = getDb();
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
    const utc = new Date().toISOString().slice(0, 10);
    db.prepare("UPDATE flights SET status='abandoned' WHERE id=? AND student_id=?").run(
      Number(params.flightId), sess.student_id
    );
    db.prepare("DELETE FROM session_roster WHERE student_id=? AND session_date IN (?,?)").run(
      sess.student_id, day, utc
    );
    return json({ ok: true });
  } catch(e) { return json({ ok: false, error: e.message }); }
}
