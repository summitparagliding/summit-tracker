import { json, error } from '@sveltejs/kit';
import { getInstructorSession, setStudentBillUrl, createBill } from '$lib/server/db.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BILLS_DIR = join(process.env.DATA_DIR || '/data', 'uploads', 'bills');
function billsUrl(fname) { return `/api/file?key=bills/${fname}`; }

async function saveBillFile(file, prefix) {
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
  if (!['pdf','jpg','jpeg','png'].includes(ext)) throw new Error('Seuls les PDF et images sont acceptés');
  const fname = `${prefix}_${Date.now()}.${ext}`;
  try { mkdirSync(BILLS_DIR, { recursive: true }); } catch(e) {}
  writeFileSync(join(BILLS_DIR, fname), Buffer.from(await file.arrayBuffer()));
  return { fname, url: billsUrl(fname) };
}

// POST: instructor uploads a bill for a student
export async function POST({ request, cookies }) {
  const tok  = cookies.get('instructor_session');
  const sess = tok ? getInstructorSession(tok) : null;
  if (!sess) throw error(401, 'Not authenticated');

  const fd        = await request.formData();
  const studentId = Number(fd.get('student_id'));
  const file      = fd.get('file');
  const title     = (fd.get('title') || '').trim() || 'Facture';
  const notes     = fd.get('notes') || '';

  if (!studentId) return json({ ok: false, error: 'Missing student_id' }, { status: 400 });
  if (!file || typeof file === 'string') return json({ ok: false, error: 'No file provided' }, { status: 400 });

  try {
    const { fname, url } = await saveBillFile(file, `bill_${studentId}`);
    const id = createBill({
      student_id:    studentId,
      title,
      filename:      file.name,
      url,
      uploaded_by:   sess.instructor_id,
      uploader_type: 'instructor',
      notes,
    });
    // Keep legacy bill_url pointing to the most recent bill
    setStudentBillUrl(studentId, url);
    return json({ ok: true, id, url });
  } catch(e) {
    console.error('[/api/bill POST]', e.message, e.stack);
    return json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE({ request, cookies }) {
  const tok  = cookies.get('instructor_session');
  const sess = tok ? getInstructorSession(tok) : null;
  if (!sess) throw error(401, 'Not authenticated');
  const { student_id } = await request.json().catch(() => ({}));
  if (!student_id) return json({ ok: false });
  setStudentBillUrl(Number(student_id), null);
  return json({ ok: true });
}
