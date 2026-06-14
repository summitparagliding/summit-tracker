import { json, error } from '@sveltejs/kit';
import {
  getStudentSession, getWaiverDocuments, recordWaiverSignature,
  markWaiverEmailed, hasSignedAllWaivers, getSetting, getStudent
} from '$lib/server/db.js';
import { saveBuffer, readByUrl, keyFor } from '$lib/server/storage.js';
import { buildSignedWaiverPdf } from '$lib/server/waiverpdf.js';
import { sendEmail } from '$lib/server/email.js';

export async function POST({ request, cookies }) {
  const tok  = cookies.get('student_session');
  const sess = tok ? getStudentSession(tok) : null;
  if (!sess) throw error(401, 'Not authenticated');

  const body = await request.json().catch(() => ({}));
  if (body.action !== 'sign') throw error(400, 'Unknown action');

  const slot       = Number(body.slot);
  const signedName = (body.signed_name || '').trim();
  const sigDataUrl = body.signature || '';
  if (!slot || !signedName) throw error(400, 'Name required');

  const doc = getWaiverDocuments().find(d => d.slot === slot);
  if (!doc || !doc.file_url) throw error(404, 'Waiver not found');

  // Drawn signature -> PNG on disk
  let sigBytes = null, sigUrl = null;
  if (sigDataUrl.startsWith('data:image')) {
    sigBytes = Buffer.from(sigDataUrl.split(',')[1] || '', 'base64');
    sigUrl = saveBuffer(keyFor(`waivers/signatures/${sess.student_id}`, 'sig.png'), sigBytes);
  }

  const student = getStudent(sess.student_id) || {};
  const signedAt = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' });

  // Build the signed PDF (template + signature page)
  const templateBytes = readByUrl(doc.file_url);
  let signedPdfUrl = null, pdfBytes = null;
  try {
    pdfBytes = await buildSignedWaiverPdf({
      templateBytes,
      waiverTitle: doc.title || `Waiver ${slot}`,
      signedName,
      studentEmail: student.email || '',
      signaturePngBytes: sigBytes,
      signedAt
    });
    signedPdfUrl = saveBuffer(keyFor(`waivers/signed/${sess.student_id}`, `waiver-${slot}.pdf`), Buffer.from(pdfBytes));
  } catch (e) { console.error('[waiver pdf]', e.message); }

  const sigId = recordWaiverSignature({
    student_id: sess.student_id, slot, waiver_version: doc.version || 1,
    signed_name: signedName, signature_url: sigUrl, signed_pdf_url: signedPdfUrl
  });

  // Email to school (always) + club (for school_club waivers)
  try {
    const school = getSetting('school_email', '');
    const club   = getSetting('club_email', '');
    const to = [school];
    if (doc.recipients === 'school_club' && club) to.push(club);
    if (to.filter(Boolean).length && pdfBytes) {
      const safe = s => String(s).replace(/[^a-z0-9]+/gi, '-');
      const r = await sendEmail({
        to,
        from: getSetting('from_email', '') || undefined,
        subject: `Signed waiver — ${doc.title || 'Waiver ' + slot} — ${signedName}`,
        html: `<p><strong>${signedName}</strong> signed <strong>${doc.title || 'Waiver ' + slot}</strong> on ${signedAt}.</p><p>The signed PDF is attached.</p>`,
        attachments: [{ filename: `${safe(doc.title || 'waiver-' + slot)}-${safe(signedName)}.pdf`, content: Buffer.from(pdfBytes).toString('base64') }]
      });
      if (r.ok) markWaiverEmailed(sigId);
    }
  } catch (e) { console.error('[waiver email]', e.message); }

  return json({ ok: true, signed_all: hasSignedAllWaivers(sess.student_id) });
}
