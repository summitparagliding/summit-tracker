/**
 * Simple upload helper — POSTs to /api/upload which saves to local disk.
 * No R2, no presigned URLs, no CORS issues.
 */
export async function uploadFile(file, { purpose = 'flight_media', meta = {}, onProgress } = {}) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('purpose', purpose);
  Object.entries(meta).forEach(([k, v]) => fd.append(k, String(v)));

  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        resolve(j.ok ? { ok: true, url: j.url, id: j.id } : { ok: false, error: j.error || `HTTP ${xhr.status}` });
      } catch { resolve({ ok: false, error: `HTTP ${xhr.status}: ${xhr.responseText.slice(0,100)}` }); }
    };
    xhr.onerror  = () => resolve({ ok: false, error: 'Network error — check connection' });
    xhr.ontimeout = () => resolve({ ok: false, error: 'Upload timeout — file may be too large' });
    xhr.timeout = 120_000; // 2 minutes
    xhr.open('POST', '/api/upload');
    xhr.send(fd);
  });
}
