import { json } from '@sveltejs/kit';
import { getInstructorSession, getDb } from '$lib/server/db.js';

export function GET({ params, cookies }) {
  const tok  = cookies.get('instructor_session');
  const sess = tok ? getInstructorSession(tok) : null;
  if (!sess) return json([], { status: 401 });
  try {
    const db = getDb();
    const studentId = Number(params.id);
    const exercises = db.prepare(`
      SELECT ex.id, ex.title, ex.title_fr, ex.category,
        COALESCE(
          (SELECT el2.status FROM exercise_logs el2
           WHERE el2.student_id=? AND el2.exercise_id=ex.id
           ORDER BY el2.created_at DESC LIMIT 1),
          'not_done'
        ) as status
      FROM exercises ex
      WHERE ex.category IN ('airborne','in_flight','landing','flight')
      ORDER BY ex.order_idx, ex.id
    `).all(studentId);
    return json(exercises);
  } catch(e) { return json([]); }
}
