import {
  getTheoryBlocks, createTheoryBlock, updateTheoryBlock, deleteTheoryBlock,
  getExercises, createExercise, updateExercise, deleteExercise,
  getExamDefs, createExamDef, deleteExamDef, getAllSitePhotos,
  getAllQuizQuestions, createQuizQuestion, updateQuizQuestion, deleteQuizQuestion,
  getLibraryItems, addLibraryItem, deleteLibraryItem,
} from '$lib/server/db.js';
import { fail } from '@sveltejs/kit';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getInstructorSession } from '$lib/server/db.js';

export function load() {
  return {
    theory:      getTheoryBlocks(),
    exercises:   getExercises(),
    exams:       getExamDefs(),
    sitePhotos:  getAllSitePhotos(),
    quiz:        getAllQuizQuestions(),
    libraryItems: (() => { try { return getLibraryItems(); } catch(e) { return []; } })(),
  };
}

export const actions = {
  addTheory: async ({ request }) => {
    const fd = await request.formData();
    const title = fd.get('title')?.trim();
    if (!title) return fail(400, { err: 'Title required' });
    createTheoryBlock({ title, title_fr: fd.get('title_fr')||null, description: fd.get('description')||null, description_fr: fd.get('description_fr')||null, content: fd.get('content')||null, content_fr: fd.get('content_fr')||null, phase: fd.get('phase')||'p1', order_idx: Number(fd.get('order_idx'))||0 });
    return { ok: 'theory' };
  },
  updateTheory: async ({ request }) => {
    const fd = await request.formData();
    const id = Number(fd.get('id')); if (!id) return fail(400, { err: 'Missing ID' });
    updateTheoryBlock(id, { title: fd.get('title')?.trim(), title_fr: fd.get('title_fr')||null, description: fd.get('description')||null, description_fr: fd.get('description_fr')||null, content: fd.get('content')||null, content_fr: fd.get('content_fr')||null, phase: fd.get('phase')||'p1', order_idx: Number(fd.get('order_idx'))||0 });
    return { ok: 'theory_updated' };
  },
  deleteTheory:   async ({ request }) => { const fd = await request.formData(); deleteTheoryBlock(Number(fd.get('id'))); return { ok: 'theory' }; },
  addExercise:    async ({ request }) => {
    const fd = await request.formData();
    const title = fd.get('title')?.trim(); if (!title) return fail(400, { err: 'Title required' });
    createExercise({ title, title_fr: fd.get('title_fr')||null, description: fd.get('description')||null, description_fr: fd.get('description_fr')||null, category: fd.get('category')||'ground_handling', order_idx: Number(fd.get('order_idx'))||0, requires_signoff: 1 });
    return { ok: 'exercise' };
  },
  updateExercise: async ({ request }) => {
    const fd = await request.formData();
    const id = Number(fd.get('id')); if (!id) return fail(400, { err: 'Missing ID' });
    updateExercise(id, { title: fd.get('title')?.trim(), title_fr: fd.get('title_fr')||null, description: fd.get('description')||null, description_fr: fd.get('description_fr')||null, category: fd.get('category')||'ground_handling', order_idx: Number(fd.get('order_idx'))||0 });
    return { ok: 'exercise_updated' };
  },
  deleteExercise: async ({ request }) => { const fd = await request.formData(); deleteExercise(Number(fd.get('id'))); return { ok: 'exercise' }; },
  addExam:        async ({ request }) => {
    const fd = await request.formData();
    const title = fd.get('title')?.trim(); if (!title) return fail(400, { err: 'Title required' });
    createExamDef({ title, title_fr: fd.get('title_fr')||null, description: fd.get('description')||null, description_fr: fd.get('description_fr')||null, type: fd.get('type')||'theory', phase: fd.get('phase')||'p1', order_idx: Number(fd.get('order_idx'))||0 });
    return { ok: 'exam' };
  },
  deleteExam:     async ({ request }) => { const fd = await request.formData(); deleteExamDef(Number(fd.get('id'))); return { ok: 'exam' }; },
  // Quiz CRUD
  addQuiz:        async ({ request }) => {
    const fd = await request.formData();
    const question_fr = fd.get('question_fr')?.trim();
    if (!question_fr) return fail(400, { err: 'Question (FR) required' });
    const correct = fd.get('correct')?.trim() || 'a';
    createQuizQuestion({
      question_fr, question_en: fd.get('question_en')?.trim()||null,
      opt_a_fr: fd.get('opt_a_fr')?.trim()||null, opt_b_fr: fd.get('opt_b_fr')?.trim()||null,
      opt_c_fr: fd.get('opt_c_fr')?.trim()||null, opt_d_fr: fd.get('opt_d_fr')?.trim()||null,
      correct, explain_fr: fd.get('explain_fr')?.trim()||null,
      phase: fd.get('phase')||'p1', category: fd.get('category')||'general',
    });
    return { ok: 'quiz' };
  },
  updateQuiz:     async ({ request }) => {
    const fd = await request.formData();
    const id = Number(fd.get('id')); if (!id) return fail(400, { err: 'Missing ID' });
    updateQuizQuestion(id, {
      question_fr: fd.get('question_fr')?.trim()||'', question_en: fd.get('question_en')?.trim()||null,
      opt_a_fr: fd.get('opt_a_fr')?.trim()||null, opt_b_fr: fd.get('opt_b_fr')?.trim()||null,
      opt_c_fr: fd.get('opt_c_fr')?.trim()||null, opt_d_fr: fd.get('opt_d_fr')?.trim()||null,
      correct: fd.get('correct')?.trim()||'a', explain_fr: fd.get('explain_fr')?.trim()||null,
      phase: fd.get('phase')||'p1', category: fd.get('category')||'general',
    });
    return { ok: 'quiz_updated' };
  },
  deleteQuiz:     async ({ request }) => { const fd = await request.formData(); deleteQuizQuestion(Number(fd.get('id'))); return { ok: 'quiz' }; },

  addLibraryItem: async ({ request, cookies }) => {
    const tok = cookies.get('instructor_session');
    if (!tok || !getInstructorSession(tok)) return fail(401, { err: 'Auth required' });
    let fd;
    try { fd = await request.formData(); } catch(e) { return fail(400, { err: 'Bad form data' }); }
    const title = fd.get('title')?.toString().trim();
    if (!title) return fail(400, { err: 'Titre requis' });

    const description = fd.get('description')?.toString() || '';
    let file_url = '';

    // Option A: plain URL
    const plainUrl = fd.get('file_url')?.toString().trim();
    if (plainUrl) {
      file_url = plainUrl;
    }

    // Option B: file upload
    if (!file_url) {
      const file = fd.get('file');
      if (file && typeof file !== 'string' && file.size > 0) {
        try {
          const UPLOAD_DIR = join(process.env.DATA_DIR || '/data', 'uploads', 'library');
          mkdirSync(UPLOAD_DIR, { recursive: true });
          const ext   = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
          const fname = `lib_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          writeFileSync(join(UPLOAD_DIR, fname), Buffer.from(await file.arrayBuffer()));
          file_url = `/api/file?key=library/${fname}`;
        } catch(e) {
          console.error('[addLibraryItem upload]', e.message);
          return fail(500, { err: `Erreur upload: ${e.message}` });
        }
      }
    }

    if (!file_url) return fail(400, { err: 'Fichier ou URL requis' });

    try {
      addLibraryItem({ title, description, file_url, file_type: 'pdf', uploaded_by: null });
    } catch(e) {
      return fail(500, { err: `Erreur DB: ${e.message}` });
    }
    return { libOk: true };
  },
  deleteLibraryItem: async ({ request, cookies }) => {
    const tok = cookies.get('instructor_session');
    if (!tok || !getInstructorSession(tok)) return { err: 'Auth' };
    const fd = await request.formData();
    deleteLibraryItem(Number(fd.get('id')));
    return { libOk: true };
  },
};
