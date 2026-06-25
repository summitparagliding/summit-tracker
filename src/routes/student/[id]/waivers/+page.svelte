<script>
  import { lang } from '$lib/stores/lang.js';
  import { goto, invalidateAll } from '$app/navigation';
  export let data;
  $: L = $lang === 'fr';

  let openSlot = data.waivers.find(w => !w.signed)?.slot ?? null;
  let names = {};        // slot -> typed name
  let agreed = {};       // slot -> checkbox
  let busy = false;
  let errorMsg = '';

  // signature canvas state (one active canvas at a time)
  let canvasEls = {};
  let drawing = false;
  let hasInk = {};

  function startDraw(e, slot) {
    drawing = true; hasInk[slot] = true; hasInk = hasInk;
    draw(e, slot, true);
  }
  function draw(e, slot, isStart=false) {
    if (!drawing && !isStart) return;
    const canvas = canvasEls[slot]; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const pt = (e.touches && e.touches[0]) || e;
    const x = (pt.clientX - rect.left) * (canvas.width / rect.width);
    const y = (pt.clientY - rect.top) * (canvas.height / rect.height);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#003C4E';
    if (isStart) { ctx.beginPath(); ctx.moveTo(x, y); }
    else { ctx.lineTo(x, y); ctx.stroke(); }
  }
  function endDraw() { drawing = false; }
  function clearSig(slot) {
    const c = canvasEls[slot]; if (!c) return;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    hasInk[slot] = false; hasInk = hasInk;
  }

  async function sign(w) {
    errorMsg = '';
    const name = (names[w.slot] || '').trim();
    if (!name) { errorMsg = L ? 'Veuillez écrire votre nom complet.' : 'Please type your full name.'; return; }
    if (!hasInk[w.slot]) { errorMsg = L ? 'Veuillez signer dans la case.' : 'Please draw your signature.'; return; }
    if (!agreed[w.slot]) { errorMsg = L ? 'Veuillez cocher la case d\'acceptation.' : 'Please check the agreement box.'; return; }
    const sig = canvasEls[w.slot].toDataURL('image/png');
    busy = true;
    try {
      const res = await fetch('/api/waiver', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign', slot: w.slot, signed_name: name, signature: sig })
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { errorMsg = out.message || (L ? 'Échec. Réessayez.' : 'Failed. Try again.'); return; }
      if (out.signed_all) { await goto(`/student/${data.studentId}`); return; }
      await invalidateAll();
      openSlot = data.waivers.find(x => !x.signed && x.slot !== w.slot)?.slot ?? null;
    } catch (e) {
      errorMsg = L ? 'Erreur réseau.' : 'Network error.';
    } finally { busy = false; }
  }
</script>

<svelte:head><title>{L ? 'Décharges' : 'Waivers'} — Summit</title></svelte:head>

<div class="wv-wrap">
  <div class="wv-head">
    <h1>{L ? 'Décharges' : 'Waivers'}</h1>
    <p class="wv-sub">{L
      ? 'Vous devez lire et signer les décharges obligatoires avant d\'accéder à l\'application. La décharge optionnelle peut être signée plus tard si elle s\'applique à vous.'
      : 'You must read and sign the required waivers before using the app. The optional waiver can be signed later if it applies to you.'}</p>
  </div>

  {#if !data.waivers.length}
    <div class="wv-empty">{L ? 'Aucune décharge configurée. Vous pouvez continuer.' : 'No waivers configured. You may continue.'}
      <button class="wv-btn" on:click={()=>goto(`/student/${data.studentId}`)}>{L?'Continuer':'Continue'}</button>
    </div>
  {/if}

  {#each data.waivers as w (w.slot)}
  <div class="wv-card" class:done={w.signed}>
    <button class="wv-cardhead" on:click={()=>openSlot = openSlot===w.slot ? null : w.slot}>
      <span class="wv-status" class:ok={w.signed} class:opt={w.optional && !w.signed}>{w.signed ? '✓' : (w.optional ? '○' : w.slot)}</span>
      <span class="wv-title">{w.title}{#if w.optional}<span class="wv-opt xs"> · {L?'optionnelle':'optional'}</span>{/if}</span>
      <span class="wv-tag xs">{w.signed ? (L?'Signée':'Signed') : (w.optional ? (L?'Optionnel':'Optional') : (L?'À signer':'To sign'))}</span>
    </button>

    {#if openSlot===w.slot && !w.signed}
    <div class="wv-body">
      <div class="wv-pdf">
        <iframe src={w.file_url} title={w.title}></iframe>
        <a class="wv-open xs" href={w.file_url} target="_blank" rel="noopener">{L?'Ouvrir le PDF':'Open PDF'} ↗</a>
      </div>

      <label class="wv-field">
        <span class="xs">{L?'Nom légal complet':'Full legal name'}</span>
        <input type="text" bind:value={names[w.slot]} placeholder={L?'Prénom Nom':'First Last'} />
      </label>

      <div class="wv-field">
        <span class="xs">{L?'Signature':'Signature'}</span>
        <canvas
          bind:this={canvasEls[w.slot]} width="600" height="160" class="wv-canvas"
          on:pointerdown={(e)=>{e.preventDefault();startDraw(e,w.slot);}}
          on:pointermove={(e)=>{e.preventDefault();draw(e,w.slot);}}
          on:pointerup={endDraw} on:pointerleave={endDraw}
        ></canvas>
        <button type="button" class="wv-clear xs" on:click={()=>clearSig(w.slot)}>{L?'Effacer':'Clear'}</button>
      </div>

      <label class="wv-check">
        <input type="checkbox" bind:checked={agreed[w.slot]} />
        <span class="xs">{L
          ? 'J\'ai lu, compris et j\'accepte les termes de cette décharge.'
          : 'I have read, understood and agree to the terms of this waiver.'}</span>
      </label>

      {#if errorMsg}<div class="wv-err xs">{errorMsg}</div>{/if}
      <button class="wv-btn" on:click={()=>sign(w)} disabled={busy}>
        {busy ? (L?'Envoi…':'Submitting…') : (L?'Signer et soumettre':'Sign & submit')}
      </button>
    </div>
    {/if}
  </div>
  {/each}
</div>

<style>
  :global(body){background:#060d16}
  .wv-wrap{max-width:680px;margin:0 auto;padding:1.25rem 1rem 3rem;color:#e6edf3;font-family:Arial,Helvetica,sans-serif}
  .wv-head h1{font-size:1.4rem;margin:0 0 .35rem;color:#00E8C6}
  .wv-sub{font-size:.9rem;opacity:.75;margin:0 0 1.25rem}
  .wv-empty{background:#0e1b2a;border:1px solid #1c3147;border-radius:12px;padding:1.25rem;text-align:center}
  .wv-card{background:#0e1b2a;border:1px solid #1c3147;border-radius:12px;margin-bottom:.75rem;overflow:hidden}
  .wv-card.done{opacity:.7}
  .wv-cardhead{display:flex;align-items:center;gap:.65rem;width:100%;background:none;border:none;color:#e6edf3;padding:.85rem .9rem;cursor:pointer;text-align:left}
  .wv-status{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#1c3147;color:#9fb4c7;font-weight:800;font-size:.85rem;flex-shrink:0}
  .wv-status.ok{background:#00E8C6;color:#003C4E}
  .wv-title{font-family:var(--ff-head);font-weight:700;flex:1}
  .wv-tag{opacity:.6}
  .wv-status.opt{background:transparent;border:1.5px dashed var(--border);color:var(--txt-3)}
  .wv-opt{color:var(--txt-3);font-weight:600;font-style:italic}
  .wv-body{padding:0 .9rem 1rem;display:flex;flex-direction:column;gap:.85rem}
  .wv-pdf{position:relative}
  .wv-pdf iframe{width:100%;height:340px;border:1px solid #1c3147;border-radius:8px;background:#fff}
  .wv-open{display:inline-block;margin-top:.35rem;color:#00E8C6;text-decoration:none}
  .wv-field{display:flex;flex-direction:column;gap:.3rem}
  .wv-field input[type=text]{background:#081320;border:1px solid #1c3147;border-radius:8px;padding:.6rem .7rem;color:#e6edf3;font-size:1rem}
  .wv-canvas{width:100%;height:160px;background:#fff;border:1px solid #1c3147;border-radius:8px;touch-action:none;cursor:crosshair}
  .wv-clear{align-self:flex-end;background:none;border:none;color:#9fb4c7;cursor:pointer;text-decoration:underline}
  .wv-check{display:flex;align-items:flex-start;gap:.5rem;cursor:pointer}
  .wv-check input{margin-top:.15rem;width:18px;height:18px;flex-shrink:0}
  .wv-err{color:#ff7676}
  .wv-btn{background:#00E8C6;color:#003C4E;border:none;border-radius:9px;padding:.7rem 1rem;font-weight:800;font-size:.95rem;cursor:pointer}
  .wv-btn:disabled{opacity:.6;cursor:default}
</style>
