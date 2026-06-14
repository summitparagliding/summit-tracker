import { json } from '@sveltejs/kit';
import { getInstructorSession, getTodayRoster,
         autoUpdateRosterFromFlights } from '$lib/server/db.js';

export async function GET({ cookies }) {
  const tok  = cookies.get('instructor_session');
  const sess = tok ? getInstructorSession(tok) : null;
  if (!sess) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    autoUpdateRosterFromFlights();
    return json({ roster: getTodayRoster() });
  } catch(e) {
    return json({ error: e.message }, { status: 500 });
  }
}
