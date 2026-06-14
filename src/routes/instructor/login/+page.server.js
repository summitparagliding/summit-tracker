import { verifyInstructor, createInstructorSession } from '$lib/server/db.js';
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ request, cookies }) => {
    const fd       = await request.formData();
    const username = fd.get('username')?.trim();
    const password = fd.get('password')?.trim();
    if (!username || !password) return fail(400, { error: 'Enter username and password.' });
    const inst = verifyInstructor(username, password);
    if (!inst) return fail(401, { error: 'Invalid credentials.' });
    const token = createInstructorSession(inst.id);
    cookies.set('instructor_session', token, { path:'/', httpOnly:true, sameSite:'lax', maxAge:86400 });
    throw redirect(303, '/instructor');
  }
};
