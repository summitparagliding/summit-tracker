import { json, error } from '@sveltejs/kit';
import { getInstructorSession } from '$lib/server/db.js';

export async function DELETE({ request, cookies }) {
  const tok  = cookies.get('instructor_session');
  const sess = tok ? getInstructorSession(tok) : null;
  if (!sess) throw error(401, 'Not authenticated');
  const { media_id } = await request.json().catch(() => ({}));
  if (!media_id) return json({ ok: false });
  try {
    const { getDb } = await import('$lib/server/db.js');
    getDb().prepare('DELETE FROM flight_media WHERE id=?').run(Number(media_id));
    return json({ ok: true });
  } catch(e) { return json({ ok: false, error: e.message }); }
}
