<script>
  export let lat  = 45.472332;
  export let lon  = -72.882132;
  export let lang = 'fr';
  export let zoom = 9;

  // Standard Windy embed2 URL — the format Windy's own "Share → Embed" dialog produces.
  // Static const (NOT reactive $:) so it's present in the iframe HTML at first paint,
  // which is required for the Windy map engine to initialise inside the frame.
  // overlay=wind, level=surface, product=namConus pins Windy to the NAM model
  // (NAM CONUS, 12 km). Mont Yamaska sits inside the NAM-CONUS domain so it loads.
  const src =
    'https://embed.windy.com/embed2.html' +
    `?lat=${lat}&lon=${lon}` +
    `&detailLat=${lat}&detailLon=${lon}` +
    `&zoom=${zoom}` +
    '&level=surface' +
    '&overlay=wind' +
    '&product=namConus' +
    '&menu=' +
    '&message=true' +
    '&marker=true' +
    '&calendar=now' +
    '&pressure=' +
    '&type=map' +
    '&location=coordinates' +
    '&detail=true' +
    '&metricWind=km%2Fh' +
    '&metricTemp=%C2%B0C' +
    '&radarRange=-1';

  const openUrl = `https://www.windy.com/?namConus,wind,${lat},${lon},${zoom}`;
</script>

<div class="wy-wrap">
  <div class="wy-hdr">
    <div class="wy-title-row">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
      </svg>
      <span class="wy-title xs">Windy — {lang==='fr'?'Carte des vents':'Wind map'}</span>
      <span class="xs model-tag">NAM 12km</span>
    </div>
    <a href={openUrl} target="_blank" rel="noopener" class="xs ext-link">
      {lang === 'fr' ? 'Plein écran ↗' : 'Fullscreen ↗'}
    </a>
  </div>

  <div class="wy-box">
    <iframe
      title="Windy wind map Mont Yamaska"
      src={src}
      width="100%"
      height="420"
      frameborder="0"
    ></iframe>
  </div>

  <div class="xs muted" style="margin-top:.25rem;text-align:center">
    {lang==='fr'
      ? 'Carte interactive du vent — touchez pour explorer, zoomez pour plus de détail.'
      : 'Interactive wind map — tap to explore, zoom in for higher detail.'}
  </div>
</div>

<style>
  .wy-wrap{display:flex;flex-direction:column;gap:.4rem}
  .wy-hdr{font-family:var(--ff-head);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.3rem}
  .wy-title-row{font-family:var(--ff-head);display:flex;align-items:center;gap:.35rem;color:var(--txt-2)}
  .wy-title{font-family:var(--ff-head);font-weight:700;color:var(--txt-2)}
  .model-tag{background:rgba(0,184,122,.12);color:var(--teal);border-radius:4px;padding:.1rem .35rem;font-weight:700;letter-spacing:.04em}
  .ext-link{color:var(--teal);text-decoration:none;border:1px solid rgba(0,184,122,.3);border-radius:5px;padding:.15rem .4rem}
  .wy-box{border-radius:10px;overflow:hidden;border:1px solid var(--border);background:#0a0a16;line-height:0}
  .wy-box iframe{display:block;width:100%;height:420px;border:none}
  .xs{font-size:.75rem} .muted{color:var(--txt-3)}
</style>
