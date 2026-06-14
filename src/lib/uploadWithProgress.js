/**
 * Upload a file with real-time progress tracking.
 * Returns a Promise that resolves with the parsed JSON response.
 * The onProgress callback receives a 0-100 number.
 */
export function uploadWithProgress(url, formData, { onProgress, method = 'POST' } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      const isHttpOk = xhr.status >= 200 && xhr.status < 300;
      try {
        const json = JSON.parse(xhr.responseText);
        // Reject on explicit ok:false even at HTTP 200 — bills used to silently fail this way
        if (isHttpOk && json?.ok === false) {
          reject(new Error(json?.error || json?.err || 'Server returned ok=false'));
        } else if (isHttpOk) {
          resolve(json);
        } else {
          reject(new Error(json?.error || json?.err || `HTTP ${xhr.status}`));
        }
      } catch(e) {
        if (isHttpOk) {
          // Non-JSON response (e.g. SvelteKit form action result format)
          resolve({ ok: true });
        } else {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Erreur réseau')));
    xhr.addEventListener('abort', () => reject(new Error('Upload annulé')));

    xhr.open(method, url);
    xhr.send(formData);
  });
}

/**
 * Svelte-friendly upload component helper.
 * Usage in a component:
 *   import { createUploader } from '$lib/uploadWithProgress.js';
 *   const { upload, progress, uploading, error } = createUploader();
 *   await upload('/api/student-bill', formData);
 */
export function createUploader() {
  let progress  = $state(0);
  let uploading = $state(false);
  let error     = $state('');

  async function upload(url, formData, onDone) {
    uploading = true;
    error     = '';
    progress  = 0;
    try {
      const result = await uploadWithProgress(url, formData, {
        onProgress: (p) => { progress = p; }
      });
      progress = 100;
      if (onDone) onDone(result);
      return result;
    } catch(e) {
      error = e.message;
      return null;
    } finally {
      uploading = false;
    }
  }

  return { upload, get progress() { return progress; }, get uploading() { return uploading; }, get error() { return error; } };
}
