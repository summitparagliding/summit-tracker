import { getPendingByStudent, signOffExercise, signOffExam } from '$lib/server/db.js';
import { fail } from '@sveltejs/kit';

export function load() {
  return { grouped: getPendingByStudent() };
}

export const actions = {
  signoffExercise: async ({ request, locals }) => {
    const fd    = await request.formData();
    const logId = Number(fd.get('log_id'));
    const status = fd.get('status');
    const notes  = fd.get('instructor_notes') || null;
    if (!logId || !status) return fail(400, { err: 'Missing fields' });
    signOffExercise(logId, locals.instructor.id, status, notes);
    return { ok: true };
  },
  signoffExam: async ({ request, locals }) => {
    const fd        = await request.formData();
    const attemptId = Number(fd.get('attempt_id'));
    const passed    = fd.get('passed') === '1' ? 1 : 0;
    const notes     = fd.get('instructor_notes') || null;
    const scorePct  = fd.get('score_pct') ? Number(fd.get('score_pct')) : null;
    if (!attemptId) return fail(400, { err: 'Missing attempt ID' });
    signOffExam(attemptId, locals.instructor.id, passed, notes, scorePct);
    return { ok: true };
  }
};
