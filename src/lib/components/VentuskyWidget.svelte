<script>
  export let lat  = 45.472332;
  export let lon  = -72.882132;
  export let lang = 'fr';
  export let zoom = 9;

  // IMPORTANT: compute the URL ONCE as a plain const, not a reactive $: statement.
  // Reactive src is set by Svelte AFTER mount, which can leave the Ventusky map
  // uninitialized (known iframe behaviour). A static src is present at first render.
  const src = `https://embed.ventusky.com/?p=${lat};${lon};${zoom}&l=wind&m=nam&w=soft`;
  const openUrl = `https://www.ventusky.com/?p=${lat};${lon};${zoom}&l=wind&m=nam`;
</script>

<div class="vt-wrap">
  <div class="vt-hdr">
    <div class="vt-title-row">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
      </svg>
      <span class="vt-title xs">Ventusky — {lang==='fr'?'Carte des vents':'Wind map'}</span>
      <span class="xs model-tag">NAM 2.5km</span>
    </div>
    <a href={openUrl} target="_blank" rel="noopener" class="xs ext-link">
      {lang === 'fr' ? 'Plein écran ↗' : 'Fullscreen ↗'}
    </a>
  </div>

  <div class="vt-box">
    <iframe
      title="Ventusky NAM wind map Mont Yamaska"
      src={src}
      width="100%"
      height="400"
      frameborder="0"
      allow="fullscreen"
    ></iframe>
  </div>

  <div class="xs muted" style="margin-top:.25rem;text-align:center">
    {lang==='fr'
      ? 'Carte interactive — modèle NAM 2.5km. Si rien ne s’affiche, touchez « Plein écran ».'
      : 'Interactive map — NAM 2.5km model. If nothing shows, tap “Fullscreen”.'}
  </div>
</div>

<style>
  .vt-wrap{display:flex;flex-direction:column;gap:.4rem}
  .vt-hdr{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.3rem}
  .vt-title-row{display:flex;align-items:center;gap:.35rem;color:var(--txt-2)}
  .vt-title{font-weight:700;color:var(--txt-2)}
  .model-tag{background:rgba(0,184,122,.12);color:var(--teal);border-radius:4px;padding:.1rem .35rem;font-weight:700;letter-spacing:.04em}
  .ext-link{color:var(--teal);text-decoration:none;border:1px solid rgba(0,184,122,.3);border-radius:5px;padding:.15rem .4rem}
  .vt-box{border-radius:10px;overflow:hidden;border:1px solid var(--border);background:#0a0a16;line-height:0}
  .vt-box iframe{display:block;width:100%;height:400px;border:none}
  .xs{font-size:.75rem} .muted{color:var(--txt-3)}
</style>
