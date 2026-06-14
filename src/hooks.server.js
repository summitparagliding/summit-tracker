import { getStudentSession, getInstructorSession, getStudent, getInstructor } from '$lib/server/db.js';

export async function handle({ event, resolve }) {
  // Wrap entirely — any DB error here must NOT block the login page from loading
  try {
    const sTok = event.cookies.get('student_session');
    const iTok = event.cookies.get('instructor_session');

    if (sTok) {
      try {
        const sess = getStudentSession(sTok);
        if (sess) event.locals.student = getStudent(sess.student_id);
      } catch(e) { /* expired or invalid session — ignore */ }
    }

    if (iTok) {
      try {
        const sess = getInstructorSession(iTok);
        if (sess) event.locals.instructor = getInstructor(sess.instructor_id);
      } catch(e) { /* expired or invalid session — ignore */ }
    }
  } catch(e) {
    // DB not yet ready, permissions issue, etc. — still serve the page.
    console.error('[hooks] Session resolution error:', e.message);
  }

  const response = await resolve(event);

  // Never cache HTML documents — guarantees users get fresh app shell + latest JS
  // bundle references on every deploy. Hashed assets (/_app/*) stay cacheable.
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('text/html')) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  return response;
}
