<script>
  import { uploadWithProgress } from '$lib/uploadWithProgress.js';
  import { uploadFile } from '$lib/upload.js';
 import { enhance } from '$app/forms';
 import { t } from '$lib/i18n/index.js';
 import { lang } from '$lib/stores/lang.js';
 import ColourSignature from '$lib/components/ColourSignature.svelte';
 import CourseRoadmap   from '$lib/components/CourseRoadmap.svelte';
 import Icon from '$lib/components/Icon.svelte';
 import { onMount } from 'svelte';
 export let data;
 $: ({ student, dash, equipment } = data);
 let showEquipForm = false;
 let equipSaved = false;

 // Weight calculator
 let wClothes = 2.5;
 let wHelmet = 1.0;
 let wWater = 1.0;
 let wBag = 1.0;
 let wCamping = 3.0;
 let useClothes = true;
 let useHelmet = true;
 let useWater = true;
 let useBag = true;
 let useCamping = false;
 let showWtCalc = false;

 $: wPilot = equipment?.pilot_weight || 0;
 $: wWing = equipment?.glider_weight || 0;
 $: wHarness = equipment?.harness_weight || 0;
 $: wReserve = equipment?.reserve_weight || 0;
 $: wAreaFlat = equipment?.glider_flat_area || 0;
 $: wAreaProj = equipment?.glider_projected_area || 0;

 $: auw = Math.round((
 wPilot
 + (useClothes ? wClothes : 0)
 + (useHelmet ? wHelmet : 0)
 + (useWater ? wWater : 0)
 + (useBag ? wBag : 0)
 + (useCamping ? wCamping : 0)
 + wWing + wHarness + wReserve
 ) * 100) / 100;

 $: wlFlat = wAreaFlat > 0 ? Math.round((auw / wAreaFlat) * 100) / 100 : 0;
 $: wlProj = wAreaProj > 0 ? Math.round((auw / wAreaProj) * 100) / 100 : 0;

 function loadColor(v) {
 if (!v) return 'var(--txt-3)';
 if (v < 3.2) return 'var(--green)';
 if (v < 4.0) return 'var(--teal)';
 if (v < 4.8) return 'var(--amber)';
 return 'var(--red)';
 }
 function gaugeSegs(val) {
 if (!val) return [];
 const col = loadColor(val);
 const lit = Math.round(Math.min(val / 6.0, 1) * 20);
 return Array.from({length:20}, (_,i) => ({on: i < lit, col}));
 }
 $: segsFlat = gaugeSegs(wlFlat);
 $: segsProj = gaugeSegs(wlProj);

 // Wing loading range from equipment
 $: loadMin = equipment?.loading_min || 0;
 $: loadMax = equipment?.loading_max || 0;
 // Dot position on gauge (0-100%)
 function rangePct(val, maxScale=6.0) {
 return val > 0 ? Math.min(Math.round(val/maxScale*100), 100) : null;
 }
 $: minPct = rangePct(loadMin);
 $: maxPct = rangePct(loadMax);
 $: ({ stats, pending, flights } = dash);

 function fmtAir(s) {
 if (!s) return '0h';
 const h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
 return h>0 ? `${h}h ${m}m` : `${m}m`;
 }
 function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
 function fmtTime(t) { return t || '—'; }

 // Progress vs 25 flights target
 $: completedFlights = flights.filter(f => f.status === 'complete');
 $: flightCount = completedFlights.length;
 // 25 = 100%, 26-30 = bonus, 30+ = extra
 $: flightPct = Math.min(Math.round((flightCount / 25) * 100), 100);
 $: flightBonus = Math.max(0, Math.min(flightCount - 25, 5));
 $: flightExtra = Math.max(0, flightCount - 30);

 // Overall course progress
 $: total = (stats.theoryTotal + stats.exTotal + stats.examsTotal) || 1;
 $: done = stats.theoryDone + stats.exDone + stats.examsDone;
 $: pct = Math.round((done / total) * 100);

 let expandedFlight = null;
 let flightMaps = {};

 async function expandFlight(f) {
 if (expandedFlight === f.id) { expandedFlight = null; return; }
 expandedFlight = f.id;
 // Render mini map after expand
 if (f.track_geojson && !flightMaps[f.id]) {
 setTimeout(() => renderMiniMap(f), 100);
 }
 }

 async function renderMiniMap(f) {
 const el = document.getElementById(`map-${f.id}`);
 if (!el || flightMaps[f.id]) return;
 const L = (await import('leaflet')).default;
 await import('leaflet/dist/leaflet.css');
 const geo = JSON.parse(f.track_geojson);
 const coords = geo.geometry?.coordinates ?? [];
 if (!coords.length) return;
 const ll = coords.map(([lon,lat]) => [lat,lon]);
 const map = L.map(el, { zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false });
 L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'© Esri, Maxar, Earthstar Geographics'}).addTo(map);
 const line = L.polyline(ll, { color:'var(--teal)', weight:2.5, opacity:.9 }).addTo(map);
 // Markers
 const mk = (bg,lbl) => L.divIcon({ html:`<div style="background:${bg};border:2px solid #fff;width:10px;height:10px;border-radius:50%;font-size:0"></div>`, className:'', iconSize:[10,10], iconAnchor:[5,5] });
 L.marker(ll[0], {icon:mk('#22c55e','T')}).addTo(map);
 L.marker(ll[ll.length-1], {icon:mk('#ef4444','L')}).addTo(map);
 map.fitBounds(line.getBounds(), { padding:[10,10] });
 flightMaps[f.id] = map;
 }

 function parseExercises(json) {
 try { return json ? JSON.parse(json) : []; } catch(e) { return []; }
 }

 // Dashboard card collapse states (collapsed by default for performance)
 let cardOpen = { stats:true, plan:true, msgs:false, orders:false, progress:false };
 function toggleCard(k) { cardOpen = { ...cardOpen, [k]: !cardOpen[k] }; }

 // Messages
 let msgs = data.messages || [];
 let debriefAlerts = [];
 $: { if (data.unviewedDebriefs?.length && !debriefAlerts.length) debriefAlerts = [...data.unviewedDebriefs]; }
 function dismissDebrief(id) {
   debriefAlerts = debriefAlerts.filter(d => d.id !== id);
   fetch('/api/mark-debrief-viewed', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id}) }).catch(()=>{});
 }
 $: activeMsgs = msgs.filter(m => !m.dismissed_at);
 $: archivedMsgs = msgs.filter(m => m.dismissed_at);
 let msgOpen = false;
 let openMsg = null;
 let msgArchiveOpen = false;
 let orderText = '';
 let orderSent = false;
 let orderFormOpen  = false;
 let commandesOpen  = false;
 let paiementsOpen  = false;
 let paymentOpen = false;
 let billOpen = false;
  let billUploading = false;
  let billErr = '';
  let billProgress = 0;
 // Planning collapse state
 let planOpen = false;
 function openPlan() {
   planOpen = true;
   // Clear "new days" notification once seen
   try { localStorage.setItem('summit_plan_seen_' + (data.trainingDays?.[0]?.id||0), '1'); } catch(e) {}
 }
 $: planHasNew = (() => {
   try {
     const firstId = data.trainingDays?.[0]?.id;
     return firstId && !localStorage.getItem('summit_plan_seen_' + firstId);
   } catch(e) { return false; }
 })();
 let undoQueue = [];
 function pushUndo(type, id, label) {
   undoQueue = [{ type, id, label, ts: Date.now() }, ...undoQueue.slice(0,2)];
   setTimeout(() => { undoQueue = undoQueue.filter(u => Date.now() - u.ts < 300000); }, 300000);
 }
 async function doUndo(item) {
   undoQueue = undoQueue.filter(u => u !== item);
   try {
     await fetch('/api/undo', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type: item.type, id: item.id }) });
     if (item.type === 'payment') { data = { ...data, payments: (data.payments||[]).filter(p => p.id !== item.id) }; }
   } catch(e) {}
 }
 let paymentDesc = '';
 let paymentAmount = '';
 let paymentUploading = false;
 let paymentProgress  = 0;
 let paymentDone = false;
 let paymentErr = '';
 async function dismissMsg(id) {
   await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'},
     body: JSON.stringify({ action:'dismiss_message', message_id: id }) });
   msgs = msgs.map(m => m.id === id ? { ...m, dismissed_at: new Date().toISOString() } : m);
 }
 async function restoreMsg(id) {
   await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'},
     body: JSON.stringify({ action:'restore_message', message_id: id }) });
   msgs = msgs.map(m => m.id === id ? { ...m, dismissed_at: null } : m);
 }
 async function sendOrder() {
   if (!orderText.trim()) return;
   const text = orderText.trim();
   const res = await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'},
     body: JSON.stringify({ action:'create_order', description: text }) });
   const out = await res.json().catch(()=>({}));
   orderText = '';
   orderSent = true;
   setTimeout(() => orderSent = false, 3000);
   // Show the new order immediately as an open chat thread
   if (out?.id) {
     const newOrder = { id: out.id, description: text, status:'pending', created_at: new Date().toISOString() };
     data = { ...data, orders: [ newOrder, ...(data.orders||[]) ] };
     openOrderId = out.id;
     orderThreads = { ...orderThreads, [out.id]: { ...newOrder, messages: [{ id:'tmp', sender_type:'student', body:text, created_at:newOrder.created_at }] } };
   }
 }
 // ── Order chat thread (student side) ───────────────────────
 let openOrderId = null;
 let orderThreads = {};
 let orderThreadLoading = false;
 let orderReply = '';
 async function orderApi(action, payload) {
   const res = await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'},
     body: JSON.stringify({ action, ...payload }) });
   const out = await res.json().catch(()=>({}));
   if (!res.ok) throw new Error(out.message || out.error || 'Error');
   return out;
 }
 async function toggleStudentOrder(id) {
   if (openOrderId === id) { openOrderId = null; return; }
   openOrderId = id; orderReply = '';
   if (!orderThreads[id]) {
     orderThreadLoading = true;
     try { const { thread } = await orderApi('get_order_thread', { order_id: id }); orderThreads = { ...orderThreads, [id]: thread }; }
     catch(e) {} finally { orderThreadLoading = false; }
   }
 }
 async function sendStudentOrderMessage(id) {
   const t = orderReply.trim(); if (!t) return;
   orderReply = '';
   try { const { thread } = await orderApi('post_order_message', { order_id: id, body: t }); orderThreads = { ...orderThreads, [id]: thread }; }
   catch(e) { alert(e.message); orderReply = t; }
 }
 function fmtOrderTime(d) {
   return d ? new Date(d).toLocaleString($lang==='fr'?'fr-CA':'en-CA', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '';
 }
 let paymentProofFile = null;
 async function logPayment() {
   if (!paymentAmount || !paymentDesc) { paymentErr = 'Montant et description requis'; return; }
   paymentUploading = true;
   paymentErr = '';
   try {
     const res = await fetch('/api/student-payment', {
       method:'POST', headers:{'Content-Type':'application/json'},
       body: JSON.stringify({ desc: paymentDesc, amount: paymentAmount }),
     });
     const json = await res.json();
     if (!json.ok) throw new Error(json.error || 'Erreur');
     // Upload proof file if one was selected (optional)
     if (paymentProofFile && json.id) {
       await uploadFile(paymentProofFile, {
         purpose: 'payment_proof',
         meta:    { payment_id: json.id },
         onProgress: p => { paymentProgress = p; }
       });
     }
     paymentDone = true;
     paymentDesc = '';
     paymentAmount = '';
     paymentProofFile = null;
     setTimeout(() => { paymentDone = false; }, 4000);
   } catch(e) {
     paymentErr = e.message || 'Erreur';
   } finally {
     paymentUploading = false;
     paymentProgress  = 0;
   }
 }
</script>

<svelte:head><title>{student.name} — Summit</title></svelte:head>

<!-- Pending flight banner -->
{#if pending}
 <div class="pending-banner">
 <div class="pb-left">
 <span class="dot dot-pulse"></span>
 <div>
 <div class="pb-title">{$t('dash_pending_flight')}</div>
 <div class="pb-sub mono xs">{fmtDate(pending.date)} · {pending.site||'—'}</div>
 </div>
 </div>
 <a href="/student/{student.id}/postflight/{pending.id}" class="btn btn-primary btn-sm">{$t('dash_complete_it')}</a>
 </div>
{/if}

<!-- Hero -->
<div class="hero-row">
 <div class="avatar-wrap">
  {#if student?.profile_picture_url}
    <img src={student.profile_picture_url} alt={student.name} class="avatar-img" style="width:52px;height:52px;min-width:52px;min-height:52px;object-fit:cover;object-position:center;border-radius:50%;border:2px solid var(--teal-border);flex-shrink:0" loading="lazy" />
  {:else}
    <div class="avatar-initials">{(student?.name||'?')[0].toUpperCase()}</div>
  {/if}
  <a href="/student/{student.id}/profile" class="avatar-edit-hint" title="Changer la photo"></a>
 </div>
 <div class="hero-info">
 <h1>{student.name}</h1>
 <p class="dimmed xs">{$t('dash_enrolled')} {fmtDate(student.enrollment_date)}</p>
 </div>
 <form method="POST" action="?/logout" use:enhance style="margin-left:auto;flex-shrink:0">
 <button class="btn btn-ghost btn-sm" style="gap:.35rem">
 <Icon name="logout" size={14} />{$t('dash_signout')}
 </button>
 </form>
</div>


<!-- Notifications -->
{#if data.notifications?.filter(n=>!n.read).length}
<div class="card notif-card">
 <div class="notif-header">
 <span> {$lang==='fr' ? 'Nouveaux messages' : 'New notifications'}</span>
 <form method="POST" action="?/markRead" use:enhance style="display:inline">
 <button class="btn btn-ghost btn-xs">{$lang==='fr' ? 'Tout lire' : 'Mark all read'}</button>
 </form>
 </div>
 {#each data.notifications.filter(n=>!n.read).slice(0,3) as n}
 <div class="notif-row">
 <span class="notif-dot-i"></span>
 <div>
 <div class="notif-title">{n.title}</div>
 <div class="notif-msg xs dimmed">{n.message}</div>
 </div>
 </div>
 {/each}
</div>
{/if}


<!-- Debriefing alerts -->
{#if debriefAlerts.length}
<div class="card debrief-alert-card">
  <div class="debrief-alert-title">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    {$lang==='fr'?'Débriefings':'Debriefings'}
    <span class="debrief-badge">{debriefAlerts.length}</span>
  </div>
  {#each debriefAlerts as d}
  <div class="debrief-alert-row">
    <a href="/flight/{d.flight_id}" class="debrief-alert-link">
      {$lang==='fr'?'Vol du':'Flight'} {d.flight_date}{d.flight_site ? ` — ${d.flight_site}`:''} →
    </a>
    <button class="debrief-dismiss" on:click={() => dismissDebrief(d.id)} title="Dismiss">✕</button>
  </div>
  {/each}
</div>
{/if}

<!-- Messages box -->
{#if msgs.length > 0 || true}
<div class="card msg-card">
  <div class="msg-header" on:click={() => openMsg = openMsg ? null : 'list'} role="button" tabindex="0" on:keydown={e=>e.key==='Enter'&&(openMsg=openMsg?null:'list')}>
    <span class="msg-title-lbl">{$lang==='fr'?'Messages':'Messages'}</span>
    {#if activeMsgs.length > 0}<span class="msg-badge">{activeMsgs.length}</span>{/if}
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto;transition:transform .2s;transform:rotate({openMsg?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
  </div>
  {#if openMsg}
  <div class="msg-body">
    {#if activeMsgs.length === 0}
      <div class="msg-empty xs dimmed">{$lang==='fr'?'Aucun nouveau message.':'No new messages.'}</div>
    {:else}
      {#each activeMsgs as m}
      <div class="msg-item" class:msg-open={openMsg===m.id}>
        <div class="msg-item-hdr" on:click={() => openMsg = openMsg===m.id ? 'list' : m.id} role="button" tabindex="0" on:keydown={e=>e.key==='Enter'&&(openMsg=openMsg===m.id?'list':m.id)}>
          <span class="msg-item-title">{m.title}</span>
          <span class="msg-item-date xs dimmed">{new Date(m.created_at).toLocaleDateString($lang==='fr'?'fr-CA':'en-CA',{month:'short',day:'numeric'})}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;transition:transform .2s;transform:rotate({openMsg===m.id?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        {#if openMsg === m.id}
        <div class="msg-item-body">
          <p class="xs">{m.body}</p>
          <button class="btn btn-ghost btn-xs" style="margin-top:.5rem" on:click={() => dismissMsg(m.id)}>
            {$lang==='fr'?'Archiver':'Archive'}
          </button>
        </div>
        {/if}
      </div>
      {/each}
    {/if}

    <!-- Archive -->
    {#if archivedMsgs.length > 0}
    <div class="msg-archive-toggle xs" on:click={() => msgArchiveOpen = !msgArchiveOpen} role="button" tabindex="0" on:keydown={e=>e.key==='Enter'&&(msgArchiveOpen=!msgArchiveOpen)}>
      {$lang==='fr'?'Archivés':'Archived'} ({archivedMsgs.length})
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform .2s;transform:rotate({msgArchiveOpen?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    {#if msgArchiveOpen}
      {#each archivedMsgs as m}
      <div class="msg-item msg-archived">
        <div class="msg-item-hdr" on:click={() => openMsg = openMsg===m.id+'a' ? 'list' : m.id+'a'} role="button" tabindex="0" on:keydown={e=>e.key==='Enter'&&(openMsg=openMsg===m.id+'a'?'list':m.id+'a')}>
          <span class="msg-item-title dimmed">{m.title}</span>
          <button class="btn btn-ghost btn-xs" style="margin-left:auto;flex-shrink:0" on:click|stopPropagation={() => restoreMsg(m.id)}>
            {$lang==='fr'?'Restaurer':'Restore'}
          </button>
        </div>
        {#if openMsg === m.id+'a'}
        <div class="msg-item-body"><p class="xs dimmed">{m.body}</p></div>
        {/if}
      </div>
      {/each}
    {/if}
    {/if}
  </div>
  {/if}
</div>
{/if}


{#if data.trainingDays?.length}
<!-- Planning card — collapsed by default -->
<div class="card plan-card">
  <div class="plan-hdr-btn" on:click={() => planOpen ? planOpen=false : openPlan()}
    role="button" tabindex="0" on:keydown={e=>e.key==='Enter'&&(planOpen?planOpen=false:openPlan())}>
    <span class="plan-hdr-title">{$lang==='fr'?'Journées planifiées':'Planned days'}</span>
    {#if !planOpen && data.trainingDays.length}
    <span class="plan-count-badge" class:plan-new={planHasNew}>{data.trainingDays.length}</span>
    {/if}
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
      style="margin-left:auto;flex-shrink:0;transition:transform .2s;transform:rotate({planOpen?180:0}deg)">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </div>

  {#if planOpen}
  <div class="plan-body">
    {#each (data.trainingDays||[]) as td}
    {@const [dayOpen, setDayOpen] = [false, null]}
    <details class="plan-day-details">
      <summary class="plan-day-summary">
        <span class="plan-date mono xs">{td.date}</span>
        <span class="plan-site xs" style="flex:1;margin-left:.5rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          {td.plan_text?.slice(0,40) || ($lang==='fr'?'Journée planifiée':'Planned day')}
        </span>
        <span class="plan-spots xs muted" style="flex-shrink:0">{td.reg_count||0}/{td.max_students}</span>
      </summary>
      <div class="plan-day-body">
        {#if td.plan_text}
        <p class="xs" style="color:var(--txt-2);margin-bottom:.5rem">{td.plan_text}</p>
        {/if}
        {#if td.student_registered}
        <form method="POST" action="?/rsvp" use:enhance>
          <input type="hidden" name="training_day_id" value={td.id} />
          <input type="hidden" name="action" value="leave" />
          <button class="btn btn-sm rsvp-on">{$lang==='fr'?'Inscrit — Annuler':'Registered — Cancel'}</button>
        </form>
        {:else}
        <form method="POST" action="?/rsvp" use:enhance class="rsvp-form">
          <input type="hidden" name="training_day_id" value={td.id} />
          <input type="hidden" name="action" value="join" />
          <div class="act-select xs">
            <span class="act-sel-lbl">{$lang==='fr'?'Activité:':'Activity:'}</span>
            <select name="activity_type" class="act-sel-input">
              <option value="flight">{$lang==='fr'?'Vol':'Flight'}</option>
              <option value="first_flight">{$lang==='fr'?'1er vol':'1st flight'}</option>
              <option value="ground">{$lang==='fr'?'Sol (exercices)':'Ground handling'}</option>
              <option value="theory">{$lang==='fr'?'Théorie / Autre':'Theory / Other'}</option>
            </select>
          </div>
          <button class="btn btn-sm rsvp-off">{$lang==='fr'?'Je serai là':"I'll be there"}</button>
        </form>
        {/if}
      </div>
    </details>
    {/each}
  </div>
  {/if}
</div>
{/if}


<!-- Equipment -->
<div class="section-label" style="margin-top:1.25rem">{$lang==='fr' ? 'Mon équipement' : 'My Equipment'}</div>
{#if !showEquipForm}
 <div class="card equip-display">
 <!-- At-a-glance items — each row self-gates -->
 <div class="eq-items">
 {#if equipment?.glider_model}
 <div class="eq-item">
 <!-- Wing SVG icon -->
 <svg class="eq-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
 <path d="M2 12 C6 6 10 4 12 4 C14 4 18 6 22 12"/>
 <path d="M2 12 C6 14 10 15 12 15 C14 15 18 14 22 12"/>
 <path d="M12 4 L12 15"/>
 <path d="M12 15 L11 20 M12 15 L13 20"/>
 </svg>
 <div class="eq-detail">
 <span class="eq-name">{[equipment.glider_make, equipment.glider_model, equipment.glider_size].filter(Boolean).join(' ')}</span>
 {#if equipment.glider_flat_area}<span class="eq-sub">{equipment.glider_flat_area} m² flat</span>{/if}
 </div>
 {#if equipment.glider_weight}<span class="eq-weight">{equipment.glider_weight} kg</span>{/if}
 </div>
 {/if}
 {#if equipment?.harness}
 <div class="eq-item">
 <!-- Harness SVG icon -->
 <svg class="eq-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
 <path d="M12 3 L12 21"/>
 <path d="M8 6 C8 6 6 8 6 12 C6 16 8 18 8 18"/>
 <path d="M16 6 C16 6 18 8 18 12 C18 16 16 18 16 18"/>
 <path d="M8 12 L16 12"/>
 <path d="M9 18 L15 18"/>
 </svg>
 <div class="eq-detail">
 <span class="eq-name">{equipment.harness}</span>
 </div>
 {#if equipment.harness_weight}<span class="eq-weight">{equipment.harness_weight} kg</span>{/if}
 </div>
 {/if}
 {#if equipment?.reserve}
 <div class="eq-item">
 <!-- Reserve parachute SVG icon -->
 <svg class="eq-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
 <path d="M12 3 C7 3 3 7 3 12"/>
 <path d="M12 3 C17 3 21 7 21 12"/>
 <path d="M3 12 C5 10 8 9 12 9 C16 9 19 10 21 12"/>
 <path d="M12 9 L10 20 M12 9 L14 20"/>
 <path d="M9 20 L15 20"/>
 </svg>
 <div class="eq-detail">
 <span class="eq-name">{equipment.reserve}</span>
 <span class="eq-sub">{$lang==='fr'?'Secours':'Reserve'}</span>
 </div>
 {#if equipment.reserve_weight}<span class="eq-weight">{equipment.reserve_weight} kg</span>{/if}
 </div>
 {/if}
 </div>

 <!-- AUW Calculator -->
 {#if wPilot > 0}
 <div class="auw-block">
 <!-- Collapsed toggle row -->
 <button type="button" class="auw-toggle" on:click={() => showWtCalc=!showWtCalc}>
 <div class="auw-summary">
 <span class="auw-total-kg mono">{auw.toFixed(2)} kg</span>
 <span class="xs dimmed">AUW</span>
 {#if wlFlat > 0}
 <span class="auw-wl mono" style="color:{loadColor(wlFlat)}">{wlFlat.toFixed(2)} kg/m²</span>
 {/if}
 {#if wlProj > 0}
 <span class="xs dimmed">·</span>
 <span class="auw-wl mono" style="color:{loadColor(wlProj)}">{wlProj.toFixed(2)} <span class="xs">RWL</span></span>
 {/if}
 </div>
 <Icon name={showWtCalc?'chevronup':'chevrondown'} size={14} color="var(--txt-3)" />
 </button>

 {#if showWtCalc}
 <div class="auw-detail">
 <!-- Fixed: pilot -->
 <div class="awd-row">
 <span class="awd-lbl">{$lang==='fr'?'Poids nu':'Naked weight'}</span>
 <div class="awd-tog-spacer"></div>
 <div class="awd-slider-spacer"></div>
 <span class="awd-val mono">{wPilot} kg</span>
 </div>

 <!-- Toggleable items — all aligned: label | toggle | slider | value -->
 {#each [
 [$lang==='fr'?'Vêtements':'Clothes', 'useClothes', useClothes, wClothes, 0, 8 ],
 [$lang==='fr'?'Casque + éléct.':'Helmet', 'useHelmet', useHelmet, wHelmet, 0, 4 ],
 [$lang==='fr'?'Eau':'Water', 'useWater', useWater, wWater, 0, 3 ],
 [$lang==='fr'?'Sac':'Bag', 'useBag', useBag, wBag, 0, 5 ],
 [$lang==='fr'?'Camping':'Camping', 'useCamping', useCamping, wCamping, 0, 15 ],
 ] as [lbl, key, active, val, min, max]}
 <div class="awd-row tog-row" class:off={!active}>
 <span class="awd-lbl">{lbl}</span>
 <button type="button" class="tog" class:on={active}
 on:click={() => {
 if (key==='useClothes') useClothes=!useClothes;
 else if (key==='useHelmet') useHelmet=!useHelmet;
 else if (key==='useWater') useWater=!useWater;
 else if (key==='useBag') useBag=!useBag;
 else useCamping=!useCamping;
 }}>
 <span class="tog-knob"></span>
 </button>
 <input type="range" min={min} max={max} step="0.1"
 value={val}
 class="wt-slider"
 class:hidden={!active}
 on:input={e => {
 const v = Math.round(Number(e.target.value)*10)/10;
 if (key==='useClothes') wClothes=v;
 else if (key==='useHelmet') wHelmet=v;
 else if (key==='useWater') wWater=v;
 else if (key==='useBag') wBag=v;
 else wCamping=v;
 }} />
 <span class="awd-val mono">{active ? val.toFixed(1)+' kg' : '—'}</span>
 </div>
 {/each}

 <!-- Fixed gear weights -->
 {#if wWing > 0}
 <div class="awd-row">
 <span class="awd-lbl">{$lang==='fr'?'Aile':'Wing'}</span>
 <div class="awd-tog-spacer"></div>
 <div class="awd-slider-spacer"></div>
 <span class="awd-val mono">{wWing} kg</span>
 </div>
 {/if}
 {#if wHarness > 0}
 <div class="awd-row">
 <span class="awd-lbl">{$lang==='fr'?'Sellette':'Harness'}</span>
 <div class="awd-tog-spacer"></div>
 <div class="awd-slider-spacer"></div>
 <span class="awd-val mono">{wHarness} kg</span>
 </div>
 {/if}
 {#if wReserve > 0}
 <div class="awd-row">
 <span class="awd-lbl">{$lang==='fr'?'Secours':'Reserve'}</span>
 <div class="awd-tog-spacer"></div>
 <div class="awd-slider-spacer"></div>
 <span class="awd-val mono">{wReserve} kg</span>
 </div>
 {/if}

 <!-- Result + gauges -->
 <div class="awd-result">
 <div class="awd-total-row">
 <span class="awd-lbl-hd">{$lang==='fr'?'PTV':'AUW'}</span>
 <span class="mono" style="color:var(--teal);font-size:1.2rem">{auw.toFixed(2)} kg</span>
 </div>
 {#if wlFlat > 0}
 <div class="gauge-row">
 <div class="gauge-meta">
 <div class="gauge-meta-left">
 <span class="xs dimmed">{$lang==='fr'?'Charge à plat':'Flat loading'}</span>
 <span class="gauge-ideal xs">{$lang==='fr'?'idéal':'ideal'} 3.4–3.9 kg/m²</span>
 </div>
 <span class="mono gauge-num" style="color:{loadColor(wlFlat)}">{wlFlat.toFixed(2)} kg/m²</span>
 </div>
 <div class="gauge-bar-wrap">
 <div class="gauge-bar">
 {#each segsFlat as seg}
 <div class="g-seg" style="background:{seg.on ? seg.col : 'var(--bg-input)'}"></div>
 {/each}
 </div>
 <!-- Range dots from wing specs -->
 {#if minPct}
 <div class="range-dot range-min" style="left:{minPct}%" title="{$lang==='fr'?'Min charge aile':'Wing min load'}: {loadMin} kg/m²"></div>
 {/if}
 {#if maxPct}
 <div class="range-dot range-max" style="left:{maxPct}%" title="{$lang==='fr'?'Max charge aile':'Wing max load'}: {loadMax} kg/m²"></div>
 {/if}
 </div>
 </div>
 {/if}
 {#if wlProj > 0}
 <div class="gauge-row">
 <div class="gauge-meta">
 <span class="xs dimmed">RWL ({$lang==='fr'?'projetée':'projected'})</span>
 <span class="mono gauge-num" style="color:{loadColor(wlProj)}">{wlProj.toFixed(2)} kg/m²</span>
 </div>
 <div class="gauge-bar-wrap">
 <div class="gauge-bar">
 {#each segsProj as seg}
 <div class="g-seg" style="background:{seg.on ? seg.col : 'var(--bg-input)'}"></div>
 {/each}
 </div>
 {#if minPct}
 <div class="range-dot range-min" style="left:{minPct}%" title="{loadMin} kg/m²"></div>
 {/if}
 {#if maxPct}
 <div class="range-dot range-max" style="left:{maxPct}%" title="{loadMax} kg/m²"></div>
 {/if}
 </div>
 </div>
 {:else if wAreaFlat > 0}
 <p class="xs dimmed">{$lang==='fr'?'Ajoutez la surface projetée pour voir le RWL':'Add projected area to see RWL'}</p>
 {/if}
 </div>
 </div>
 {/if}
 </div>
 {/if}
 {#if !equipment?.glider_make && !equipment?.glider_model && !equipment?.harness && !equipment?.reserve && !equipment?.wing_color_1 && !equipment?.pilot_weight}
 <p class="dimmed xs" style="padding:.25rem 0">{$lang==='fr' ? 'Aucun équipement enregistré' : 'No equipment on file'}</p>
 {/if}

 <button class="btn btn-ghost btn-xs eq-edit-btn" on:click={() => showEquipForm = true}>
 <Icon name="edit" size={12} />{$lang==='fr' ? 'Modifier' : 'Edit'}
 </button>
 </div>
{:else}
 <div class="card" style="margin-bottom:.875rem">
 {#if equipSaved}<div class="alert alert-ok"><Icon name="check" size={14} />{$lang==='fr'?'Sauvegardé':'Saved'}</div>{/if}
 <form method="POST" action="?/saveEquipment" use:enhance
 on:submit={() => { equipSaved = true; showEquipForm = false; }}>

 <div class="eq-section-title">{$lang==='fr'?'Aile / Parapente':'Wing / Paraglider'}</div>
 <div class="form-row">
 <div class="form-group">
 <label>{$lang==='fr'?'Marque':'Make'}</label>
 <input name="glider_make" type="text" placeholder="Advance, Gin, Ozone…" value={equipment?.glider_make||''} />
 </div>
 <div class="form-group">
 <label>{$lang==='fr'?'Modèle':'Model'}</label>
 <input name="glider_model" type="text" placeholder="Pi3, Explorer…" value={equipment?.glider_model||''} />
 </div>
 </div>
 <div class="form-row">
 <div class="form-group">
 <label>{$lang==='fr'?'Taille fabricant':'Size'}</label>
 <input name="glider_size" type="text" placeholder="S, M, L, XS…" value={equipment?.glider_size||''} />
 </div>
 <div class="form-group">
 <label>{$lang==='fr'?'Surface à plat (m²)':'Flat Area (m²)'}</label>
 <input name="glider_flat_area" type="number" step="0.1" placeholder="25.0" value={equipment?.glider_flat_area||''} />
 </div>
 </div>
 <div class="form-group">
 <label>{$lang==='fr'?'Surface projetée (m²) — pour RWL':'Projected Area (m²) — for RWL'}</label>
 <input name="glider_projected_area" type="number" step="0.1" placeholder="21.5" value={equipment?.glider_projected_area||''} style="max-width:160px" />
 </div>
 <div class="form-group">
 <label>{$lang==='fr'?'Poids aile (kg)':'Wing Weight (kg)'}</label>
 <input name="glider_weight" type="number" step="0.1" placeholder="5.2" value={equipment?.glider_weight||''} style="max-width:140px" />
 </div>

 <div class="eq-section-title" style="margin-top:1rem">{$lang==='fr'?'Sellette':'Harness'}</div>
 <div class="form-row">
 <div class="form-group">
 <label>{$lang==='fr'?'Marque / Modèle':'Make / Model'}</label>
 <input name="harness" type="text" placeholder="Advance Impress, Gin Genie…" value={equipment?.harness||''} />
 </div>
 <div class="form-group">
 <label>{$lang==='fr'?'Poids sellette (kg)':'Harness Weight (kg)'}</label>
 <input name="harness_weight" type="number" step="0.1" placeholder="3.8" value={equipment?.harness_weight||''} />
 </div>
 </div>

 <div class="eq-section-title" style="margin-top:1rem">{$lang==='fr'?'Parachute de secours':'Reserve Parachute'}</div>
 <div class="form-row">
 <div class="form-group">
 <label>{$lang==='fr'?'Marque / Modèle':'Make / Model'}</label>
 <input name="reserve" type="text" placeholder="Gin, Advance, BGD…" value={equipment?.reserve||''} />
 </div>
 <div class="form-group">
 <label>{$lang==='fr'?'Poids secours (kg)':'Reserve Weight (kg)'}</label>
 <input name="reserve_weight" type="number" step="0.1" placeholder="1.6" value={equipment?.reserve_weight||''} />
 </div>
 </div>

 <div class="eq-section-title" style="margin-top:1rem">{$lang==='fr'?'Pilote':'Pilot'}</div>
 <div class="form-group">
 <label>{$lang==='fr'?'Poids pilote avec vêtements (kg)':'Pilot Weight with Clothing (kg)'}</label>
 <input name="pilot_weight" type="number" step="0.5" placeholder="75.0" value={equipment?.pilot_weight||''} style="max-width:160px" />
 </div>

 <div style="display:flex;gap:.5rem;margin-top:1.25rem">
 <button type="submit" class="btn btn-primary btn-sm">
 <Icon name="save" size={13} />{$lang==='fr'?'Sauvegarder':'Save'}
 </button>
 <button type="button" class="btn btn-ghost btn-sm" on:click={() => showEquipForm=false}>
 {$lang==='fr'?'Annuler':'Cancel'}
 </button>
 </div>
 </form>
 </div>
{/if}

<!-- ── Commandes ──────────────────────────────────────────── -->
<div class="card dash-card">
  <button class="dash-toggle-hdr" on:click={() => commandesOpen = !commandesOpen}>
    <div style="display:flex;align-items:center;gap:.5rem">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--teal)" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
      <span class="dash-card-title">{$lang==='fr'?'Commandes':'Orders'}</span>
      {#if data.orders?.filter(o=>o.status!=='confirmed' && o.status!=='completed').length}
      <span class="badge-teal">{data.orders.filter(o=>o.status!=='confirmed' && o.status!=='completed').length}</span>
      {/if}
    </div>
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"
      style="transition:transform .2s;transform:rotate({commandesOpen?180:0}deg)">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </button>
  {#if commandesOpen}

  <!-- Pending orders — tap to open the conversation -->
  {#if data.orders?.filter(o=>o.status!=='confirmed' && o.status!=='completed').length}
  <div class="order-list">
    {#each data.orders.filter(o=>o.status!=='confirmed' && o.status!=='completed') as o}
    <div class="sorder" class:open={openOrderId===o.id}>
      <button class="sorder-head" on:click={()=>toggleStudentOrder(o.id)}>
        <span class="xs dimmed">{new Date(o.created_at).toLocaleDateString($lang==='fr'?'fr-CA':'en-CA')}</span>
        <span class="sorder-snippet xs">{(o.description||'').slice(0,40)}{(o.description||'').length>40?'…':''}</span>
        <span class="status-pill" class:status-pending={o.status==='pending'} class:status-resp={o.status==='responded'}>
          {o.status==='responded'?($lang==='fr'?'Répondu':'Replied'):($lang==='fr'?'En attente':'Pending')}
        </span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="transition:transform .2s;transform:rotate({openOrderId===o.id?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {#if openOrderId===o.id}
      <div class="sorder-thread">
        {#if orderThreadLoading && !orderThreads[o.id]}
          <div class="xs dimmed" style="padding:.4rem">{$lang==='fr'?'Chargement…':'Loading…'}</div>
        {:else if orderThreads[o.id]}
          <div class="sorder-msgs">
            {#each orderThreads[o.id].messages as m}
            <div class="sorder-bubble {m.sender_type==='student'?'sb-me':'sb-them'}">
              <div class="sb-body">{m.body}</div>
              <div class="sb-time xs">{m.sender_type==='student'?($lang==='fr'?'Vous':'You'):($lang==='fr'?'Instructeur':'Instructor')} · {fmtOrderTime(m.created_at)}</div>
            </div>
            {/each}
          </div>
          <div class="sorder-input-row">
            <textarea rows="2" bind:value={orderReply} class="order-textarea" style="flex:1"
              placeholder={$lang==='fr'?'Répondre…':'Reply…'}
              on:keydown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendStudentOrderMessage(o.id);}}}></textarea>
            <button class="btn-teal-sm" on:click={()=>sendStudentOrderMessage(o.id)} disabled={!orderReply.trim()}>{$lang==='fr'?'Envoyer':'Send'}</button>
          </div>
        {/if}
      </div>
      {/if}
    </div>
    {/each}
  </div>
  {/if}

  <!-- New order form -->
  <div class="new-order-form">
    <textarea bind:value={orderText} rows="2"
      placeholder={$lang==='fr'?'Nouvelle demande (équipement, question…)':'New request (equipment, question…)'}
      class="order-textarea"></textarea>
    <div style="display:flex;align-items:center;gap:.5rem;margin-top:.35rem">
      <button class="btn-teal-sm" on:click={sendOrder} disabled={!orderText.trim()}>
        {$lang==='fr'?'Envoyer':'Send'}
      </button>
      {#if orderSent}<span class="xs" style="color:var(--teal)">{$lang==='fr'?'Envoyé ✓':'Sent ✓'}</span>{/if}
    </div>
  </div>

  <!-- Order history collapsed -->
  {#if data.orders?.filter(o=>o.status==='confirmed' || o.status==='completed').length}
  <details class="hist-details">
    <summary class="hist-summary xs">
      {$lang==='fr'?'Historique':'History'} ({data.orders.filter(o=>o.status==='confirmed'||o.status==='completed').length}) ▾
    </summary>
    <div class="order-list" style="margin-top:.4rem">
      {#each data.orders.filter(o=>o.status==='confirmed'||o.status==='completed') as o}
      <div class="order-item">
        <div class="order-item-top">
          <span class="xs dimmed">{new Date(o.created_at).toLocaleDateString($lang==='fr'?'fr-CA':'en-CA')}</span>
          <span class="status-pill" class:status-ok={o.status==='confirmed'} class:status-resp={o.status==='responded'}>
            {o.status==='confirmed'?($lang==='fr'?'Confirmé':'Confirmed'):($lang==='fr'?'Répondu':'Responded')}
          </span>
        </div>
        <div class="order-desc xs">{o.description}</div>
        {#if o.instructor_response}
        <div class="xs" style="color:var(--teal);margin-top:.15rem">↳ {o.instructor_response}</div>
        {/if}
      </div>
      {/each}
    </div>
  </details>
  {/if}
  {/if}
</div>

<!-- ── Paiements ────────────────────────────────────────────── -->
<div class="card dash-card">
  <button class="dash-toggle-hdr" on:click={() => paiementsOpen = !paiementsOpen}>
    <div style="display:flex;align-items:center;gap:.5rem">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      <span class="dash-card-title">{$lang==='fr'?'Paiements':'Payments'}</span>
      {#if data.billing?.balance > 0}
      <span class="balance-pill">{data.billing.balance.toFixed(2)} $ {$lang==='fr'?'dû':'owing'}</span>
      {/if}
    </div>
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"
      style="transition:transform .2s;transform:rotate({paiementsOpen?180:0}deg)">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </button>
  {#if paiementsOpen}

  <!-- Payment form -->
  <div class="new-order-form">
    <input type="text" class="order-textarea" style="height:auto;padding:.4rem .5rem" bind:value={paymentDesc}
      placeholder={$lang==='fr'?'Description (ex: Acompte cours P1)':'Description (e.g. P1 deposit)'} />
    <div style="display:flex;gap:.4rem;margin-top:.35rem;flex-wrap:wrap;align-items:center">
      <input type="number" bind:value={paymentAmount} placeholder="$ montant"
        class="pay-amount-inp" min="0" step="0.01" />
      <label class="upload-lbl">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        {paymentProofFile ? paymentProofFile.name.slice(0,18) : ($lang==='fr'?'Preuve (opt.)':'Proof (opt.)')}
        <input type="file" accept="image/*,.pdf" style="display:none"
          on:change={e => { paymentProofFile = e.target.files?.[0] || null; }} />
      </label>
      <button class="btn-green-sm" disabled={paymentUploading || !paymentDesc || !paymentAmount}
        on:click|preventDefault={logPayment}>
        {#if paymentUploading}<div class="spinner-xs" style="margin-right:.2rem"></div>{/if}
        {$lang==='fr'?'Envoyer':'Submit'}
      </button>
    </div>
    {#if paymentErr}<div class="xs" style="color:var(--red);margin-top:.2rem">{paymentErr}</div>{/if}
    {#if paymentDone}<div class="xs" style="color:#22c55e;margin-top:.2rem">{$lang==='fr'?'Paiement enregistré ✓':'Payment logged ✓'}</div>{/if}
  </div>

  <!-- Payment history collapsed -->
  {#if data.payments?.length}
  <details class="hist-details">
    <summary class="hist-summary xs">
      {$lang==='fr'?'Historique':'History'} ({data.payments.length}) ▾
    </summary>
    <div style="margin-top:.4rem;display:flex;flex-direction:column;gap:.2rem">
      {#each data.payments as p}
      <div class="pay-row">
        <span class="xs mono" style="color:var(--txt-3)">{p.date}</span>
        <span class="xs" style="flex:1;padding:0 .4rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{p.notes||p.method||'—'}</span>
        <span class="xs mono" style="color:#22c55e">{Number(p.amount||0).toFixed(2)}$</span>
        <span class="pay-badge" class:pay-pending={p.status==='pending'} class:pay-paid={p.status==='paid'} class:pay-rej={p.status==='rejected'}>
          {p.status==='paid'?($lang==='fr'?'Confirmé':'Confirmed'):p.status==='rejected'?($lang==='fr'?'Refusé':'Rejected'):($lang==='fr'?'En attente':'Pending')}
        </span>
      </div>
      {/each}
    </div>
  </details>
  {/if}
  {/if}
</div>

<!-- ── Factures ────────────────────────────────────────────── -->
{#if data.billing}
<div class="card dash-card" style="margin-bottom:.75rem">
  <button class="dash-card-hdr" on:click={() => billOpen = !billOpen} style="width:100%;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:.5rem;padding:0">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--txt-2)" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
    <span class="dash-card-title">{$lang==='fr'?'Factures & reçus':'Invoices & receipts'}</span>

    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"
      style="margin-left:auto;flex-shrink:0;color:var(--txt-3);transition:transform .2s;transform:rotate({billOpen?180:0}deg)">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </button>

  {#if billOpen}
  <div class="dash-card-body">
    <!-- Balance summary -->
    <div class="bill-summary xs">
      <div class="bill-row">
        <span class="muted">{$lang==='fr'?'Total inscription':'Total tuition'}</span>
        <strong>{(data.billing.totalDue||0).toFixed(2)} $</strong>
      </div>
      {#if data.billing.totalPaid > 0}
      <div class="bill-row">
        <span style="color:var(--teal)">{$lang==='fr'?'Payé':'Paid'}</span>
        <span style="color:var(--teal)">− {(data.billing.totalPaid||0).toFixed(2)} $</span>
      </div>
      {/if}
      {#if data.billing.balance > 0}
      <div class="bill-row bill-owing">
        <span>{$lang==='fr'?'Solde dû':'Balance due'}</span>
        <strong>{(data.billing.balance||0).toFixed(2)} $</strong>
      </div>
      {:else if data.billing.totalDue > 0}
      <div class="bill-row" style="color:var(--teal)">
        <span>{$lang==='fr'?'Compte soldé ✓':'Paid in full ✓'}</span>
        <span>0.00 $</span>
      </div>
      {/if}
    </div>

    <!-- Bills history (shared view: instructor uploads + student uploads) -->
    {#if data.bills?.length}
    <div class="bill-history">
      <div class="xs muted" style="margin-bottom:.3rem;font-weight:600">
        {$lang==='fr'?'Documents partagés':'Shared documents'}
      </div>
      {#each data.bills as bill}
      <a href={bill.url} target="_blank" rel="noopener" class="bill-item">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--teal)" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <div class="bill-item-info">
          <span class="xs" style="font-weight:600;color:var(--txt)">{bill.title}</span>
          <span class="xs muted">{bill.uploader_type==='student'?($lang==='fr'?'Uploadé par vous':'Uploaded by you'):($lang==='fr'?'Par instructeur':'By instructor')} · {new Date(bill.uploaded_at).toLocaleDateString($lang==='fr'?'fr-CA':'en-CA',{month:'short',day:'numeric',year:'numeric'})}</span>
        </div>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--teal)" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </a>
      {/each}
    </div>
    {:else}
    <div class="xs muted" style="font-style:italic;margin:.35rem 0">
      {$lang==='fr'?'Aucune facture disponible pour le moment.':'No invoices available yet.'}
    </div>
    {/if}

    <!-- Student upload -->
    <div class="bill-upload-section">
      <div class="xs muted" style="margin-bottom:.35rem;font-weight:600">
        {$lang==='fr'?'Joindre un reçu ou preuve':'Attach receipt or proof'}
      </div>
      {#if billErr}<div class="xs" style="color:#ef4444;margin-bottom:.3rem">{billErr}</div>{/if}
      <input id="bill-title-input" type="text"
        placeholder={$lang==='fr'?'Description (ex: Acompte versé…)':'Description (e.g. Deposit paid…)'}
        class="bill-upload-input xs" style="margin-bottom:.35rem" />
      <div class="bill-upload-row">
        <input id="bill-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png"
          class="bill-file-input xs" />
        <button
          class="btn btn-primary btn-xs"
          disabled={billUploading}
          on:click={async () => {
            const fileEl = document.getElementById('bill-file-input');
            const file = fileEl?.files?.[0];
            if (!file) { billErr = $lang==='fr'?'Choisir un fichier':'Choose a file'; return; }
            billErr = '';
            billUploading = true;
            try {
              const fd = new FormData();
              fd.append('file', file);
              fd.append('title', document.getElementById('bill-title-input')?.value?.trim() || ($lang==='fr'?'Reçu':'Receipt'));
              billProgress = 0;
              await uploadWithProgress('/api/student-bill', fd, { onProgress: p => billProgress = p });
              fileEl.value = '';
              location.reload();
            } catch(e) { billErr = e.message; }
            billUploading = false;
          }}>
          {billUploading ? `${billProgress}%` : ($lang==='fr'?'Envoyer':'Send')}
        </button>
      </div>
      {#if billUploading && billProgress > 0}
      <div class="upload-prog-bar-bg">
        <div class="upload-prog-bar" style="width:{billProgress}%"></div>
      </div>
      {/if}
    </div>
  </div>
  {/if}
</div>
{/if}

<!-- ── Parcours<!-- ── Parcours de formation ────────────────────────────────── -->
<div class="card" style="padding:.75rem .875rem;margin-bottom:.75rem">
  <CourseRoadmap
    stats={stats}
    readiness={data.readiness}
    exercises={dash?.exercises || []}
    exams={dash?.exams || []}
    theory={dash?.theory || []}
    lang={$lang}
  />
</div>

<!-- Course progress -->
<div class="card card-teal prog-card">
 <div class="prog-inner">
 <div class="prog-pct">
 <div class="pct-num">{pct}<span class="pct-sign">%</span></div>
 <div class="pct-label">{$lang==='fr' ? 'FORMATION COMPLÉTÉE' : 'COURSE COMPLETE'}</div>
 </div>
 <div class="prog-bars">
 {#each [
 [$t('dash_theory'), stats.theoryDone, stats.theoryTotal, 'var(--teal)'],
 [$t('dash_exercises'), stats.exDone, stats.exTotal, 'var(--teal)'],
 [$t('dash_exams'), stats.examsDone, stats.examsTotal, 'var(--teal)'],
 ] as [lbl,d,t2,col]}
 <div class="prog-bar-row">
 <span class="pb-lbl xs dimmed">{lbl}</span>
 <div class="progress-track" style="flex:1">
 <div class="progress-fill" style="width:{t2?Math.round(d/t2*100):0}%;background:{col}"></div>
 </div>
 <span class="pb-num mono xs dimmed">{d}/{t2}</span>
 </div>
 {/each}
 </div>
 </div>
</div>

<!-- Flight progress (25 target) -->
<div class="card flight-prog-card">
 <div class="fp-header">
 <div class="fp-label">{$lang==='fr' ? 'Vols' : 'Flights'}</div>
 <div class="fp-count mono">
 <span style="color:var(--teal);font-size:1.4rem">{flightCount}</span>
 <span class="dimmed xs"> / 25</span>
 {#if flightBonus > 0}<span class="bonus-tag">+{flightBonus}</span>{/if}
 {#if flightExtra > 0}<span class="extra-tag">+{flightExtra} extra</span>{/if}
 </div>
 </div>
 <div class="fp-track">
 <!-- 0–25 segment -->
 <div class="fp-seg main" style="flex:25">
 <div class="fp-fill" style="width:{flightPct}%"></div>
 <div class="fp-mark" style="right:0" title="25 vols"></div>
 </div>
 <!-- 26–30 segment (bonus) -->
 <div class="fp-seg bonus" style="flex:5">
 <div class="fp-fill bonus-fill" style="width:{Math.min(flightBonus/5*100,100)}%"></div>
 <div class="fp-mark" style="right:0" title="30 vols"></div>
 </div>
 <!-- 30+ segment (extra) -->
 <div class="fp-seg extra" style="flex:2">
 <div class="fp-fill extra-fill" style="width:{flightExtra>0?100:0}%"></div>
 </div>
 </div>
 <div class="fp-legend">
 <span class="xs dimmed">0</span>
 <span class="xs dimmed" style="margin-left:auto;margin-right:{100/32*2}%">25</span>
 <span class="xs dimmed">30+</span>
 </div>
</div>

<!-- Stats strip -->
<div class="stats-strip">
 <a href="/student/{student.id}/flights" class="stat-card">
 <Icon name="flights" size={18} color="var(--teal)" />
 <div class="stat-val" style="color:var(--teal)">{flightCount}</div>
 <div class="stat-lbl">{$t('dash_flights')}</div>
 </a>
 <a href="/student/{student.id}/flights" class="stat-card">
 <Icon name="timer" size={18} color="var(--green)" />
 <div class="stat-val" style="color:var(--green)">{fmtAir(stats.airtime)}</div>
 <div class="stat-lbl">{$t('dash_airtime')}</div>
 </a>
 <a href="/student/{student.id}/exercises" class="stat-card">
 <Icon name="checklist" size={18} color="var(--green)" />
 <div class="stat-val" style="color:var(--green)">{stats.exDone}</div>
 <div class="stat-lbl">{$t('dash_passed')}</div>
 </a>
 <a href="/student/{student.id}/theory" class="stat-card">
 <Icon name="book" size={18} color="var(--txt-2)" />
 <div class="stat-val">{stats.theoryDone}</div>
 <div class="stat-lbl">{$t('dash_theory_b')}</div>
 </a>
</div>

<!-- Recent flights — numbered, expandable, with mini map -->
{#if completedFlights.length}
 <div class="section-label">{$t('dash_recent')}</div>
 <div class="flight-list">
 {#each completedFlights.slice(0,3) as f, i}
 {@const exDone = parseExercises(f.exercises_done)}
 {@const isOpen = expandedFlight === f.id}
 <div class="flight-item card" class:open={isOpen}>
 <!-- Summary row -->
 <button type="button" class="fi-summary" on:click={() => expandFlight(f)}>
 <span class="fi-num mono">{flightCount - i}</span>
 <div class="fi-info">
 <span class="fi-site">{f.site?.replace(/_/g,' ')||'—'}</span>
 <span class="fi-date mono xs dimmed">{fmtDate(f.date)}</span>
 </div>
 <div class="fi-stats">
 <span class="mono xs" style="color:var(--teal)">{fmtAir(f.duration_seconds)}</span>
 {#if f.flight_type}<span class="badge badge-muted xs">{f.flight_type}</span>{/if}
 {#if exDone.length}<span class="badge badge-info xs">{exDone.length} ex</span>{/if}
 {#if f.what_went_well || f.personal_notes}<span class="note-dot"></span>{/if}
 </div>
 <Icon name={isOpen?'chevronup':'chevrondown'} size={15} color="var(--txt-3)" />
 </button>

 <!-- Expanded content -->
 {#if isOpen}
 <div class="fi-expanded">
 <!-- Info bar -->
 <div class="fi-infobar">
 {#if f.start_time || f.end_time}
 <div class="ib-item">
 <Icon name="clock" size={12} color="var(--txt-3)" />
 <span class="xs dimmed">{f.start_time||'?'} → {f.end_time||'?'}</span>
 </div>
 {/if}
 {#if f.site}
 <div class="ib-item">
 <Icon name="mountain" size={12} color="var(--txt-3)" />
 <span class="xs dimmed">{f.site.replace(/_/g,' ')}</span>
 </div>
 {/if}
 {#if f.landing_site}
 <div class="ib-item">
 <Icon name="flag" size={12} color="var(--txt-3)" />
 <span class="xs dimmed">{f.landing_site.replace(/_/g,' ')}</span>
 </div>
 {/if}
 {#if f.wind_speed}
 <div class="ib-item">
 <Icon name="wind" size={12} color="var(--txt-3)" />
 <span class="xs dimmed">{f.wind_speed}{f.wind_direction ? ' '+f.wind_direction : ''}</span>
 </div>
 {/if}
 </div>

 <!-- Exercises done -->
 {#if exDone.length}
 <div class="fi-exercises">
 <div class="xs dimmed" style="margin-bottom:.3rem">{$lang==='fr'?'Exercices':'Exercises'}:</div>
 <div class="ex-pills">
 {#each exDone as ex}
 <span class="ex-pill">{ex}</span>
 {/each}
 </div>
 </div>
 {/if}

 <!-- Notes -->
 {#if f.what_went_well}
 <div class="fi-note ok">
 <Icon name="check" size={12} color="var(--green)" />
 <span class="small">{f.what_went_well}</span>
 </div>
 {/if}
 {#if f.what_to_improve}
 <div class="fi-note warn">
 <Icon name="flag" size={12} color="var(--amber)" />
 <span class="small">{f.what_to_improve}</span>
 </div>
 {/if}
 {#if f.personal_notes}
 <div class="fi-note">
 <Icon name="note" size={12} color="var(--txt-3)" />
 <span class="small dimmed">{f.personal_notes}</span>
 </div>
 {/if}

 <!-- Mini map -->
 {#if f.track_geojson}
 <div id="map-{f.id}" class="mini-map"></div>
 {:else}
 <div class="no-track dimmed xs">
 <Icon name="gps" size={14} />
 {$lang==='fr' ? 'Aucune trace GPS' : 'No GPS track'}
 </div>
 {/if}

 <!-- Share link -->
 <div class="fi-share">
 <a href="/flight/{f.id}" target="_blank" class="btn btn-secondary btn-xs">
 <Icon name="share" size={12} />{$lang==='fr'?'Partager':'Share'}
 </a>
 </div>
 </div>
 {/if}
 </div>
 {/each}
 </div>
{/if}



<!-- ── Undo toast ──────────────────────────────────────────── -->
{#each undoQueue.filter(u => Date.now() - u.ts < 300000) as item (item.ts)}
<div class="undo-toast">
  <span class="xs">{item.label}</span>
  <button class="undo-btn" on:click={() => doUndo(item)}>{$lang==='fr'?'Annuler':'Undo'}</button>
</div>
{/each}


<style>
 .hero-row{display:flex;align-items:center;gap:.875rem;margin-bottom:1.25rem;flex-wrap:wrap}
 .hero-info h1{font-size:1.35rem}
 .hero-info p{margin-top:.15rem}

 .avatar-initials{width:52px;height:52px;border-radius:50%;background:rgba(0,184,122,.15);border:2px solid var(--teal-border);color:var(--teal);font-family:var(--ff-head);font-weight:800;font-size:1.3rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
 .pending-banner{background:var(--amber-lo);border:1px solid rgba(245,158,11,.2);border-radius:var(--r-md);padding:.875rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap}
 .pb-left{display:flex;align-items:center;gap:.625rem}
 .pb-title{font-family:var(--ff-head);font-size:.875rem;font-weight:600;color:var(--txt);margin-bottom:.1rem}
 .pb-sub{color:var(--txt-2)}

 .prog-card{margin-bottom:.875rem}
 /* Notifications */
 .notif-card{margin-bottom:.75rem;padding:.75rem;border-left:3px solid var(--teal)}
 .notif-header{font-family:var(--ff-head);display:flex;align-items:center;justify-content:space-between;font-weight:600;font-size:.82rem;margin-bottom:.5rem}
 .notif-row{display:flex;gap:.5rem;align-items:flex-start;padding:.3rem 0}
 .notif-dot-i{width:8px;height:8px;border-radius:50%;background:var(--teal);flex-shrink:0;margin-top:.3rem}
 .notif-title{font-family:var(--ff-head);font-size:.83rem;font-weight:600;color:var(--txt)}
 .notif-msg{line-height:1.3}
 /* Day plans */
 /* Day plans — unified styling with msg-card */
 .plan-card{padding:0;overflow:hidden;margin-bottom:.75rem}
 .plan-hdr-btn{display:flex;align-items:center;gap:.5rem;padding:.75rem 1rem;cursor:pointer;user-select:none;width:100%;background:none;border:none;color:inherit;text-align:left}
 .plan-hdr-btn:hover{background:var(--bg-raised)}
 .plan-hdr-title{font-family:var(--ff-head);font-size:.85rem;font-weight:700;color:var(--txt)}
 .plan-count-badge{font-family:var(--ff-head);background:var(--teal);color:#fff;font-size:.68rem;font-weight:700;padding:.1rem .4rem;border-radius:var(--r-full);min-width:18px;text-align:center}
 .plan-count-badge.plan-new{background:var(--amber);animation:pulse-badge 2s ease-in-out infinite}
 @keyframes pulse-badge{0%,100%{opacity:1}50%{opacity:.6}}
 .plan-body{padding:.5rem .75rem .75rem;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:.4rem}
 .plan-day-details{background:var(--bg-2);border-radius:8px;overflow:hidden}
 .plan-day-summary{display:flex;align-items:center;gap:.5rem;padding:.5rem .625rem;cursor:pointer;user-select:none;list-style:none}
 .plan-day-summary::-webkit-details-marker{display:none}
 .plan-day-summary::after{content:'▾';margin-left:auto;color:var(--txt-3);transition:transform .2s}
 .plan-day-details[open] .plan-day-summary::after{transform:rotate(180deg)}
 .plan-day-body{padding:.5rem .625rem .625rem;border-top:1px solid var(--border)}
 .plan-date{color:var(--teal);font-weight:600;flex-shrink:0}
 .plan-site{color:var(--txt-2)}
 .plan-spots{color:var(--txt-3)}
 .rsvp-on{background:rgba(0,184,122,.15);color:var(--teal);border:1.5px solid var(--teal);font-weight:600}
 .rsvp-off{background:var(--teal);color:#fff;border:1.5px solid var(--teal)}
 .rsvp-form{display:flex;flex-direction:column;gap:.3rem;align-items:flex-end}
 .act-select{display:flex;align-items:center;gap:.3rem}
 .act-sel-lbl{color:var(--txt-3);flex-shrink:0}
 .act-sel-input{background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.2rem .35rem;color:var(--txt);font-size:.75rem}
 .plan-header{font-family:var(--ff-head);font-weight:700;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--txt-2);margin-bottom:.5rem}
 .plan-row{display:flex;align-items:center;gap:.75rem;padding:.4rem 0;border-bottom:1px solid var(--border)}
 .plan-row:last-child{border-bottom:none}
 .plan-info{flex:1;min-width:0}
 .plan-date{color:var(--teal)}
 .plan-text{font-size:.82rem;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .plan-spots{margin-top:.15rem}
 .prog-inner{display:flex;gap:1.5rem;align-items:flex-start;flex-wrap:wrap}
 .prog-pct{text-align:center;flex-shrink:0;min-width:70px}
 .pct-num{font-family:var(--ff-head);font-size:2.4rem;font-weight:400;color:var(--teal);line-height:1}
 .pct-sign{font-family:var(--ff-head);font-size:1.2rem}
 .pct-label{font-size:.55rem;text-transform:uppercase;letter-spacing:.07em;color:var(--txt-3);margin-top:.2rem;font-family:var(--ff-head);font-weight:700}
 .prog-bars{flex:1;min-width:160px;display:flex;flex-direction:column;gap:.625rem;justify-content:center}
 .prog-bar-row{display:flex;align-items:center;gap:.625rem}
 .pb-lbl{width:60px;flex-shrink:0}
 .pb-num{width:32px;text-align:right;flex-shrink:0}

 /* Flight progress bar */
 .flight-prog-card{margin-bottom:1.25rem;padding:1.1rem 1.25rem}
 .fp-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem}
 .fp-label{font-family:var(--ff-head);font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--txt-2)}
 .fp-count{display:flex;align-items:baseline;gap:.25rem}
 .bonus-tag{font-family:var(--ff-head);font-size:.68rem;color:var(--amber);background:var(--amber-lo);border:1px solid rgba(245,158,11,.2);border-radius:var(--r-full);padding:.1rem .4rem}
 .extra-tag{font-family:var(--ff-head);font-size:.68rem;color:var(--red);background:var(--red-lo);border:1px solid rgba(239,68,68,.2);border-radius:var(--r-full);padding:.1rem .4rem}
 .fp-track{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:2px;margin-bottom:.35rem}
 .fp-seg{position:relative;background:var(--bg-input);border-radius:4px;overflow:hidden}
 .fp-seg.bonus{background:rgba(245,158,11,.1)}
 .fp-seg.extra{background:rgba(239,68,68,.1)}
 .fp-fill{height:100%;background:var(--teal);transition:width .5s;border-radius:4px}
 .bonus-fill{background:var(--amber)}
 .extra-fill{background:var(--red)}
 .fp-mark{position:absolute;top:0;bottom:0;width:2px;background:var(--bg-card)}
 .fp-legend{display:flex;align-items:center}

 .stats-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1.5rem}
 @media(max-width:400px){.stats-strip{grid-template-columns:repeat(2,1fr)}}
 .stat-card{display:flex;flex-direction:column;align-items:center;gap:.375rem;padding:.875rem .5rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);text-decoration:none;transition:border-color .15s}
 .stat-card:hover{border-color:var(--teal-border);text-decoration:none}
 .stat-val{font-family:var(--ff-head);font-size:1.05rem;font-weight:500;line-height:1}
 .stat-lbl{font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;color:var(--txt-3);font-family:var(--ff-head);font-weight:700;text-align:center}

 .section-label{font-family:var(--ff-head);font-size:.67rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--txt-3);margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem}
 .section-label::after{content:'';flex:1;height:1px;background:var(--border)}

 /* Flight items */
 .flight-list{display:flex;flex-direction:column;gap:.5rem}
 .flight-item{padding:0;overflow:hidden;transition:border-color .15s;isolation:isolate}
 .flight-item.open{border-color:var(--teal-border)}

 .fi-summary{display:flex;align-items:center;gap:.75rem;width:100%;background:none;border:none;cursor:pointer;padding:.875rem 1rem;text-align:left}
 .fi-num{font-family:var(--ff-head);width:28px;height:28px;border-radius:50%;background:var(--bg-raised);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:500;color:var(--txt-2);flex-shrink:0}
 .fi-info{flex:1;display:flex;flex-direction:column;gap:.1rem}
 .fi-site{font-weight:600;font-size:.875rem;color:var(--txt)}
 .fi-stats{display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;flex-shrink:0}
 .note-dot{width:6px;height:6px;border-radius:50%;background:var(--teal);flex-shrink:0}

 .fi-expanded{padding:.75rem 1rem 1rem;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:.625rem}
 .fi-infobar{display:flex;flex-wrap:wrap;gap:.625rem}
 .ib-item{display:flex;align-items:center;gap:.3rem}

 .fi-exercises{}
 .ex-pills{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.25rem}
 .ex-pill{font-size:.7rem;padding:.15rem .5rem;border:1px solid var(--border);border-radius:var(--r-full);color:var(--txt-2);white-space:nowrap}

 .fi-note{display:flex;align-items:flex-start;gap:.4rem;font-size:.82rem;color:var(--txt-2)}
 .fi-note.ok{}
 .fi-note.warn{}

 .mini-map{height:180px;border-radius:var(--r-sm);overflow:hidden;border:1px solid var(--border);position:relative;z-index:0}
 /* Messages */
 .msg-card{padding:0;overflow:hidden;margin-bottom:.75rem}
 .msg-header{display:flex;align-items:center;gap:.5rem;padding:.75rem 1rem;cursor:pointer;user-select:none}
 .msg-title-lbl{font-family:var(--ff-head);font-size:.85rem;font-weight:700;color:var(--txt)}
 .msg-badge{background:var(--teal);color:#fff;font-size:.68rem;font-weight:700;padding:.1rem .4rem;border-radius:var(--r-full);min-width:18px;text-align:center}
 .msg-body{padding:.5rem .75rem .75rem;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:.3rem}
 .msg-empty{padding:.25rem 0}
 .msg-item{background:var(--bg-2);border-radius:8px;overflow:hidden}
 .msg-archived{opacity:.7}
 .msg-item-hdr{display:flex;align-items:center;gap:.5rem;padding:.5rem .625rem;cursor:pointer;user-select:none}
 .msg-item-title{flex:1;font-size:.83rem;font-weight:600;color:var(--txt)}
 .msg-item-date{flex-shrink:0}
 .msg-item-body{padding:.5rem .625rem .625rem;border-top:1px solid var(--border)}
 .msg-item-body p{margin:0;color:var(--txt-2);line-height:1.5}
 .msg-archive-toggle{display:flex;align-items:center;gap:.35rem;padding:.35rem .25rem;cursor:pointer;color:var(--txt-3);margin-top:.2rem;user-select:none}
 /* Orders */
 .order-card{padding:0;overflow:hidden;margin-bottom:.75rem}
 .order-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;padding:.625rem .875rem;gap:.5rem;color:var(--txt-2)}
 .order-toggle:hover{background:var(--bg-raised)}
 .order-body{padding:.25rem .875rem .75rem;border-top:1px solid var(--border)}
 .order-hdr{font-family:var(--ff-head);font-size:.82rem;font-weight:700;color:var(--txt);margin-bottom:.3rem}
 .payment-log-section{padding:.5rem .875rem .75rem;border-top:1px solid var(--border)}
 .payment-inputs{display:flex;flex-direction:column;gap:.35rem}
 .pay-input{width:100%;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.35rem .5rem;color:var(--txt);font-size:.85rem;font-family:inherit}
 .pay-amount{width:140px}
 .pay-history{margin-top:.4rem;display:flex;flex-direction:column;gap:.2rem}
 .pay-row{display:flex;align-items:center;gap:.25rem;padding:.25rem .4rem;background:var(--bg-2);border-radius:5px}
 .pay-badge{font-size:.65rem;font-weight:700;padding:.1rem .35rem;border-radius:var(--r-full)}
 .pay-pending{background:rgba(245,158,11,.15);color:var(--amber)}
 .pay-paid{background:rgba(0,184,122,.15);color:var(--teal)}
 .pay-rej{background:rgba(239,68,68,.15);color:var(--red)}
 .spinner-xs{width:10px;height:10px;border:2px solid rgba(255,255,255,.25);border-top-color:var(--teal);border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0}
 .order-textarea{width:100%;background:var(--bg-2);border:1px solid var(--border);border-radius:7px;padding:.5rem .65rem;color:var(--txt);font-size:.85rem;resize:vertical;font-family:inherit}
 .order-list{display:flex;flex-direction:column;gap:.35rem;margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border)}
 /* Student order chat */
 .sorder{border:1px solid var(--border);border-radius:9px;overflow:hidden;background:var(--bg-2)}
 .sorder.open{border-color:var(--teal,#00e8c6)}
 .sorder-head{display:flex;align-items:center;gap:.5rem;width:100%;background:none;border:none;cursor:pointer;padding:.5rem .55rem;text-align:left;color:var(--txt)}
 .sorder-snippet{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--txt-2)}
 .sorder-thread{padding:.45rem .55rem .55rem;border-top:1px solid var(--border)}
 .sorder-msgs{display:flex;flex-direction:column;gap:.35rem;max-height:260px;overflow-y:auto;margin-bottom:.45rem}
 .sorder-bubble{max-width:84%;padding:.38rem .55rem;border-radius:12px;font-size:.8rem;line-height:1.35}
 .sorder-bubble .sb-body{white-space:pre-wrap;word-break:break-word}
 .sorder-bubble .sb-time{margin-top:.12rem;opacity:.6;font-size:.62rem}
 .sb-them{align-self:flex-start;background:var(--bg-raised,#11203a);color:var(--txt);border-bottom-left-radius:3px}
 .sb-me{align-self:flex-end;background:var(--teal,#00e8c6);color:#003C4E;border-bottom-right-radius:3px}
 .sb-me .sb-time{color:#003C4E}
 .sorder-input-row{display:flex;gap:.4rem;align-items:flex-end}
 .order-item{background:var(--bg-2);border-radius:7px;padding:.4rem .6rem;display:flex;flex-direction:column;gap:.1rem}
 .order-desc{color:var(--txt-2)}
 .order-status{font-family:var(--ff-head);font-weight:700;text-transform:uppercase;letter-spacing:.04em}
 .status-pending{color:var(--amber)}
 .status-ok{color:var(--teal)}
 .order-response{border-left:2px solid var(--teal);padding-left:.4rem}
 .no-track{display:flex;align-items:center;gap:.4rem;padding:.5rem;color:var(--txt-3)}
 .fi-share{display:flex;justify-content:flex-end}

 :global(.leaflet-container){background:var(--bg)!important}
 .auw-block{border-top:1px solid var(--border);padding-top:.75rem;margin-top:.375rem}
 .auw-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;padding:.2rem 0;gap:.5rem}
 .auw-summary{display:flex;align-items:baseline;gap:.4rem;flex-wrap:wrap}
 .auw-total-kg{font-family:var(--ff-head);font-size:1.05rem;font-weight:500;color:var(--teal)}
 .auw-wl{font-size:.9rem;font-weight:500}
 /* Grid-based rows so columns stay perfectly aligned */
 .auw-detail{padding:.5rem 0;display:flex;flex-direction:column;gap:.2rem}
 .awd-row{display:grid;grid-template-columns:1fr 36px 1fr 64px;align-items:center;gap:.5rem;padding:.3rem .375rem;border-radius:var(--r-xs)}
 .awd-row.tog-row{background:var(--bg-raised)}
 .awd-row.off{opacity:.45}
 .awd-lbl{font-size:.78rem;color:var(--txt-2);min-width:0}
 .awd-val{font-size:.82rem;text-align:right;color:var(--txt);font-family:var(--ff-head);white-space:nowrap}
 .awd-tog-spacer{width:36px}
 .awd-slider-spacer{width:100%}
 /* Full-width slider — no max-width */
 .wt-slider{width:100%;accent-color:var(--teal);height:4px;cursor:pointer;display:block}
 .wt-slider.hidden{visibility:hidden}
 /* Toggle switch */
 .tog{width:36px;height:20px;border-radius:10px;background:var(--border);border:none;cursor:pointer;position:relative;flex-shrink:0;transition:background .2s;padding:0;justify-self:center}
 .tog.on{background:var(--teal)}
 .tog-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .18s;display:block;box-shadow:0 1px 4px rgba(0,0,0,.4)}
 .tog.on .tog-knob{transform:translateX(16px)}
 .awd-result{margin-top:.75rem;padding-top:.625rem;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:.5rem}
 .awd-total-row{display:flex;align-items:baseline;gap:.5rem}
 .awd-lbl-hd{font-family:var(--ff-head);font-size:.67rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--txt-3)}
 .gauge-row{display:flex;flex-direction:column;gap:.3rem}
 .gauge-meta{display:flex;align-items:baseline;justify-content:space-between}
 .gauge-num{font-family:var(--ff-head);font-size:.9rem;font-weight:600}
 .gauge-bar{display:flex;gap:2px;height:9px}
 .g-seg{flex:1;border-radius:2px;transition:background .2s}
 /* PTV info box */
 .ptv-box{background:var(--bg-raised);border:1px solid var(--teal-border);border-radius:var(--r-sm);padding:.625rem .875rem;margin-top:.375rem}
 .ptv-main{display:flex;align-items:baseline;gap:.625rem;flex-wrap:wrap}
 .ptv-item{display:flex;flex-direction:column;gap:.1rem}
 .ptv-lbl{font-family:var(--ff-head);font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--txt-3)}
 .ptv-val{font-family:var(--ff-head);font-size:.95rem;font-weight:500}
 .ptv-sep{color:var(--txt-3);font-size:.75rem;align-self:center}
 /* Gauge with range dots */
 .gauge-bar-wrap{position:relative;margin-top:.1rem}
 .gauge-meta-left{display:flex;flex-direction:column;gap:.1rem}
 .gauge-ideal{color:var(--teal);opacity:.6;font-style:italic}
 .range-dot{position:absolute;top:50%;transform:translate(-50%,-50%);width:4px;height:14px;border-radius:2px;z-index:2}
 .range-min{background:var(--green)}
 .range-max{background:var(--red)}
 .equip-display { display:flex; flex-direction:column; gap:.75rem; margin-bottom:.875rem; }
 .eq-items { display:flex; flex-direction:column; gap:.5rem; }
 .eq-item { display:flex; align-items:center; gap:.75rem; padding:.5rem 0; border-bottom:1px solid var(--border); }
 .eq-item:last-child { border-bottom:none; }
 .eq-ico { width:22px; height:22px; flex-shrink:0; color:var(--teal); opacity:.8; }
 .eq-detail { flex:1; display:flex; flex-direction:column; gap:.1rem; }
 .eq-name { font-size:.875rem; font-weight:600; color:var(--txt); }
 .eq-sub { font-size:.7rem; color:var(--txt-3); font-family:var(--ff-head); }
 .eq-weight { font-family:var(--ff-head); font-size:.78rem; color:var(--txt-2); flex-shrink:0; }
 .eq-edit-btn { margin-top:.25rem; align-self:flex-start; }
 .eq-section-title { font-family:var(--ff-head); font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--teal); margin-bottom:.625rem; border-bottom:1px solid var(--teal-border); padding-bottom:.35rem; }

 .weight-summary { display:flex; align-items:center; gap:.5rem; padding:.75rem; background:var(--bg-raised); border-radius:var(--r-sm); flex-wrap:wrap; }
 .ws-item { display:flex; flex-direction:column; align-items:center; gap:.1rem; }
 .ws-label { font-size:.6rem; text-transform:uppercase; letter-spacing:.06em; color:var(--txt-3); font-family:var(--ff-head); font-weight:700; }
 .ws-val { font-size:.9rem; font-weight:500; }
 .ws-sep { color:var(--txt-3); font-size:.875rem; padding:0 .1rem; }
 .ws-total .ws-val { font-size:1rem; }
 .ws-loading .ws-val { font-size:1rem; }
 .equip-card{display:flex;flex-direction:column;gap:.375rem}
 .eq-row{display:flex;align-items:center;gap:.5rem}
 .equip-form-card{}
  .bill-hdr{display:flex;align-items:center;justify-content:space-between;gap:.5rem;cursor:pointer;padding:.1rem 0;margin-bottom:.1rem}
  .bill-body{padding-top:.35rem;border-top:1px solid var(--border)}
  .bill-balance-row{border-top:1px solid var(--border);padding-top:.3rem;margin-top:.25rem}
  .bill-balance{font-size:.88rem;font-weight:800}
  .bill-doc-row{display:flex;align-items:center;gap:.4rem;margin-top:.35rem;padding-top:.35rem;border-top:1px solid var(--border)}
  .order-history-details{margin-top:.5rem}
  .order-history-summary{display:flex;align-items:center;gap:.4rem;cursor:pointer;list-style:none;padding:.3rem 0}
  .order-history-summary::-webkit-details-marker{display:none}
  .order-pending-badge{background:#f59e0b;color:#fff;border-radius:10px;padding:0 .35rem;font-size:.65rem;font-weight:700}
  .status-responded{color:#a78bfa}
  .debrief-alert-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
  .debrief-alert-link{font-size:.8rem;color:var(--teal);padding:.15rem 0;text-decoration:none;flex:1}
  .debrief-dismiss{background:none;border:none;color:var(--txt-3);cursor:pointer;font-size:.75rem;flex-shrink:0;padding:.1rem .25rem}
  .undo-toast{position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:var(--bg-raised);border:1px solid var(--teal);border-radius:8px;padding:.4rem .75rem;display:flex;align-items:center;gap:.75rem;z-index:300;box-shadow:0 2px 12px rgba(0,0,0,.3)}
  .undo-btn{background:var(--teal);color:#fff;border:none;border-radius:6px;padding:.2rem .55rem;font-size:.75rem;font-weight:700;cursor:pointer}
  .bill-hdr{display:flex;align-items:center;justify-content:space-between;gap:.5rem;cursor:pointer;padding:.1rem 0;margin-bottom:.1rem}
  .bill-body{padding-top:.35rem;border-top:1px solid var(--border)}
  .bill-balance-row{border-top:1px solid var(--border);padding-top:.3rem;margin-top:.25rem}
  .bill-balance{font-size:.88rem;font-weight:800}
  .bill-doc-row{display:flex;align-items:center;gap:.4rem;margin-top:.35rem;padding-top:.35rem;border-top:1px solid var(--border)}
  /* Dashboard cards (orders + payments) */
  .dash-card{padding:.75rem .875rem;margin-bottom:.75rem}
  .dash-card-hdr{display:flex;align-items:center;gap:.5rem;margin-bottom:.625rem}
  .dash-card-title{font-family:var(--ff-head);font-size:.88rem;font-weight:800;color:var(--txt);flex:1}
  .balance-pill{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:.1rem .45rem;font-size:.7rem;font-weight:700;font-family:var(--ff-head)}
  .new-order-form{margin-bottom:.5rem}
  .hist-details{margin-top:.4rem}
  .hist-summary{cursor:pointer;color:var(--txt-3);font-weight:600;padding:.2rem 0;list-style:none}
  .hist-summary::-webkit-details-marker{display:none}
  .pending-item{border-left:2px solid #f59e0b}
  .order-item-top{display:flex;align-items:center;justify-content:space-between;gap:.4rem;margin-bottom:.15rem}
  .status-pill{font-family:var(--ff-head);font-size:.65rem;font-weight:700;border-radius:8px;padding:.08rem .4rem}
  .status-pending{background:rgba(245,158,11,.15);color:#f59e0b}
  .status-ok{background:rgba(34,197,94,.15);color:#22c55e}
  .status-resp{background:rgba(0,232,198,.12);color:var(--teal)}
  .btn-teal-sm{background:var(--teal,#00e8c6);color:#003C4E;border:none;border-radius:7px;padding:.3rem .75rem;font-weight:800;font-size:.78rem;cursor:pointer}
  .btn-teal-sm:disabled{opacity:.4;cursor:not-allowed}
  .btn-green-sm{background:#22c55e;color:#fff;border:none;border-radius:7px;padding:.3rem .75rem;font-weight:800;font-size:.78rem;cursor:pointer;display:flex;align-items:center}
  .btn-green-sm:disabled{opacity:.4;cursor:not-allowed}
  .pay-amount-inp{width:90px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.35rem .45rem;color:var(--txt);font-size:.85rem;font-family:monospace}
  .upload-lbl{display:inline-flex;align-items:center;gap:.25rem;font-size:.72rem;color:var(--txt-3);background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.3rem .5rem;cursor:pointer}
  .recent-flights-list{display:flex;flex-direction:column;gap:0}
  .rf-row{display:flex;align-items:center;gap:.5rem;padding:.4rem .25rem;border-bottom:1px solid var(--border);text-decoration:none;transition:background .12s}
  .rf-row:hover{background:var(--bg-2)}
  .rf-row:last-child{border-bottom:none}
  .rf-num{color:var(--txt-3);font-family:var(--ff-head);min-width:18px;text-align:right}
  .rf-info{flex:1;display:flex;flex-direction:column;gap:.05rem;padding:0 .4rem}
  .rf-stats{display:flex;flex-direction:column;align-items:flex-end;gap:.05rem;flex-shrink:0}
  .dash-toggle-hdr{width:100%;display:flex;align-items:center;justify-content:space-between;background:none;border:none;cursor:pointer;padding:0;margin-bottom:0}
  .dash-toggle-hdr:focus{outline:none}
  .badge-teal{background:rgba(0,232,198,.15);color:var(--teal);border-radius:8px;padding:.05rem .4rem;font-size:.65rem;font-weight:700}
  .bill-doc-link{display:flex;align-items:center;gap:.625rem;padding:.5rem .35rem;background:var(--bg-2);border-radius:8px;text-decoration:none;transition:background .12s}
  .balance-pill-sm{font-size:.68rem;font-weight:700;color:#f59e0b;background:rgba(245,158,11,.1);border-radius:8px;padding:.1rem .4rem;flex-shrink:0}
  .dash-card-body{padding-top:.5rem}
  .bill-history{display:flex;flex-direction:column;gap:.25rem;margin:.5rem 0}
  .bill-item{display:flex;align-items:center;gap:.5rem;padding:.4rem .5rem;background:var(--bg-2);border-radius:8px;text-decoration:none;transition:background .12s}
  .bill-item:hover{background:var(--bg-raised)}
  .bill-item-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:.05rem;overflow:hidden}
  .bill-upload-section{border-top:1px solid var(--border);padding-top:.5rem;margin-top:.35rem}
  .upload-prog-bar-bg{height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:.35rem}
  .upload-prog-bar{height:100%;background:var(--teal);border-radius:2px;transition:width .15s}
  .bill-upload-input{width:100%;padding:.35rem .55rem;box-sizing:border-box;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;color:var(--txt);font-family:inherit;outline:none}
  .bill-upload-row{display:flex;align-items:center;gap:.5rem}
  .bill-file-input{flex:1;min-width:0;font-size:.73rem;color:var(--txt-3)}
  .bill-doc-link:hover{background:var(--bg-raised)}
  .bill-summary{display:flex;flex-direction:column;gap:.25rem;margin-bottom:.1rem}
  .bill-row{display:flex;justify-content:space-between;align-items:center;padding:.2rem 0;border-bottom:1px solid var(--border)}
  .bill-row:last-child{border-bottom:none}
  .bill-owing{color:#f59e0b;font-weight:700}
</style>
