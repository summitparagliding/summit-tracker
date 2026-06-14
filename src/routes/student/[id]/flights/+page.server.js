import { getFlightsForStudent } from '$lib/server/db.js';
import { redirect, fail } from '@sveltejs/kit';

export function load({ params, url }) {
  if (url.searchParams.get('start') === '1') {
    throw redirect(303, `/student/${params.id}/preflight`);
  }
  // Load only flight summaries — media loaded lazily on expand
  const flights = getFlightsForStudent(Number(params.id));
  return {
    flights,  // no media preloaded
    completed: url.searchParams.get('completed') === '1',
  };
}

export const actions = {
  // Instructor can still delete directly (kept for instructor portal use)
  delete: async ({ request, cookies }) => {
    const { deleteFlight, getInstructorSession } = await import('$lib/server/db.js');
    const tok = cookies.get('instructor_session');
    if (!tok || !getInstructorSession(tok)) return fail(403, { err: 'Instructor only' });
    const fd = await request.formData();
    try { deleteFlight(Number(fd.get('id'))); } catch(e) {}
    return { success: true };
  },

  // Student requests an instructor review before the flight is deleted
  requestRemoval: async ({ request, params }) => {
    const { requestFlightRemoval, hasPendingFlightRemovalRequest } = await import('$lib/server/db.js');
    const studentId = Number(params.id);
    const fd = await request.formData();
    const flightId = Number(fd.get('id'));
    const reason   = fd.get('reason') || null;
    if (!flightId) return fail(400, { err: 'Missing flight id' });

    if (hasPendingFlightRemovalRequest(flightId, studentId)) {
      return fail(400, { err: 'A removal request is already pending for this flight' });
    }

    requestFlightRemoval({ flight_id: flightId, student_id: studentId, reason });
    return { requested: true };
  }
};
