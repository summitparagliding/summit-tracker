import { json, error } from '@sveltejs/kit';
import {
  getStudentSession, getInstructorSession,
  getDebriefingsForFlight, createDebriefingRequest,
  updateDebriefing, addDebriefingToFlight,
  acknowledgeDebriefing
} from '$lib/server/db.js';

export async function GET({ url }) {
  const flightId = Number(url.searchParams.get('flight_id'));
  if (!flightId) return json([]);
  try {
    return json(getDebriefingsForFlight(flightId));
  } catch(e) {
    console.error('[debrief GET]', e.message);
    return json([]);
  }
}

export async function POST({ request, cookies }) {
  // Read cookies
  const stok = cookies.get('student_session');
  const itok = cookies.get('instructor_session');
  const student    = stok ? getStudentSession(stok)    : null;
  const instructor = itok ? getInstructorSession(itok) : null;

  if (!student && !instructor) {
    return json({ ok: false, error: 'Not authenticated (no session cookie)' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch(e) {
    return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, flight_id } = body;

  // Student: request a debriefing
  if (action === 'request') {
    if (!student) {
      return json({ ok: false, error: 'Student session required' }, { status: 403 });
    }
    if (!flight_id) {
      return json({ ok: false, error: 'Missing flight_id' }, { status: 400 });
    }
    try {
      const id = createDebriefingRequest({
        flight_id,
        student_id:       student.student_id,
        phases_requested: body.phases || [],
        student_note:     body.note || null,
      });
      return json({ ok: true, id });
    } catch(e) {
      console.error('[debrief request]', e.message);
      return json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  // Instructor: add a new debriefing directly
  if (action === 'add') {
    if (!instructor) {
      return json({ ok: false, error: 'Instructor session required' }, { status: 403 });
    }
    if (!flight_id) {
      return json({ ok: false, error: 'Missing flight_id' }, { status: 400 });
    }
    try {
      const id = addDebriefingToFlight({
        flight_id,
        instructor_id: instructor.instructor_id,
        content:       body.content || '',
      });
      return json({ ok: true, id });
    } catch(e) {
      console.error('[debrief add]', e.message);
      return json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  // Student: acknowledge a debriefing
  if (action === 'acknowledge') {
    const { debrief_id } = body;
    if (!debrief_id) return json({ ok: false, error: 'Missing debrief_id' }, { status: 400 });
    try {
      acknowledgeDebriefing(Number(debrief_id));
      return json({ ok: true });
    } catch(e) {
      return json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  // Instructor: respond to a student request
  if (action === 'respond') {
    if (!instructor) {
      return json({ ok: false, error: 'Instructor session required' }, { status: 403 });
    }
    try {
      updateDebriefing({
        id:            body.debriefing_id,
        instructor_id: instructor.instructor_id,
        content:       body.content || '',
        status:        'done',
      });
      return json({ ok: true });
    } catch(e) {
      console.error('[debrief respond]', e.message);
      return json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  return json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
}
