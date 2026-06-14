import { redirect } from '@sveltejs/kit';

export function load({ locals, url }) {
  if (url.pathname === '/instructor/login') return {};
  if (!locals.instructor) throw redirect(303, '/instructor/login');
  return { instructor: locals.instructor };
}
