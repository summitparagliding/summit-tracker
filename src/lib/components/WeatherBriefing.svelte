<script>
  import { YAMASKA_LAUNCHES, launchScore, bestLaunchScore, bestLaunch,
           scoreColor, scoreLabel, dirLabel, timeBriefing } from '$lib/launchParams.js';
  export let lang = 'fr';
  export let lat  = 45.472332;
  export let lon  = -72.882132;

  $: L = lang === 'fr';
  let loading  = true;
  let error    = null;
  let wxData   = null;
  let gridOpen = false;
  let model    = null;

  import { onMount } from 'svelte';

  async function fetchData() {
    error = null; loading = true; wxData = null;
    try {
      // Stage 1 — core variables (always supported, no model constraint = best available)
      const coreUrl = '/api/weather?' + new URLSearchParams({
        latitude:        lat,
        longitude:       lon,
        hourly:          'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation_probability',
        timezone:        'America/Toronto',
        forecast_days:   '2',
        models:          'gem_seamless',
        wind_speed_unit: 'kmh',
      });
      let coreRes = await fetch(coreUrl);
      if (!coreRes.ok) coreRes = await fetch(coreUrl.replace('gem_seamless','best_match'));
      if (!coreRes.ok) throw new Error(`HTTP ${coreRes.status}`);
      const coreJson = await coreRes.json();
      if (!coreJson.hourly?.time?.length) throw new Error(coreJson.reason || 'Aucune donnée');

      model = 'Open-Meteo GEM';
      const h = { ...coreJson.hourly };



      wxData = processData(h);
    } catch(e) {
      error = e.message;
    }
    loading = false;
  }

  onMount(fetchData);

  function processData(h) {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
    let idxs = h.time.map((t, i) => t.startsWith(todayStr) ? i : -1).filter(i => i >= 0);
    if (!idxs.length && h.time.length) {
      const first = h.time[0].slice(0, 10);
      idxs = h.time.map((t, i) => t.startsWith(first) ? i : -1).filter(i => i >= 0);
    }
    if (!idxs.length) return null;

    const flyIdxs = idxs.filter(i => {
      const hr = parseInt(h.time[i].slice(11, 13), 10);
      return hr >= 8 && hr <= 21;
    });
    const workIdxs = flyIdxs.length ? flyIdxs : idxs;

    const avg = arr => {
      const v = arr.filter(x => x != null);
      return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
    };

    const hours = workIdxs.map(i => ({
      time:  h.time[i].slice(11, 16),
      spd:   h.wind_speed_10m?.[i],
      dir:   h.wind_direction_10m?.[i],
      gust:  h.wind_gusts_10m?.[i] ?? null,
      precip:h.precipitation_probability?.[i] ?? null,
    }));

    const avgSpd   = avg(hours.map(h => h.spd));
    const peakGust = hours.reduce((m, h) => Math.max(m, h.gust ?? 0), 0);
    const midHr    = hours[Math.floor(hours.length / 2)];
    const domDir   = midHr?.dir;
    const maxPrecip= hours.reduce((m, h) => Math.max(m, h.precip ?? 0), 0);

    const hourScores = hours.map(h => ({
      ...h,
      scores: YAMASKA_LAUNCHES.map(l => ({
        key: l.key, color: l.color,
        pct: launchScore(h.spd, h.dir, h.gust, l, h.precip ?? 0),
      })),
    }));

    const blocks  = timeBriefing(hours, lang);
    const bestPct = bestLaunchScore(avgSpd, domDir, peakGust || null, maxPrecip);
    const bestLch = bestLaunch(avgSpd, domDir, peakGust || null);

    return { avgSpd, peakGust, domDir, maxPrecip, bestPct, bestLch,
             hourScores, blocks, flyWindow: flyIdxs.length > 0 };
  }
</script>

<div class="wb">
  <div class="wb-hdr">
    <span class="wb-title">{L ? 'Analyse météo — Mont Yamaska' : 'Weather analysis — Mont Yamaska'}</span>
    <button class="wb-ref" on:click={fetchData} disabled={loading} title="Refresh">↺</button>
  </div>

  {#if loading}
  <div class="wb-state xs muted"><div class="spin"></div> {L ? 'Chargement…' : 'Loading…'}</div>

  {:else if error}
  <div class="wb-state">
    <span class="xs" style="color:#dc2626">{error}</span>
    <button class="btn btn-xs btn-secondary" on:click={fetchData} style="margin-left:.5rem">
      {L ? 'Réessayer' : 'Retry'}
    </button>
  </div>

  {:else if wxData}
  <!-- Summary pill -->
  <div class="wb-pill" style="border-color:{scoreColor(wxData.bestPct)}50;background:{scoreColor(wxData.bestPct)}12">
    <div class="wb-dot" style="background:{scoreColor(wxData.bestPct)}"></div>
    <div>
      <span class="xs" style="font-weight:700;color:{scoreColor(wxData.bestPct)}">
        {scoreLabel(wxData.bestPct, lang)}
      </span>
      {#if wxData.bestLch}
      <span class="xs muted"> · {wxData.bestLch.key}</span>
      {/if}
      <span class="xs muted">
        · {wxData.avgSpd ?? '—'} km/h {dirLabel(wxData.domDir)}
        {#if wxData.peakGust > 0}, {L ? 'rafales' : 'gusts'} {wxData.peakGust} km/h{/if}
      </span>
    </div>
  </div>

  <!-- Time blocks — structured display -->
  <div class="wb-blocks">
    {#each wxData.blocks as blk}
    {@const col = blk.score != null ? scoreColor(blk.score) : 'var(--border)'}
    <div class="wb-block" style="border-left:3px solid {col}">
      <!-- Block header -->
      <div class="wb-blk-hdr">
        <span class="xs" style="font-weight:700;color:var(--txt-2)">{blk.label}</span>
        {#if blk.score != null}
        <span class="xs" style="font-weight:700;color:{col};margin-left:auto">{blk.score}% · {scoreLabel(blk.score, lang)}</span>
        {/if}
      </div>
      <!-- Wind + gusts -->
      {#if blk.avgSpd != null}
      <div class="wb-blk-row">
        <svg viewBox="0 0 16 14" width="11" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 3 Q4 1 7 3 Q10 5 13 3"/><path d="M1 7 Q4 5 7 7 Q10 9 13 7"/><path d="M1 11 Q4 9 7 11 Q10 13 13 11"/></svg>
        <span class="xs">{L?'Vent':'Wind'}: <b class="mono">{blk.avgSpd} km/h</b>
          {#if blk.dir}<span class="muted"> {blk.dir}</span>{/if}
        </span>
        {#if blk.peakGust && blk.peakGust > blk.avgSpd}
        <span class="xs" style="color:{blk.peakGust > blk.avgSpd * 1.4 ? '#f97316' : 'var(--txt-3)'};margin-left:.4rem">
          {L?'rafales':'gusts'} <b class="mono">{blk.peakGust}</b> km/h
          {#if blk.peakGust > blk.avgSpd * 1.6}
          <span style="color:#ef4444"> ⚠</span>
          {/if}
        </span>
        {/if}
      </div>
      {/if}
      <!-- Precipitation -->
      {#if blk.maxPrecip != null && blk.maxPrecip > 0}
      <div class="wb-blk-row">
        <span class="wb-blk-ico">💧</span>
        <span class="xs" style="color:{blk.maxPrecip > 50 ? '#60a5fa' : 'var(--txt-3)'}">
          {L?'Précip.':'Precip.'}: {blk.maxPrecip}%
          {#if blk.maxPrecip > 60}<span> — {L?'risque de pluie':'rain likely'}</span>{/if}
        </span>
      </div>
      {/if}
      <!-- Best launch -->
      {#if blk.bestLaunch && blk.score >= 38}
      <div class="wb-blk-row">
        <svg viewBox="0 0 16 14" width="11" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 3 Q4 1 7 3 Q10 5 13 3"/><path d="M1 7 Q4 5 7 7 Q10 9 13 7"/><path d="M1 11 Q4 9 7 11 Q10 13 13 11"/></svg>
        <span class="xs" style="color:{blk.bestLaunch.color}">{blk.bestLaunch.key}</span>
      </div>
      {/if}
      <!-- No-go reason -->
      {#if blk.score != null && blk.score < 38}
      <div class="wb-blk-row">
        <span class="xs muted">
          {#if blk.peakGust && blk.peakGust > (blk.avgSpd||0) * 1.5}
            {L ? 'Rafales trop importantes.' : 'Gusts too strong.'}
          {:else if blk.avgSpd > 25}
            {L ? 'Vent trop fort.' : 'Wind too strong.'}
          {:else if blk.avgSpd < 4}
            {L ? 'Vent insuffisant.' : 'Wind too light.'}
          {:else}
            {L ? 'Direction défavorable.' : 'Unfavourable direction.'}
          {/if}
        </span>
      </div>
      {/if}
    </div>
    {/each}
  </div>

  <!-- Hourly per-launch grid — prominent button, collapsed by default -->
  {#if wxData.hourScores.length}
  <button class="wb-prom-btn" on:click={() => gridOpen = !gridOpen}>
    <div class="wb-prom-btn-left">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>
      </svg>
      <span style="font-weight:700">{L ? 'Vérificateur par heure' : 'Hourly checker'}</span>
    </div>
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"
      style="transition:transform .2s;transform:rotate({gridOpen?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
  </button>
  {#if gridOpen}
  <div class="wb-grid-wrap">
    <div class="wb-grid" style="grid-template-columns:72px repeat({wxData.hourScores.length},1fr)">
      <div class="wg-head"></div>
      {#each wxData.hourScores as h}<div class="wg-head xs">{h.time}</div>{/each}

      <!-- BEST-of-launches row: matches the colors used by the 3-day / 7-day forecast cards -->
      <div class="wg-lbl xs" style="font-weight:700;color:var(--teal)">{L ? 'Meilleure note' : 'Best score'}</div>
      {#each wxData.hourScores as h}
        {@const bestPct = Math.max(0, ...h.scores.map(s => s?.pct ?? 0))}
        <div class="wg-score"
          style="background:{scoreColor(bestPct)}1a;border-bottom:2px solid {scoreColor(bestPct)}">
          <span class="xs mono" style="color:{scoreColor(bestPct)};font-weight:700">{bestPct}</span>
        </div>
      {/each}

      <div class="wg-lbl xs muted">{L ? 'Vent km/h' : 'Wind km/h'}</div>
      {#each wxData.hourScores as h}<div class="wg-val xs mono">{h.spd ?? '—'}</div>{/each}

      <div class="wg-lbl xs muted" style="color:#f97316">{L ? 'Rafales' : 'Gusts'}</div>
      {#each wxData.hourScores as h}
        <div class="wg-val xs mono" style="color:{h.gust && h.gust > (h.spd??0)*1.4 ? '#f97316' : 'var(--txt-3)'}">
          {h.gust ?? '—'}
        </div>
      {/each}

      <div class="wg-lbl xs muted">Dir.</div>
      {#each wxData.hourScores as h}<div class="wg-val xs">{dirLabel(h.dir)}</div>{/each}

      <div class="wg-lbl xs muted" style="color:#3b9eff">{L ? 'Précip.' : 'Precip.'}</div>
      {#each wxData.hourScores as h}
        <div class="wg-val xs mono" style="color:{(h.precip??0)>=40?'#3b9eff':(h.precip??0)>=20?'#7fb3d5':'var(--txt-3)'};font-weight:{(h.precip??0)>=40?'700':'400'}">
          {h.precip != null ? h.precip+'%' : '—'}
        </div>
      {/each}

      {#each YAMASKA_LAUNCHES as lch}
      <div class="wg-lbl xs" style="color:{lch.color};font-weight:700">{lch.key}</div>
      {#each wxData.hourScores as h}
        {@const s = h.scores.find(x => x.key === lch.key)}
        <div class="wg-score"
          style="background:{scoreColor(s?.pct ?? 0)}1a;border-bottom:2px solid {scoreColor(s?.pct ?? 0)}">
          <span class="xs mono" style="color:{scoreColor(s?.pct ?? 0)};font-weight:700">
            {s?.pct ?? '?'}
          </span>
        </div>
      {/each}
      {/each}
    </div>

    <!-- Color legend — explains color → percentage mapping -->
    <div class="wg-legend">
      <div class="wg-legend-bar"></div>
      <div class="wg-legend-ticks xs">
        <span style="color:#dc2626">0</span>
        <span style="color:#ef4444">25</span>
        <span style="color:#f97316">45</span>
        <span style="color:#eab308">65</span>
        <span style="color:#84cc16">80</span>
        <span style="color:#22c55e">100</span>
      </div>
      <div class="xs muted" style="text-align:center;margin-top:.15rem">
        {L ? 'No-go · Marginal · Acceptable · Favorable · Excellent' : 'No-go · Marginal · Acceptable · Favourable · Excellent'}
      </div>
    </div>
  </div>
  {/if}
  {/if}

  <div class="xs muted" style="margin-top:.3rem">
    {L ? 'Source :' : 'Source:'}
    <a href="https://open-meteo.com" target="_blank" style="color:var(--teal)">Open-Meteo</a> · Modèle GEM (Canada)
    · 
  </div>
  {/if}
</div>

<style>
  .wb{display:flex;flex-direction:column;gap:.5rem}
  .wb-hdr{display:flex;align-items:center;justify-content:space-between}
  .wb-title{font-family:var(--ff-head);font-size:.82rem;font-weight:700;color:var(--txt)}
  .wb-ref{background:none;border:1px solid var(--border);border-radius:5px;padding:.15rem .4rem;cursor:pointer;color:var(--txt-3);font-size:.9rem;line-height:1}
  .wb-ref:disabled{opacity:.4}
  .wb-state{display:flex;align-items:center;gap:.4rem;padding:.35rem 0}
  .wb-pill{display:flex;align-items:center;gap:.5rem;border-radius:8px;border:1px solid;padding:.4rem .625rem}
  .wb-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .wb-blocks{display:flex;flex-direction:column;gap:.3rem}
  .wb-block{padding:.4rem .6rem;border-radius:0 8px 8px 0;background:var(--bg-raised);display:flex;flex-direction:column;gap:.2rem}
  .wb-blk-hdr{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}
  .wb-blk-row{display:flex;align-items:center;gap:.25rem}
  .wb-blk-ico{width:14px;flex-shrink:0;font-size:.75rem;text-align:center;color:var(--txt-3)}
  .wb-grid-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .wb-grid{display:grid;gap:2px;min-width:max-content}
  .wg-head{font-size:.6rem;color:var(--txt-3);font-weight:700;background:var(--bg-2);border-radius:3px;padding:.2rem .25rem;text-align:center;min-width:32px}
  .wg-lbl{min-width:72px;background:var(--bg-2);border-radius:3px;padding:.2rem .35rem;display:flex;align-items:center}
  .wg-val{padding:.2rem .25rem;display:flex;align-items:center;justify-content:center;background:var(--bg-2);border-radius:3px;text-align:center}
  .wg-score{border-radius:4px;min-height:22px;display:flex;align-items:center;justify-content:center}
  .xs{font-size:.75rem} .muted{color:var(--txt-3)} .mono{font-family:var(--ff-mono)}
  .wb-prom-btn{width:100%;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg, rgba(0,184,122,.10), rgba(0,184,122,.02));border:1px solid rgba(0,184,122,.35);border-radius:8px;padding:.6rem .75rem;cursor:pointer;color:var(--teal);font-size:.85rem;margin:.5rem 0;transition:all .15s}
  .wb-prom-btn:hover{background:linear-gradient(135deg, rgba(0,184,122,.18), rgba(0,184,122,.06));border-color:var(--teal)}
  .wb-prom-btn-left{display:flex;align-items:center;gap:.5rem}
  .wb-grid-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.3rem .5rem;cursor:pointer;margin:.25rem 0}
  .spin{width:13px;height:13px;border:2px solid var(--border);border-top-color:var(--teal);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
  @keyframes spin{to{transform:rotate(360deg)}}

  .wg-legend{margin-top:.5rem;padding:.4rem .5rem;background:var(--bg-2);border-radius:6px}
  .wg-legend-bar{height:8px;border-radius:4px;background:linear-gradient(to right, #dc2626 0%, #ef4444 25%, #f97316 45%, #eab308 65%, #84cc16 80%, #22c55e 100%)}
  .wg-legend-ticks{display:flex;justify-content:space-between;margin-top:.2rem;font-weight:700;font-family:var(--ff-mono,monospace)}
</style>
