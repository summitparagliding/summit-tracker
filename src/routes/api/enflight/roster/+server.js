import { json } from '@sveltejs/kit';
import { getInstructorSession, addToRoster, removeFromRoster,
         updateRosterStatus, autoUpdateRosterFromFlights } from '$lib/server/db.js';

export async function POST({ request, cookies }) {
  const tok  = cookies.get('instructor_session');
  const sess = tok ? getInstructorSession(tok) : null;
  if (!sess) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { action, student_id, status } = await request.json();
    if (!student_id) return json({ error: 'No student_id' }, { status: 400 });

    if (action === 'add')    addToRoster(Number(student_id));
    if (action === 'remove') removeFromRoster(Number(student_id));
    if (action === 'status') updateRosterStatus(Number(student_id), null, status, 'manual');

    return json({ ok: true });
  } catch(e) {
    return json({ error: e.message }, { status: 500 });
  }
}
