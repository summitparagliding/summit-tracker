import { getFlight, getStudent } from '$lib/server/db.js';
import { error, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';

export function load({ params, locals }) {
  if (!locals.student) throw error(401);
  // Prevent returning to completed flight (Item 5)
  try {
    const f = getDb().prepare('SELECT status FROM flights WHERE id=?').get(Number(params.flightId));
    if (f?.status === 'complete' || f?.status === 'abandoned') throw redirect(303, `/student/${params.id}`);
  } catch(e) { if (e?.status === 303) throw e; }
  const flight = getFlight(Number(params.flightId));
  if (!flight) throw error(404, 'Flight not found');
  // Pass student directly since layout is reset
  return { flight, student: locals.student };
}
