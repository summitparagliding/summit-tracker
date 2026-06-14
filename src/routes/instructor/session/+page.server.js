import { getInstructorSession, getAllStudents, getExercises,
         createTrainingSession, logExercise, signOffExercise } from '$lib/server/db.js';
import { redirect, fail } from '@sveltejs/kit';

export function load({ cookies }) {
  const tok = cookies.get('instructor_session');
  const sess = tok ? getInstructorSession(tok) : null;
  if (!sess) throw redirect(303, '/instructor/login');
  return { students: getAllStudents(), exercises: getExercises() };
}

export const actions = {
  startSession: async ({ request, cookies }) => {
    const tok  = cookies.get('instructor_session');
    const sess = tok ? getInstructorSession(tok) : null;
    if (!sess) return fail(401, { error: 'Not authenticated' });
    const fd   = await request.formData();
    const date = fd.get('date') || new Date().toISOString().slice(0,10);
    const { createTrainingSession } = await import('$lib/server/db.js');
    const id = createTrainingSession({ instructor_id: sess.instructor_id, date });
    return { sessionId: id };
  },

  signOffAll: async ({ request, cookies }) => {
    const tok  = cookies.get('instructor_session');
    const sess = tok ? getInstructorSession(tok) : null;
    if (!sess) return fail(401, { error: 'Not authenticated' });
    const fd      = await request.formData();
    const entries = fd.getAll('entries');  // "exerciseId:studentId" strings
    const today   = new Date().toISOString().slice(0,10);
    let n = 0;
    for (const entry of entries) {
      const [exId, stuId] = entry.split(':').map(Number);
      if (!exId || !stuId) continue;
      try {
        // Create a log entry and immediately sign it off
        const logId = logExercise({
          student_id:    stuId,
          exercise_id:   exId,
          date:          today,
          attempt_notes: 'Session groupe',
          status:        'pending',
        });
        signOffExercise(logId, sess.instructor_id, 'passed', 'Session groupe');
        n++;
      } catch(e) { console.error('[session signoff]', e.message); }
    }
    return { signedOff: n };
  },
};
