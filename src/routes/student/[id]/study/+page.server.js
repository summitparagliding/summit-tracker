import { getLibraryItems, getStudentSession, getQuizCount } from '$lib/server/db.js';
import { redirect } from '@sveltejs/kit';

export function load({ cookies, params }) {
  const tok = cookies.get('student_session');
  const sess = tok ? getStudentSession(tok) : null;
  if (!sess || String(sess.student_id) !== String(params.id)) throw redirect(303, '/');
  return { libraryItems: getLibraryItems(), quizCount: getQuizCount() };
}
