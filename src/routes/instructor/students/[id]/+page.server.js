import { getConfidenceTrend,
  
  getStudent, getStudentDashboard, updateStudentPin, sha256, getDb,
  updateStudentContact, addPayment, deletePayment, getPayments,
  getBillsForStudent, createBill, deleteBill, getPaymentProof, getOrdersForStudent, deleteOrder, respondToOrder, confirmOrder, resetStudentData, approvePayment, rejectPayment,
  setStudentTotalDue
} from '$lib/server/db.js';
import { error, fail } from '@sveltejs/kit';

export function load({ params }) {
  const id = Number(params.id);
  const student = getStudent(id);
  if (!student) throw error(404, 'Student not found');
  const payments = getPayments(id);
  const paymentProofs = {};
  for (const p of payments) {
    const proof = getPaymentProof(p.id);
    if (proof) paymentProofs[p.id] = proof;
  }
  const confidenceTrend = (() => { try { return getConfidenceTrend(id); } catch(e) { return {trend:'neutral',data:[]}; } })();
  return {
    student,
    dash:          getStudentDashboard(id),
    payments,
    paymentProofs,
    bills:         getBillsForStudent(id),
    orders:        getOrdersForStudent(id),
  };
}


export const actions = {
  resetPin: async ({ request, params }) => {
    const fd  = await request.formData();
    let pin = (fd.get('pin') || '').trim().replace(/\D/g, '');
    if (!pin || pin.length < 4 || pin.length > 6)
      return fail(400, { pinErr: 'Le PIN doit avoir 4 à 6 chiffres.' });
    updateStudentPin(Number(params.id), pin);
    return { pinOk: true };
  },
  updateNotes: async ({ request, params }) => {
    const fd = await request.formData();
    getDb().prepare('UPDATE students SET notes=? WHERE id=?')
      .run(fd.get('notes')?.trim() || null, Number(params.id));
    return { notesOk: true };
  },
  deleteBill: async ({ request, params }) => {
    const fd = await request.formData();
    deleteBill(Number(fd.get('id')));
    return { ok: true };
  },
  deleteOrder: async ({ request }) => {
    const fd = await request.formData();
    deleteOrder(Number(fd.get('id')));
    return { ok: true };
  },
  respondOrder: async ({ request, locals }) => {
    const fd = await request.formData();
    respondToOrder(Number(fd.get('order_id')), fd.get('response')||'', 1);
    return { ok: true };
  },
  confirmOrder: async ({ request }) => {
    const fd = await request.formData();
    confirmOrder(Number(fd.get('order_id')));
    return { ok: true };
  },
  resetStudent: async ({ params }) => {
    resetStudentData(Number(params.id));
    return { resetOk: true };
  },
  approvePayment: async ({ request }) => {
    const fd = await request.formData();
    try { approvePayment(Number(fd.get('id'))); } catch(e) { console.error('approvePayment:', e.message); }
    return { payOk: true };
  },
  rejectPayment: async ({ request }) => {
    const fd = await request.formData();
    try { rejectPayment(Number(fd.get('id'))); } catch(e) { console.error('rejectPayment:', e.message); }
    return { payOk: true };
  },
  saveContact: async ({ request, params }) => {
    const fd = await request.formData();
    updateStudentContact(Number(params.id), {
      phone:                        fd.get('phone') || '',
      email:                        fd.get('email') || '',
      emergency_contact_name:       fd.get('emergency_contact_name') || '',
      emergency_contact_phone:      fd.get('emergency_contact_phone') || '',
      emergency_contact_relationship: fd.get('emergency_contact_relationship') || '',
    });
    return { contactOk: true };
  },
  setTotalDue: async ({ request, params }) => {
    const fd = await request.formData();
    setStudentTotalDue(Number(params.id), parseFloat(fd.get('amount')) || 0);
    return { payOk: true };
  },
  addPayment: async ({ request, params }) => {
    const fd = await request.formData();
    addPayment({
      student_id: Number(params.id),
      amount:     parseFloat(fd.get('amount')) || 0,
      date:       fd.get('date') || new Date().toISOString().slice(0,10),
      method:     fd.get('method') || 'interac',
      notes:      fd.get('notes') || '',
      status:     fd.get('status') || 'paid',
    });
    return { payOk: true };
  },
};
