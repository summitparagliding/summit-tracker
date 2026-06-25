<script>
  import '../../../../../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { startGPSWatch, isNative } from '$lib/gps.js';
  import { lang } from '$lib/stores/lang.js';
  import Icon from '$lib/components/Icon.svelte';

  export let data;
  $: flight    = data.flight;
  $: studentId = data.student?.id;
  $: flightId  = flight?.id;

  // ── State ──────────────────────────────────────────────────
  let elapsed    = 0;
  let fixes      = [];
  let currentAlt = null;
  let currentSpd = null;   // m/s from GPS
  let distanceKm = 0;
  let maxAlt     = 0;
  let gpsStatus  = 'waiting';  // waiting | active | error

  let launchTime = null;   // JS timestamp when speed first hit 5km/h
  let landTime   = null;   // JS timestamp when speed last below 5km/h
  let launchClock= null;   // HH:MM string
  let airborneMs = 0;      // accumulated airborne milliseconds

  let saving    = false;
  let emergStep = 0;

  let timerInterval;
  let watchId;
  let startWall = Date.now();

  const LAUNCH_SPD = 7 / 3.6;  // 7 km/h in m/s (as agreed)

  // ── Status reporting ───────────────────────────────────────
  let heartbeatInterval;
  let lastLaunchIso = null;  // ISO string sent to server
  let launchSignaled = false;
  let landSignaled   = false;
  let launchSince = null;   // timestamp when speed first >= 5km/h (time-based)
  let landSince  = null;   // timestamp when speed first < 5km/h

  async function reportStatus(status) {
    const body = { status };
    if (status === 'flying' && lastLaunchIso) body.launched_at = lastLaunchIso;
    try {
      await fetch('/api/enflight/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch(e) {}
  }

  // Manual launch button
  function manualLaunch() {
    if (launchTime) return; // already launched
    launchTime     = Date.now();
    launchClock    = new Date().toTimeString().slice(0,5);
    lastLaunchIso  = new Date(launchTime).toISOString();
    launchSignaled = true;
    reportStatus('flying');
  }

  // ── GPS ────────────────────────────────────────────────────
  let stopGPS = () => {};

  async function startGPS() {
    // Join roster immediately on GPS start
    reportStatus('ground');

    // Start heartbeat — every 20s, reports current status
    heartbeatInterval = setInterval(() => {
      if (landTime) { clearInterval(heartbeatInterval); return; }
      reportStatus(launchTime ? 'flying' : 'ground');
    }, 20000);

    // Use unified GPS utility (native bg GPS in app, web GPS in browser)
    stopGPS = await startGPSWatch(
      (pos) => {
        gpsStatus  = 'active';
        const spd  = pos.spd ?? 0;
        currentSpd = spd;
        currentAlt = pos.alt ?? null;
        if (currentAlt && currentAlt > maxAlt) maxAlt = currentAlt;

        const fix = {
          lat: pos.lat,
          lon: pos.lon,
          alt: currentAlt ?? 0,
          spd,
          t: pos.t ?? Date.now()
        };

        // Detect launch: 5 seconds continuously at >= 5 km/h
        if (!launchTime) {
          if (spd >= LAUNCH_SPD) {
            if (!launchSince) launchSince = Date.now();
            if (Date.now() - launchSince >= 5000) {
              launchTime    = fix.t;
              launchClock   = new Date().toTimeString().slice(0,5);
              lastLaunchIso = new Date(launchTime).toISOString();
              launchSignaled = true;
              launchSince   = null;
              reportStatus('flying');
            }
          } else {
            launchSince = null; // reset if speed drops
          }
        }

        // Heartbeat while flying
        if (launchTime && !landTime) {
          airborneMs = fix.t - launchTime;
        }

        if (fixes.length > 0) {
          const p = fixes[fixes.length-1];
          const R=6371, φ1=p.lat*Math.PI/180, φ2=fix.lat*Math.PI/180;
          const Δφ=(fix.lat-p.lat)*Math.PI/180, Δλ=(fix.lon-p.lon)*Math.PI/180;
          const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
          distanceKm = Math.round((distanceKm + R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)))*100)/100;
        }
        fixes = [...fixes, fix];
        if (launchTime && !landSignaled) checkForLanding(spd * 3.6);
        try { sessionStorage.setItem('gps_'+flightId, JSON.stringify(fixes.slice(-3000))); } catch {}
      },
      (err) => { gpsStatus = 'error'; console.error('[GPS]', err); }
    );
  }

  // ── Formatters ──────────────────────────────────────────────
  function fmtMs(ms) {
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return h>0
      ? `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
      : `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  }
  function fmtElapsed(s) {
    const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
    return h>0
      ? `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
      : `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  }
  function fmtSpd(ms) {
    if (ms == null) return '—';
    return (ms * 3.6).toFixed(1) + ' km/h';
  }

  // ── GPS track save — shared by endFlight AND auto-landing ───────────────────
  async function saveTrack(landClock) {
    if (fixes.length < 2) return;
    try {
      await fetch(`/api/flight/${flightId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixes,
          source:       'browser',
          launch_clock: launchClock || '',
          land_clock:   new Date().toTimeString().slice(0, 5),
          airborne_ms:  launchTime ? Date.now() - launchTime : 0,
        })
      });
      try { sessionStorage.removeItem('gps_' + flightId); } catch {}
      console.log('[GPS] Track saved:', fixes.length, 'fixes');
    } catch(e) {
      console.error('[GPS] Track save failed:', e.message);
    }
  }

  // ── End flight (manual button) ────────────────────────────────────────────
  async function endFlight() {
    saving = true;
    const landClock     = new Date().toTimeString().slice(0, 5);
    const finalAirborne = launchTime ? Date.now() - launchTime : 0;
    // Update roster to 'landed' immediately so instructor sees correct status
    await reportStatus('landed');
    clearInterval(heartbeatInterval);
    await saveTrack(landClock);
    const params = new URLSearchParams({
      lt:  launchClock || '',
      ld:  landClock,
      air: Math.round(finalAirborne / 1000)
    });
    goto(`/student/${studentId}/postflight/${flightId}?${params}`);
  }

  let wakeLock = null;
  async function acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('[GPS] Wake Lock acquired — screen stays on');
        wakeLock.addEventListener('release', () => {
          // Re-acquire if page is still visible and flight not done
          if (document.visibilityState === 'visible' && !landSignaled) acquireWakeLock();
        });
      } catch(e) { console.warn('[GPS] Wake Lock failed:', e.message); }
    }
  }
  // Re-acquire wake lock when page becomes visible again (e.g. after notification swipe)
  function onVisibilityChange() {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !landSignaled && !wakeLock) acquireWakeLock();
  }

  onMount(async () => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    await acquireWakeLock();
    startWall = Date.now();
    timerInterval = setInterval(() => {
      elapsed = Math.floor((Date.now() - startWall) / 1000);
    }, 1000);
    // Restore saved fixes
    try {
      const saved = sessionStorage.getItem('gps_'+flightId);
      if (saved) { fixes = JSON.parse(saved); }
    } catch {}
    startGPS();
  });

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (wakeLock) { try { wakeLock.release(); } catch(e) {} }
    clearInterval(timerInterval);
    clearInterval(heartbeatInterval);
    if (stopGPS) stopGPS();
  });

  $: spdKmh = currentSpd != null ? currentSpd * 3.6 : 0;
  $: isAirborne = launchTime != null;

  // ── GPS-based landing detection for roster ─────────────────────────────
  function checkForLanding(spdKmh) {
    const spd = spdKmh ?? 0;
    if (spd < 2) {
      if (!landSince) landSince = Date.now();
      // 10 seconds continuously below 2 km/h → landing detected
      if (!landSignaled && (Date.now() - landSince) >= 10000) {
        landSignaled = true;
        landTime     = Date.now();
        reportStatus('landed');
        clearInterval(heartbeatInterval);
        // Release wake lock on landing
        if (wakeLock) { try { wakeLock.release(); } catch(e) {} wakeLock = null; }
        // Stop GPS — prevents re-trigger
        if (stopGPS) { stopGPS(); stopGPS = () => {}; }
        // Save GPS track to server BEFORE navigating (auto-landing path)
        const _landClock = new Date().toTimeString().slice(0,5);
        saveTrack(_landClock); // fire-and-forget, don't await (we navigate after 3s)
        // Go to post-flight form
        const _p = new URLSearchParams({
          launched: launchClock || '',
          landed:   _landClock,
          duration: airborneMs ? String(Math.round(airborneMs / 60000)) : '',
          distance: distanceKm ? String(distanceKm) : '',
          maxAlt:   maxAlt ? String(Math.round(maxAlt)) : '',
        });
        setTimeout(() => goto(`/student/${studentId}/postflight/${flightId}?${_p}`), 3000);
      }
    } else if (spd >= 2) {
      landSince = null; // reset if moving again
    }
  }

  // Item 1: Cancel flight without launching
  async function cancelFlight() {
    try {
      await fetch(`/api/flights/${flightId}/cancel`, { method: 'POST' });
    } catch(e) {}
    goto(`/student/${studentId}`);
  }
</script>

<svelte:head><title>{$lang==='fr'?'Vol en cours':'Flight in Progress'} — Summit</title></svelte:head>

<div class="af-page">

  <!-- Header -->
  <div class="af-top">
    <img src="/summit-logo.png" alt="Summit" class="af-logo logo-teal" />
    <div class="af-site mono dimmed xs">{flight?.site?.replace(/_/g,' ') || '—'}</div>
      {#if !launchTime}
  <button class="manual-launch-btn" on:click={manualLaunch}>
    ▲ {$lang==='fr' ? 'Je décolle maintenant' : 'I am launching now'}
  </button>
  <button class="cancel-flight-btn" on:click={cancelFlight}>
    {$lang==='fr' ? 'Annuler ce vol' : 'Cancel this flight'}
  </button>
  {/if}

  {#if landSignaled}
  <div class="landing-detected">
    <div style="font-size:1.1rem;font-weight:800;color:var(--teal)">
      {$lang==='fr' ? 'Atterrissage détecté' : 'Landing detected'} ✓
    </div>
    <div class="xs muted" style="margin-top:.2rem">
      {$lang==='fr' ? 'Redirection vers le formulaire post-vol…' : 'Redirecting to post-flight form…'}
    </div>
  </div>
  {/if}

  <div class="gps-pill" class:ok={gpsStatus==='active'} class:err={gpsStatus==='error'}>
      <span class="dot {gpsStatus==='active'?'dot-pulse':'dot-muted'}" style="width:7px;height:7px"></span>
      <span class="xs">{gpsStatus==='active' ? 'GPS' : gpsStatus==='error' ? 'GPS err' : 'GPS…'}</span>
    </div>
  </div>

  <!-- Big timer (session time) -->
  <div class="timer-block">
    <div class="timer-sub">{$lang==='fr'?'Durée session':'Session'}</div>
    <div class="timer-val">{fmtElapsed(elapsed)}</div>
    {#if isAirborne}
      <div class="airborne-pill">
        <span class="dot dot-teal" style="width:6px;height:6px"></span>
        <span class="xs">{$lang==='fr'?'En vol':'Airborne'} {fmtMs(airborneMs)}</span>
      </div>
    {/if}
  </div>

  <!-- Stats -->
  <div class="stats-card card">
    <div class="sc-row">
      <div class="sc-item">
        <div class="sc-val" style="color:{currentAlt!=null?'var(--teal)':'var(--txt-3)'}">{currentAlt!=null?Math.round(currentAlt)+' m':'— m'}</div>
        <div class="sc-lbl">{$lang==='fr'?'ALTITUDE':'ALTITUDE'}</div>
      </div>
      <div class="sc-item">
        <div class="sc-val" style="color:{spdKmh>=5?'var(--green)':'var(--txt-3)'}">{fmtSpd(currentSpd)}</div>
        <div class="sc-lbl">{$lang==='fr'?'VITESSE':'SPEED'}</div>
      </div>
      <div class="sc-item">
        <div class="sc-val">{distanceKm > 0 ? distanceKm+' km' : '—'}</div>
        <div class="sc-lbl">{$lang==='fr'?'DISTANCE':'DISTANCE'}</div>
      </div>
      <div class="sc-item">
        <div class="sc-val">{fixes.length}</div>
        <div class="sc-lbl">{$lang==='fr'?'POINTS':'POINTS'}</div>
      </div>
    </div>
  </div>

  <!-- Launch detection status -->
  {#if launchClock}
    <div class="launch-detected">
      <Icon name="flights" size={14} color="var(--green)" />
      <span class="small">{$lang==='fr'?'Décollage détecté à':'Launch detected at'} <strong>{launchClock}</strong></span>
    </div>
  {:else if gpsStatus === 'active'}
    <div class="launch-waiting">
      <Icon name="clock" size={13} color="var(--txt-3)" />
      <span class="xs dimmed">{$lang==='fr'?'En attente du décollage (5 km/h)…':'Waiting for launch (5 km/h)…'}</span>
    </div>
  {/if}

  <!-- Altitude profile -->
  {#if fixes.length > 2}
    {@const alts = fixes.map(f=>f.alt||0)}
    {@const minA = Math.min(...alts)}
    {@const maxA = Math.max(...alts)||1}
    {@const pts  = fixes.map((f,i)=>`${(i/(fixes.length-1))*100},${30-((f.alt||0)-minA)/(maxA-minA||1)*28}`).join(' ')}
    <div class="track-preview card-xs card">
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" class="track-svg">
        <polyline points={pts} fill="none" stroke="var(--teal)" stroke-width="1.5" opacity=".85" />
      </svg>
      <div class="track-meta dimmed xs">Max {Math.round(maxA)} m · {distanceKm} km</div>
    </div>
  {/if}

  <div class="spacer"></div>

  <!-- End flight -->
  <div class="end-section">
    <button class="end-btn" on:click={endFlight} disabled={saving}>
      {#if saving}
        <span class="spinner"></span>{$lang==='fr'?'Sauvegarde…':'Saving…'}
      {:else}
        <Icon name="flag" size={18} />{$lang==='fr'?'Terminer le vol':'End Flight'}
      {/if}
    </button>
    <p class="dimmed xs" style="text-align:center;margin-top:.5rem">
      {$lang==='fr'?'La trace GPS sera sauvegardée automatiquement':'GPS track saved automatically'}
    </p>
  </div>

  <!-- Emergency -->
  <div class="emergency-wrap">
    {#if !emergStep}
      <button class="emerg-trigger" on:click={() => emergStep=1}>
        <Icon name="alert" size={14} />{$lang==='fr'?'Urgence':'Emergency'}
      </button>
    {:else}
      <div class="emerg-open">
        <p class="small" style="margin-bottom:.75rem;color:var(--txt-2)">{$lang==='fr'?'Appuyez pour appeler :':'Press to call:'}</p>
        <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
          <a href="tel:+14387631350" class="btn-call instructor">
            <Icon name="phone" size={15} />Pat (+1 438 763 1350)
          </a>
          <a href="tel:911" class="btn-call nine11">
            <Icon name="phone" size={15} />911
          </a>
        </div>
        <button class="btn btn-ghost btn-xs" style="margin-top:.625rem" on:click={() => emergStep=0}>
          {$lang==='fr'?'Annuler':'Cancel'}
        </button>
      </div>
    {/if}
  </div>

</div>

<style>
  .af-page { min-height:100svh;display:flex;flex-direction:column;gap:.875rem;padding:1rem 1rem 1.5rem;max-width:480px;margin:0 auto;background:var(--bg) }

  .af-top { display:flex;align-items:center;gap:.625rem;padding-top:.25rem }
  .af-logo { height:26px;width:auto;flex-shrink:0 }
  .af-site { flex:1 }
  .gps-pill { display:flex;align-items:center;gap:.3rem;padding:.2rem .5rem;border-radius:var(--r-full);border:1px solid var(--border);background:var(--bg-raised) }
  .gps-pill.ok { border-color:var(--teal-border);background:var(--teal-lo) }
  .gps-pill.err { border-color:rgba(239,68,68,.3) }

  .timer-block { text-align:center;padding:1.5rem 0 .75rem;display:flex;flex-direction:column;align-items:center;gap:.5rem }
  .timer-sub { font-family:var(--ff-head);font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--txt-3) }
  .timer-val { font-family:var(--ff-head);font-size:clamp(3.5rem,18vw,5.5rem);font-weight:300;color:var(--teal);line-height:1;letter-spacing:.04em }
  .airborne-pill { display:flex;align-items:center;gap:.4rem;padding:.3rem .75rem;background:rgba(0,184,122,.1);border:1px solid var(--teal-border);border-radius:var(--r-full);color:var(--teal) }

  .stats-card { padding:.875rem }
  .sc-row { display:flex }
  .sc-item { flex:1;text-align:center }
  .sc-item+.sc-item { border-left:1px solid var(--border) }
  .sc-val { font-family:var(--ff-head);font-size:.95rem;font-weight:500;line-height:1;margin-bottom:.2rem;color:var(--txt) }
  .sc-lbl { font-family:var(--ff-head);font-size:.58rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--txt-3) }

  .launch-detected { display:flex;align-items:center;gap:.5rem;padding:.5rem .875rem;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:var(--r-sm) }
  .launch-waiting { display:flex;align-items:center;gap:.5rem;padding:.4rem .75rem }

  .track-preview { padding:.625rem }
  .track-svg { width:100%;height:50px }
  .track-meta { text-align:center;margin-top:.2rem }

  .spacer { flex:1;min-height:.5rem }

  .end-section { display:flex;flex-direction:column;align-items:stretch }
  .end-btn {
    display:flex;align-items:center;justify-content:center;gap:.625rem;
    background:var(--teal);color:var(--txt-inv);
    font-family:var(--ff-head);font-size:1.1rem;font-weight:700;
    padding:1.1rem;border-radius:var(--r-lg);border:none;cursor:pointer;
    transition:all .15s;letter-spacing:.02em;
  }
  .end-btn:hover:not(:disabled) { background:var(--teal-hi);transform:translateY(-1px) }
  .end-btn:disabled { opacity:.5;cursor:not-allowed }

  .emergency-wrap { text-align:center;padding-top:.5rem;border-top:1px solid var(--border) }
  .emerg-trigger {
    background:none;border:none;color:var(--red);opacity:.7;
    font-family:var(--ff-head);font-size:.78rem;font-weight:700;
    display:inline-flex;align-items:center;gap:.4rem;
    cursor:pointer;padding:.35rem .625rem;border-radius:var(--r-sm);
    transition:opacity .15s;
  }
  .emerg-trigger:hover { opacity:1 }
  .emerg-open { padding:.75rem;background:var(--red-lo);border:1px solid rgba(239,68,68,.25);border-radius:var(--r-md);display:flex;flex-direction:column;align-items:center }
  .btn-call { display:inline-flex;align-items:center;gap:.5rem;padding:.75rem 1.25rem;border-radius:var(--r-md);font-family:var(--ff-head);font-weight:700;font-size:.875rem;text-decoration:none }
  .btn-call.instructor { background:var(--teal);color:var(--txt-inv) }
  .btn-call.instructor:hover { background:var(--teal-hi);text-decoration:none;color:var(--txt-inv) }
  .btn-call.nine11 { background:var(--red);color:#fff }
  .btn-call.nine11:hover { background:#dc2626;text-decoration:none;color:#fff }
  .manual-launch-btn{
    width:100%;padding:.875rem;margin-bottom:.625rem;
    background:linear-gradient(135deg,rgba(0,184,122,.25),rgba(0,232,198,.15));
    border:2px solid var(--teal);border-radius:12px;
    color:var(--teal);font-size:1rem;font-weight:800;
    cursor:pointer;letter-spacing:.04em;
    animation:pulse-launch 2s ease-in-out infinite;
  }
  @keyframes pulse-launch{0%,100%{box-shadow:0 0 0 0 rgba(0,232,198,.3)}50%{box-shadow:0 0 0 8px rgba(0,232,198,.0)}}
  .cancel-flight-btn{width:100%;padding:.5rem;margin-bottom:.4rem;background:none;border:1px solid var(--border);border-radius:8px;color:var(--txt-3);font-size:.82rem;cursor:pointer}
  .cancel-flight-btn:hover{border-color:#ef4444;color:#ef4444}
  .landing-detected{text-align:center;padding:.875rem;background:rgba(0,232,198,.08);border:1px solid rgba(0,232,198,.3);border-radius:10px;margin-bottom:.5rem}
  .native-badge{background:rgba(0,232,198,.12);color:var(--teal);border-radius:8px;padding:.2rem .5rem;font-size:.65rem;font-weight:700;margin-bottom:.25rem;display:inline-block}
</style>