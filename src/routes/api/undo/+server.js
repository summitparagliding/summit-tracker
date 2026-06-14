import { json, error } from '@sveltejs/kit';
import { getInstructorSession, getStudentSession, deleteExerciseLog, deletePaymentLog } from '$lib/server/db.js';

export async function POST({ request, cookies }) {
  const body = await request.json().catch(() => null);
  if (!body) throw error(400, 'Bad request');

  const instrTok = cookies.get('instructor_session');
  const studTok  = cookies.get('student_session');
  const instrSess = instrTok ? getInstructorSession(instrTok) : null;
  const studSess  = studTok  ? getStudentSession(studTok)     : null;

  if (!instrSess && !studSess) throw error(401, 'Not authenticated');

  const { type, id } = body;
  if (type === 'exercise_log' && instrSess) {
    const ok = deleteExerciseLog(Number(id));
    return json({ ok });
  }
  if (type === 'payment' && studSess) {
    const ok = deletePaymentLog(Number(id));
    return json({ ok });
  }
  throw error(403, 'Not allowed');
}
