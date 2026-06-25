<script>
  import { lang } from '$lib/stores/lang.js';
  import "../../../app.css";
  import { enhance } from "$app/forms";
  import { onMount } from "svelte";
  import FlightReplay from "$lib/components/FlightReplay.svelte";
  export let data, form;
  const { flight, student, media, debriefs: initialDebriefs, isInstructor } = data;
  let debriefs = initialDebriefs || [];

  const geo = flight.track_geojson ? JSON.parse(flight.track_geojson) : null;

  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}) : "—";
  }
  function fmtDur(s) {
    if (!s) return "—";
    const h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
    return h>0?`${h}h ${m.toString().padStart(2,"0")}m`:`${m}m`;
  }

  let copied = false;
  let showReplay = false;
  let showDebriefForm = false;
  let debriefContent = '';
  // Media lightbox
  let lightboxUrl = null;
  let lightboxType = 'image';
  function openLightbox(m) { lightboxUrl = vUrl(m); lightboxType = m.type || 'image'; }
  function closeLightbox() { lightboxUrl = null; }
  // Delete media (instructor only)
  async function deleteMedia(m) {
    if (!confirm($lang === 'fr' ? 'Supprimer ce média ?' : 'Delete this media?')) return;
    try {
      await fetch('/api/flight-media', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_id: m.id }) });
      publicMedia = publicMedia.filter(x => x.id !== m.id);
    } catch(e) {}
  }
  // Student: acknowledge a debriefing
  async function acknowledgeDebrief(id) {
    debriefs = debriefs.map(d => d.id === id ? { ...d, student_acknowledged: 1 } : d);
    await fetch('/api/debrief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'acknowledge', debrief_id: id }) }).catch(() => {});
  }
  let addingMedia   = null;
  function vUrl(m) {
    if (!m) return '';
    if (m.r2_key) return `/api/file?key=${encodeURIComponent(m.r2_key)}`;
    return m.url || '';
  }
  function dUrl(m) {
    if (!m) return '';
    if (m.r2_key) return `/api/file?key=${encodeURIComponent(m.r2_key)}&dl=1`;
    return m.url || '';
  }
  function mediaUrl(m) { return m?.url || ''; }
  let publicMedia   = [...(data.media || [])];
  let publicUploading = false;
  let publicUploadErr = null;

  async function uploadPublicMedia(files) {
    if (!files?.length) return;
    publicUploading = true;
    publicUploadErr = null;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('purpose', 'flight_media');
      fd.append('flight_id', String(flight.id));
              fd.append('content_type', file.type);
      fd.append('type', file.type?.startsWith('video') ? 'video' : 'photo');
      try {
        const res  = await fetch('/api/upload', { method:'POST', body: fd });
        const json = await res.json();
        if (json.ok) {
          publicMedia = [...publicMedia, { id: json.id, url: json.url, type: file.type?.startsWith('video') ? 'video' : 'photo' }];
        } else {
          publicUploadErr = json.error || 'Upload failed';
        }
      } catch(e) {
        publicUploadErr = e.message;
      }
    }
    publicUploading = false;
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    copied = true; setTimeout(() => copied = false, 2000);
  }

  let mapEl, map;
  onMount(async () => {
    if (!geo) return;
    const L = (await import("leaflet")).default;
    await import("leaflet/dist/leaflet.css");
    const coords = geo.geometry?.coordinates ?? [];
    if (!coords.length) return;
    const ll = coords.map(([lon,lat]) => [lat,lon]);
    map = L.map(mapEl, {zoomControl:true});
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {maxZoom:19,attribution:'© Esri, Maxar, Earthstar Geographics'}).addTo(map);
    const line = L.polyline(ll, {color:"#00b87a",weight:3.5,opacity:.9}).addTo(map);
    const mk=(bg,lbl)=>L.divIcon({html:`<div style="background:${bg};border:2px solid #fff;width:14px;height:14px;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:700">${lbl}</div>`,className:"",iconSize:[14,14],iconAnchor:[7,7]});
    L.marker([flight.takeoff_lat??ll[0][0], flight.takeoff_lon??ll[0][1]],{icon:mk("#22c55e","T")}).bindPopup("<b>Takeoff</b>").addTo(map);
    L.marker([flight.landing_lat??ll[ll.length-1][0], flight.landing_lon??ll[ll.length-1][1]],{icon:mk("#ef4444","L")}).bindPopup("<b>Landing</b>").addTo(map);
    map.fitBounds(line.getBounds(),{padding:[28,28]});
  });

  // Instructor: add debrief via API then refresh list
  let debriefError = '';
  async function submitDebrief() {
    if (!debriefContent.trim()) return;
    debriefError = '';
    try {
      const res  = await fetch('/api/debrief', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'add', flight_id: flight.id, content: debriefContent })
      });
      const json = await res.json();
      if (json.ok) {
        const r2 = await fetch(`/api/debrief?flight_id=${flight.id}`);
        debriefs = await r2.json();
        debriefContent = '';
        showDebriefForm = false;
      } else {
        debriefError = json.error || `Error ${res.status}`;
      }
    } catch(e) {
      debriefError = e.message;
    }
  }

  // Instructor: upload media to a debriefing
  async function uploadDebriefMedia(debriefingId, files) {
    if (!files?.length) return;
    addingMedia = debriefingId;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('purpose', 'debriefing_media');
      fd.append('debriefing_id', String(debriefingId));
      fd.append('type', file.type.startsWith('video') ? 'video' : 'photo');
      await fetch('/api/upload', { method:'POST', body: fd });
    }
    // Refresh debriefs
    const r = await fetch(`/api/debrief?flight_id=${flight.id}`);
    debriefs = await r.json();
    addingMedia = null;
  }
</script>

{#if showReplay}<FlightReplay flight={data.flight} onClose={() => showReplay=false} />{/if}

<svelte:head>
  <title>{student?.name} — {fmtDate(flight.date)} — Summit Paragliding</title>
</svelte:head>

<div class="share-page">
  <header class="share-bar">
    <img src="/summit-logo.png" alt="Summit Paragliding" class="sb-logo logo-teal" />
    <div class="sb-info">
      <strong>{student?.name}</strong>
      <span class="mono dimmed xs">{fmtDate(flight.date)}{flight.site ? " · "+flight.site.replace(/_/g," ") : ""}</span>
    </div>
    <div style="display:flex;gap:.5rem;align-items:center;margin-left:auto;flex-wrap:wrap">
      {#if geo}
      <button class="btn btn-ghost btn-sm" on:click={() => showReplay = !showReplay}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        Replay
      </button>
      {/if}
      <button class="btn btn-secondary btn-sm" on:click={copyLink}>
        {copied ? "Copied!" : "Share link"}
      </button>
    </div>
  </header>

  <!-- Map -->
  <div class="map-section">
    {#if geo}
      <div bind:this={mapEl} class="the-map"></div>
    {:else}
      <div class="no-map"><p class="dimmed small">No GPS track for this flight</p></div>
    {/if}
  </div>

  <!-- Stats ribbon -->
  <div class="stats-ribbon">
    {#each [
      ["Duration",  fmtDur(flight.duration_seconds), "var(--teal)"],
      ["Distance",  flight.distance_km!=null?flight.distance_km+" km":"—", null],
      ["Max Alt",   flight.max_altitude_m?flight.max_altitude_m+" m":"—", null],
      ["Launch",    flight.launch_quality?flight.launch_quality+"/5":"—", null],
      ["Landing",   flight.landing_quality?flight.landing_quality+"/5":"—", null],
      ["Confidence",flight.confidence_rating?flight.confidence_rating+"/5":"—", "var(--amber)"],
    ] as [lbl,val,col]}
    <div class="sr-item">
      <span class="sr-val" style={col?`color:${col}`:""}>{val}</span>
      <span class="sr-lbl">{lbl}</span>
    </div>
    {/each}
  </div>

  <div class="detail-body">

    <!-- Details grid -->
    <div class="detail-grid">
      <div class="card">
        <h3 class="dh">Flight Details</h3>
        <dl>
          <dt>Pilot</dt><dd>{student?.name||"—"}</dd>
          <dt>Date</dt><dd>{fmtDate(flight.date)}</dd>
          <dt>Site</dt><dd>{flight.site?.replace(/_/g," ")||"—"}</dd>
          {#if flight.glider}<dt>Glider</dt><dd>{flight.glider}</dd>{/if}
          {#if flight.wind_speed}<dt>Wind</dt><dd>{flight.wind_speed}{flight.wind_direction?" from "+flight.wind_direction:""}</dd>{/if}
          {#if flight.flight_type}<dt>Type</dt><dd>{flight.flight_type}</dd>{/if}
        </dl>
      </div>
      <div class="card">
        <h3 class="dh">Performance</h3>
        <dl>
          <dt>Duration</dt><dd class="teal mono">{fmtDur(flight.duration_seconds)}</dd>
          <dt>Distance</dt><dd class="mono">{flight.distance_km!=null?flight.distance_km+" km":"—"}</dd>
          <dt>Max Altitude</dt><dd class="mono">{flight.max_altitude_m?flight.max_altitude_m+" m":"—"}</dd>
          {#if flight.what_went_well}<dt>Went Well</dt><dd class="small">{flight.what_went_well}</dd>{/if}
          {#if flight.what_to_improve}<dt>Improve</dt><dd class="small">{flight.what_to_improve}</dd>{/if}
        </dl>
      </div>
    </div>

    <!-- Flight media -->
    {#if publicMedia?.length}
    <div class="media-section card">
      <h3 class="dh">Photos & Videos</h3>
      <div class="media-grid">
        {#each publicMedia as m}
        <div class="media-item">
          <button class="media-tap" on:click={() => openLightbox(m)} aria-label="View">
            {#if m.type === 'video'}
              <video src={vUrl(m)} class="media-thumb" preload="metadata" muted playsinline></video>
              <div class="media-play-icon">▶</div>
            {:else}
              <img src={vUrl(m)} alt="Photo" class="media-thumb" loading="lazy" />
            {/if}
          </button>
          <div class="media-actions">
            <a href={vUrl(m)} download target="_blank" class="media-act-btn" title="{$lang==='fr'?'Télécharger':'Download'}">↓</a>
            {#if isInstructor}
            <button class="media-act-btn media-del" on:click={() => deleteMedia(m)} title="Delete">✕</button>
            {/if}
          </div>
        </div>
        {/each}
      </div>
    </div>
    {/if}

    <!-- Debriefings -->
    <div class="debrief-section card">
      <div class="dbrief-top">
        <h3 class="dh" style="margin-bottom:0">
          Instructor Debriefings
          {#if debriefs.filter(d=>d.status==='pending').length > 0}
            <span class="badge-pend-count">{debriefs.filter(d=>d.status==='pending').length} en attente</span>
          {/if}
        </h3>
        {#if isInstructor}
        <button class="btn btn-primary btn-sm" on:click={() => showDebriefForm = !showDebriefForm}>
          + Add Debriefing
        </button>
        {/if}
      </div>

      <!-- Add debrief form (instructor) -->
      {#if isInstructor && showDebriefForm}
      <div class="add-debrief-form">
        <textarea bind:value={debriefContent} rows="4"
          placeholder="Write your debriefing notes here — phases covered, observations, advice…"></textarea>
        {#if debriefError}<div class="xs" style="color:var(--red);margin:.3rem 0">{debriefError}</div>{/if}
        <div style="display:flex;gap:.5rem;margin-top:.5rem;flex-wrap:wrap;align-items:center">
          <button class="btn btn-primary btn-sm" on:click={submitDebrief} disabled={!debriefContent.trim()}>
            Save Debriefing
          </button>
          <button class="btn btn-ghost btn-sm" on:click={() => { showDebriefForm=false; debriefContent=''; debriefError=''; }}>
            Cancel
          </button>
        </div>
      </div>
      {/if}

      <!-- Existing debriefings -->
      {#if debriefs.length}
      <div class="debrief-list">
        {#each debriefs as d}
        <div class="debrief-card">
          <div class="debrief-meta xs">
            {#if d.instructor_name}<strong style="color:var(--teal)">{d.instructor_name}</strong>{/if}
            {#if d.phases_requested && d.phases_requested !== '[]'}
              {@const phases = (() => { try { const p=JSON.parse(d.phases_requested||'[]'); return Array.isArray(p)?p:[];} catch(e) { return []; } })()}
              {#if phases.length}
              <span class="dimmed"> · Phases: {phases.join(', ')}</span>
              {/if}
            {/if}
            <span class="dimmed"> · {new Date(d.created_at).toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric"})}</span>
            {#if d.status === 'pending'}<span class="debrief-pending-badge">⏳ En attente de débriefing</span>{/if}
          </div>

          {#if d.student_name && !d.instructor_name}
          <p class="xs dimmed" style="margin:.2rem 0">Requested by {d.student_name}</p>
          {/if}

          {#if d.content}
          <p class="debrief-content">{d.content}</p>
          {/if}

          <!-- Debrief media -->
          {#if d.media?.length}
          <div class="media-grid" style="margin-top:.625rem">
            {#each d.media as m}
            <div class="media-item">
              {#if m.type === 'video'}
                <video src={vUrl(m)} class="media-thumb" controls playsinline preload="metadata"></video>
              {:else}
                <a href={vUrl(m)} target="_blank">
                  <img src={vUrl(m)} alt="Photo" class="media-thumb" loading="lazy" />
                </a>
              {/if}
            </div>
            {/each}
          </div>
          {/if}

          <!-- Student: Understood button -->
          {#if !isInstructor && d.content && !d.student_acknowledged}
          <button class="btn btn-xs btn-secondary" style="margin-top:.5rem" on:click={() => acknowledgeDebrief(d.id)}>
            {$lang === 'fr' ? 'Compris' : 'Understood'}
          </button>
          {:else if !isInstructor && d.content && d.student_acknowledged}
          <span class="xs" style="color:var(--teal);margin-top:.3rem;display:block">
            {$lang==='fr'?'Lu et compris':'Read and understood'} ✓
            {#if d.student_acknowledged_at}
            <span class="xs muted">· {new Date(d.student_acknowledged_at).toLocaleDateString($lang==='fr'?'fr-CA':'en-CA')}</span>
            {/if}
          </span>
          {/if}
          <!-- Instructor: show read status -->
          {#if isInstructor && d.content}
          <div class="debrief-read-status">
            {#if d.student_acknowledged}
            <span class="xs" style="color:var(--teal)">
              Lu par {d.student_name||'l\'élève'}
              {#if d.student_acknowledged_at}
              · {new Date(d.student_acknowledged_at).toLocaleString($lang==='fr'?'fr-CA':'en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
              {/if}
              ✓
            </span>
            {:else}
            <span class="xs muted">{$lang==='fr'?'Pas encore lu':'Not yet read'}</span>
            {/if}
          </div>
          {/if}
          <!-- Instructor: add media to this debrief -->
          {#if isInstructor}
          <div style="margin-top:.5rem">
            <label class="btn btn-ghost btn-xs" style="cursor:pointer">
              {addingMedia === d.id ? 'Uploading…' : '+ Add photo/video'}
              <input type="file" accept="image/*,video/*,.heic,.mov,.mp4" multiple style="display:none"
                disabled={addingMedia === d.id}
                on:change={e => { uploadDebriefMedia(d.id, e.target.files); e.target.value=''; }} />
            </label>
          </div>
          {/if}
        </div>
        {/each}
      </div>
      {:else}
      <p class="xs dimmed" style="margin-top:.75rem">No debriefings yet for this flight.</p>
      {/if}
    </div>

    <p class="share-footer dimmed xs">Shared via Summit Paragliding Training Tracker</p>
  </div>
</div>

<!-- ── Media Lightbox ──────────────────────────────────────── -->
{#if lightboxUrl}
<div class="lightbox-overlay" on:click={closeLightbox} role="dialog" aria-modal="true">
  <div class="lightbox-inner" on:click|stopPropagation>
    <button class="lb-close" on:click={closeLightbox}>✕</button>
    {#if lightboxType === 'video'}
      <video src={lightboxUrl} controls autoplay class="lb-media" playsinline></video>
    {:else}
      <img src={lightboxUrl} alt="Media" class="lb-media" />
    {/if}
    <div class="lb-actions">
      <a href={lightboxUrl} download target="_blank" class="btn btn-secondary btn-sm">↓ {$lang==='fr'?'Télécharger':'Download'}</a>
    </div>
  </div>
</div>
{/if}


<style>
  .share-page{min-height:100svh;display:flex;flex-direction:column;background:var(--bg)}
  .share-bar{position:sticky;top:0;z-index:100;background:rgba(8,15,24,.96);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);padding:.7rem 1.25rem;display:flex;align-items:center;gap:.875rem;flex-wrap:wrap}
  .sb-logo{height:28px;width:auto;flex-shrink:0}
  .sb-info{flex:1;display:flex;flex-direction:column;gap:.1rem}
  .sb-info strong{font-size:.875rem;line-height:1}
  .map-section{flex-shrink:0}
  .the-map{width:100%;height:clamp(260px,50vh,520px)}
  .no-map{height:220px;display:flex;align-items:center;justify-content:center;background:var(--bg-card);border-bottom:1px solid var(--border)}
  .stats-ribbon{display:flex;overflow-x:auto;background:var(--bg-card);border-bottom:1px solid var(--border);padding:.75rem 1rem}
  .sr-item{flex:1;min-width:72px;text-align:center;padding:.25rem .5rem}
  .sr-item+.sr-item{border-left:1px solid var(--border)}
  .sr-val{display:block;font-family:var(--ff-head);font-size:.88rem;font-weight:500;line-height:1;margin-bottom:.2rem;color:var(--txt)}
  .sr-lbl{font-family:var(--ff-head);font-size:.58rem;text-transform:uppercase;letter-spacing:.07em;color:var(--txt-3);font-weight:700}
  .detail-body{max-width:860px;margin:0 auto;padding:1.25rem 1rem;display:flex;flex-direction:column;gap:1rem}
  .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
  @media(max-width:600px){.detail-grid{grid-template-columns:1fr}}
  .dh{font-family:var(--ff-head);font-size:.7rem;text-transform:uppercase;letter-spacing:.09em;color:var(--txt-3);font-weight:700;margin-bottom:.875rem}
  dl{display:grid;grid-template-columns:auto 1fr;gap:.4rem 1rem;align-items:baseline}
  dt{font-family:var(--ff-head);font-size:.72rem;color:var(--txt-3);text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
  dd{font-size:.875rem;color:var(--txt)}
  .teal{color:var(--teal)}
  .amber{color:var(--amber)}
  /* Media */
  .media-section{padding:1rem}
  .media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:.4rem}
  .media-item{border-radius:7px;overflow:hidden;aspect-ratio:1;background:var(--bg-2)}
  .media-thumb{width:100%;height:100%;object-fit:cover;display:block}
  /* Debriefing */
  .debrief-section{padding:1rem;display:flex;flex-direction:column;gap:.625rem}
  .dbrief-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem}
  .add-debrief-form{background:var(--bg-2);border-radius:8px;padding:.75rem}
  .add-debrief-form textarea{width:100%;background:var(--bg-raised);border:1px solid var(--border);border-radius:7px;padding:.5rem .65rem;color:var(--txt);font-size:.88rem;resize:vertical;font-family:inherit}
  .debrief-list{display:flex;flex-direction:column;gap:.625rem}
  .debrief-card{background:var(--bg-2);border-radius:8px;padding:.625rem .75rem;border-left:3px solid var(--teal)}
  .debrief-meta{display:flex;align-items:center;flex-wrap:wrap;gap:.25rem;margin-bottom:.35rem}
  .debrief-content{font-size:.875rem;color:var(--txt-2);line-height:1.6;white-space:pre-wrap;margin:0}
  .share-footer{text-align:center;padding-top:1.25rem;border-top:1px solid var(--border)}
  .badge-pend-count{font-size:.72rem;font-weight:700;background:rgba(245,158,11,.15);color:var(--amber);border:1px solid rgba(245,158,11,.3);padding:.1rem .45rem;border-radius:var(--r-full);margin-left:.5rem}
  .debrief-pending-badge{display:inline-block;font-size:.78rem;font-weight:700;color:var(--amber);background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:6px;padding:.2rem .5rem;margin-top:.2rem}
  :global(.leaflet-container){background:#080f18!important}
  :global(.leaflet-popup-content-wrapper){background:var(--bg-card);color:var(--txt);border:1px solid var(--border);border-radius:var(--r-sm)}
  :global(.leaflet-popup-tip){background:var(--bg-card)}
  :global(.leaflet-control-attribution){background:rgba(8,15,24,.8)!important;color:var(--txt-3)!important;font-size:10px}
  :global(.leaflet-control-attribution a){color:var(--teal)!important}
  :global(.leaflet-control-zoom a){background:var(--bg-card)!important;color:var(--txt)!important;border-color:var(--border)!important}
  .xs{font-size:.75rem}
  .dimmed{color:var(--txt-3)}
  .mono{font-family:var(--ff-head)}
  .small{font-size:.82rem}
  .public-upload{padding:1rem}
  .pub-spinner{width:10px;height:10px;border:2px solid rgba(0,0,0,.2);border-top-color:var(--teal);border-radius:50%;animation:spin .6s linear infinite}
  .media-item-inner{position:relative;width:100%;height:100%}
  .media-dl-btn{position:absolute;bottom:3px;right:3px;width:22px;height:22px;border-radius:4px;background:rgba(0,0,0,.55);color:#fff;display:flex;align-items:center;justify-content:center;text-decoration:none;opacity:.8}
  .media-dl-btn:hover{opacity:1;background:rgba(0,0,0,.8)}
  @keyframes spin{to{transform:rotate(360deg)}}
  .media-item{display:flex;flex-direction:column;gap:.25rem}
  .media-tap{display:block;width:100%;background:none;border:none;padding:0;cursor:pointer;position:relative;border-radius:6px;overflow:hidden}
  .media-play-icon{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.8rem;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6);pointer-events:none}
  .media-actions{display:flex;gap:.25rem;justify-content:flex-end}
  .media-act-btn{background:var(--bg-2);border:1px solid var(--border);border-radius:5px;padding:.15rem .4rem;cursor:pointer;color:var(--txt-2);font-size:.78rem;text-decoration:none;display:inline-flex;align-items:center;transition:all .12s}
  .media-act-btn:hover{border-color:var(--teal-border);color:var(--teal)}
  .media-del:hover{border-color:rgba(220,38,38,.4)!important;color:#dc2626!important}
  .lightbox-overlay{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:500;display:flex;align-items:center;justify-content:center;padding:1rem}
  .lightbox-inner{position:relative;max-width:min(92vw,960px);display:flex;flex-direction:column;align-items:center;gap:.75rem}
  .lb-close{position:absolute;top:-2.2rem;right:0;background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;line-height:1;padding:.2rem .5rem}
  .lb-media{max-width:100%;max-height:82vh;border-radius:8px;object-fit:contain;box-shadow:0 4px 32px rgba(0,0,0,.5)}
  .lb-actions{display:flex;gap:.5rem}
  .debrief-read-status{margin-top:.3rem;padding:.25rem .4rem;background:var(--bg-2);border-radius:5px}
</style>
