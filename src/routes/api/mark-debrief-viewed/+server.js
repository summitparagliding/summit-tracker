import { json, error } from '@sveltejs/kit';
import { markDebriefingViewed, getDebriefingById, getStudentSession, getDb } from '$lib/server/db.js';

export async function POST({ request, cookies }) {
  const tok  = cookies.get('student_session');
  const sess = tok ? getStudentSession(tok) : null;
  if (!sess) throw error(401, 'Not authenticated');

  const { id } = await request.json().catch(() => ({}));
  if (!id) return json({ ok: false });

  markDebriefingViewed(Number(id));

  // Record that student confirmed — instructor sees this on next view
  try {
    const debrief = getDebriefingById(Number(id));
    if (debrief) {
      const db = getDb();
      // Mark on the debrief record that student acknowledged
      db.prepare("UPDATE flight_debriefings SET student_acknowledged=1, acknowledged_at=datetime('now') WHERE id=?").run(Number(id));
    }
  } catch(e) { /* non-fatal — columns may not exist yet, safeAlter will add them */ }

  return json({ ok: true });
}
