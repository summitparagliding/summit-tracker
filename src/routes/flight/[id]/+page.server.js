import { getFlight, getStudent, getFlightMedia, getInstructorSession, getDebriefingsForFlight } from '$lib/server/db.js';
import { error } from '@sveltejs/kit';

export function load({ params, cookies }) {
  let flight;
  try {
    flight = getFlight(Number(params.id));
  } catch(e) {
    throw error(500, 'Database error');
  }
  if (!flight) throw error(404, 'Flight not found');

  const student = getStudent(flight.student_id);
  let media    = [];
  let debriefs = [];

  try { media = getFlightMedia(flight.id); } catch(e) { console.error('[flight] media error:', e.message); }
  try { debriefs = getDebriefingsForFlight(flight.id); } catch(e) { console.error('[flight] debriefs error:', e.message); }

  let isInstructor = false;
  try {
    const itok = cookies.get('instructor_session');
    if (itok) isInstructor = !!getInstructorSession(itok);
  } catch(e) {}

  return { flight, student, media, debriefs, isInstructor };
}

export const actions = {
  addDebrief: async ({ request, cookies }) => {
    try {
      const itok = cookies.get('instructor_session');
      const instructor = itok ? getInstructorSession(itok) : null;
      if (!instructor) return { err: 'Not authorized' };
      const { addDebriefingToFlight } = await import('$lib/server/db.js');
      const fd = await request.formData();
      addDebriefingToFlight({
        flight_id:     Number(fd.get('flight_id')),
        instructor_id: instructor.instructor_id,
        content:       fd.get('content') || '',
      });
      return { debriefOk: true };
    } catch(e) {
      return { err: e.message };
    }
  }
};
