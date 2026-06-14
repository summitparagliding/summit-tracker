import { json } from '@sveltejs/kit';
import { getStudentSession, getDb } from '$lib/server/db.js';

export async function POST({ params, request, cookies }) {
  const tok  = cookies.get('student_session');
  const sess = tok ? getStudentSession(tok) : null;
  if (!sess || sess.student_id !== Number(params.id)) {
    return json({ error: 'Non autorisé' }, { status: 401 });
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, { status: 400 }); }

  const { date, site, duration_seconds, max_altitude_m, notes } = body;
  if (!date) return json({ error: 'Date requise.' }, { status: 400 });

  try {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO flights (student_id, date, site, duration_seconds, max_altitude_m,
                           personal_notes, status, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'complete', 'manual', datetime('now'))
    `).run(
      Number(params.id),
      date,
      site || null,
      duration_seconds || null,
      max_altitude_m || null,
      notes || null
    );
    return json({ ok: true, id: result.lastInsertRowid });
  } catch(e) {
    console.error('[manual-flight]', e.message);
    return json({ error: e.message }, { status: 500 });
  }
}
