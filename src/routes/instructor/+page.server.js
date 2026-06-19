import { redirect } from '@sveltejs/kit';
import { getPendingRegistrations,
  getInstructorSession, getInstructorDashboard, getAllStudentsProgress,
  getMessages, getAllOrders, getAllOrdersWithStudents, getPendingSignoffs, getPendingExamSignoffs, getMessageReaders, getPendingOrdersAll,
  getPendingDebriefs, signOffExercise, signOffExam, signOffAllForStudent, getDb,
  getNewOrdersForInstructor, markOrdersSeenByInstructor, getAllPendingPayments, approvePayment, rejectPayment,
  getPendingFlightRemovals, approveFlightRemoval, denyFlightRemoval,
  getOrdersAwaitingReply, getUnseenStudentBills, markBillsSeenByInstructor,
} from '$lib/server/db.js';

export function load({ cookies }) {
  const tok = cookies.get('instructor_session');
  if (!tok) throw redirect(303, '/instructor/login');

  let sess;
  try { sess = getInstructorSession(tok); } catch(e) { throw redirect(303, '/instructor/login'); }
  if (!sess) throw redirect(303, '/instructor/login');

  const EMPTY_DASH = { students:0, flights:0, pending_signoffs:0, recent_flights:[], active_students:[], pending_ex:[], pending_exam:[] };

  let dash = EMPTY_DASH, allProgress = [], messages = [], orders = [], pendingDebriefs = [], pendEx = [], pendExam = [];

  try { dash = getInstructorDashboard() || EMPTY_DASH; } catch(e) { console.error('dash:', e.message); }
  try { allProgress = getAllStudentsProgress() || []; } catch(e) { console.error('allProgress:', e.message); }
  try { 
    messages = (getMessages() || []).map(m => ({
      ...m,
      readers: getMessageReaders(m.id)
    }));
  } catch(e) { console.error('messages:', e.message); }
  try { orders = getAllOrders() || []; } catch(e) { console.error('orders:', e.message); }
  try { pendingDebriefs = getPendingDebriefs() || []; } catch(e) { console.error('debriefs:', e.message); }
  let newOrders = [];
  try {
    newOrders = getNewOrdersForInstructor() || [];
    // Mark them as seen after loading (instructor is now aware)
    if (newOrders.length) markOrdersSeenByInstructor(newOrders.map(o=>o.id));
  } catch(e) {}
  let acknowledgedDebriefs = [];
  try {
    acknowledgedDebriefs = getDb().prepare(`
      SELECT fd.*, s.name as student_name, f.date as flight_date
      FROM flight_debriefings fd
      JOIN students s ON s.id = fd.student_id
      LEFT JOIN flights f ON f.id = fd.flight_id
      WHERE fd.student_acknowledged = 1
        AND (fd.instructor_seen_ack IS NULL OR fd.instructor_seen_ack = 0)
      ORDER BY fd.student_acknowledged_at DESC
      LIMIT 15
    `).all();
    // Mark them as seen by instructor
    if (acknowledgedDebriefs.length) {
      const ids = acknowledgedDebriefs.map(d => d.id).join(',');
      getDb().prepare(`UPDATE flight_debriefings SET instructor_seen_ack=1 WHERE id IN (${ids})`).run();
    }
  } catch(e) {}
  try { pendEx = getPendingSignoffs() || []; } catch(e) { console.error('pendEx:', e.message); }
  try { pendExam = getPendingExamSignoffs() || []; } catch(e) { console.error('pendExam:', e.message); }

  // Group by student — template expects [{student_name, student_id, exercises:[], exams:[]}]
  const studentMap = {};
  for (const ex of pendEx) {
    if (!studentMap[ex.student_id]) studentMap[ex.student_id] = { student_id: ex.student_id, student_name: ex.student_name || '?', exercises: [], exams: [] };
    studentMap[ex.student_id].exercises.push(ex);
  }
  for (const ea of pendExam) {
    if (!studentMap[ea.student_id]) studentMap[ea.student_id] = { student_id: ea.student_id, student_name: ea.student_name || '?', exercises: [], exams: [] };
    studentMap[ea.student_id].exams.push(ea);
  }
  const today = Object.values(studentMap);

  let allOrders = [];
  try { allOrders = getAllOrdersWithStudents(); } catch(e) {}
  let pendingPayments = [];
  try { pendingPayments = getAllPendingPayments() || []; } catch(e) {}
  let flightRemovals = [];
  try { flightRemovals = getPendingFlightRemovals() || []; } catch(e) {}
  let orderReplies = [];
  try { orderReplies = getOrdersAwaitingReply() || []; } catch(e) {}
  let uploadedBills = [];
  try {
    uploadedBills = getUnseenStudentBills() || [];
    if (uploadedBills.length) markBillsSeenByInstructor(uploadedBills.map(b => b.id));
  } catch(e) {}
  return {
    registrations: getPendingRegistrations(), dash, today, allProgress, messages, orders, allOrders, pendingDebriefs, acknowledgedDebriefs, newOrders, pendingPayments, flightRemovals, orderReplies, uploadedBills };
}

export const actions = {
  createMessage: async ({ request, locals }) => {
    try {
      const { createMessage } = await import('$lib/server/db.js');
      const fd = await request.formData();
      createMessage({ title: String(fd.get('title')||''), body: String(fd.get('body')||''), instructor_id: locals.instructor?.id || 1 });
    } catch(e) { console.error('createMessage:', e.message); }
    return {
    registrations: getPendingRegistrations(), msgOk: true };
  },
  deleteMessage: async ({ request }) => {
    try {
      const { deleteMessage } = await import('$lib/server/db.js');
      const fd = await request.formData();
      deleteMessage(Number(fd.get('id')));
    } catch(e) { console.error('deleteMessage:', e.message); }
    return {
    registrations: getPendingRegistrations(), msgOk: true };
  },
  approvePayment: async ({ request }) => {
    const fd = await request.formData();
    try { approvePayment(Number(fd.get('payment_id'))); } catch(e) {}
    return {
    registrations: getPendingRegistrations(), ok: true };
  },
  rejectPayment: async ({ request }) => {
    const fd = await request.formData();
    try { rejectPayment(Number(fd.get('payment_id'))); } catch(e) {}
    return {
    registrations: getPendingRegistrations(), ok: true };
  },
  respondOrder: async ({ request, locals }) => {
    try {
      const { respondToOrder } = await import('$lib/server/db.js');
      const fd = await request.formData();
      respondToOrder(Number(fd.get('order_id')), String(fd.get('response')||''), locals.instructor?.id||1);
    } catch(e) { console.error('respondOrder:', e.message); }
    return {
    registrations: getPendingRegistrations(), orderOk: true };
  },
  confirmOrder: async ({ request }) => {
    try {
      const { confirmOrder } = await import('$lib/server/db.js');
      const fd = await request.formData();
      confirmOrder(Number(fd.get('order_id')));
    } catch(e) { console.error('confirmOrder:', e.message); }
    return {
    registrations: getPendingRegistrations(), orderOk: true };
  },
  approveRemoval: async ({ request, locals }) => {
    try {
      const fd = await request.formData();
      approveFlightRemoval(Number(fd.get('request_id')), locals.instructor?.id || 1);
    } catch(e) { console.error('approveRemoval:', e.message); }
    return { registrations: getPendingRegistrations(), removalOk: true };
  },
  denyRemoval: async ({ request, locals }) => {
    try {
      const fd = await request.formData();
      denyFlightRemoval(Number(fd.get('request_id')), locals.instructor?.id || 1);
    } catch(e) { console.error('denyRemoval:', e.message); }
    return { registrations: getPendingRegistrations(), removalOk: true };
  },
  respondDebrief: async ({ request, locals }) => {
    try {
      const { updateDebriefing } = await import('$lib/server/db.js');
      const fd = await request.formData();
      updateDebriefing({ id: Number(fd.get('debrief_id')), instructor_id: locals.instructor?.id||1, content: String(fd.get('content')||''), status: 'done' });
    } catch(e) { console.error('respondDebrief:', e.message); }
    return {
    registrations: getPendingRegistrations(), debriefOk: true };
  },
  signoffExercise: async ({ request, locals }) => {
    try {
      const fd = await request.formData();
      signOffExercise(Number(fd.get('log_id')), locals.instructor?.id||1, String(fd.get('status')||'passed'), '');
    } catch(e) { console.error('signoffExercise:', e.message); }
    return {
    registrations: getPendingRegistrations(), ok: true };
  },
  signoffExam: async ({ request, locals }) => {
    try {
      const fd = await request.formData();
      signOffExam(Number(fd.get('attempt_id')), locals.instructor?.id||1, Number(fd.get('passed')||0), '', null);
    } catch(e) { console.error('signoffExam:', e.message); }
    return {
    registrations: getPendingRegistrations(), ok: true };
  },
  signAllForStudent: async ({ request, locals }) => {
    try {
      const fd = await request.formData();
      signOffAllForStudent(Number(fd.get('student_id')), locals.instructor?.id||1);
    } catch(e) { console.error('signAllForStudent:', e.message); }
    return {
    registrations: getPendingRegistrations(), ok: true };
  },
  logout: async ({ cookies }) => {
    try {
      const tok = cookies.get('instructor_session');
      if (tok) {
        const { getDb } = await import('$lib/server/db.js');
        getDb().prepare('DELETE FROM instructor_sessions WHERE token=?').run(tok);
      }
    } catch(e) { console.error('instructor logout:', e.message); }
    cookies.delete('instructor_session', { path: '/' });
    throw redirect(303, '/instructor/login');
  },
};
