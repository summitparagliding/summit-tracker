import { redirect } from '@sveltejs/kit';
import { getInstructorSession, completeAppReset } from '$lib/server/db.js';

export function load({ cookies }) {
  const tok = cookies.get('instructor_session');
  if (!tok || !getInstructorSession(tok)) throw redirect(303, '/instructor/login');
  return {};
}

export const actions = {
  fullReset: async ({ request, cookies }) => {
    const tok  = cookies.get('instructor_session');
    const sess = tok ? getInstructorSession(tok) : null;
    if (!sess) return { error: 'Not authenticated' };
    const fd = await request.formData();
    if (fd.get('confirm') !== 'RESET' && !String(fd.get('confirmText')||'').includes('RESET')) {
      // Try getting confirm from the form directly
    }
    try {
      completeAppReset();
      return { resetDone: true };
    } catch(e) {
      return { error: e.message };
    }
  },
};
