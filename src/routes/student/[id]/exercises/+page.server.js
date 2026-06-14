import {
  getExerciseLogsForStudent, logExercise,
  getExamAttemptsForStudent, getExamDefs, logExamAttempt,
  getStudentProgressMap, cancelExerciseLog, cancelExamAttempt,
  getDb
} from '$lib/server/db.js';
import { fail } from '@sveltejs/kit';

export function load({ params }) {
  const id = Number(params.id);
  return {
    logs:         getExerciseLogsForStudent(id),
    practicalExams: getExamAttemptsForStudent(id),
    examDefs:     getExamDefs().filter(d => d.type === 'practical'),
    progressMap:  getStudentProgressMap(id)
  };
}

export const actions = {
  logAttempt: async ({ request, params }) => {
    const fd          = await request.formData();
    const studentId   = Number(params.id);
    const exercise_id = Number(fd.get('exercise_id'));
    if (!exercise_id) return fail(400, { err: 'Missing exercise' });

    // Prevent duplicate — check for existing pending or passed log
    const db       = getDb();
    const existing = db.prepare(
      "SELECT id, status FROM exercise_logs WHERE student_id=? AND exercise_id=? AND status IN ('pending','passed')"
    ).get(studentId, exercise_id);

    if (existing) {
      return fail(400, { err: existing.status === 'passed'
        ? 'Cet exercice est déjà réussi.'
        : 'Une demande est déjà en attente pour cet exercice.' });
    }

    logExercise({
      student_id:    studentId,
      exercise_id,
      date:          new Date().toISOString().slice(0, 10),
      attempt_notes: fd.get('attempt_notes') || null,
      status:        'pending'
    });
    return { ok: true };
  },

  // Update notes on an existing exercise log (lets students add notes even
  // after the exercise was signed off, e.g. from a group session)
  updateAttemptNotes: async ({ request, params }) => {
    const fd        = await request.formData();
    const studentId = Number(params.id);
    const exId      = Number(fd.get('exercise_id'));
    const notes     = fd.get('attempt_notes') || '';
    if (!exId) return fail(400, { err: 'Missing exercise' });

    const db  = getDb();
    // Find the most recent log for this (student, exercise)
    const log = db.prepare(
      "SELECT id FROM exercise_logs WHERE student_id=? AND exercise_id=? ORDER BY id DESC LIMIT 1"
    ).get(studentId, exId);
    if (!log) return fail(404, { err: 'No log found for that exercise' });

    db.prepare("UPDATE exercise_logs SET attempt_notes=? WHERE id=?").run(notes, log.id);
    return { ok: true };
  },

  cancelExercise: async ({ request, params }) => {
    const fd      = await request.formData();
    const logId   = Number(fd.get('log_id'));
    const success = cancelExerciseLog(logId, Number(params.id));
    if (!success) return fail(400, { err: 'Impossible d\'annuler' });
    return { cancelOk: true };
  },

  submitPractical: async ({ request, params }) => {
    const fd      = await request.formData();
    const exam_id = Number(fd.get('exam_id'));
    if (!exam_id) return fail(400, { practErr: 'Missing exam' });

    // Prevent duplicate pending exam attempt
    const db       = getDb();
    const existing = db.prepare(
      "SELECT id FROM exam_attempts WHERE student_id=? AND exam_id=? AND signed_off_at IS NULL"
    ).get(Number(params.id), exam_id);

    if (existing) {
      return fail(400, { practErr: 'Une tentative est déjà en attente pour cet examen.' });
    }

    logExamAttempt({
      student_id:    Number(params.id),
      exam_id,
      date:          new Date().toISOString().slice(0, 10),
      score:         null,
      max_score:     100,
      passed:        null,
      student_notes: fd.get('student_notes') || null
    });
    return { practOk: true };
  },

  cancelExam: async ({ request, params }) => {
    const fd        = await request.formData();
    const attemptId = Number(fd.get('attempt_id'));
    const success   = cancelExamAttempt(attemptId, Number(params.id));
    if (!success) return fail(400, { err: 'Impossible d\'annuler' });
    return { cancelOk: true };
  }
};
