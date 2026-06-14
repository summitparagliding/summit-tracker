import { json, error } from '@sveltejs/kit';
import { getStudentSession, createBill } from '$lib/server/db.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BILLS_DIR = join(process.env.DATA_DIR || '/data', 'uploads', 'bills');
function billsUrl(fname) { return `/api/file?key=bills/${fname}`; }

// POST: student uploads their own bill/receipt
export async function POST({ request, cookies }) {
  const tok  = cookies.get('student_session');
  const sess = tok ? getStudentSession(tok) : null;
  if (!sess) throw error(401, 'Not authenticated');

  const fd    = await request.formData();
  const file  = fd.get('file');
  const title = (fd.get('title') || '').trim() || 'Reçu';

  if (!file || typeof file === 'string') return json({ ok: false, error: 'No file provided' }, { status: 400 });

  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
  if (!['pdf','jpg','jpeg','png'].includes(ext))
    return json({ ok: false, error: 'Seuls les PDF et images sont acceptés' }, { status: 400 });

  try {
    const fname = `bill_s${sess.student_id}_${Date.now()}.${ext}`;
    try { mkdirSync(BILLS_DIR, { recursive: true }); } catch(e) {}
    writeFileSync(join(BILLS_DIR, fname), Buffer.from(await file.arrayBuffer()));
    const url = billsUrl(fname);

    const id = createBill({
      student_id:    sess.student_id,
      title,
      filename:      file.name,
      url,
      uploaded_by:   null,   // null = student upload
      uploader_type: 'student',
    });
    return json({ ok: true, id, url });
  } catch(e) {
    console.error('[/api/student-bill POST]', e.message, e.stack);
    return json({ ok: false, error: e.message }, { status: 500 });
  }
}
