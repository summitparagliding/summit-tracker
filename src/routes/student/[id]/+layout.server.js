import { redirect } from '@sveltejs/kit';
import { getStudent, getNotifications, hasSignedAllWaivers } from '$lib/server/db.js';

export function load({ locals, params, url }) {
  // Auth check — must have a valid session
  if (!locals.student) throw redirect(303, '/');
  if (String(locals.student.id) !== String(params.id)) throw redirect(303, '/');

  // Obligatory waivers — block the whole app until every active waiver is signed.
  // The waivers page itself is exempt so there's no redirect loop.
  const onWaivers = url.pathname.endsWith('/waivers');
  let waiversDone = true;
  try { waiversDone = hasSignedAllWaivers(locals.student.id); } catch(e) {}
  if (!waiversDone && !onWaivers) {
    throw redirect(303, `/student/${params.id}/waivers`);
  }

  // Reload student data — safe fallback to session data if DB fails
  let student = locals.student;
  try { student = getStudent(locals.student.id) || locals.student; } catch(e) {}

  // Unread notification count — safe fallback to 0 if table missing
  let notifs = [];
  try { notifs = getNotifications(locals.student.id, true); } catch(e) {}

  return { student, unreadCount: notifs.length };
}
