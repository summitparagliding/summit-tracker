import { redirect, fail } from '@sveltejs/kit';
import { getInstructorSession, getDb } from '$lib/server/db.js';
import { createHash } from 'crypto';

export function load({ cookies, params }) {
  const tok  = cookies.get('instructor_session');
  const sess = tok ? getInstructorSession(tok) : null;
  if (!sess) throw redirect(303, '/instructor/login');
  try {
    const req = getDb().prepare(
      'SELECT * FROM registration_requests WHERE id=?'
    ).get(Number(params.id));
    if (!req) throw redirect(303, '/instructor');
    return { req };
  } catch(e) {
    if (e?.status === 303) throw e;
    throw redirect(303, '/instructor');
  }
}

export const actions = {
  approve: async ({ request, cookies, params }) => {
    const tok  = cookies.get('instructor_session');
    const sess = tok ? getInstructorSession(tok) : null;
    if (!sess) return fail(401, { error: 'Non autorisé.' });

    let fd;
    try { fd = await request.formData(); }
    catch(e) { return fail(400, { error: 'Erreur de formulaire.' }); }

    // Clean PIN — keep only digits
    const rawPin = String(fd.get('pin') || '').trim();
    const pin    = rawPin.replace(/\D/g, '');
    if (!pin || pin.length < 4 || pin.length > 6) {
      return fail(400, { error: `Code PIN invalide : saisissez 4 à 6 chiffres (saisi: "${rawPin}").` });
    }

    try {
      const db  = getDb();
      const reqId = Number(params.id);

      // Fetch registration request
      const req = db.prepare(
        'SELECT * FROM registration_requests WHERE id=?'
      ).get(reqId);
      if (!req) return fail(404, { error: 'Demande introuvable.' });

      // Hash the PIN
      const pinHash = createHash('sha256').update(pin).digest('hex');

      // Create the student in one transaction
      const info = db.prepare(
        `INSERT INTO students (name, phone, email, pin_hash, enrollment_date, active)
         VALUES (?, ?, ?, ?, date('now'), 1)`
      ).run(req.name, req.phone || null, req.email || null, pinHash);

      const studentId = info.lastInsertRowid;

      // Mark registration as approved
      db.prepare(
        "UPDATE registration_requests SET status='approved' WHERE id=?"
      ).run(reqId);

      // Redirect to the new student's profile
      throw redirect(303, `/instructor/students/${studentId}`);

    } catch(e) {
      // Re-throw SvelteKit redirects
      if (e?.status === 303 || e?.location) throw e;
      console.error('[approve-registration] Error:', e?.message, e);
      return fail(500, { error: `Erreur lors de la création : ${e?.message || 'erreur interne'}` });
    }
  },

  reject: async ({ cookies, params }) => {
    const tok = cookies.get('instructor_session');
    if (!getInstructorSession(tok)) return fail(401, { error: 'Non autorisé.' });
    try {
      getDb().prepare(
        "UPDATE registration_requests SET status='rejected' WHERE id=?"
      ).run(Number(params.id));
    } catch(e) { console.error('[reject-registration]', e?.message); }
    throw redirect(303, '/instructor');
  }
};
