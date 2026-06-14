// Email via Resend REST API. No-ops gracefully if RESEND_API_KEY is not set,
// so signing still works (waiver is recorded + downloadable) even before the
// key is configured in Fly secrets.
export async function sendEmail({ to, from, subject, html, attachments }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: 'RESEND_API_KEY not set' };

  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return { ok: false, skipped: true, reason: 'no recipients' };

  const fromAddr = from || process.env.WAIVER_FROM_EMAIL || 'Summit Paragliding <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddr, to: recipients, subject, html, attachments })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
