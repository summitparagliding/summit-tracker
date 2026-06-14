import { json, error } from '@sveltejs/kit';
import {
  getInstructorSession, getStudentSession,
  createMessage, deleteMessage, dismissMessage, restoreMessage,
  getAllOrders, createOrder, respondToOrder, confirmOrder, deleteOrder,
  addOrderMessage, getOrderWithThread,
  getStudent
} from '$lib/server/db.js';

export async function POST({ request, cookies }) {
  const itok = cookies.get('instructor_session');
  const stok = cookies.get('student_session');
  const instructor = itok ? getInstructorSession(itok) : null;
  const student    = stok ? getStudentSession(stok)    : null;
  if (!instructor && !student) throw error(401, 'Not authenticated');

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  // ── Messages ──────────────────────────────────────────────
  if (action === 'create_message') {
    if (!instructor) throw error(403, 'Instructor only');
    const id = createMessage({ title: body.title, body: body.body, instructor_id: instructor.instructor_id });
    return json({ ok: true, id });
  }
  if (action === 'delete_message') {
    if (!instructor) throw error(403, 'Instructor only');
    deleteMessage(body.id);
    return json({ ok: true });
  }
  if (action === 'dismiss_message') {
    if (!student) throw error(403, 'Student only');
    dismissMessage(body.message_id, student.student_id);
    return json({ ok: true });
  }
  if (action === 'restore_message') {
    if (!student) throw error(403, 'Student only');
    restoreMessage(body.message_id, student.student_id);
    return json({ ok: true });
  }

  // ── Orders ────────────────────────────────────────────────
  if (action === 'create_order') {
    if (!student) throw error(403, 'Student only');
    if (!body.description?.trim()) throw error(400, 'Description required');
    const id = createOrder(student.student_id, body.description.trim());
    return json({ ok: true, id });
  }
  if (action === 'respond_order') {
    if (!instructor) throw error(403, 'Instructor only');
    respondToOrder(body.order_id, body.response, instructor.instructor_id);
    return json({ ok: true });
  }

  // ── Order chat thread (either party, many times, until confirmed) ──
  if (action === 'post_order_message') {
    const text = (body.body || '').trim();
    if (!text) throw error(400, 'Message required');
    const thread = getOrderWithThread(body.order_id);
    if (!thread) throw error(404, 'Order not found');
    if (thread.status === 'confirmed') throw error(400, 'Order already confirmed');
    if (instructor) {
      addOrderMessage(body.order_id, 'instructor', instructor.instructor_id, text);
    } else {
      if (thread.student_id !== student.student_id) throw error(403, 'Not your order');
      addOrderMessage(body.order_id, 'student', student.student_id, text);
    }
    return json({ ok: true, thread: getOrderWithThread(body.order_id) });
  }
  if (action === 'get_order_thread') {
    const thread = getOrderWithThread(body.order_id);
    if (!thread) throw error(404, 'Order not found');
    if (student && thread.student_id !== student.student_id) throw error(403, 'Not your order');
    return json({ ok: true, thread });
  }
  if (action === 'confirm_order') {
    if (!instructor) throw error(403, 'Instructor only');
    confirmOrder(body.order_id);
    return json({ ok: true });
  }
  if (action === 'delete_order') {
    if (!instructor) throw error(403, 'Instructor only');
    deleteOrder(body.order_id);
    return json({ ok: true });
  }

  throw error(400, 'Unknown action: ' + action);
}
