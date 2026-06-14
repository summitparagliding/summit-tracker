import { json, error } from '@sveltejs/kit';
import { getInstructorSession, getStudentSession,
  createDebriefingRequest, updateDebriefing, addDebriefingToFlight,
  getDebriefingsForFlight, addDebriefingMedia } from '$lib/server/db.js';

export function GET({ params }) {
  return json(getDebriefingsForFlight(Number(params.id)));
}

export async function POST({ params, request, cookies }) {
  const stok = cookies.get('student_session');
  const itok = cookies.get('instructor_session');
  const student    = stok ? getStudentSession(stok)    : null;
  const instructor = itok ? getInstructorSession(itok) : null;
  if (!student && !instructor) throw error(401, 'Not authenticated');

  const body = await request.json();
  const flightId = Number(params.id);

  if (body.action === 'request') {
    // Student requests a debriefing
    if (!student) throw error(403, 'Student only');
    const id = createDebriefingRequest({
      flight_id: flightId,
      student_id: student.student_id,
      phases_requested: body.phases || [],
    });
    // Telegram notify
    const BOT = process.env.TELEGRAM_BOT_TOKEN || '';
    const CHAT = process.env.TELEGRAM_CHAT_ID || '-1001676182634';
    if (BOT) {
      const phases = (body.phases || []).join(', ');
      fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ chat_id: CHAT, text: `Demande de debriefing — Vol #${flightId}\nPhases: ${phases || 'non précisé'}`, parse_mode:'HTML' })
      }).catch(()=>{});
    }
    return json({ ok: true, id });
  }

  if (body.action === 'respond') {
    // Instructor responds to an existing debriefing request
    if (!instructor) throw error(403, 'Instructor only');
    updateDebriefing({ id: body.debriefing_id, instructor_id: instructor.instructor_id, content: body.content, status: 'done' });
    return json({ ok: true });
  }

  if (body.action === 'add') {
    // Instructor adds a new debriefing directly
    if (!instructor) throw error(403, 'Instructor only');
    const id = addDebriefingToFlight({ flight_id: flightId, instructor_id: instructor.instructor_id, content: body.content });
    return json({ ok: true, id });
  }

  throw error(400, 'Unknown action');
}
