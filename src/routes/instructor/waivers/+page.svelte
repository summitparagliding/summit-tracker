<script>
  import { enhance } from '$app/forms';
  import { lang } from '$lib/stores/lang.js';
  export let data;
  export let form;
  $: L = $lang === 'fr';
</script>

<svelte:head><title>{L?'Décharges':'Waivers'} — Summit</title></svelte:head>

<div class="section-label">{L ? 'Décharges' : 'Waivers'}</div>

{#if !data.emailReady}
<div class="warn">
  {L
    ? 'L\'envoi courriel est inactif : ajoutez RESEND_API_KEY dans les secrets Fly pour activer l\'envoi automatique. Les décharges signées restent téléchargeables ci-dessous.'
    : 'Email sending is off: set RESEND_API_KEY in Fly secrets to enable auto-send. Signed waivers are still downloadable below.'}
</div>
{/if}

<!-- Recipient emails -->
<div class="card pad">
  <h3>{L ? 'Destinataires' : 'Recipients'}</h3>
  <form method="POST" action="?/saveEmails" use:enhance>
    <label class="fld"><span>{L?'Courriel de l\'école':'School email'}</span>
      <input name="school_email" type="email" value={data.schoolEmail} placeholder="ecole@summitparagliding.com" /></label>
    <label class="fld"><span>{L?'Courriel du club':'Club email'}</span>
      <input name="club_email" type="email" value={data.clubEmail} placeholder="club@…" /></label>
    <label class="fld"><span>{L?'Adresse d\'envoi (domaine vérifié Resend)':'From address (verified Resend domain)'}</span>
      <input name="from_email" value={data.fromEmail} placeholder="Summit Paragliding <waivers@summitparagliding.com>" /></label>
    <button class="btn-teal">{L?'Enregistrer':'Save'}</button>
    {#if form?.emailsSaved}<span class="ok xs">✓ {L?'Enregistré':'Saved'}</span>{/if}
  </form>
</div>

<!-- The three waiver documents -->
{#each data.docs as d}
<div class="card pad">
  <h3>{L?'Décharge':'Waiver'} {d.slot}{d.file_url ? '' : (L?' — non configurée':' — not set')}</h3>
  <form method="POST" action="?/saveDoc" use:enhance enctype="multipart/form-data">
    <input type="hidden" name="slot" value={d.slot} />
    <label class="fld"><span>{L?'Titre':'Title'}</span>
      <input name="title" value={d.title} placeholder={L?'p. ex. Décharge de responsabilité':'e.g. Liability waiver'} /></label>
    <label class="fld"><span>{L?'Destinataires de la décharge signée':'Who receives the signed waiver'}</span>
      <select name="recipients">
        <option value="school" selected={d.recipients==='school'}>{L?'École seulement':'School only'}</option>
        <option value="school_club" selected={d.recipients==='school_club'}>{L?'École + club':'School + club'}</option>
      </select></label>
    <label class="fld"><span>{L?'Fichier PDF':'PDF file'}{d.file_url ? (L?' (laisser vide pour garder l\'actuel)':' (leave empty to keep current)') : ''}</span>
      <input name="file" type="file" accept="application/pdf" /></label>
    {#if d.file_url}
      <a class="filelink xs" href={d.file_url} target="_blank" rel="noopener">{L?'Voir le PDF actuel':'View current PDF'} ↗ (v{d.version})</a>
    {/if}
    <button class="btn-teal">{L?'Enregistrer la décharge':'Save waiver'}</button>
    {#if form?.savedSlot===d.slot}<span class="ok xs">✓ {L?'Enregistré':'Saved'}</span>{/if}
    {#if form?.err}<span class="err xs">{form.err}</span>{/if}
  </form>
</div>
{/each}

<!-- Signed waivers -->
<div class="section-label" style="margin-top:1.25rem">{L?'Décharges signées':'Signed waivers'} ({data.signed.length})</div>
<div class="card pad">
  {#if !data.signed.length}
    <div class="xs dimmed">{L?'Aucune décharge signée pour l\'instant.':'No signed waivers yet.'}</div>
  {:else}
    {#each data.signed as s}
    <div class="srow">
      <span class="xs" style="min-width:120px;font-weight:700">{s.student_name}</span>
      <span class="xs" style="flex:1;color:var(--txt-3)">{s.waiver_title || ('Waiver '+s.slot)} · {s.signed_name}</span>
      <span class="xs dimmed">{new Date(s.signed_at).toLocaleDateString($lang==='fr'?'fr-CA':'en-CA')}</span>
      {#if s.emailed_at}<span class="xs" style="color:#22c55e" title={L?'Envoyé par courriel':'Emailed'}>✉</span>{/if}
      {#if s.signed_pdf_url}<a class="xs" href={`${s.signed_pdf_url}&dl=1`} style="color:var(--teal)">{L?'PDF':'PDF'}↓</a>{/if}
    </div>
    {/each}
  {/if}
</div>

<style>
  .section-label{font-weight:800;letter-spacing:.04em;margin:.5rem 0 .6rem;color:var(--txt-2)}
  .card.pad{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:.85rem}
  h3{margin:0 0 .7rem;font-size:1rem;color:var(--teal)}
  .fld{display:flex;flex-direction:column;gap:.3rem;margin-bottom:.7rem}
  .fld span{font-size:.78rem;color:var(--txt-3)}
  .fld input, .fld select{background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:.55rem .65rem;color:var(--txt);font-size:.9rem;font-family:inherit}
  .btn-teal{background:var(--teal);color:var(--txt-inv,#003C4E);border:none;border-radius:8px;padding:.55rem 1rem;font-weight:800;font-size:.85rem;cursor:pointer}
  .ok{color:#22c55e;margin-left:.5rem}
  .err{color:#ef4444;margin-left:.5rem}
  .warn{background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);color:#f59e0b;border-radius:10px;padding:.7rem .85rem;margin-bottom:.85rem;font-size:.82rem}
  .filelink{display:inline-block;margin-bottom:.6rem;color:var(--teal)}
  .srow{display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--border)}
  .srow:last-child{border-bottom:none}
</style>
