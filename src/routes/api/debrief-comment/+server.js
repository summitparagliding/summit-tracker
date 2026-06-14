import { json, error } from '@sveltejs/kit';
import { getStudentSession, getDb } from '$lib/server/db.js';

export async function POST({ request, cookies }) {
  const tok  = cookies.get('student_session');
  const sess = tok ? getStudentSession(tok) : null;
  if (!sess) throw error(401, 'Not authenticated');

  const { debrief_id, comment } = await request.json().catch(() => ({}));
  if (!debrief_id || !comment?.trim()) return json({ ok: false });

  try {
    const db = getDb();
    // Ensure student_comment column exists
    try { db.prepare('ALTER TABLE flight_debriefings ADD COLUMN student_comment TEXT').run(); } catch(e) {}
    db.prepare(
      "UPDATE flight_debriefings SET student_comment=?, viewed_at=COALESCE(viewed_at, datetime('now')), student_viewed=1 WHERE id=?"
    ).run(comment.trim(), Number(debrief_id));
  } catch(e) {
    return json({ ok: false, error: e.message });
  }

  return json({ ok: true });
}
