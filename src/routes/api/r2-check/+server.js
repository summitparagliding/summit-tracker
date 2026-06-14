/** GET /api/r2-check — shows R2 configuration status. Share with instructor to debug. */
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function GET() {
  const ACCT   = process.env.R2_ACCOUNT_ID        || '';
  const BUCKET = process.env.R2_BUCKET_NAME       || '';
  const AK     = process.env.R2_ACCESS_KEY_ID     || '';
  const SK     = process.env.R2_SECRET_ACCESS_KEY || '';

  const lines = [
    '=== R2 Configuration Check ===',
    '',
    `R2_ACCOUNT_ID:        ${ACCT ? '✓ set (' + ACCT.slice(0,8) + '...)' : '✗ MISSING'}`,
    `R2_BUCKET_NAME:       ${BUCKET ? '✓ ' + BUCKET : '✗ MISSING'}`,
    `R2_ACCESS_KEY_ID:     ${AK ? '✓ set (' + AK.slice(0,8) + '...)' : '✗ MISSING'}`,
    `R2_SECRET_ACCESS_KEY: ${SK ? '✓ set' : '✗ MISSING'}`,
    '',
  ];

  if (!ACCT || !BUCKET || !AK || !SK) {
    lines.push('❌ R2 is NOT fully configured. Set missing secrets:');
    if (!ACCT)   lines.push('  fly secrets set R2_ACCOUNT_ID=<cloudflare-account-id>');
    if (!BUCKET) lines.push('  fly secrets set R2_BUCKET_NAME=<bucket-name>');
    if (!AK)     lines.push('  fly secrets set R2_ACCESS_KEY_ID=<token-id>');
    if (!SK)     lines.push('  fly secrets set R2_SECRET_ACCESS_KEY=<token-secret>');
    return new Response(lines.join('\n'), { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  // Try a real list to verify credentials + endpoint
  try {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCT}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: AK, secretAccessKey: SK },
    });
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 3 }));
    lines.push(`✅ R2 connection successful!`);
    lines.push(`   Bucket: ${BUCKET}`);
    lines.push(`   Objects (up to 3): ${(r.Contents||[]).map(o => o.Key).join(', ') || '(empty bucket)'}`);
  } catch(e) {
    lines.push(`❌ R2 connection FAILED: ${e.message}`);
    lines.push('');
    lines.push('Common fixes:');
    lines.push('  - R2_ACCOUNT_ID should be your Cloudflare account ID (not the R2 token)');
    lines.push('  - R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are from an R2 API Token');
    lines.push('    (Cloudflare dashboard → R2 → Manage API Tokens)');
    lines.push('  - R2_BUCKET_NAME must match exactly');
  }

  return new Response(lines.join('\n'), { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
