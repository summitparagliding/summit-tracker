<script>
  import { createEventDispatcher } from 'svelte';
  export let flightId;
  export let lang = 'fr';
  const dispatch = createEventDispatcher();

  let files = [];
  let caption = '';
  let uploading = false;
  let error = '';
  let progress = 0;

  const L = {
    addMedia: lang==='fr' ? 'Ajouter photo / vidéo' : 'Add photo / video',
    caption:  lang==='fr' ? 'Légende (optionnel)' : 'Caption (optional)',
    upload:   lang==='fr' ? 'Téléverser' : 'Upload',
    uploading:lang==='fr' ? 'Téléversement...' : 'Uploading...',
    success:  lang==='fr' ? 'Média ajouté !' : 'Media added!',
  };

  async function handleUpload() {
    if (!files.length) return;
    uploading = true;
    error = '';
    progress = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append('file', file);
        fd.append('flight_id', flightId);
        fd.append('type', file.type.startsWith('video') ? 'video' : 'photo');
        fd.append('caption', caption);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Upload failed');
        progress = Math.round(((i+1)/files.length)*100);
        dispatch('uploaded', { url: data.url, id: data.id, type: file.type.startsWith('video') ? 'video' : 'photo', caption });
      }
      files = [];
      caption = '';
    } catch(e) {
      error = e.message;
    } finally {
      uploading = false;
    }
  }
</script>

<div class="mu-wrap">
  <div class="mu-title">{L.addMedia}</div>
  <div class="mu-inputs">
    <input type="file" accept="image/*,video/*" multiple
      on:change={e => files = [...e.target.files]}
      class="mu-file" />
    {#if files.length}
      <input type="text" bind:value={caption} placeholder={L.caption} class="mu-cap" />
      <button class="btn btn-primary btn-sm" on:click={handleUpload} disabled={uploading}>
        {uploading ? `${L.uploading} ${progress}%` : `${L.upload} (${files.length})`}
      </button>
    {/if}
  </div>
  {#if error}<div class="mu-err">{error}</div>{/if}
</div>

<style>
  .mu-wrap{background:var(--bg-raised);border-radius:8px;padding:.75rem;margin-top:.75rem}
  .mu-title{font-family:var(--ff-head);font-size:.75rem;font-weight:600;color:var(--txt-2);margin-bottom:.5rem}
  .mu-inputs{display:flex;flex-direction:column;gap:.4rem}
  .mu-file{font-size:.8rem;color:var(--txt-2)}
  .mu-cap{background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.35rem .5rem;color:var(--txt);font-size:.85rem}
  .mu-err{color:var(--red);font-size:.78rem;margin-top:.3rem}
</style>
