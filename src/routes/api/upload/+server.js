/**
 * Upload handler — saves files to /data/uploads/ (Fly.io persistent disk).
 * No R2, no cloud storage, no presigned URLs.
 * Files are served via /api/file?key=PATH.
 */
import { json, error } from '@sveltejs/kit';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import {
  getStudentSession, getInstructorSession, addFlightMedia, upsertSitePhoto,
  createBill, createPaymentProof, updateStudentProfilePicture, addDebriefingMedia,
  deleteFlightMedia,
} from '$lib/server/db.js';

const UPLOAD_DIR = process.env.DATA_DIR ? join(process.env.DATA_DIR, 'uploads') : '/data/uploads';

function saveFile(buffer, keyPath) {
  const fullPath = join(UPLOAD_DIR, keyPath);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, buffer);
  return `/api/file?key=${encodeURIComponent(keyPath)}`;
}

function makeKey(prefix, filename) {
  const ext  = (filename.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rand = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}/${rand}.${ext}`;
}

export async function POST({ request, cookies }) {
  const stok = cookies.get('student_session');
  const itok = cookies.get('instructor_session');
  const student    = stok ? getStudentSession(stok)    : null;
  const instructor = itok ? getInstructorSession(itok) : null;

  let form;
  try { form = await request.formData(); }
  catch(e) { throw error(400, 'Cannot parse form: ' + e.message); }

  const file    = form.get('file');
  const purpose = String(form.get('purpose') || 'flight_media');
  if (!file || typeof file === 'string') throw error(400, 'No file received');

  const buffer = Buffer.from(await file.arrayBuffer());

  // ── flight_media — public, no auth ──────────────────────────────────────
  if (purpose === 'flight_media') {
    const flightId = Number(form.get('flight_id'));
    if (!flightId) throw error(400, 'Missing flight_id');
    try {
      const key = makeKey(`flights/${flightId}`, file.name);
      const url = saveFile(buffer, key);
      const mt  = file.type?.startsWith('video') ? 'video' : 'photo';
      const id  = addFlightMedia({ flight_id: flightId, student_id: student?.student_id||null, type: mt, r2_key: '', url, caption: '' });
      return json({ ok: true, id, url });
    } catch(e) { console.error('[upload flight_media]', e); throw error(500, e.message); }
  }

  if (!student && !instructor) throw error(401, 'Not authenticated');

  if (purpose === 'profile_picture') {
    if (!student) throw error(403, 'Student only');
    try {
      const key = makeKey(`avatars/${student.student_id}`, file.name);
      const url = saveFile(buffer, key);
      updateStudentProfilePicture(student.student_id, url);
      return json({ ok: true, url });
    } catch(e) { throw error(500, e.message); }
  }

  if (purpose === 'site_photo') {
    if (!instructor) throw error(403, 'Instructor only');
    const site_key = String(form.get('site_key')||'');
    if (!site_key) throw error(400, 'Missing site_key');
    try {
      const key  = makeKey('sites', file.name);
      const url  = saveFile(buffer, key);
      upsertSitePhoto({ site_key, site_type: String(form.get('site_type')||'launch'), filename: file.name, url, r2_key: '', uploaded_by: instructor.instructor_id });
      return json({ ok: true, url });
    } catch(e) { throw error(500, e.message); }
  }

  if (purpose === 'bill') {
    if (!instructor) throw error(403, 'Instructor only');
    const student_id = Number(form.get('student_id'));
    if (!student_id) throw error(400, 'Missing student_id');
    try {
      const key   = makeKey(`bills/${student_id}`, file.name);
      const url   = saveFile(buffer, key);
      const title = String(form.get('title') || file.name);
      const id    = createBill({ student_id, title, filename: file.name, url, r2_key: '', uploaded_by: instructor.instructor_id });
      return json({ ok: true, id, url });
    } catch(e) { throw error(500, e.message); }
  }

  if (purpose === 'payment_proof') {
    const payment_id = Number(form.get('payment_id'));
    if (!payment_id) throw error(400, 'Missing payment_id');
    try {
      const key = makeKey('payments', file.name);
      const url = saveFile(buffer, key);
      createPaymentProof({ payment_id, filename: file.name, url, r2_key: '' });
      return json({ ok: true, url });
    } catch(e) { throw error(500, e.message); }
  }

  if (purpose === 'debriefing_media') {
    if (!instructor) throw error(403, 'Instructor only');
    const debriefing_id = Number(form.get('debriefing_id'));
    if (!debriefing_id) throw error(400, 'Missing debriefing_id');
    try {
      const mt  = file.type?.startsWith('video') ? 'video' : 'photo';
      const key = makeKey('debriefings', file.name);
      const url = saveFile(buffer, key);
      const id  = addDebriefingMedia({ debriefing_id, uploaded_by: instructor.instructor_id, uploader_type: 'instructor', url, r2_key: '', type: mt, caption: '' });
      return json({ ok: true, id, url });
    } catch(e) { throw error(500, e.message); }
  }

  // ── library (study guide PDFs) ──────────────────────────────────────────
  if (purpose === 'library') {
    const key = makeKey('library', file.name);
    const url = saveFile(buffer, key);
    return json({ ok: true, url, key });
  }

  throw error(400, `Unknown purpose: ${purpose}`);
}

export async function DELETE({ url: reqUrl, cookies }) {
  const stok = cookies.get('student_session');
  const itok = cookies.get('instructor_session');
  const student    = stok ? getStudentSession(stok)    : null;
  const instructor = itok ? getInstructorSession(itok) : null;
  // Students can delete their own media; instructors can delete any
  if (!student && !instructor) throw error(401, 'Not authenticated');
  const id = Number(reqUrl.searchParams.get('id'));
  try {
    deleteFlightMedia(id, instructor ? null : student?.student_id);
    return json({ ok: true });
  } catch(e) {
    return json({ ok: false, error: e.message });
  }
}
