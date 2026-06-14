import { json, error } from '@sveltejs/kit';
import { getStudentSession, addPayment } from '$lib/server/db.js';

export async function POST({ request, cookies }) {
  const tok     = cookies.get('student_session');
  const session = tok ? getStudentSession(tok) : null;
  if (!session) throw error(401, 'Not authenticated');

  let body;
  try { body = await request.json(); }
  catch(e) { throw error(400, 'Invalid JSON'); }

  const { desc, amount } = body;
  try {
    const id = addPayment({
      student_id: session.student_id,
      amount:     parseFloat(amount) || 0,
      method:     'student_reported',
      notes:      desc || '',
      date:       new Date().toISOString().slice(0, 10),
      status:     'pending',
    });
    return json({ ok: true, id });
  } catch(e) {
    console.error('[student-payment]', e.message);
    throw error(500, e.message);
  }
}
