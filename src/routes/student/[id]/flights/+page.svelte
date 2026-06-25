<script>
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import { lang } from '$lib/stores/lang.js';
  import Icon           from '$lib/components/Icon.svelte';
  import CourseRoadmap   from '$lib/components/CourseRoadmap.svelte';
  import { uploadFile } from '$lib/upload.js';
  export let data;

  let removalReasonOpen = null;
  let removalRequested  = new Set();

  $: ({ flights, completed, student } = data);
  $: L = $lang === 'fr';

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d+'T12:00:00').toLocaleDateString(L?'fr-CA':'en-CA',{weekday:'short',month:'short',day:'numeric'});
  }
  function fmtDur(s) {
    if (!s) return '—';
    const h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
    return h>0?`${h}h ${m}m`:`${m}m`;
  }

  $: done    = flights.filter(f => f.status === 'complete');

  // ── Manual flight log ──────────────────────────────────────
  let showManualForm = false;
  let manualDate = new Date().toISOString().slice(0,10);
  let manualSite = '';
  let manualDurH = 0;
  let manualDurM = 20;
  let manualAlt  = '';
  let manualNotes = '';
  let manualSaving = false;
  let manualDone = false;
  let manualErr = '';

  async function saveManualFlight() {
    manualSaving = true; manualErr = '';
    const duration_seconds = (manualDurH * 3600) + (manualDurM * 60);
    const res = await fetch(`/api/student/${data.student?.id || '0'}/manual-flight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: manualDate,
        site: manualSite,
        duration_seconds,
        max_altitude_m: manualAlt ? Number(manualAlt) : null,
        notes: manualNotes,
      }),
    });
    manualSaving = false;
    if (res.ok) {
      manualDone = true;
      showManualForm = false;
      setTimeout(() => location.reload(), 800);
    } else {
      const j = await res.json().catch(() => ({}));
      manualErr = j.error || 'Erreur lors de l\'enregistrement.';
    }
  }
  $: pending = flights.filter(f => f.status !== 'complete');

  // ── Tabs ──────────────────────────────────────────────────────
  let mainTab = 'mine';
  let allFlights = [];
  let allFlightsLoaded = false;
  let allFlightsLoading = false;
  let allFlightMedia = {};  // { flightId: [...media] }
  let allFlightUploading = null;
  let allFlightProgress  = 0;

  async function uploadToFeed(flightId, files) {
    if (!files?.length) return;
    allFlightUploading = flightId;
    allFlightProgress  = 0;
    for (const file of Array.from(files)) {
      const res = await uploadFile(file, {
        purpose:'flight_media',
        meta:{ flight_id:flightId },
        onProgress: p => { allFlightProgress = p; }
      });
      if (res.ok) {
        allFlightMedia = {
          ...allFlightMedia,
          [flightId]: [...(allFlightMedia[flightId]||[]), { id:res.id, url:res.url, r2_key:res.r2_key||'', type:file.type?.startsWith('video')?'video':'photo' }]
        };
      }
    }
    allFlightUploading = null;
    allFlightProgress  = 0;
  }

  async function loadAllFlights() {
    if (allFlightsLoaded) return;
    allFlightsLoading = true;
    try {
      const res = await fetch('/api/flights');
      allFlights = await res.json();
      allFlightsLoaded = true;
    } catch(e) { console.error(e); }
    allFlightsLoading = false;
  }

  function switchTab(tab) {
    mainTab = tab;
    if (tab === 'all') loadAllFlights();
  }

  // ── Expanded flight ────────────────────────────────────────────
  let openId     = null;
  let mediaMap   = {};   // { flightId: [...media] }
  let loadingMedia = null;
  let mapInstances = {};

  async function toggleFlight(id) {
    if (openId === id) {
      openId = null;
      if (mapInstances[id]) { mapInstances[id].remove(); delete mapInstances[id]; }
    } else {
      openId = id;
      // Lazy load media
      if (!mediaMap[id]) await fetchMedia(id);
      // Render map next tick
      setTimeout(() => renderMap(id), 60);
    }
  }

  async function fetchMedia(flightId) {
    loadingMedia = flightId;
    try {
      const res = await fetch(`/api/flight/${flightId}/media`);
      const items = await res.json();
      mediaMap = { ...mediaMap, [flightId]: items };
    } catch(e) { mediaMap = { ...mediaMap, [flightId]: [] }; }
    loadingMedia = null;
  }

  async function renderMap(id) {
    const f = done.find(x => x.id === id);
    if (!f?.track_geojson) return;
    const el = document.getElementById(`fmap-${id}`);
    if (!el || mapInstances[id]) return;
    try {
      const Lf = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      const geo    = JSON.parse(f.track_geojson);
      const coords = geo.geometry?.coordinates ?? [];
      if (!coords.length) return;
      const ll  = coords.map(([lon,lat]) => [lat,lon]);
      const map = Lf.map(el, { zoomControl:false, attributionControl:false });
      Lf.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {maxZoom:19}).addTo(map);
      const line = Lf.polyline(ll,{color:'#00b87a',weight:3}).addTo(map);
      map.fitBounds(line.getBounds(),{padding:[16,16]});
      mapInstances[id] = map;
    } catch(e) { console.error('[map]', e); }
  }

  // ── Media upload ───────────────────────────────────────────────
  let uploadingId  = null;
  let uploadProgress = 0;
  let uploadError  = '';



  async function uploadMedia(flightId, files) {
    if (!files?.length) return;
    uploadingId   = flightId;
    uploadProgress = 0;
    uploadError   = '';
    for (const file of Array.from(files)) {
      const res = await uploadFile(file, {
        purpose: 'flight_media',
        meta: { flight_id: flightId },
        onProgress: p => { uploadProgress = p; },
      });
      if (res.ok) {
        const newItem = { id: res.id, url: res.url, r2_key: res.r2_key||'', type: file.type?.startsWith('video')?'video':'photo', caption:'' };
        mediaMap = { ...mediaMap, [flightId]: [...(mediaMap[flightId]||[]), newItem] };
      } else {
        uploadError = res.error || 'Upload failed';
      }
    }
    uploadingId = null;
    uploadProgress = 0;
  }

  function mediaUrl(m) { return m?.url || ''; }
  function handleDownload(m) {
    const u = m?.url || '';
    if (!u) return;
    if (u.startsWith('data:')) {
      // Convert base64 data URL to blob download
      const a = document.createElement('a');
      a.href = u;
      a.download = 'photo';
      a.click();
      return;
    }
    window.open(downloadUrl(m), '_blank');
  }
  function downloadUrl(m) {
    if (!m?.url) return '';
    const u = m.url;
    // base64 data URLs cannot have query params - trigger download via blob instead
    if (u.startsWith('data:')) return u;  // handled separately
    return u.includes('?') ? u + '&dl=1' : u + '?dl=1';
  }

  async function deleteMedia(flightId, mediaId) {
    if (!confirm(L?'Supprimer ce média?':'Delete this media?')) return;
    const res  = await fetch(`/api/upload?id=${mediaId}`, { method:'DELETE' });
    const json = await res.json();
    if (json.ok) {
      mediaMap = { ...mediaMap, [flightId]: (mediaMap[flightId]||[]).filter(m => m.id !== mediaId) };
    }
  }

  // ── Debrief ────────────────────────────────────────────────────
  const PHASES = [
    {key:'wing_up',   fr:'Gonflage',         en:'Inflation',          group:'launch'},
    {key:'wing_ctrl', fr:'Contrôle',         en:'Control',            group:'launch'},
    {key:'run',       fr:'Course',           en:'Run',                group:'launch'},
    {key:'exercises', fr:'Exercices en vol', en:'In-flight exercises',group:'flight'},
    {key:'approach',  fr:'Approche',         en:'Approach',           group:'landing'},
    {key:'final',     fr:'Finale',           en:'Final',              group:'landing'},
    {key:'flare',     fr:'Arrondi',          en:'Flare',              group:'landing'},
  ];
  let debriefFlight  = null;
  let lightboxUrl    = null;  // fullscreen image viewer
  let selectedPhases = new Set();
  let debriefNote    = '';
  let debriefsByFlight = {};
  let debriefLoading   = null;
  let debriefSent      = null;
  let debriefErr       = '';
  let commentingId     = null;   // debrief id being commented on
  let commentText      = {};     // { debriefId: string }

  function togglePhase(key) {
    const s = new Set(selectedPhases);
    s.has(key) ? s.delete(key) : s.add(key);
    selectedPhases = s;
  }

  async function openDebrief(flightId) {
    debriefFlight = flightId;
    selectedPhases = new Set();
    debriefErr = '';
    if (!debriefsByFlight[flightId]) await fetchDebriefs(flightId);
  }

  async function fetchDebriefs(flightId) {
    debriefLoading = flightId;
    try {
      const res = await fetch(`/api/debrief?flight_id=${flightId}`);
      debriefsByFlight = { ...debriefsByFlight, [flightId]: await res.json() };
    } catch(e) { debriefsByFlight = { ...debriefsByFlight, [flightId]: [] }; }
    debriefLoading = null;
  }

  async function submitComment(debriefId, flightId) {
    const text = (commentText[debriefId] || '').trim();
    if (!text) return;
    try {
      await fetch('/api/debrief-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debrief_id: debriefId, comment: text })
      });
      commentText = { ...commentText, [debriefId]: '' };
      commentingId = null;
      await fetchDebriefs(flightId);
    } catch(e) {}
  }

  async function markDebriefRead(debriefId, flightId) {
    try {
      await fetch('/api/mark-debrief-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: debriefId })
      });
      // Refresh the list so the button disappears
      await fetchDebriefs(flightId);
    } catch(e) {}
  }

  async function sendDebrief(flightId) {
    if (!selectedPhases.size && !debriefNote.trim()) return;
    debriefErr = '';
    try {
      const res  = await fetch('/api/debrief', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'request', flight_id:flightId, phases:[...selectedPhases], note:debriefNote.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        debriefSent  = flightId;
        debriefFlight = null;
        selectedPhases = new Set();
        debriefNote = '';
        await fetchDebriefs(flightId);
        setTimeout(() => debriefSent=null, 3000);
      } else {
        debriefErr = json.error || `Erreur (${res.status})`;
      }
    } catch(e) {
      debriefErr = e.message;
    }
  }
</script>

<svelte:head><title>{L?'Mes vols':'My Flights'} — Summit</title></svelte:head>

<!-- Pending flight banner -->
{#each pending as pf}
<div class="pending-banner">
  <span class="xs" style="color:var(--amber);font-weight:700">
    {L?'Vol en cours — formulaire à compléter':'Flight in progress — complete the form'}
  </span>
  <a href="/student/{student?.id}/postflight/{pf.id}" class="btn btn-primary btn-sm">{L?'Compléter':'Complete'}</a>
</div>
{/each}

{#if completed}
<div class="alert alert-ok"><Icon name="check" size={13}/> {L?'Vol enregistré!':'Flight logged!'}</div>
{/if}

<!-- Page header -->
<div class="page-hd">
  <div>
    <h1>{L?'Vols':'Flights'}</h1>
    <span class="xs muted">{done.length} {L?'vol(s)':'flight(s)'}</span>
  </div>
  <a href="/student/{student?.id}/preflight" class="btn btn-primary btn-sm">+ {L?'Nouveau':'New'}</a>
</div>

<!-- Tabs -->
<div class="main-tabs">
  <button class="main-tab" class:active={mainTab==='mine'} on:click={() => switchTab('mine')}>
    {L?'Mes vols':'My Flights'} <span class="tc">{done.length}</span>
  </button>
  <button class="main-tab" class:active={mainTab==='all'} on:click={() => switchTab('all')}>
    {L?'Tous':'All Flights'}
  </button>
</div>

{#if uploadError}
<div class="alert alert-err">{uploadError}</div>
{/if}

<!-- MY FLIGHTS -->
{#if mainTab === 'mine'}
<!-- Manual flight button + form -->
<div style="display:flex;justify-content:flex-end;margin-bottom:.5rem">
  <button class="btn btn-secondary btn-sm" on:click={() => showManualForm = !showManualForm}>
    + {L ? 'Ajouter un vol manuellement' : 'Log a flight manually'}
  </button>
</div>
{#if showManualForm}
<div class="card manual-log-card">
  <div class="xs" style="font-weight:800;color:var(--txt);margin-bottom:.625rem">
    {L ? 'Nouveau vol hors Yamaska' : 'New off-site flight'}
  </div>
  {#if manualErr}<div class="xs" style="color:#ef4444;margin-bottom:.3rem">{manualErr}</div>{/if}
  <div class="ml-grid">
    <label class="ml-field">
      <span class="xs muted">{L?'Date':'Date'}</span>
      <input type="date" bind:value={manualDate} class="ml-inp" />
    </label>
    <label class="ml-field">
      <span class="xs muted">{L?'Site / lieu':'Site / location'}</span>
      <input type="text" bind:value={manualSite} placeholder={L?'ex. Bromont':'e.g. Bromont'} class="ml-inp" />
    </label>
    <label class="ml-field">
      <span class="xs muted">{L?'Durée':'Duration'}</span>
      <div style="display:flex;gap:.3rem;align-items:center">
        <input type="number" min="0" max="12" bind:value={manualDurH} class="ml-inp" style="width:48px;text-align:center" />
        <span class="xs muted">h</span>
        <input type="number" min="0" max="59" bind:value={manualDurM} class="ml-inp" style="width:48px;text-align:center" />
        <span class="xs muted">min</span>
      </div>
    </label>
    <label class="ml-field">
      <span class="xs muted">{L?'Altitude max (m)':'Max altitude (m)'}</span>
      <input type="number" min="0" bind:value={manualAlt} placeholder="—" class="ml-inp" style="width:80px" />
    </label>
    <label class="ml-field" style="grid-column:1/-1">
      <span class="xs muted">{L?'Notes':'Notes'}</span>
      <textarea bind:value={manualNotes} rows="2" placeholder={L?'Conditions, exercices…':'Conditions, exercises…'} class="ml-inp ml-ta"></textarea>
    </label>
  </div>
  <div style="display:flex;gap:.4rem;margin-top:.5rem">
    <button class="btn btn-primary btn-sm" on:click={saveManualFlight} disabled={manualSaving}>
      {manualSaving?'…':(L?'Enregistrer':'Save')}
    </button>
    <button class="btn btn-secondary btn-sm" on:click={() => showManualForm=false}>
      {L?'Annuler':'Cancel'}
    </button>
  </div>
</div>
{/if}

{#if done.length === 0}
<div class="empty-state">
  <Icon name="flights" size={36} color="var(--txt-3)" />
  <p class="muted">{L?'Aucun vol complété.':'No completed flights yet.'}</p>
</div>
{:else}
<div class="flight-list">
  {#each done as f, i}
  {@const isOpen = openId === f.id}
  {@const media  = mediaMap[f.id] || []}
  <div class="flight-card" class:open={isOpen}>

    <!-- Summary row -->
    <button class="flight-summary" on:click={() => toggleFlight(f.id)}>
      <span class="fl-num mono xs muted">{done.length - i}</span>
      <div class="fl-main">
        <div class="fl-date">{fmtDate(f.date)}</div>
        <div class="fl-sub xs muted">
          {f.site?.replace(/_/g,' ') || '—'}
          {#if f.duration_seconds} · {fmtDur(f.duration_seconds)}{/if}
        </div>
      </div>
      <div class="fl-chips">
        {#if f.track_geojson}<span class="chip chip-teal">GPS</span>{/if}
              </div>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
        style="flex-shrink:0;transform:rotate({isOpen?180:0}deg);transition:transform .2s">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <!-- Expanded detail -->
    {#if isOpen}
    <div class="flight-detail">

      <!-- Stats -->
      <div class="detail-stats">
        {#each [
          [fmtDur(f.duration_seconds), L?'Durée':'Duration', 'var(--teal)'],
          [f.distance_km?f.distance_km+' km':'—', L?'Distance':'Dist.', 'var(--txt)'],
          [f.max_altitude_m?f.max_altitude_m+' m':'—', 'Alt. max', 'var(--txt)'],
          [f.launch_quality?f.launch_quality+'/5':'—', L?'Décollage':'Launch', 'var(--txt)'],
          [f.landing_quality?f.landing_quality+'/5':'—', L?'Atterr.':'Landing', 'var(--txt)'],
        ] as [val,lbl,col]}
        <div class="dstat">
          <div class="dstat-val" style="color:{col}">{val}</div>
          <div class="dstat-lbl xs muted">{lbl}</div>
        </div>
        {/each}
      </div>

      <!-- Map -->
      {#if f.track_geojson}
      <div id="fmap-{f.id}" class="flight-map"></div>
      {/if}

      <!-- Notes -->
      {#if f.what_went_well || f.what_to_improve}
      <div class="notes-grid">
        {#if f.what_went_well}
        <div class="note-block">
          <div class="note-lbl xs">{L?'Ce qui a bien marché':'What went well'}</div>
          <p class="note-txt xs">{f.what_went_well}</p>
        </div>
        {/if}
        {#if f.what_to_improve}
        <div class="note-block">
          <div class="note-lbl xs">{L?'À améliorer':'To improve'}</div>
          <p class="note-txt xs">{f.what_to_improve}</p>
        </div>
        {/if}
      </div>
      {/if}

      <!-- Media section -->
      <div class="media-section">
        <div class="media-hdr">
          <span class="xs" style="font-weight:700;color:var(--txt-2)">{L?'Photos / Vidéos':'Photos / Videos'}</span>
          <label class="btn btn-ghost btn-xs" style="cursor:pointer;display:inline-flex;align-items:center;gap:.3rem"
            class:uploading-btn={uploadingId===f.id}>
            {#if uploadingId===f.id}
              <div class="spinner-xs"></div>
              {uploadProgress > 0 ? uploadProgress+'%' : '…'}
            {:else}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {L?'Ajouter':'Add'}
            {/if}
            <input type="file" accept="image/*,video/*,.heic,.heif,.mov,.mp4" multiple style="display:none"
              disabled={!!uploadingId}
              on:change={e => { uploadMedia(f.id, e.target.files); e.target.value=''; }} />
          </label>
        </div>
        <!-- Upload progress bar -->
        {#if uploadingId===f.id && uploadProgress > 0}
        <div class="upload-progress">
          <div class="upload-bar" style="width:{uploadProgress}%"></div>
        </div>
        {/if}
        {#if loadingMedia===f.id}
          <p class="xs muted">Chargement…</p>
        {:else if media.length}
        <div class="media-grid">
          {#each media as m (m.id)}
          <div class="media-item">
            {#if m.type==='video'}
              <video src={mediaUrl(m)} class="media-thumb" controls playsinline preload="none" loading="lazy"></video>
            {:else}
              <button class="media-img-btn" on:click={() => lightboxUrl = mediaUrl(m)}>
                <img src={mediaUrl(m)} alt="Photo" class="media-thumb" loading="lazy" decoding="async" />
              </button>
            {/if}
            <a class="media-dl" href={downloadUrl(m, 'media.'+((m.type==='video')?'mp4':'jpg'))} target="_blank" download title={L?'Télécharger':'Download'}>
              <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </a>
            <div class="media-actions">
              <a href={downloadUrl(m)} class="media-act" download title={L?'Télécharger':'Download'}><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>
              <button class="media-act" on:click={() => deleteMedia(f.id, m.id)} title={L?'Supprimer':'Delete'}>
              <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            </div>
          </div>
          {/each}
        </div>
        {:else}
          <p class="xs muted">{L?'Aucun média.':'No media yet.'}</p>
        {/if}
      </div>

      <!-- Debrief request -->
      <div class="debrief-section">
        <div class="debrief-hdr">
          <span class="xs" style="font-weight:700;color:var(--txt-2)">{L?'Débriefing instructeur':'Instructor Debriefing'}</span>
          {#if debriefFlight !== f.id}
          <button class="btn btn-ghost btn-xs" on:click={() => openDebrief(f.id)}>
            {L?'Demander un débriefing':'Request debriefing'}
          </button>
          {/if}
        </div>

        {#if debriefFlight === f.id}
        <div class="debrief-form">
          <p class="xs muted">{L?'Sélectionne les phases à débriéfer:':'Select phases to debrief:'}</p>
          {#each [['launch',L?'Décollage':'Launch'],['flight',L?'En vol':'In-flight'],['landing',L?'Atterrissage':'Landing']] as [grp,grpLbl]}
          <div class="phase-group">
            <div class="xs" style="color:var(--txt-3);font-weight:700;margin-bottom:.2rem">{grpLbl}</div>
            <div class="phase-chips">
              {#each PHASES.filter(p=>p.group===grp) as ph}
              <button class="phase-chip" class:selected={selectedPhases.has(ph.key)}
                on:click={() => togglePhase(ph.key)}>
                {L ? ph.fr : ph.en}
              </button>
              {/each}
            </div>
          </div>
          {/each}
          <div class="debrief-note">
            <div class="xs" style="color:var(--txt-3);font-weight:700;margin-bottom:.2rem">
              {L?'Ce que tu veux débriéfer / ce que tu as ressenti':'What you want to debrief / how it felt'}
            </div>
            <textarea class="debrief-note-ta" rows="3" bind:value={debriefNote}
              placeholder={L?'Décris ce qui s\'est passé, ce qui t\'a surpris, ce sur quoi tu veux des conseils…':'Describe what happened, what surprised you, what you want advice on…'}></textarea>
          </div>
          {#if debriefErr}<div class="xs" style="color:var(--red);margin-top:.35rem">{debriefErr}</div>{/if}
          <div style="display:flex;gap:.5rem;margin-top:.5rem">
            <button class="btn btn-primary btn-sm" disabled={!selectedPhases.size && !debriefNote.trim()}
              on:click={() => sendDebrief(f.id)}>
              {L?'Envoyer':'Send'}
            </button>
            <button class="btn btn-ghost btn-sm" on:click={() => {debriefFlight=null; debriefErr=''; debriefNote='';}}>
              {L?'Annuler':'Cancel'}
            </button>
          </div>
        </div>
        {/if}

        {#if debriefSent===f.id}
        <div class="alert alert-ok xs">{L?'Demande envoyée!':'Request sent!'}</div>
        {/if}

        {#if debriefLoading===f.id}
          <p class="xs muted">…</p>
        {:else if debriefsByFlight[f.id]?.length}
        <div class="debrief-list">
          {#each debriefsByFlight[f.id] as d}
          <div class="debrief-card" class:debrief-unread={d.content && !d.viewed_at}>
            <div class="xs muted" style="margin-bottom:.3rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
              {#if d.instructor_name}<strong style="color:var(--teal)">{d.instructor_name}</strong> · {/if}
              {new Date(d.created_at).toLocaleDateString(L?'fr-CA':'en-CA',{month:'short',day:'numeric'})}
              {#if d.status==='pending'}
                <span class="badge badge-pend xs">{L?'En attente':'Pending'}</span>
              {:else if d.viewed_at}
                <span class="badge badge-ok xs">✓ {L?'Lu':'Read'}</span>
              {/if}
            </div>
            {#if d.content}
              <p class="xs" style="color:var(--txt-2);margin:0 0 .5rem;line-height:1.5">{d.content}</p>
              {#if !d.viewed_at}
              <div class="debrief-actions">
                <button class="btn-understood" on:click={() => markDebriefRead(d.id, f.id)}>
                  ✓ {L ? 'Confirmer compris' : 'Confirm understood'}
                </button>
                <button class="btn-comment-toggle" on:click={() => commentingId = commentingId===d.id ? null : d.id}>
                  💬 {L ? 'Commenter' : 'Comment'}
                </button>
              </div>
              {/if}
              {#if commentingId === d.id}
              <div class="comment-box">
                <textarea class="comment-input" rows="2"
                  placeholder={L ? 'Votre commentaire…' : 'Your comment…'}
                  bind:value={commentText[d.id]}></textarea>
                <button class="btn btn-primary btn-xs" on:click={() => submitComment(d.id, f.id)}>
                  {L ? 'Envoyer' : 'Send'}
                </button>
              </div>
              {/if}
              {#if d.student_comment}
              <div class="student-comment xs">
                <span style="color:var(--txt-3)">{L?'Votre note':'Your note'}:</span> {d.student_comment}
              </div>
              {/if}
            {/if}
          </div>
          {/each}
        </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="detail-footer">
        <a href="/flight/{f.id}" target="_blank" class="btn btn-ghost btn-xs">{L?'Page publique':'Public page'}</a>
        <a href="/student/{student?.id}/postflight/{f.id}?readonly=1" class="btn btn-ghost btn-xs">{L?'Voir le formulaire':'View form'}</a>
        <!-- Students cannot delete flights directly — they request instructor approval -->
        {#if removalRequested.has(f.id)}
          <span class="xs muted" style="margin-left:auto;display:inline-flex;align-items:center;gap:.3rem">
            <Icon name="clock" size={11} />{L?'Suppression demandée — en attente':'Removal requested — pending'}
          </span>
        {:else if removalReasonOpen === f.id}
          <form method="POST" action="?/requestRemoval" use:enhance={() => {
              return async ({ result, update }) => {
                if (result?.type === 'success') {
                  removalRequested = new Set([...removalRequested, f.id]);
                  removalReasonOpen = null;
                } else { await update(); }
              };
            }} style="margin-left:auto;display:flex;flex-direction:column;gap:.35rem;min-width:230px">
            <input type="hidden" name="id" value={f.id} />
            <textarea name="reason" rows="2" placeholder="{L?'Raison (optionnelle)':'Reason (optional)'}"
              style="width:100%;font-size:.7rem;padding:.3rem;background:var(--bg-2);border:1px solid var(--border);border-radius:5px;color:var(--txt)"></textarea>
            <div style="display:flex;gap:.35rem">
              <button type="submit" class="btn btn-danger btn-xs">
                {L?'Envoyer la demande':'Send request'}
              </button>
              <button type="button" class="btn btn-ghost btn-xs" on:click={()=>removalReasonOpen=null}>
                {L?'Annuler':'Cancel'}
              </button>
            </div>
          </form>
        {:else}
          <button class="btn btn-ghost btn-xs" style="margin-left:auto;color:var(--red,#dc2626)"
            on:click={()=>removalReasonOpen=f.id} title={L?'Soumettre une demande à l\'instructeur':'Submit a request to the instructor'}>
            {L?'Demander la suppression':'Request removal'}
          </button>
        {/if}
      </div>
    </div>
    {/if}
  </div>
  {/each}
</div>
{/if}
{/if}<!-- end mine tab -->

<!-- ALL FLIGHTS -->
{#if mainTab==='all'}
<div class="all-feed">
  {#if allFlightsLoading}
    <div class="empty-state muted xs">{L?'Chargement…':'Loading…'}</div>
  {:else if !allFlights.length}
    <div class="empty-state muted xs">{L?'Aucun vol public.':'No public flights yet.'}</div>
  {:else}
    {#each allFlights as f}
    <div class="feed-card">
      <div class="feed-top">
        <span class="feed-pilot">{f.student_name}</span>
        <span class="xs muted">{fmtDate(f.date)}{f.site?' · '+f.site.replace(/_/g,' '):''}</span>
        <a href="/flight/{f.id}" target="_blank" class="btn btn-ghost btn-xs" style="margin-left:auto">{L?'Voir':'View'}</a>
      </div>
      {#if f.duration_seconds}<div class="xs muted" style="margin-bottom:.35rem">{fmtDur(f.duration_seconds)}{f.distance_km?' · '+f.distance_km+' km':''}</div>{/if}
      {#if (allFlightMedia[f.id]||[]).length}
      <div class="feed-media-mini">
        {#each allFlightMedia[f.id] as m (m.id)}
          <a href={mediaUrl(m)} target="_blank" rel="noopener">
            <img src={mediaUrl(m)} alt="Photo" class="feed-thumb" loading="lazy" decoding="async" />
          </a>
        {/each}
      </div>
      {/if}
      <label class="btn btn-ghost btn-xs" style="cursor:pointer;display:inline-flex;align-items:center;gap:.3rem;margin-top:.25rem">
        {#if allFlightUploading===f.id}<div class="spinner-xs"></div>{L?'Envoi…':'Uploading…'}{:else}
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {L?'Ajouter photo/vidéo':'Add photo/video'}
        {/if}
        <input type="file" accept="image/*,video/*,.heic,.heif,.mov,.mp4" multiple style="display:none"
          disabled={!!allFlightUploading}
          on:change={e => { uploadToFeed(f.id, e.target.files); e.target.value=''; }} />
      </label>
      {#if allFlightUploading===f.id && allFlightProgress > 0}
      <div class="upload-progress" style="margin-top:.35rem">
        <div class="upload-bar" style="width:{allFlightProgress}%"></div>
      </div>
      {/if}
    </div>
    {/each}
  {/if}
</div>
{/if}

{#if lightboxUrl}
<div class="lightbox-overlay" on:click|self={() => lightboxUrl=null} role="dialog" aria-modal="true">
  <div class="lightbox-box">
    <img src={lightboxUrl} alt="Photo" class="lightbox-img" />
    <div class="lightbox-actions">
      <a href={lightboxUrl} download class="btn btn-primary btn-sm">⬇ {L?'Télécharger':'Download'}</a>
      <button class="btn btn-ghost btn-sm" on:click={() => lightboxUrl=null}>✕ {L?'Fermer':'Close'}</button>
    </div>
  </div>
</div>
{/if}

<style>
  .page-hd{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:.75rem}
  h1{font-size:1.2rem;font-weight:700;color:var(--txt)}
  .pending-banner{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:.625rem .875rem;display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.625rem}
  .empty-state{display:flex;flex-direction:column;align-items:center;gap:.5rem;padding:2.5rem 1rem;text-align:center}
  .main-tabs{display:flex;gap:.25rem;margin-bottom:.75rem;background:var(--bg-raised);border-radius:9px;padding:.2rem}
  .main-tab{flex:1;padding:.35rem;border-radius:7px;border:none;cursor:pointer;font-size:.78rem;font-weight:600;color:var(--txt-3);background:none;display:flex;align-items:center;justify-content:center;gap:.3rem}
  .main-tab.active{background:var(--bg-card);color:var(--txt);box-shadow:0 1px 3px rgba(0,0,0,.12)}
  .tc{background:var(--bg-2);border-radius:var(--r-full);padding:.05rem .3rem;font-size:.68rem;font-family:var(--ff-head)}
  .flight-list{display:flex;flex-direction:column;gap:.4rem}
  .flight-card{background:var(--bg-raised);border-radius:10px;overflow:hidden;border:1px solid var(--border)}
  .flight-card.open{border-color:var(--teal-border)}
  .flight-summary{display:flex;align-items:center;gap:.5rem;width:100%;background:none;border:none;cursor:pointer;padding:.625rem .75rem;text-align:left}
  .fl-num{flex-shrink:0;min-width:20px;text-align:right}
  .fl-main{flex:1;min-width:0}
  .fl-date{font-weight:600;font-size:.85rem;color:var(--txt)}
  .fl-sub{margin-top:.1rem}
  .fl-chips{display:flex;gap:.2rem}
  .chip{font-family:var(--ff-head);font-size:.62rem;font-weight:700;padding:.1rem .35rem;border-radius:var(--r-full)}
  .chip-teal{background:rgba(0,184,122,.15);color:var(--teal)}
  .chip-amber{background:rgba(245,158,11,.15);color:var(--amber)}
  .flight-detail{padding:.625rem .75rem;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:.75rem}
  .detail-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem}
  @media(min-width:380px){.detail-stats{grid-template-columns:repeat(6,1fr)}}
  .dstat{background:var(--bg-2);border-radius:6px;padding:.35rem .25rem;text-align:center}
  .dstat-val{font-family:var(--ff-head);font-size:.82rem;font-weight:700}
  .dstat-lbl{margin-top:.1rem}
  .flight-map{height:200px;border-radius:8px;overflow:hidden;border:1px solid var(--border);position:relative;z-index:0}
  .notes-grid{display:flex;flex-direction:column;gap:.4rem}
  .note-block{background:var(--bg-2);border-radius:6px;padding:.4rem .5rem}
  .note-lbl{font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--txt-3);margin-bottom:.15rem}
  .note-txt{color:var(--txt-2);line-height:1.45;margin:0}
  /* Media */
  .media-section{display:flex;flex-direction:column;gap:.4rem}
  .media-hdr{display:flex;align-items:center;justify-content:space-between}
  .uploading-btn{opacity:.6;cursor:wait}
  .upload-progress{height:4px;background:var(--border);border-radius:2px;overflow:hidden}
  .upload-bar{height:100%;background:var(--teal);border-radius:2px;transition:width .2s}
  .media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:.3rem}
  .media-item{position:relative;border-radius:6px;overflow:hidden;aspect-ratio:1;background:var(--bg-2)}
  .media-thumb{width:100%;height:100%;object-fit:cover;display:block}
  .media-dl{position:absolute;bottom:3px;right:3px;width:18px;height:18px;border-radius:50%;background:rgba(0,184,122,.8);display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none}
  .media-actions{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:flex-end;gap:2px;padding:3px;background:linear-gradient(to top,rgba(0,0,0,.7),transparent)}
  .media-action-btn{width:20px;height:20px;border-radius:4px;background:rgba(0,0,0,.5);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;flex-shrink:0}
  .media-del{border:none}
  /* Debrief */
  .debrief-section{display:flex;flex-direction:column;gap:.4rem}
  .debrief-hdr{display:flex;align-items:center;justify-content:space-between}
  .debrief-form{background:var(--bg-2);border-radius:8px;padding:.5rem .625rem;display:flex;flex-direction:column;gap:.35rem}
  .phase-group{display:flex;flex-direction:column;gap:.2rem}
  .debrief-note-ta{width:100%;background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:.5rem;color:var(--txt);font-size:.82rem;font-family:inherit;resize:vertical}
  .phase-chips{display:flex;flex-wrap:wrap;gap:.25rem}
  .phase-chip{font-size:.75rem;padding:.2rem .5rem;border-radius:var(--r-full);border:1px solid var(--border);background:var(--bg-raised);color:var(--txt-2);cursor:pointer}
  .phase-chip.selected{background:rgba(0,184,122,.15);border-color:var(--teal);color:var(--teal);font-weight:700}
  .debrief-list{display:flex;flex-direction:column;gap:.35rem}
  .debrief-card{background:var(--bg-2);border-radius:7px;padding:.5rem .625rem;border-left:3px solid var(--teal)}
  /* Footer */
  .detail-footer{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;padding-top:.35rem;border-top:1px solid var(--border)}
  /* All feed */
  .all-feed{display:flex;flex-direction:column;gap:.4rem}
  .feed-card{background:var(--bg-raised);border-radius:9px;padding:.625rem .75rem}
  .feed-top{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-bottom:.15rem}
  .feed-pilot{font-weight:700;font-size:.85rem;color:var(--txt)}
  .feed-media-mini{display:flex;flex-wrap:wrap;gap:.25rem;margin:.25rem 0}
  .feed-thumb{width:60px;height:60px;object-fit:cover;border-radius:5px;display:block}
  .spinner-xs{width:10px;height:10px;border:2px solid rgba(0,0,0,.1);border-top-color:var(--teal);border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0}
  /* Spinner */
  .spinner-xs{width:10px;height:10px;border:2px solid rgba(0,0,0,.15);border-top-color:var(--teal);border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0}
  @keyframes spin{to{transform:rotate(360deg)}}
  .xs{font-size:.75rem}
  .muted{color:var(--txt-3)}
  .manual-log-card{padding:.75rem .875rem;margin-bottom:.75rem;border:1px solid rgba(0,232,198,.2)}
  .ml-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
  .ml-field{display:flex;flex-direction:column;gap:.2rem}
  .ml-inp{background:var(--bg-2);border:1px solid var(--border);border-radius:7px;padding:.35rem .45rem;color:var(--txt);font-size:.85rem;width:100%;box-sizing:border-box}
  .ml-ta{resize:vertical;min-height:50px;font-family:inherit}
  .debrief-unread{border-left:3px solid var(--teal);padding-left:.625rem}
  .debrief-actions{display:flex;gap:.5rem;margin-top:.25rem}
  .btn-understood{flex:1;background:rgba(0,232,198,.12);border:1.5px solid var(--teal);color:var(--teal);border-radius:8px;padding:.4rem .875rem;font-size:.78rem;font-weight:700;cursor:pointer}
  .btn-understood:hover{background:rgba(0,232,198,.25)}
  .btn-comment-toggle{background:var(--bg-2);border:1px solid var(--border);color:var(--txt-2);border-radius:8px;padding:.4rem .75rem;font-size:.78rem;cursor:pointer}
  .btn-comment-toggle:hover{border-color:var(--teal);color:var(--teal)}
  .comment-box{margin-top:.5rem;display:flex;flex-direction:column;gap:.35rem}
  .comment-input{width:100%;background:var(--bg-2);border:1.5px solid var(--border);border-radius:8px;color:var(--txt);font-size:.82rem;padding:.4rem .625rem;resize:vertical;font-family:inherit}
  .comment-input:focus{outline:none;border-color:var(--teal)}
  .student-comment{margin-top:.3rem;padding:.3rem .5rem;background:var(--bg-2);border-radius:6px;color:var(--txt-2)}
  .badge-ok{background:rgba(34,197,94,.12);color:#4ade80;border-radius:4px;padding:.05rem .35rem}
  .media-img-btn{background:none;border:none;padding:0;cursor:zoom-in;display:block;width:100%}
  .lightbox-overlay{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;flex-direction:column;gap:1rem}
  .lightbox-box{display:flex;flex-direction:column;align-items:center;gap:.75rem;max-width:100%;max-height:90svh}
  .lightbox-img{max-width:min(90vw,800px);max-height:75svh;object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.6)}
  .lightbox-actions{display:flex;gap:.75rem;justify-content:center}
  .lightbox-box{display:flex;flex-direction:column;align-items:center;gap:1rem;max-width:100%;max-height:100%}
  .lightbox-img{max-width:min(90vw,900px);max-height:80vh;object-fit:contain;border-radius:8px}
  .lightbox-actions{display:flex;gap:.75rem}
</style>
