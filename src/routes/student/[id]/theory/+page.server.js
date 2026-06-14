import { getTheoryProgress, markTheoryComplete, unmarkTheoryComplete, getExamAttemptsForStudent, getExamDefs, logExamAttempt, getQuizQuestions } from '$lib/server/db.js';
import { fail } from '@sveltejs/kit';

export function load({ params }) {
  return {
    blocks: getTheoryProgress(Number(params.id)),
    exams:  getExamAttemptsForStudent(Number(params.id)),
    defs:   getExamDefs(),
    quiz:   getQuizQuestions(null, null, 60),
  };
}

export const actions = {
  markDone: async ({ request, params }) => {
    const fd = await request.formData();
    markTheoryComplete(Number(params.id), Number(fd.get('block_id')));
    return { ok: true };
  },
  markUndone: async ({ request, params }) => {
    const fd = await request.formData();
    unmarkTheoryComplete(Number(params.id), Number(fd.get('block_id')));
    return { ok: true };
  },
  submitExam: async ({ request, params }) => {
    const fd = await request.formData();
    const exam_id = Number(fd.get('exam_id'));
    if (!exam_id) return fail(400, { examErr: 'Invalid exam' });
    logExamAttempt({
      student_id:    Number(params.id),
      exam_id,
      date:          new Date().toISOString().slice(0,10),
      score:         null,
      max_score:     100,
      passed:        null,
      student_notes: fd.get('student_notes') || null
    });
    return { examOk: true };
  }
};
