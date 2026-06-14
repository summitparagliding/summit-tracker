// Small disk-storage helper for waivers, matching the /data/uploads + /api/file scheme.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

const DATA_ROOT  = process.env.DATA_DIR || '/data';
const UPLOAD_DIR = join(DATA_ROOT, 'uploads');

export function saveBuffer(keyPath, buffer) {
  const full = join(UPLOAD_DIR, keyPath);
  const dir  = dirname(full);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(full, buffer);
  return `/api/file?key=${encodeURIComponent(keyPath)}`;
}

export function readByUrl(fileUrl) {
  if (!fileUrl) return null;
  try {
    const m = fileUrl.match(/[?&]key=([^&]+)/);
    const raw = m ? decodeURIComponent(m[1]) : fileUrl;
    const key = raw.replace(/\.\./g, '').replace(/^\/+/, '');
    const full = join(UPLOAD_DIR, key);
    return existsSync(full) ? readFileSync(full) : null;
  } catch (e) { return null; }
}

export function keyFor(prefix, filename) {
  const ext = (String(filename).split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}
