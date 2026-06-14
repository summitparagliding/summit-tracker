import { getInstructorSession, getAllStudentsProgression, getStudentReadiness, getConfidenceTrend } from '$lib/server/db.js';
import { redirect } from '@sveltejs/kit';

export function load({ cookies }) {
  const tok = cookies.get('instructor_session');
  if (!tok || !getInstructorSession(tok)) throw redirect(303, '/instructor/login');
  const students = getAllStudentsProgression();
  const readiness = students.map(s => ({
    ...s,
    ...getStudentReadiness(s.id),
    confidence: (() => { try { return getConfidenceTrend(s.id); } catch(e) { return { trend:'neutral', data:[] }; } })(),
  }));
  return { students: readiness };
}
