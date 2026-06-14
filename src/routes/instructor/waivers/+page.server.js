import { fail } from '@sveltejs/kit';
import { getWaiverDocuments, upsertWaiverDocument, getSetting, setSetting, getAllSignedWaivers } from '$lib/server/db.js';
import { saveBuffer, keyFor } from '$lib/server/storage.js';

export function load() {
  return {
    docs: getWaiverDocuments(),
    schoolEmail: getSetting('school_email', ''),
    clubEmail:   getSetting('club_email', ''),
    fromEmail:   getSetting('from_email', ''),
    emailReady:  !!process.env.RESEND_API_KEY,
    signed: getAllSignedWaivers().slice(0, 200)
  };
}

export const actions = {
  saveDoc: async ({ request }) => {
    const fd = await request.formData();
    const slot = Number(fd.get('slot'));
    if (![1,2,3].includes(slot)) return fail(400, { err: 'Bad slot' });
    const title = String(fd.get('title') || '');
    const recipients = String(fd.get('recipients') || 'school');
    const file = fd.get('file');
    let file_url = null;
    if (file && typeof file !== 'string' && file.size > 0) {
      const isPdf = (file.type || '').includes('pdf') || (file.name || '').toLowerCase().endsWith('.pdf');
      if (!isPdf) return fail(400, { err: 'Please upload a PDF' });
      const buf = Buffer.from(await file.arrayBuffer());
      file_url = saveBuffer(keyFor('waivers/templates', file.name || `waiver-${slot}.pdf`), buf);
    }
    upsertWaiverDocument(slot, { title, file_url, recipients });
    return { ok: true, savedSlot: slot };
  },
  saveEmails: async ({ request }) => {
    const fd = await request.formData();
    setSetting('school_email', String(fd.get('school_email') || ''));
    setSetting('club_email',   String(fd.get('club_email') || ''));
    setSetting('from_email',   String(fd.get('from_email') || ''));
    return { ok: true, emailsSaved: true };
  }
};
