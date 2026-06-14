/**
 * Profile picture upload - delegates to /api/upload with purpose=profile_picture.
 * Kept for backward compatibility.
 */
import { json, error } from '@sveltejs/kit';
import { getStudentSession, updateStudentProfilePicture } from '$lib/server/db.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function POST({ request, cookies }) {
  const tok     = cookies.get('student_session');
  const session = tok ? getStudentSession(tok) : null;
  if (!session) throw error(401, 'Not authenticated');

  const form = await request.formData().catch(e => { throw error(400, 'Form parse error: ' + e.message); });
  const file = form.get('file');
  if (!file || typeof file === 'string') throw error(400, 'No file received');

  const buffer = Buffer.from(await file.arrayBuffer());
  const key    = `avatars/${session.student_id}-${Date.now()}.jpg`;

  if (process.env.R2_ACCOUNT_ID) {
    try {
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId:     process.env.R2_ACCESS_KEY_ID     || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
      });
      await s3.send(new PutObjectCommand({
        Bucket:      process.env.R2_BUCKET_NAME || 'summit-media',
        Key:         key,
        Body:        buffer,
        ContentType: 'image/jpeg',
      }));
      const R2_PUBLIC = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
      const url = R2_PUBLIC ? `${R2_PUBLIC}/${key}` : `/api/file?key=${encodeURIComponent(key)}`;
      updateStudentProfilePicture(session.student_id, url);
      return json({ ok: true, url });
    } catch(e) {
      console.error('[profile-picture] R2 error:', e.message);
    }
  }

  // Fallback: base64 (small images only)
  const url = `data:image/jpeg;base64,${buffer.toString('base64')}`;
  updateStudentProfilePicture(session.student_id, url);
  return json({ ok: true, url });
}
