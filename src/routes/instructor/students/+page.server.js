import { getAllStudents, getArchivedStudents, permanentlyDeleteStudent } from '$lib/server/db.js';
import { getDb } from '$lib/server/db.js';

export function load() {
  try {
    return {
      students: (() => {
        try {
          return getDb().prepare(
            'SELECT s.*, e.wing_color_1, e.wing_le_color, e.wing_color_2, e.harness_color ' +
            'FROM students s LEFT JOIN student_equipment e ON e.student_id=s.id ' +
            "WHERE s.active=1 ORDER BY s.name ASC"
          ).all();
        } catch(e) { return getAllStudents(); }
      })(),
      archived: getArchivedStudents(),
    };
  } catch(e) {
    console.error('[students load]', e.message);
    return { students: [], archived: [] };
  }
}

export const actions = {
  deactivate: async ({ request }) => {
    const fd = await request.formData();
    try { getDb().prepare('UPDATE students SET active=0 WHERE id=?').run(Number(fd.get('id'))); } catch(e) {}
    return { ok: true };
  },
  reactivate: async ({ request }) => {
    const fd = await request.formData();
    try { getDb().prepare('UPDATE students SET active=1 WHERE id=?').run(Number(fd.get('id'))); } catch(e) {}
    return { ok: true };
  },
  deleteStudent: async ({ request }) => {
    const fd = await request.formData();
    try { permanentlyDeleteStudent(Number(fd.get('id'))); } catch(e) { console.error('deleteStudent:', e.message); }
    return { ok: true };
  },
};
