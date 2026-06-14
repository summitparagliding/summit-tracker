import { getInstructorSession, getTrainingDays, deleteTrainingDay, updateTrainingDay, getTrainingDay, publishDayToApp, markDayTelegramSent, getTrainingDayRegistrations } from '$lib/server/db.js';
import { redirect } from '@sveltejs/kit';

export function load({ cookies }) {
  const tok = cookies.get('instructor_session');
  if (!tok || !getInstructorSession(tok)) throw redirect(303, '/instructor/login');
  const rawDays = getTrainingDays(60);
  // Attach full registration list to each day
  const days = rawDays.map(d => ({
    ...d,
    registrations: getTrainingDayRegistrations(d.id),
  }));
  return { days };
}

export const actions = {
  // Update app only (already published) — silent update, students see changes without new Telegram notification
  updateApp: async ({ request, cookies }) => {
    const tok = cookies.get('instructor_session');
    if (!tok || !getInstructorSession(tok)) return { err: 'Auth' };
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    try {
      publishDayToApp(id);  // updates the app notification without Telegram
      // Optionally create an in-app notification that planning was updated
    } catch(e) { console.error('updateApp:', e.message); }
    return { ok: true };
  },

  publishToApp: async ({ request, cookies }) => {
    const tok = cookies.get('instructor_session');
    if (!tok || !getInstructorSession(tok)) return { err: 'Auth required' };
    const fd = await request.formData();
    try { publishDayToApp(Number(fd.get('id'))); } catch(e) { console.error(e.message); }
    return { pubOk: true };
  },
  publishToTelegram: async ({ request, cookies }) => {
    const tok = cookies.get('instructor_session');
    if (!tok || !getInstructorSession(tok)) return { err: 'Auth required' };
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    try {
      const day = getTrainingDay(id);
      markDayTelegramSent(id);
      const BOT  = process.env.TELEGRAM_BOT_TOKEN || '';
      const CHAT = process.env.TELEGRAM_CHAT_ID   || '-1001676182634';
      const TOP  = process.env.TELEGRAM_TOPIC_ID  || '8788';
      if (BOT && day) {
        const lines = [`Journée de vol — ${day.date}`];
        if (day.launch_site) lines.push(`Site: ${day.launch_site.replace(/_/g,' ')}`);
        if (day.plan_text) lines.push(day.plan_text);
        if (day.max_students) lines.push(`Places: ${day.max_students}`);
        await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ chat_id:CHAT, message_thread_id:Number(TOP), text:lines.join('\n'), parse_mode:'HTML' }),
        }).catch(() => {});
      }
    } catch(e) { console.error('telegram publish:', e.message); }
    return { pubOk: true };
  },
  publishToBoth: async ({ request, cookies }) => {
    const tok = cookies.get('instructor_session');
    if (!tok || !getInstructorSession(tok)) return { err: 'Auth required' };
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    try { publishDayToApp(id); } catch(e) {}
    try {
      const day = getTrainingDay(id);
      markDayTelegramSent(id);
      const BOT  = process.env.TELEGRAM_BOT_TOKEN || '';
      const CHAT = process.env.TELEGRAM_CHAT_ID   || '-1001676182634';
      const TOP  = process.env.TELEGRAM_TOPIC_ID  || '8788';
      if (BOT && day) {
        const lines = [`Journée de vol — ${day.date}`];
        if (day.launch_site) lines.push(`Site: ${day.launch_site.replace(/_/g,' ')}`);
        if (day.plan_text) lines.push(day.plan_text);
        if (day.max_students) lines.push(`Places: ${day.max_students}`);
        await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ chat_id:CHAT, message_thread_id:Number(TOP), text:lines.join('\n'), parse_mode:'HTML' }),
        }).catch(() => {});
      }
    } catch(e) { console.error('telegram publish both:', e.message); }
    return { pubOk: true };
  },
  deleteDay: async ({ request, cookies }) => {
    const tok = cookies.get('instructor_session');
    if (!tok || !getInstructorSession(tok)) return { err: 'Not authenticated' };
    const fd = await request.formData();
    deleteTrainingDay(Number(fd.get('id')));
    return { ok: true };
  },
  // Save changes only — no publishing
  editDay: async ({ request, cookies }) => {
    const tok = cookies.get('instructor_session');
    if (!tok || !getInstructorSession(tok)) return { err: 'Not authenticated' };
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    updateTrainingDay(id, {
      date: fd.get('date'), launch_site: fd.get('launch_site')||'',
      activity_types: fd.get('activity_types')||'[]',
      max_students: Number(fd.get('max_students')||12),
      weather_summary: fd.get('weather_summary')||'',
      plan_text: fd.get('plan_text')||'',
    });
    return { editOk: true };
  },

  // Save changes + push silent update to app (no Telegram)
  editAndPublishApp: async ({ request, cookies }) => {
    const tok = cookies.get('instructor_session');
    if (!tok || !getInstructorSession(tok)) return { err: 'Not authenticated' };
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    updateTrainingDay(id, {
      date: fd.get('date'), launch_site: fd.get('launch_site')||'',
      activity_types: fd.get('activity_types')||'[]',
      max_students: Number(fd.get('max_students')||12),
      weather_summary: fd.get('weather_summary')||'',
      plan_text: fd.get('plan_text')||'',
    });
    try { publishDayToApp(id); } catch(e) { console.error('app publish:', e.message); }
    return { editOk: true };
  },

  // Save changes + publish to BOTH app and Telegram
  editAndPublishBoth: async ({ request, cookies }) => {
    const tok = cookies.get('instructor_session');
    if (!tok || !getInstructorSession(tok)) return { err: 'Not authenticated' };
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    updateTrainingDay(id, {
      date: fd.get('date'), launch_site: fd.get('launch_site')||'',
      activity_types: fd.get('activity_types')||'[]',
      max_students: Number(fd.get('max_students')||12),
      weather_summary: fd.get('weather_summary')||'',
      plan_text: fd.get('plan_text')||'',
    });
    try { publishDayToApp(id); } catch(e) { console.error('app publish:', e.message); }
    try {
      const day = getTrainingDay(id);
      const BOT  = process.env.TELEGRAM_BOT_TOKEN || '';
      const CHAT = process.env.TELEGRAM_CHAT_ID   || '-1001676182634';
      const TOP  = process.env.TELEGRAM_TOPIC_ID  || '8788';
      if (BOT && day) {
        const text = `<b>Journée modifiée — ${day.date}</b>\n\n` +
          (day.launch_site ? `📍 ${day.launch_site.replace(/_/g,' ')}\n` : '') +
          (day.plan_text   ? `\n${day.plan_text}` : '');
        await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ chat_id:CHAT, message_thread_id:Number(TOP), text, parse_mode:'HTML' }),
        }).catch(() => {});
      }
    } catch(e) { console.error('telegram edit:', e.message); }
    return { editOk: true };
  },
};
