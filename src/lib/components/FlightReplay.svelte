<script>
  import { onMount, onDestroy } from 'svelte';
  import { lang } from '$lib/stores/lang.js';
  export let flight;   // full flight object with track_geojson
  export let onClose;  // callback to close the modal

  // ── Track data ──────────────────────────────────────────────
  let geo, coords = [], totalPts = 0;
  try {
    geo    = JSON.parse(flight.track_geojson || 'null');
    coords = geo?.geometry?.coordinates ?? [];
    totalPts = coords.length;
  } catch {}

  // ── Replay state ────────────────────────────────────────────
  let playing   = false;
  let speed     = 4;          // multiplier
  let progress  = 0;          // 0–1
  let curIdx    = 0;          // current coord index
  let elapsed   = 0;          // seconds of flight time elapsed
  const SPEEDS  = [1, 2, 4, 8, 16];

  const durSecs  = flight.duration_seconds || (totalPts * 2) || 60;
  $: curCoord    = coords[curIdx] || null;
  $: curAlt      = curCoord ? (curCoord[2] || 0) : 0;
  $: curPct      = totalPts > 1 ? Math.round((curIdx / (totalPts - 1)) * 100) : 0;

  function fmtTime(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  // ── Leaflet map ─────────────────────────────────────────────
  let mapEl, map, polyline, marker, animFrame;

  onMount(async () => {
    if (!coords.length) return;
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    const ll = coords.map(([lon, lat]) => [lat, lon]);

    map = L.map(mapEl, { zoomControl: true, attributionControl: false });

    // Satellite layer
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: '© Esri' }
    ).addTo(map);

    // Label overlay
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, opacity: 0.6 }
    ).addTo(map);

    // Full track (dimmed)
    L.polyline(ll, { color: '#ffffff', weight: 2, opacity: 0.25 }).addTo(map);

    // Travelled portion (bright teal)
    polyline = L.polyline([], { color: '#00e8c6', weight: 3, opacity: 0.9 }).addTo(map);

    // Takeoff / landing markers
    const mk = (col, lbl) => L.divIcon({
      html: `<div style="background:${col};border:2px solid #fff;width:12px;height:12px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.5)">${lbl}</div>`,
      className: '', iconSize: [12, 12], iconAnchor: [6, 6]
    });
    L.marker(ll[0],          { icon: mk('#22c55e', 'D'), zIndexOffset: 100 })
     .bindTooltip($lang === 'fr' ? 'Décollage' : 'Takeoff').addTo(map);
    L.marker(ll[ll.length-1],{ icon: mk('#ef4444', 'A'), zIndexOffset: 100 })
     .bindTooltip($lang === 'fr' ? 'Atterrissage' : 'Landing').addTo(map);

    // Paraglider marker (SVG icon, rotates with heading)
    const pgIcon = L.divIcon({
      html: `<div id="pg-marker" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center">
        <svg viewBox="0 0 40 30" width="28" height="21" xmlns="http://www.w3.org/2000/svg">
          <!-- Canopy -->
          <path d="M5,20 Q10,4 20,4 Q30,4 35,20 Q27,23 20,23 Q13,23 5,20Z" fill="#00e8c6" opacity="0.95"/>
          <!-- Risers -->
          <line x1="13" y1="21" x2="19" y2="28" stroke="white" stroke-width="1.2" opacity="0.9"/>
          <line x1="27" y1="21" x2="21" y2="28" stroke="white" stroke-width="1.2" opacity="0.9"/>
          <!-- Pilot harness -->
          <ellipse cx="20" cy="26" rx="3" ry="2" fill="white" opacity="0.9"/>
        </svg>
      </div>`,
      className: '', iconSize: [28, 28], iconAnchor: [14, 26]
    });
    marker = L.marker(ll[0], { icon: pgIcon, zIndexOffset: 1000 }).addTo(map);

    map.fitBounds(L.latLngBounds(ll), { padding: [40, 40] });
    updatePosition(0);
  });

  onDestroy(() => {
    cancelAnimationFrame(animFrame);
    map?.remove();
  });

  // ── Update map position ─────────────────────────────────────
  function updatePosition(idx) {
    if (!marker || !polyline || !coords.length) return;
    idx = Math.max(0, Math.min(idx, totalPts - 1));
    curIdx = idx;

    const ll = coords.slice(0, idx + 1).map(([lon, lat]) => [lat, lon]);
    polyline.setLatLngs(ll);
    const cur = coords[idx];
    marker.setLatLng([cur[1], cur[0]]);

    // Rotate marker by heading
    if (idx > 0) {
      const prev = coords[idx - 1];
      const angle = Math.atan2(cur[0] - prev[0], cur[1] - prev[1]) * (180 / Math.PI);
      const el = document.getElementById('pg-marker');
      if (el) el.style.transform = `rotate(${angle}deg)`;
    }

    elapsed   = (idx / Math.max(totalPts - 1, 1)) * durSecs;
    progress  = idx / Math.max(totalPts - 1, 1);
  }

  // ── Playback ────────────────────────────────────────────────
  let lastTime = null;
  let accumMs  = 0;   // ms of flight time accumulated between frames

  function step(ts) {
    if (!playing) return;
    if (lastTime !== null) {
      const wallMs   = ts - lastTime;
      accumMs       += wallMs * speed;
      const flightMs = (durSecs * 1000) / Math.max(totalPts - 1, 1);
      while (accumMs >= flightMs && curIdx < totalPts - 1) {
        curIdx++;
        accumMs -= flightMs;
        updatePosition(curIdx);
      }
    }
    lastTime = ts;
    if (curIdx < totalPts - 1) {
      animFrame = requestAnimationFrame(step);
    } else {
      playing  = false;
      lastTime = null;
    }
  }

  function togglePlay() {
    if (curIdx >= totalPts - 1) {
      // Restart
      curIdx   = 0;
      accumMs  = 0;
      updatePosition(0);
    }
    playing  = !playing;
    lastTime = null;
    if (playing) animFrame = requestAnimationFrame(step);
    else cancelAnimationFrame(animFrame);
  }

  function scrub(e) {
    cancelAnimationFrame(animFrame);
    playing  = false;
    lastTime = null;
    const pct = Number(e.target.value) / 100;
    const idx = Math.round(pct * (totalPts - 1));
    updatePosition(idx);
  }

  function restart() {
    cancelAnimationFrame(animFrame);
    playing  = false;
    lastTime = null;
    accumMs  = 0;
    updatePosition(0);
  }
</script>

<!-- ── Modal overlay ──────────────────────────────────────────── -->
<div class="replay-overlay" role="dialog" aria-modal="true">
  <div class="replay-shell">

    <!-- Header bar -->
    <div class="replay-hdr">
      <div class="rh-info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2">
          <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19 4c-1 0-2.5 0-4 1.5L11 9 2.8 6.2c-.5-.2-1-.1-1.4.3L1 7l4.4 4.4 1.6 1 -1.5 1.5-1 2.5 2.5-1L8.6 14l1.5 1.6 4.4 4.4.4-.4c.4-.4.5-.9.3-1.4z"/>
        </svg>
        <strong class="rh-name">{flight.site ? flight.site.replace(/_/g,' ') : (flight.date || '')}</strong>
        {#if flight.date}<span class="rh-date xs dimmed">{flight.date}</span>{/if}
        {#if flight.duration_seconds}
          <span class="rh-dur xs mono" style="color:var(--green)">
            {fmtTime(flight.duration_seconds)}
          </span>
        {/if}
      </div>

      <div class="rh-right">
        <!-- GPX download -->
        <a href="/api/flight/{flight.id}/download"
           class="btn btn-secondary btn-sm"
           title="{$lang === 'fr' ? 'Télécharger GPX' : 'Download GPX'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          GPX
        </a>
        <button class="btn btn-ghost btn-sm" on:click={onClose} aria-label="Close"></button>
      </div>
    </div>

    <!-- Map -->
    <div class="replay-map" bind:this={mapEl}></div>

    {#if !coords.length}
      <div class="no-track">
        <p class="dimmed">{$lang === 'fr' ? 'Aucune trace GPS disponible' : 'No GPS track available'}</p>
      </div>
    {:else}
      <!-- Stats bar -->
      <div class="replay-stats">
        <div class="rs-item">
          <span class="rs-lbl xs dimmed">{$lang === 'fr' ? 'Temps' : 'Time'}</span>
          <span class="rs-val mono">{fmtTime(elapsed)}</span>
        </div>
        <div class="rs-item">
          <span class="rs-lbl xs dimmed">{$lang === 'fr' ? 'Altitude' : 'Altitude'}</span>
          <span class="rs-val mono" style="color:var(--teal)">{curAlt ? curAlt.toFixed(0)+'m' : '—'}</span>
        </div>
        <div class="rs-item">
          <span class="rs-lbl xs dimmed">{$lang === 'fr' ? 'Point' : 'Point'}</span>
          <span class="rs-val mono">{curIdx+1}/{totalPts}</span>
        </div>
        <div class="rs-item">
          <span class="rs-lbl xs dimmed">{$lang === 'fr' ? 'Terminé' : 'Done'}</span>
          <span class="rs-val mono">{curPct}%</span>
        </div>
      </div>

      <!-- Scrubber -->
      <div class="replay-scrubber">
        <input type="range" min="0" max="100" step="0.1"
               value={curPct} on:input={scrub} class="scrub-slider" />
      </div>

      <!-- Controls -->
      <div class="replay-controls">
        <!-- Restart -->
        <button class="ctrl-btn" on:click={restart} title="{$lang === 'fr' ? 'Recommencer' : 'Restart'}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
          </svg>
        </button>

        <!-- Play / Pause -->
        <button class="ctrl-btn play-btn" on:click={togglePlay}
                aria-label="{playing ? 'Pause' : 'Play'}">
          {#if playing}
            <!-- Pause icon -->
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          {:else}
            <!-- Play icon -->
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          {/if}
        </button>

        <!-- Speed selector -->
        <div class="speed-btns">
          {#each SPEEDS as s}
            <button class="speed-btn" class:active={speed === s}
                    on:click={() => speed = s}>{s}×</button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .replay-overlay{
    position:fixed;inset:0;z-index:10000;
    background:rgba(6,13,22,.92);backdrop-filter:blur(6px);
    display:flex;align-items:center;justify-content:center;
    padding:12px;
  }
  .replay-shell{
    width:100%;max-width:820px;
    background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);
    overflow:hidden;display:flex;flex-direction:column;
    max-height:calc(100vh - 24px);
  }

  /* Header */
  .replay-hdr{
    display:flex;align-items:center;justify-content:space-between;
    gap:.75rem;padding:.625rem 1rem;
    border-bottom:1px solid var(--border);flex-shrink:0;
  }
  .rh-info{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  .rh-name{font-size:.875rem}
  .rh-date{color:var(--txt-3)}
  .rh-right{display:flex;align-items:center;gap:.5rem;flex-shrink:0}

  /* Map */
  .replay-map{flex:1;min-height:320px;background:#0a1520}
  .no-track{padding:2rem;text-align:center}

  /* Stats bar */
  .replay-stats{
    display:flex;gap:0;border-top:1px solid var(--border);flex-shrink:0;
  }
  .rs-item{
    flex:1;display:flex;flex-direction:column;align-items:center;
    padding:.4rem .5rem;border-right:1px solid var(--border);
  }
  .rs-item:last-child{border-right:none}
  .rs-lbl{font-size:.62rem;text-transform:uppercase;letter-spacing:.05em}
  .rs-val{font-size:.875rem;font-weight:500;margin-top:.1rem}

  /* Scrubber */
  .replay-scrubber{padding:.5rem 1rem .25rem;flex-shrink:0}
  .scrub-slider{
    width:100%;height:4px;accent-color:var(--teal);cursor:pointer;display:block;
  }

  /* Controls */
  .replay-controls{
    display:flex;align-items:center;gap:.75rem;padding:.5rem 1rem .75rem;
    flex-shrink:0;
  }
  .ctrl-btn{
    background:none;border:1px solid var(--border);color:var(--txt-2);
    border-radius:var(--r-sm);padding:.35rem .6rem;cursor:pointer;
    display:flex;align-items:center;gap:.3rem;transition:all .15s;
  }
  .ctrl-btn:hover{border-color:var(--teal);color:var(--teal)}
  .play-btn{
    background:var(--teal);border-color:var(--teal);color:#fff;
    padding:.4rem 1.25rem;border-radius:var(--r-full);font-weight:700;
  }
  .play-btn:hover{background:var(--teal);opacity:.88}
  .speed-btns{display:flex;gap:.25rem;margin-left:auto}
  .speed-btn{
    background:none;border:1px solid var(--border);color:var(--txt-3);
    font-family:var(--ff-mono);font-size:.72rem;font-weight:700;
    padding:.2rem .45rem;border-radius:var(--r-xs);cursor:pointer;transition:all .15s;
  }
  .speed-btn.active{background:var(--teal);border-color:var(--teal);color:#fff}
  .speed-btn:hover:not(.active){border-color:var(--teal);color:var(--teal)}
</style>
