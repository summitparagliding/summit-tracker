import { readFileSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';

const DATA_ROOT  = process.env.DATA_DIR || '/data';
const UPLOAD_DIR = join(DATA_ROOT, 'uploads');
const BILLS_DIR  = join(DATA_ROOT, 'uploads', 'bills');

function guessType(key) {
  const ext = (key.split('.').pop() || '').toLowerCase().split('?')[0];
  return ({ jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif',
    webp:'image/webp', heic:'image/heic', heif:'image/heif', avif:'image/avif',
    mp4:'video/mp4', mov:'video/mp4', webm:'video/webm', avi:'video/x-msvideo',
    pdf:'application/pdf', txt:'text/plain',
  })[ext] || 'application/octet-stream';
}

export async function GET({ url, request }) {
  const key = url.searchParams.get('key');
  const dl  = url.searchParams.get('dl') === '1';
  if (!key) return txt('Missing ?key=', 400);

  const safePath = key.replace(/\.\./g, '').replace(/^\/+/, '');
  // bills/ subdirectory served from DATA_ROOT/uploads/bills/
  const filePath = safePath.startsWith('bills/')
    ? join(BILLS_DIR, safePath.slice(6))
    : join(UPLOAD_DIR, safePath);
  const filename = basename(safePath);
  const ct = guessType(safePath);

  // ── Local disk (primary) ────────────────────────────────────────────────
  if (existsSync(filePath)) {
    try {
      const buf  = readFileSync(filePath);
      const stat = statSync(filePath);
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type':        ct,
          'Content-Length':      String(stat.size),
          'Cache-Control':       'private, max-age=7200',
          'Accept-Ranges':       'bytes',
          'Content-Disposition': dl ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`,
        },
      });
    } catch(e) {
      return txt(`Read error: ${e.message}`, 500);
    }
  }

  // ── R2 fallback (for older uploads) ─────────────────────────────────────
  const ACCT = process.env.R2_ACCOUNT_ID || '';
  const BKT  = process.env.R2_BUCKET_NAME || '';
  const AK   = process.env.R2_ACCESS_KEY_ID || '';
  const SK   = process.env.R2_SECRET_ACCESS_KEY || '';

  if (ACCT && BKT && AK && SK) {
    try {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({ region:'auto', endpoint:`https://${ACCT}.r2.cloudflarestorage.com`, credentials:{accessKeyId:AK,secretAccessKey:SK} });
      const r  = await s3.send(new GetObjectCommand({ Bucket:BKT, Key:safePath }));
      const bytes = await r.Body.transformToByteArray();
      return new Response(bytes, {
        headers: {
          'Content-Type':        r.ContentType || ct,
          'Cache-Control':       'private, max-age=7200',
          'Content-Disposition': dl ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`,
        }
      });
    } catch(e) {
      console.error('[file] R2 miss:', e.message);
    }
  }

  return txt(`File not found.\nSearched: ${filePath}\nR2 configured: ${!!(ACCT && BKT)}`, 404);
}

function txt(msg, status) {
  return new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
