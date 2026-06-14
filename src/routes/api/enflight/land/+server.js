import { json } from '@sveltejs/kit';
import { getStudentSession, updateRosterStatus, addToRoster } from '$lib/server/db.js';

// POST = student landed (GPS detected)
export async function POST({ cookies }) {
  const tok  = cookies.get('student_session');
  const sess = tok ? getStudentSession(tok) : null;
  if (!sess) return json({ ok: false }, { status: 401 });
  try {
    addToRoster(sess.student_id);  // ensure in roster
    updateRosterStatus(sess.student_id, null, 'landed', 'gps');
    return json({ ok: true });
  } catch(e) { return json({ ok: false, error: e.message }); }
}

// PUT = student launched (GPS detected)
export async function PUT({ cookies }) {
  const tok  = cookies.get('student_session');
  const sess = tok ? getStudentSession(tok) : null;
  if (!sess) return json({ ok: false }, { status: 401 });
  try {
    addToRoster(sess.student_id);  // auto-add if not in roster
    updateRosterStatus(sess.student_id, null, 'flying', 'gps');
    return json({ ok: true });
  } catch(e) { return json({ ok: false, error: e.message }); }
}
