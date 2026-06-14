import { getStudentNames, verifyStudentPin, createStudentSession, getDb } from '$lib/server/db.js';
import { fail, redirect } from '@sveltejs/kit';

export function load() {
  try {
    const names = getStudentNames();
    console.log(`[login] ${names.length} students available`);
    return { names };
  } catch(e) {
    console.error('[login load ERROR]', e.message);
    return { names: [] };
  }
}

export const actions = {
  default: async ({ request, cookies }) => {
    let name, pin;
    try {
      const fd = await request.formData();
      name = (fd.get('name') || '').toString().trim();
      pin  = (fd.get('pin')  || '').toString().replace(/\D/g, '').trim();
      console.log(`[login attempt] name="${name}" pin_length=${pin.length}`);
    } catch(e) {
      console.error('[login formData ERROR]', e.message);
      return fail(400, { error: 'Erreur de formulaire.' });
    }

    if (!name) return fail(400, { error: 'Veuillez entrer votre nom.' });
    if (!pin || pin.length < 4) return fail(400, { error: 'Code PIN invalide (4–6 chiffres requis).' });

    try {
      const student = verifyStudentPin(name, pin);
      console.log(`[login] verifyStudentPin result: ${student ? `found id=${student.id}` : 'null'}`);
      if (!student) {
        // Try to give a more helpful error
        try {
          const db = getDb();
          const byName = db.prepare("SELECT id, name, active FROM students WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))").get(name);
          if (!byName) {
            console.log(`[login] No student named "${name}" in DB`);
            return fail(401, { error: `Nom non trouvé : "${name}". Vérifiez l'orthographe.` });
          }
          if (!byName.active) {
            console.log(`[login] Student ${byName.id} is inactive`);
            return fail(401, { error: 'Compte inactif. Contactez votre instructeur.' });
          }
          console.log(`[login] Student found but PIN mismatch`);
          return fail(401, { error: 'Code PIN incorrect. Contactez votre instructeur pour réinitialiser.' });
        } catch(e2) {
          console.error('[login DB check ERROR]', e2.message);
        }
        return fail(401, { error: 'Nom ou PIN incorrect.' });
      }
      const token = createStudentSession(student.id);
      cookies.set('student_session', token, {
        path: '/', httpOnly: true, sameSite: 'lax', maxAge: 7 * 86400
      });
      console.log(`[login] SUCCESS student ${student.id}`);
      throw redirect(303, `/student/${student.id}`);
    } catch(e) {
      if (e?.status === 303 || e?.location) throw e;
      console.error('[login action ERROR]', e.message, e.stack?.split('\n')[1]);
      return fail(500, { error: `Erreur serveur: ${e.message}` });
    }
  }
};
