import { json, error } from '@sveltejs/kit';
import { getInstructorSession, getTrainingDay, markTelegramSent, notifyAllStudents } from '$lib/server/db.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '-1001676182634';
const TOPIC_ID  = process.env.TELEGRAM_TOPIC_ID  || '8788';

export async function POST({ request, cookies }) {
  const itok = cookies.get('instructor_session');
  const sess = itok ? getInstructorSession(itok) : null;
  if (!sess) throw error(401, 'Not authenticated');

  const { training_day_id, message } = await request.json();

  if (!BOT_TOKEN) {
    return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  const text = message || buildDefaultMessage(training_day_id);

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:            CHAT_ID,
      message_thread_id:  Number(TOPIC_ID),
      text,
      parse_mode:         'HTML',
    }),
  });

  const data = await res.json();
  if (!data.ok) return json({ ok: false, error: data.description });

  if (training_day_id) {
    markTelegramSent(training_day_id);
    // Create in-app notifications for all students
    const td = getTrainingDay(training_day_id);
    if (td) {
      notifyAllStudents('day_plan', ' Nouveau plan de journée', td.plan_text?.slice(0, 120) || 'Un plan a été publié pour demain.', `/student/dashboard`);
    }
  }

  return json({ ok: true, message_id: data.result?.message_id });
}

function buildDefaultMessage(dayId) {
  return ` Plan Summit Paragliding\n\nConsultez l'application pour les détails de la journée d'entraînement.`;
}
