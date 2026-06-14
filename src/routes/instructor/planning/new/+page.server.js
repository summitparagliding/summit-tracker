import { getInstructorSession, createTrainingDay } from '$lib/server/db.js';
import { redirect } from '@sveltejs/kit';

export function load({ cookies }) {
  const tok = cookies.get('instructor_session');
  if (!tok || !getInstructorSession(tok)) throw redirect(303, '/instructor/login');
  return {};
}

export const actions = {
  default: async ({ request, cookies }) => {
    const tok  = cookies.get('instructor_session');
    const sess = tok ? getInstructorSession(tok) : null;
    if (!sess) throw redirect(303, '/instructor/login');
    const fd  = await request.formData();
    const num = k => { const v = fd.get(k); return v !== '' && v != null ? Number(v) : null; };
    const activities = fd.getAll('activity_types');
    const id = createTrainingDay({
      date:            fd.get('date'),
      instructor_id:   sess.instructor_id,
      activity_types:  JSON.stringify(activities),
      launch_site:     fd.get('launch_site') || '',
      max_students:    num('max_students') || 12,
      weather_summary: fd.get('weather_summary') || '',
      plan_text:       fd.get('plan_text') || '',
      wind_min:        num('wind_min'),
      wind_max:        num('wind_max'),
      wind_dir:        fd.get('wind_dir') || '',
    });
    // Day created as DRAFT - instructor publishes manually
    throw redirect(303, '/instructor/planning');
  }
};
