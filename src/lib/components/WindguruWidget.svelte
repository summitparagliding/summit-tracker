<script>
  import { onMount } from 'svelte';

  export let lang = 'fr';
  export let spotId = 246726;     // Mont Yamaska
  export let model = 3;            // m=3 = GFS 13km (NAM not offered by Windguru public widget)
  export let embedUrl = '';        // optional account distr_iframe URL

  let host;
  let showFallback = false;
  $: directUrl = `https://www.windguru.cz/${spotId}`;
  $: useIframe = embedUrl && embedUrl.includes('windguru');

  onMount(() => {
    if (useIframe || typeof window === 'undefined') return;

    const uid = `wg_fwdg_${spotId}_${model}_${Date.now()}`;
    host.innerHTML = `<div id="${uid}"></div>`;

    const arg = [
      `s=${spotId}`, `m=${model}`, `uid=${uid}`,
      'wj=km', 'tj=c', 'waj=m', 'tij=cm',
      'odh=0', 'doh=24', 'fhours=72', 'hrsm=2',
      'vt=forecasts', `lng=${lang === 'fr' ? 'fr' : 'en'}`,
      'idbs=1', 'p=WINDSPD,GUST,SMER,TMPE,APCP1s,RATING'
    ];

    const script = document.createElement('script');
    script.src = 'https://www.windguru.cz/js/widget.php?' + arg.join('&');
    script.async = true;
    script.onerror = () => { showFallback = true; };
    host.appendChild(script);

    // If no table appears within 13s, show the fallback link
    let tries = 0;
    const poll = setInterval(() => {
      if (host.querySelector('table')) { clearInterval(poll); }
      else if (++tries > 26) { showFallback = true; clearInterval(poll); }
    }, 500);
    return () => clearInterval(poll);
  });
</script>

<div class="wg-wrap">
  <div class="wg-hdr">
    <div class="wg-title-row">
      <svg viewBox="0 0 20 16" width="16" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M1 4 Q5 1 10 4 Q15 7 19 4"/><path d="M1 9 Q5 6 10 9 Q15 12 19 9"/>
      </svg>
      <span class="wg-title xs">Windguru — Mont Yamaska</span>
    </div>
    <a href={directUrl} target="_blank" rel="noopener" class="xs ext-link">
      {lang === 'fr' ? 'Ouvrir ↗' : 'Open ↗'}
    </a>
  </div>

  {#if useIframe}
    <div class="wg-iframe-box">
      <iframe src={embedUrl} title="Windguru Mont Yamaska" class="wg-iframe" loading="lazy" scrolling="auto"></iframe>
    </div>
  {:else}
    <!-- Windguru's table is styled for a WHITE background — force it so it's never "black" -->
    <div class="wg-host-box">
      <div class="wg-host" bind:this={host}></div>
    </div>
    {#if showFallback}
      <a href={directUrl} target="_blank" rel="noopener" class="wg-fallback xs">
        {lang==='fr'?'Le widget ne s’est pas chargé — ouvrir Windguru directement →':'Widget did not load — open Windguru directly →'}
      </a>
    {/if}
  {/if}
</div>

<style>
  .wg-wrap{display:flex;flex-direction:column;gap:.4rem}
  .wg-hdr{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.3rem}
  .wg-title-row{display:flex;align-items:center;gap:.35rem;color:var(--txt-2)}
  .wg-title{font-weight:700;color:var(--txt-2)}
  .ext-link{color:var(--teal);text-decoration:none;border:1px solid rgba(0,184,122,.3);border-radius:5px;padding:.15rem .4rem}
  .wg-iframe-box{border-radius:10px;overflow:hidden;border:1px solid var(--border);background:#fff}
  .wg-iframe{width:100%;height:430px;display:block;border:none}
  /* WHITE background so the Windguru table is readable — this fixes the "always black" box */
  .wg-host-box{border-radius:10px;overflow:auto;border:1px solid var(--border);background:#ffffff;min-height:120px;padding:4px}
  .wg-host{width:100%}
  .wg-host :global(table){width:100% !important;font-size:11px;color:#222}
  .wg-fallback{display:block;text-align:center;padding:.5rem;color:var(--teal);text-decoration:none}
  .xs{font-size:.75rem} .muted{color:var(--txt-3)}
</style>
