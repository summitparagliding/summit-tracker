<script>
  import { bestLaunchScore, scoreColor, dirLabel } from '$lib/launchParams.js';
  import { onMount } from 'svelte';
  export let lang = 'fr';
  // Section controls — lets the info page compose sections in a custom order.
  export let showNow      = true;   // current conditions + analysis
  export let show12h      = true;   // next 12 hours
  export let showForecast = true;   // 3 & 7 day forecast

  const LAT = 45.472332, LON = -72.882132;  // Mont Yamaska launch — corrected
  let fly7Open = false;
  let fc3Open  = true;
  let forecast = null, loading = true, err = null;

  const DIRS16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const degToDir = d => DIRS16[Math.round(d/22.5)%16];
  // Under 5 km/h: always flyable regardless of gusts
  // Under 10 km/h: gusts within 75% of avg are OK
  // Otherwise: gusts within 50% of avg
  const gustOk = (avg, gust) => {
    if (avg <= 5) return true;
    if (avg <= 10) return gust <= avg * 1.75;
    return gust <= avg * 1.50;
  };

  // Wind "coming FROM" = source direction = display arrow points toward the viewer
  // Arrow SVG points down by default; we rotate by (dirDeg + 180) so it shows FROM
  const fromDeg = d => (d + 180) % 360;

  const wmoLabel = (c, l) => {
    if (c === 0)  return l==='fr' ? 'Ciel clair'  : 'Clear';
    if (c <= 3)   return l==='fr' ? 'Nuageux'     : 'Cloudy';
    if (c <= 48)  return l==='fr' ? 'Brouillard'  : 'Fog';
    if (c <= 65)  return l==='fr' ? 'Pluie'       : 'Rain';
    if (c <= 75)  return l==='fr' ? 'Neige'       : 'Snow';
    if (c <= 82)  return l==='fr' ? 'Averses'     : 'Showers';
    return l==='fr' ? 'Orage' : 'Thunderstorm';
  };

  // Activity parameters — corrected terminology
  const ACTS = [
    { key:'fly',    fr:'Vol',         en:'Flight',    min:0,   max:20  },
    { key:'fly1',   fr:'1er vol',     en:'1st flight',min:0,   max:10  },
    { key:'ghFwd',  fr:'Dos voile',   en:'Forward',   min:0,   max:5   },
    { key:'ghRev',  fr:'Face voile',  en:'Reverse',   min:5,   max:25  },
    { key:'theory', fr:'Théorie',     en:'Theory',    min:0,   max:999 },
  ];

  // Launch sites
  const SITES = [
    { key:'NE CVLY', dirs:['NNE','NE','ENE','N','NW','NNW'] },
    { key:'N Cogeco',dirs:['N','NNW','NW','WNW','NNE','NE'] },
    { key:'O CVLY',  dirs:['WNW','W','WSW']                  },
    { key:'S',       dirs:['SSW','SW','S','SSE','SE']         },
  ];

  function flyScore(wind, gust) {
    if (wind == null) return null;
    if (!gustOk(wind, gust)) return 0.15;
    if (wind <= 5)  return 1.0;   // under 5 = ideal
    if (wind <= 10) return 1.0;   // under 10 with ok gusts = excellent
    if (wind <= 15) return 0.85;
    if (wind <= 20) return 0.65;
    if (wind <= 25) return 0.3;
    return 0.05;
  }

  function getColor(score, windSpd, windDir, gustSpd) {
    if (windSpd != null && windDir != null) {
      const pct = bestLaunchScore(windSpd, windDir, gustSpd ?? null);
      if (pct != null) return scoreColor(pct);
    }
    if (score === null || score === undefined) return '#6b8da8';
    // score is a 0–1 fraction here, scoreColor() wants 0–100
    return scoreColor(Math.round(score * 100));
  }
  function scoreLabel(score, l) {
    // score is 0-100 (from bestLaunchScore) — Excellent only at 90+
    if (score === null || score === undefined) return '—';
    if (score >= 90) return l==='fr' ? 'Excellent'   : 'Excellent';
    if (score >= 75) return l==='fr' ? 'Favorable'   : 'Favourable';
    if (score >= 55) return l==='fr' ? 'Acceptable'  : 'Acceptable';
    if (score >= 35) return l==='fr' ? 'Marginal'    : 'Marginal';
    if (score >= 15) return l==='fr' ? 'Déconseillé' : 'Not ideal';
    return l==='fr' ? 'Non volable' : 'No-go';
  }

  function actOk(act, wind, gust) {
    if (act.key === 'theory') return true;
    if (wind == null) return null;
    return wind >= act.min && wind <= act.max && gustOk(wind, gust);
  }
  function actMarginal(act, wind, gust) {
    if (act.key === 'theory') return false;
    if (wind == null) return false;
    return wind <= act.max + 5 && gustOk(wind, gust) && !actOk(act, wind, gust);
  }

  function fmtHour(d) {
    return d.toLocaleTimeString(lang==='fr'?'fr-CA':'en-CA',{hour:'numeric',hour12:true});
  }
  function fmtDate(d) {
    return d.toLocaleDateString(lang==='fr'?'fr-CA':'en-CA',{weekday:'short',month:'short',day:'numeric'});
  }

  onMount(async () => {
    try {
      const url = `/api/weather?latitude=${LAT}&longitude=${LON}` +
        `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation_probability,weathercode` +
        `&daily=weathercode,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_probability_max` +
        `&wind_speed_unit=kmh&timezone=America%2FToronto&forecast_days=8&models=gem_seamless`;
      let _res = await fetch(url);
      if (!_res.ok) _res = await fetch(url.replace('gem_seamless','best_match'));
      const data = await _res.json();
      if (data.error) throw new Error(data.reason || 'API error');
      const h    = data.hourly;
      const d    = data.daily;
      const now  = new Date();

      const allHourly = h.time.map((t,i) => ({
        iso:     t,
        day:     t.slice(0,10),
        hr:      Number(t.slice(11,13)),
        time:    new Date(t),
        wind:    Math.round(h.wind_speed_10m[i]),
        gust:    Math.round(h.wind_gusts_10m[i]),
        dir:     degToDir(h.wind_direction_10m[i]),
        dirDeg:  h.wind_direction_10m[i],
        temp:    Math.round(h.temperature_2m[i]),
        precip:  h.precipitation_probability[i] || 0,
        wmo:     h.weathercode[i],
      }));

      const cur    = allHourly.filter(x => x.time <= now).at(-1) || allHourly[0];
      const next12 = allHourly.filter(x => x.time >= now && x.time <= new Date(now.getTime() + 12*3600e3));

      // Daily forecast — flyability computed the SAME way as the hourly checker
      // and the 12h strip: the best flyable hour in the 08:00–21:00 window via
      // bestLaunchScore (wind + direction + gust + precip). Keeps every period
      // on the weather page homogeneous instead of using pessimistic daily maxes.
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
      const dayStrs  = d.time.filter(ds => ds > todayStr).slice(0, 7);
      const days = dayStrs.map(ds => {
        const di = d.time.indexOf(ds);
        const dayHrs = allHourly.filter(x => x.day === ds && x.hr >= 8 && x.hr <= 21);
        let best = null;
        for (const hh of dayHrs) {
          const sc = bestLaunchScore(hh.wind, hh.dirDeg, hh.gust, hh.precip);
          if (sc != null && (best == null || sc > best.score)) best = { ...hh, score: sc };
        }
        return {
          date:     new Date(ds + 'T12:00:00'),
          wmo:      d.weathercode[di],
          tMax:     Math.round(d.temperature_2m_max[di]),
          tMin:     Math.round(d.temperature_2m_min[di]),
          wind:     best ? best.wind   : Math.round(d.wind_speed_10m_max[di]),
          gust:     best ? best.gust   : Math.round(d.wind_gusts_10m_max[di]),
          dir:      best ? best.dir    : degToDir(d.wind_direction_10m_dominant[di]),
          dirDeg:   best ? best.dirDeg : d.wind_direction_10m_dominant[di],
          precip:   best ? best.precip : (d.precipitation_probability_max[di] || 0),
          bestTime: best ? best.iso.slice(11,16) : null,
          score:    best ? best.score  : 0,
        };
      });

      forecast = { cur, next12, days };
    } catch(e) {
      err = e.message;
    } finally {
      loading = false;
    }
  });

  // Manual checker
  let mv = '', mg = '', mdir = 'NE';
  $: mvN = parseFloat(mv) || 0;
  $: mgN = parseFloat(mg) || mvN;

  function wmoIcon(code) {
    if (code == null) return '—';
    if (code === 0) return '☀️';
    if (code <= 2) return '⛅';
    if (code <= 3) return '☁️';
    if (code <= 49) return '🌫️';
    if (code <= 59) return '🌧️';
    if (code <= 69) return '🌨️';
    if (code <= 79) return '🌨️';
    if (code <= 82) return '🌧️';
    if (code <= 84) return '🌧️';
    if (code <= 99) return '⛈️';
    return '❓';
  }

</script>

<div class="ww">

{#if loading}
  <div class="ww-msg">{lang==='fr'?'Chargement météo…':'Loading weather…'}</div>
{:else if err}
  <div class="ww-msg ww-err">{err}</div>
{:else if forecast}
  {@const c = forecast.cur}

  {#if showNow}
  <!-- CURRENT CONDITIONS -->
  <div class="cur-card">
    <div class="cur-left">
      <div class="cur-info">
        <div class="cur-desc xs">{wmoLabel(c.wmo, lang)}</div>
        <div class="cur-temp">{c.temp}°C</div>
        <div class="cur-loc xs muted">Mont Yamaska · {new Date().toLocaleDateString(lang==='fr'?'fr-CA':'en-CA',{weekday:'short',month:'short',day:'numeric'})}</div>
      </div>
    </div>
    <div class="cur-right">
      <div class="cur-wind-row">
        <!-- Arrow rotated to show wind coming FROM -->
        <svg class="wind-arrow" viewBox="0 0 24 24" width="20" height="20"
          style="transform:rotate({fromDeg(c.dirDeg)}deg);color:var(--teal)">
          <path d="M12 2L7 9h3v8h4V9h3z" fill="currentColor"/>
        </svg>
        <span class="cur-kph">{c.wind}</span>
        <span class="cur-unit">km/h</span>
      </div>
      <div class="xs muted">{lang==='fr'?'Rafales':'Gusts'}:
        <!-- Gust icon: wavy lines -->
        <svg viewBox="0 0 20 12" width="14" height="10" style="vertical-align:middle;color:var(--txt-3)">
          <path d="M1 3 Q5 1 9 3 Q13 5 17 3 Q19 2 19 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <path d="M1 7 Q5 5 9 7 Q13 9 17 7" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <path d="M3 11 Q7 9 11 11 Q14 12 16 11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </svg>
        <b style="color:var(--txt)">{c.gust} km/h</b>
      </div>
      <div class="xs" style="color:var(--teal)">{c.dir}
        {#if !gustOk(c.wind, c.gust)}<span style="color:var(--red);margin-left:.3rem">{lang==='fr'?'Rafales élevées':'High gusts'}</span>{/if}
      </div>
      {#if c.precip > 0}<div class="xs muted">{c.precip}% {lang==='fr'?'préc.':'precip.'}</div>{/if}
    </div>
  </div>

  {/if}

  {#if showNow}
  <!-- CONDITIONS NOW -->
  <div class="section-card">
    <div class="sec-lbl">{lang==='fr'?'Conditions maintenant':'Conditions now'}</div>
    <div class="site-grid">
      {#each SITES as s}
        {@const ok = s.dirs.includes(c.dir) && c.wind <= 20 && gustOk(c.wind, c.gust)}
        {@const mg2 = s.dirs.includes(c.dir) && c.wind <= 25 && gustOk(c.wind, c.gust) && !ok}
        <div class="site-cell" style="background:{ok?'rgba(0,184,122,.1)':mg2?'rgba(217,119,6,.1)':'rgba(220,38,38,.08)'};border-color:{ok?'rgba(0,184,122,.3)':mg2?'rgba(217,119,6,.3)':'rgba(220,38,38,.2)'}">
          <div class="site-key">{s.key}</div>
          <div class="site-dot" style="background:{ok?'var(--teal)':mg2?'var(--amber)':'var(--red)'}"></div>
        </div>
      {/each}
    </div>
  </div>
  {/if}

  <!-- NEXT 12H HOURLY -->
  {#if show12h && forecast.next12.length}
  <div class="section-card">
    <div class="sec-lbl sec-lbl-row">
      <span>{lang==='fr'?'Prochaines 12h':'Next 12 hours'}</span>
      <span class="scroll-hint">{lang==='fr'?'glissez':'swipe'}
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
      </span>
    </div>
    <div class="hourly-row">
      {#each forecast.next12.filter((_, i) => i % 2 === 0) as hh}
        {@const score = bestLaunchScore(hh.wind, hh.dirDeg, hh.gust, hh.precip) ?? 0}
        <div class="h-cell" style="border-bottom:3px solid {scoreColor(score)}">
          <div class="xs muted">{fmtHour(hh.time)}</div>
          <div class="h-spd mono">{hh.wind}</div>
          <div class="xs" style="display:flex;align-items:center;gap:2px;color:var(--txt-3)">
            <!-- Gust wavy icon -->
            <svg viewBox="0 0 16 10" width="12" height="9">
              <path d="M1 2 Q4 0.5 7 2 Q10 3.5 13 2" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>
              <path d="M1 6 Q4 4.5 7 6 Q10 7.5 13 6" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>
            </svg>
            <span>{hh.gust}</span>
          </div>
          <div class="xs" style="color:var(--teal)">{hh.dir}</div>
          <div class="xs h-precip" style="color:{(hh.precip||0)>=40?'#3b9eff':'var(--txt-3)'};font-weight:{(hh.precip||0)>=40?'700':'400'}">
            <svg viewBox="0 0 12 16" width="9" height="11" style="vertical-align:-1px"><path d="M6 1 C6 1 1.5 6.5 1.5 10 a4.5 4.5 0 0 0 9 0 C10.5 6.5 6 1 6 1 z" fill="currentColor"/></svg>
            {hh.precip||0}%
          </div>
        </div>
      {/each}
    </div>
    <div class="xs muted" style="margin-top:.3rem;text-align:center">{lang==='fr'?'km/h · barre = volabilité':'km/h · bar = flyability'}</div>
  </div>
  {/if}

  {#if showForecast}
  <!-- 3-DAY & 7-DAY FORECAST -->
  <div class="section-card">
    <div class="sec-lbl">{lang==='fr'?'Prévisions — 3 et 7 jours':'Forecast — 3 & 7 days'}</div>
    <div class="forecast-legend xs muted" style="margin-bottom:.5rem">
      <span style="display:inline-flex;align-items:center;gap:.25rem">
        <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="#00b87a" stroke-width="2"><path d="M7 10l2 2 4-4" stroke-linecap="round"/><circle cx="10" cy="10" r="8"/></svg>
        {lang==='fr'?'Bon':'Good'}
      </span>
      <span style="margin-left:.5rem;display:inline-flex;align-items:center;gap:.25rem">
        <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="#dc2626" stroke-width="2"><path d="M7 7l6 6M13 7l-6 6" stroke-linecap="round"/><circle cx="10" cy="10" r="8"/></svg>
        {lang==='fr'?'Non volable':'Not flyable'}
      </span>
      <span class="muted" style="margin-left:.5rem">{lang==='fr'?'Gradient = nuance':'Gradient = nuance'}</span>
    </div>
    <!-- 3-day block -->
    <button class="ww-prom-btn" on:click={() => fc3Open = !fc3Open}>
      <div class="ww-prom-btn-left">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style="font-weight:700">{lang==='fr'?'3 prochains jours':'Next 3 days'}</span>
      </div>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"
        style="transition:transform .2s;transform:rotate({fc3Open?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    {#if fc3Open}
    <div class="forecast-grid">
      {#each forecast.days.slice(0,3) as day}
        {@const pct = day.score ?? 0}
        {@const col = scoreColor(pct)}
        <div class="forecast-card" style="border-top:3px solid {col}">
          <div class="fc-date xs">{fmtDate(day.date)}</div>
          <div class="fc-score-icon">
            {#if pct >= 60}
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="{col}" stroke-width="2"><path d="M7 10l2 2 4-4" stroke-linecap="round"/><circle cx="10" cy="10" r="8"/></svg>
            {:else if pct >= 30}
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="{col}" stroke-width="2"><path d="M10 5v6M10 14v1" stroke-linecap="round"/><circle cx="10" cy="10" r="8"/></svg>
            {:else}
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="{col}" stroke-width="2"><path d="M7 7l6 6M13 7l-6 6" stroke-linecap="round"/><circle cx="10" cy="10" r="8"/></svg>
            {/if}
          </div>
          <div class="fc-label xs" style="color:{col}">{scoreLabel(pct, lang)}</div>
          <div class="fc-wind mono xs">{day.wind} <span class="muted">km/h</span></div>
          {#if day.gust && !isNaN(day.gust) && day.gust > day.wind}
          <div class="fc-gust xs" style="color:#f97316;display:flex;align-items:center;gap:2px"><svg viewBox="0 0 16 12" width="10" height="9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="vertical-align:middle"><path d="M1 2.5 Q4 1 7 2.5 Q10 4 13 2.5"/><path d="M1 6 Q4 4.5 7 6 Q10 7.5 13 6"/><path d="M1 9.5 Q4 8 7 9.5 Q10 11 13 9.5"/></svg>{day.gust} km/h</div>
          {/if}
          <div class="fc-dir xs muted">{day.dir}</div>
          <div class="fc-temp xs muted">{day.tMin}°–{day.tMax}°C</div>
          <div class="fc-precip xs" style="color:{(day.precip||0)>=40?'#3b9eff':(day.precip||0)>=20?'#7fb3d5':'var(--txt-3)'};font-weight:{(day.precip||0)>=40?'700':'400'}">
            {lang==='fr'?'Précip.':'Precip.'} {day.precip ?? 0}%
          </div>
          {#if day.bestTime && pct >= 25}
          <div class="fc-best xs" style="color:var(--teal)">{lang==='fr'?'Meilleure':'Best'} {day.bestTime}</div>
          {/if}
        </div>
      {/each}
    </div>
    {/if}
    <!-- 7 prochains jours — prominent button + collapsible -->
    <button class="ww-prom-btn" on:click={() => fly7Open = !fly7Open}>
      <div class="ww-prom-btn-left">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style="font-weight:700">{lang==='fr'?'7 prochains jours':'Next 7 days'}</span>
      </div>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"
        style="transition:transform .2s;transform:rotate({fly7Open?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    {#if fly7Open}
    <div class="fly7-list">
      {#each forecast.days as day}
        {@const pct = day.score ?? 0}
        {@const col = scoreColor(pct)}
        <div class="fly7-row">
          <div class="fly7-date xs">{fmtDate(day.date)}</div>
          <div class="fly7-ico">{wmoIcon(day.wmo)}</div>
          <div class="fly7-wind xs">
            <span class="mono">{day.wind}</span>
            {#if day.gust && !isNaN(day.gust) && day.gust > day.wind}
            <span style="color:#f97316;display:inline-flex;align-items:center;gap:2px"><svg viewBox="0 0 16 12" width="10" height="9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="vertical-align:middle"><path d="M1 2.5 Q4 1 7 2.5 Q10 4 13 2.5"/><path d="M1 6 Q4 4.5 7 6 Q10 7.5 13 6"/><path d="M1 9.5 Q4 8 7 9.5 Q10 11 13 9.5"/></svg>{day.gust}</span>
            {/if}
            <span class="muted"> {day.dir}</span>
          </div>
          <div class="fly7-score">
            <span class="fly7-dot" style="background:{col}"></span>
            <span class="xs mono" style="color:{col};font-weight:700">{pct ?? '—'}%</span>
          </div>
          <div class="fly7-precip xs mono" style="color:{(day.precip||0)>=40?'#3b9eff':(day.precip||0)>=20?'#7fb3d5':'var(--txt-3)'};font-weight:{(day.precip||0)>=40?'700':'400'}"><svg viewBox="0 0 12 16" width="8" height="10" style="vertical-align:-1px"><path d="M6 1 C6 1 1.5 6.5 1.5 10 a4.5 4.5 0 0 0 9 0 C10.5 6.5 6 1 6 1 z" fill="currentColor"/></svg>{day.precip ?? 0}%</div>
          <div class="fly7-tmp xs muted">{day.tMax}°/{day.tMin}°</div>
        </div>
      {/each}
    </div>
    {/if}
  </div>
  {/if}

{/if}

<div class="ww-credit xs muted">{lang==='fr'?'Météo':'Weather'}: <a href="https://open-meteo.com" target="_blank" rel="noopener" style="color:inherit">Open-Meteo</a> · GEM (Canada) · {LAT}°N {Math.abs(LON)}°W</div>
</div>

<style>
  .ww{display:flex;flex-direction:column;gap:.75rem}
  .ww-msg{padding:1.5rem;text-align:center;color:var(--txt-3);font-size:.88rem;background:var(--bg-raised);border-radius:10px}
  .ww-err{color:var(--amber)}
  .cur-card{background:var(--bg-raised);border-radius:12px;padding:.875rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap}
  .cur-left{display:flex;align-items:center;gap:.75rem}
  .cur-desc{color:var(--txt-3)}
  .cur-temp{font-size:1.6rem;font-weight:700;font-family:var(--ff-head);color:var(--txt);line-height:1.1}
  .cur-loc{margin-top:.2rem}
  .cur-right{text-align:right;display:flex;flex-direction:column;gap:.15rem}
  .cur-wind-row{display:flex;align-items:center;gap:.25rem;justify-content:flex-end}
  .wind-arrow{display:inline-block;transition:transform .3s}
  .cur-kph{font-size:2rem;font-weight:800;font-family:var(--ff-head);color:var(--teal);line-height:1}
  .cur-unit{font-size:.75rem;color:var(--txt-3)}
  .section-card{background:var(--bg-raised);border-radius:10px;padding:.75rem}
  .sec-lbl{font-family:var(--ff-head);font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--teal);margin-bottom:.6rem}
  .site-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.3rem;margin-bottom:.5rem}
  .site-cell{border-radius:8px;border:1.5px solid;padding:.4rem .3rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:.3rem}
  .site-key{font-weight:700;font-size:.72rem;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .site-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .act-list{display:flex;flex-direction:column;gap:.2rem}
  .act-row{display:flex;align-items:center;gap:.4rem;padding:.25rem .35rem;background:var(--bg-2);border-radius:5px}
  .act-name{flex:1;font-size:.8rem;color:var(--txt)}
  .act-rng{min-width:70px;text-align:right}
  .act-icon{min-width:20px;text-align:right;display:flex;justify-content:flex-end;align-items:center}
  .hourly-row{display:flex;gap:.3rem;overflow-x:auto;padding-bottom:.25rem}
  .sec-lbl-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
  .scroll-hint{display:inline-flex;align-items:center;gap:.2rem;font-family:var(--ff-body);font-size:.62rem;font-weight:600;text-transform:none;letter-spacing:0;color:var(--txt-3);opacity:.85;animation:hintpulse 1.8s ease-in-out infinite}
  .scroll-hint svg{animation:hintnudge 1.8s ease-in-out infinite}
  @keyframes hintpulse{0%,100%{opacity:.5}50%{opacity:.95}}
  @keyframes hintnudge{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
  .h-cell{flex-shrink:0;width:52px;background:var(--bg-2);border-radius:7px;padding:.35rem .25rem;text-align:center;display:flex;flex-direction:column;gap:.1rem;align-items:center}
  .h-spd{font-size:.9rem;font-weight:700;color:var(--txt)}
  /* Forecast */
  .forecast-subhdr{font-family:var(--ff-head);font-weight:700;color:var(--txt-2);margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.05em}
  .forecast-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem}
  .forecast-card{background:var(--bg-2);border-radius:8px;padding:.5rem .4rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:.15rem}
  .fc-date{color:var(--txt-2);font-weight:600}
  .fc-score-icon{margin:.15rem 0}
  .fc-label{font-weight:700}
  .fc-wind{color:var(--txt)}
  .fc-dir,.fc-temp{color:var(--txt-3)}
  .forecast-list{display:flex;flex-direction:column;gap:.25rem}
  .fl-row{display:grid;grid-template-columns:80px 18px 1fr 36px 36px;align-items:center;gap:.4rem;padding:.2rem .35rem;background:var(--bg-2);border-radius:5px}
  .fl-date{color:var(--txt-2);font-size:.75rem}
  .ww-prom-btn{width:100%;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg, rgba(0,184,122,.10), rgba(0,184,122,.02));border:1px solid rgba(0,184,122,.35);border-radius:8px;padding:.6rem .75rem;cursor:pointer;color:var(--teal);font-size:.85rem;margin:.75rem 0 .5rem;transition:all .15s}
  .ww-prom-btn:hover{background:linear-gradient(135deg, rgba(0,184,122,.18), rgba(0,184,122,.06));border-color:var(--teal)}
  .ww-prom-btn-left{display:flex;align-items:center;gap:.5rem}
  .fly7-list{display:flex;flex-direction:column;gap:.2rem}
  .fly7-row{display:flex;align-items:center;gap:.5rem;padding:.3rem .4rem;border-radius:7px;background:var(--bg-raised);border:1px solid var(--border)}
  .fly7-date{min-width:54px;color:var(--txt-2)}
  .fly7-ico{font-size:.95rem;flex-shrink:0}
  .fly7-wind{flex:1;min-width:0;font-family:var(--ff-head)}
  .fly7-score{display:flex;align-items:center;gap:.25rem;flex-shrink:0}
  .fly7-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;display:block}
  .fly7-tmp{min-width:52px;text-align:right;flex-shrink:0}
  .fly7-precip{min-width:42px;text-align:right;flex-shrink:0;display:flex;align-items:center;gap:1px;justify-content:flex-end}
  .fl-wind{color:var(--txt);text-align:right}
  .fl-dir{color:var(--txt-3);text-align:right}
  .forecast-legend{display:flex;align-items:center;flex-wrap:wrap;gap:.25rem}
  /* Manual checker */
  .man-inputs{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem}
  .mi{display:flex;flex-direction:column;gap:.2rem}
  .mi-r{display:flex;align-items:center;gap:.25rem}
  .mi-inp{width:58px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.28rem .35rem;color:var(--txt);font-family:var(--ff-head);font-size:.85rem;text-align:center}
  .mi-sel{background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.28rem .35rem;color:var(--txt);font-size:.8rem}
  .gw-box{background:rgba(217,119,6,.1);border:1px solid var(--amber);border-radius:6px;padding:.3rem .5rem;font-size:.78rem;color:var(--amber);margin-bottom:.4rem}
  .ww-credit{text-align:right;margin-top:.25rem}
  .xs{font-size:.72rem}
  .muted{color:var(--txt-3)}
  .mono{font-family:var(--ff-head)}
</style>
