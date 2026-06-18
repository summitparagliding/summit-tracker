<script>
  import { enhance } from '$app/forms';
  import Icon from '$lib/components/Icon.svelte';
  import { lang } from '$lib/stores/lang.js';
  $: L = $lang === 'fr';
  export let data, form;
  $: ({ dash, today, allProgress, messages, orders, allOrders, pendingDebriefs, acknowledgedDebriefs, newOrders, pendingPayments, flightRemovals } = data);

  let newMsgTitle = '', newMsgBody = '';
  let showMsgForm = false;
  let msgOpen = false;
  let ordersOpen = false;
  $: pendingOrders = (orders || []).filter(o => o.status !== 'confirmed' && o.status !== 'completed');

  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
  function fmtDur(s) { if(!s)return'—'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; }

  $: todayTotal = today.reduce((a,g) => a+g.exercises.length+g.exams.length, 0);

  // Progress bar color
  function pct(n,t) { return t ? Math.round(n/t*100) : 0; }
  function barColor(p) { return p>=80?'var(--green)':p>=40?'var(--teal)':'var(--txt-3)'; }
  function parsePhases(raw) {
    if (!raw || raw === '[]') return [];
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
    catch(e) { return []; }
  }

  // ── Order chat (multi-message exchange, then Confirm) ───────
  let openOrderId = null;
  let threads = {};          // order_id -> { ...order, messages: [] }
  let threadLoading = false;
  let replyText = '';
  let historyOpen = false;

  async function api(action, payload) {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Error');
    return data;
  }
  async function toggleOrder(id) {
    if (openOrderId === id) { openOrderId = null; return; }
    openOrderId = id; replyText = '';
    if (!threads[id]) await loadThread(id);
  }
  async function loadThread(id) {
    threadLoading = true;
    try { const { thread } = await api('get_order_thread', { order_id: id }); threads = { ...threads, [id]: thread }; }
    catch (e) { /* leave closed */ }
    finally { threadLoading = false; }
  }
  async function sendOrderMessage(id) {
    const t = replyText.trim(); if (!t) return;
    replyText = '';
    try { const { thread } = await api('post_order_message', { order_id: id, body: t }); threads = { ...threads, [id]: thread }; }
    catch (e) { alert(e.message); replyText = t; }
  }
  async function confirmOrderChat(id) {
    if (!confirm(L ? 'Confirmer cette commande ? Les détails sont complets ?' : 'Confirm this order? All details gathered?')) return;
    try { await api('confirm_order', { order_id: id }); location.reload(); }
    catch (e) { alert(e.message); }
  }
  function fmtMsgTime(d) {
    return d ? new Date(d).toLocaleString(L ? 'fr-CA' : 'en-CA', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '';
  }
</script>


<svelte:head><title>Dashboard — Summit Paragliding</title></svelte:head>

<div class="page-hd">
  <div><h1>Dashboard</h1><p>Summit Paragliding · Instructor</p></div>
</div>

{#if form?.ok}<div class="alert alert-ok" style="margin-bottom:1rem"><Icon name="check" size={14} />Signed off successfully</div>{/if}

<div class="section-label" style="margin-top:1.5rem">Messages aux étudiants</div>
<div class="msg-panel card" style="padding:.875rem;margin-bottom:1rem">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <button class="msg-toggle-btn" on:click={() => msgOpen = !msgOpen}>
      <span class="xs" style="font-weight:700;color:var(--txt)">Messages aux élèves</span>
      {#if messages?.length}
      <span class="msg-count-pill">{messages.length}</span>
      {/if}
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"
        style="margin-left:.25rem;transition:transform .2s;transform:rotate({msgOpen?180:0}deg)">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
    <button class="btn btn-primary btn-sm" on:click={() => { msgOpen=true; showMsgForm = !showMsgForm; }}>
      + Nouveau
    </button>
  </div>
  {#if msgOpen}
  {#if showMsgForm}
  <form method="POST" action="?/createMessage" use:enhance on:submit={() => { showMsgForm = false; newMsgTitle=''; newMsgBody=''; }} class="msg-form">
    <div class="fg"><label class="xs">Titre</label><input name="title" bind:value={newMsgTitle} placeholder="Objet du message" required /></div>
    <div class="fg"><label class="xs">Message</label><textarea name="body" bind:value={newMsgBody} rows="3" placeholder="Contenu visible par tous les étudiants…" required></textarea></div>
    <button type="submit" class="btn btn-primary btn-sm">Envoyer à tous</button>
  </form>
  {/if}
  {#if messages?.length}
  <div class="msg-list">
    {#each messages as m}
    <div class="msg-row">
      <div style="flex:1;min-width:0">
        <div class="msg-title-s">{m.title}</div>
        <div class="xs dimmed">{(m.body||"").slice(0,80)}{(m.body||"").length>80?'…':''}</div>
        <div class="xs dimmed" style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-top:.15rem">
          <span>{new Date(m.created_at).toLocaleDateString('fr-CA',{month:'short',day:'numeric'})}</span>
          {#if m.readers?.length}
          <span class="seen-pill">Vu par {m.readers.length}: {m.readers.slice(0,3).map(r=>r.name.split(' ')[0]).join(', ')}{m.readers.length>3?'…':''}</span>
          {:else}
          <span class="seen-pill unseen">Non lu</span>
          {/if}
        </div>
      </div>
      <form method="POST" action="?/deleteMessage" use:enhance style="flex-shrink:0">
        <input type="hidden" name="id" value={m.id} />
        <button class="btn btn-danger btn-xs" on:click|preventDefault={e=>{if(confirm('Supprimer ce message?'))e.target.form.submit();}}>X</button>
      </form>
    </div>
    {/each}
  </div>
  {:else}
  <div class="xs dimmed">Aucun message.</div>
  {/if}
  {/if}
</div>

<!-- Messages Panel -->
<div class="section-label" style="margin-top:1.5rem">
  Débriefings en attente
  {#if pendingDebriefs?.length}<span class="badge badge-amber">{pendingDebriefs.length}</span>{/if}
</div>

{#if pendingDebriefs?.length}
<div class="debrief-requests-list">
  {#each pendingDebriefs as d}
  <div class="debrief-request-card">
    <div class="dr-top">
      <span class="dr-pilot">{d.student_name}</span>
      <span class="xs muted">
        {d.flight_date ? new Date(d.flight_date+'T12:00:00').toLocaleDateString('fr-CA',{month:'short',day:'numeric'}) : '—'}
        {d.flight_site ? ' · ' + d.flight_site.replace(/_/g,' ') : ''}
      </span>
      <a href="/flight/{d.flight_id}" target="_blank" class="btn btn-ghost btn-xs" style="margin-left:auto">Voir vol</a>
    </div>
    {#if parsePhases(d.phases_requested).length}
      <div class="xs muted" style="margin:.25rem 0">Phases: {parsePhases(d.phases_requested).join(', ')}</div>
    {/if}
    {#if d.student_note}
      <div class="xs" style="margin:.25rem 0;padding:.4rem .55rem;background:var(--bg-2);border-left:3px solid var(--teal);border-radius:6px;color:var(--txt-2);white-space:pre-wrap">
        <strong style="color:var(--teal)">Note de l'étudiant :</strong> {d.student_note}
      </div>
    {/if}
    <form method="POST" action="?/respondDebrief" use:enhance class="debrief-resp-form">
      <input type="hidden" name="debrief_id" value={d.id} />
      <textarea name="content" rows="3" placeholder="Votre débriefing pour cet étudiant…" class="debrief-textarea" required></textarea>
      <button type="submit" class="btn btn-primary btn-sm">Envoyer le débriefing</button>
    </form>
  </div>
  {/each}
</div>
{:else}
<div class="muted xs" style="padding:.5rem 0">Aucun débriefing en attente.</div>
{/if}


{#if data.registrations?.length}
<div class="reg-notif-card">
  <div class="reg-notif-title">
    <span>{$lang==='fr'?"Demandes d'inscription":"Registration requests"}</span>
    <span class="reg-badge">{data.registrations.length}</span>
  </div>
  {#each data.registrations as r}
  <div class="reg-item">
    <div style="flex:1;min-width:0">
      <div class="xs" style="font-weight:700;color:var(--txt)">{r.name}</div>
      {#if r.phone}<div class="xs muted">{r.phone}</div>{/if}
      {#if r.email}<div class="xs muted">{r.email}</div>{/if}
      {#if r.message}<div class="xs" style="color:var(--txt-2);margin-top:.1rem">{r.message}</div>{/if}
    </div>
    <a href="/instructor/approve-registration/{r.id}" class="btn btn-primary btn-xs" style="flex-shrink:0">
      {$lang==='fr'?'Approuver':'Approve'}
    </a>
  </div>
  {/each}
</div>
{/if}

<!-- New student orders notification -->
{#if newOrders?.length}
<div class="new-orders-strip">
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:var(--amber,#f59e0b)"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
  <span class="xs" style="font-weight:700;color:var(--amber,#f59e0b)">{L?'Nouvelle(s) commande(s)':'New order(s)'} :</span>
  {#each newOrders as o}
  <span class="xs muted">{o.student_name} — <span style="color:var(--txt)">{o.description.slice(0,40)}{o.description.length>40?'…':''}</span></span>
  {/each}
</div>
{/if}

<!-- Acknowledged debriefs notification -->
{#if acknowledgedDebriefs?.length}
<div class="ack-strip">
  <span class="xs" style="color:var(--teal);font-weight:600">
    {L?'Débriefings lus :':'Read debriefings:'}
  </span>
  {#each acknowledgedDebriefs as a}
  <span class="xs muted">
    {a.student_name}
    <a href="/flight/{a.flight_id}" class="xs" style="color:var(--teal)">
      {L?'(vol':'(flight'} {a.flight_date||''}) ✓
    </a>
  </span>
  {/each}
</div>
{/if}

<!-- ── TODAY'S ACTIVITY ──────────────────────────────────── -->
{#if today.length}
  <div class="today-panel">
    <div class="tp-header">
      <div>
        <div class="tp-title">Today's Activity</div>
        <div class="tp-sub dimmed xs">{todayTotal ?? 0} item{todayTotal!==1?'s':''} awaiting sign-off · {new Date().toLocaleDateString('en-CA')}</div>
      </div>
      <a href="/instructor/signoffs" class="btn btn-secondary btn-sm">All sign-offs</a>
    </div>

    {#each today as g}
      <div class="student-block">
        <div class="sb-row">
          <div class="sb-av">{g.student_name[0]}</div>
          <div class="sb-name">{g.student_name}</div>
          <div class="sb-counts dimmed xs">
            {#if g.exercises.length}{g.exercises.length} ex{/if}
            {#if g.exercises.length && g.exams.length} · {/if}
            {#if g.exams.length}{g.exams.length} exam{/if}
          </div>
          <!-- BULK SIGN-OFF -->
          <form method="POST" action="?/signAllForStudent" use:enhance>
            <input type="hidden" name="student_id" value={g.student_id} />
            <button type="submit" class="btn btn-success btn-xs bulk-btn"
              on:click|preventDefault={e=>{if(confirm(`Approve all ${g.exercises.length+g.exams.length} items for ${g.student_name}?`))e.target.closest('form').requestSubmit()}}>
              <Icon name="check" size={12} />Approve All
            </button>
          </form>
        </div>
        <div class="item-list">
          {#each g.exercises as ex}
            <div class="today-item">
              <span class="badge badge-muted xs">{ex.category?.replace('_',' ')}</span>
              <a href="/instructor/students/{g.student_id}?tab=exercises" class="small today-item-link" style="flex:1">{ex.exercise_title}</a>
              {#if ex.attempt_notes}<span class="dimmed xs" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">"{ex.attempt_notes}"</span>{/if}
              <form method="POST" action="?/signoffExercise" use:enhance style="display:inline">
                <input type="hidden" name="log_id" value={ex.id} />
                <input type="hidden" name="status" value="passed" />
                <button type="submit" class="btn btn-success btn-xs"><Icon name="check" size={11} /></button>
              </form>
              <form method="POST" action="?/signoffExercise" use:enhance style="display:inline">
                <input type="hidden" name="log_id" value={ex.id} />
                <input type="hidden" name="status" value="failed" />
                <button type="submit" class="btn btn-danger btn-xs"><Icon name="cross" size={11} /></button>
              </form>
            </div>
          {/each}
          {#each g.exams as ea}
            <div class="today-item">
              <span class="badge badge-info xs">{ea.exam_type}</span>
              <a href="/instructor/students/{g.student_id}?tab=theory" class="small today-item-link" style="flex:1">{ea.exam_title}</a>
              {#if ea.student_notes}<span class="dimmed xs" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">"{ea.student_notes}"</span>{/if}
              <form method="POST" action="?/signoffExam" use:enhance style="display:inline">
                <input type="hidden" name="attempt_id" value={ea.id} />
                <input type="hidden" name="passed" value="1" />
                <button type="submit" class="btn btn-success btn-xs"><Icon name="check" size={11} /></button>
              </form>
              <form method="POST" action="?/signoffExam" use:enhance style="display:inline">
                <input type="hidden" name="attempt_id" value={ea.id} />
                <input type="hidden" name="passed" value="0" />
                <button type="submit" class="btn btn-danger btn-xs"><Icon name="cross" size={11} /></button>
              </form>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{:else}
  <div class="today-empty">
    <Icon name="check" size={20} color="var(--green)" />
    <span class="small">All caught up — nothing pending today.</span>
  </div>
{/if}

<!-- ── STATS STRIP ────────────────────────────────────────── -->
<div class="stat-row">
  <div class="stat-card card">
    <Icon name="students" size={20} color="var(--teal)" />
    <div class="sv">{dash?.students ?? 0}</div><div class="sl">Students</div>
  </div>
  <div class="stat-card card">
    <Icon name="flights" size={20} color="var(--teal)" />
    <div class="sv" style="color:var(--teal)">{dash?.flights ?? 0}</div><div class="sl">Flights</div>
  </div>
  <div class="stat-card card">
    <Icon name="clock" size={20} color="{todayTotal>0?'var(--amber)':'var(--green)'}" />
    <div class="sv" style="color:{todayTotal>0?'var(--amber)':'var(--green)'}">{todayTotal ?? 0}</div><div class="sl">Pending</div>
  </div>
</div>

<!-- ── ACTIVITY & ALERTS (always at top) ────────────────── -->
{#if (pendingDebriefs?.length || newOrders?.length || pendingPayments?.length || data.registrations?.length || acknowledgedDebriefs?.length || flightRemovals?.length)}
<div class="card activity-card" style="margin-bottom:1rem">
  <div class="activity-hdr">
    <span class="act-title">{$lang==='fr' ? 'Activité & actions requises' : 'Activity & required actions'}</span>
    {#if (pendingDebriefs?.length||0)+(newOrders?.length||0)+(pendingPayments?.length||0)+(data.registrations?.length||0)+(acknowledgedDebriefs?.length||0)+(flightRemovals?.length||0) > 0}
    <span class="act-badge">{(pendingDebriefs?.length||0)+(newOrders?.length||0)+(pendingPayments?.length||0)+(data.registrations?.length||0)+(acknowledgedDebriefs?.length||0)+(flightRemovals?.length||0)}</span>
    {/if}
  </div>
  <div class="act-list">
    {#each (pendingDebriefs || []) as d}
    <a href="/instructor/students/{d.student_id}?tab=flights" class="act-item act-item-link"><div class="act-dot" style="background:#f59e0b"></div>
      <div class="act-body"><span class="xs act-label">{$lang==='fr'?'Débriefing demandé':'Debrief requested'}</span>
      <span class="xs act-name">{d.student_name} · Vol #{d.flight_id}</span></div>
      <span class="act-btn xs">{$lang==='fr'?'Répondre':'Reply'}</span></a>
    {/each}
    {#each (acknowledgedDebriefs || []).slice(0,3) as d}
    <a href="/instructor/students/{d.student_id}?tab=flights" class="act-item act-item-link"><div class="act-dot" style="background:var(--teal)"></div>
      <div class="act-body"><span class="xs act-label">{$lang==='fr'?'Briefing compris ✓':'Briefing confirmed ✓'}</span>
      <span class="xs act-name">{d.student_name}</span></div></a>
    {/each}
    {#each (newOrders || []) as o}
    <a href="/instructor/students/{o.student_id}?tab=orders" class="act-item act-item-link"><div class="act-dot" style="background:#8b5cf6"></div>
      <div class="act-body"><span class="xs act-label">{$lang==='fr'?'Nouvelle commande':'New order'}</span>
      <span class="xs act-name">{o.student_name}</span></div>
      <span class="act-btn xs">{$lang==='fr'?'Voir':'View'}</span></a>
    {/each}
    {#each (pendingPayments || []) as p}
    <a href="/instructor/students/{p.student_id}?tab=payments" class="act-item act-item-link"><div class="act-dot" style="background:#22c55e"></div>
      <div class="act-body"><span class="xs act-label">{$lang==='fr'?'Paiement à confirmer':'Payment to confirm'}</span>
      <span class="xs act-name">{p.student_name} · {(p.amount||0).toFixed(2)} $</span></div>
      <span class="act-btn xs">{$lang==='fr'?'Confirmer':'Confirm'}</span></a>
    {/each}
    {#each (data.registrations || []).slice(0,3) as r}
    <div class="act-item"><div class="act-dot" style="background:#f97316"></div>
      <div class="act-body"><span class="xs act-label">{$lang==='fr'?'Demande inscription':'Registration'}</span>
      <span class="xs act-name">{r.name} · {r.email}</span></div>
      <a href="/instructor/approve-registration/{r.id}" class="act-btn xs">{$lang==='fr'?'Traiter':'Process'}</a></div>
    {/each}
    {#each (flightRemovals || []) as fr}
    <div class="act-item"><div class="act-dot" style="background:#ef4444"></div>
      <div class="act-body">
        <span class="xs act-label">{$lang==='fr'?'Retrait de vol demandé':'Flight removal requested'}</span>
        <span class="xs act-name">{fr.student_name} · {$lang==='fr'?'vol':'flight'} #{fr.flight_id}{fr.flight_date?` · ${new Date(fr.flight_date+'T12:00:00').toLocaleDateString($lang==='fr'?'fr-CA':'en-CA',{month:'short',day:'numeric'})}`:''}{fr.reason?` · "${fr.reason}"`:''}</span>
      </div>
      <div style="display:flex;gap:.3rem;flex-shrink:0">
        <form method="POST" action="?/approveRemoval" use:enhance>
          <input type="hidden" name="request_id" value={fr.id} />
          <button class="act-btn xs" style="color:#ef4444"
            on:click|preventDefault={e=>{ if(confirm($lang==='fr'?`Retirer le vol #${fr.flight_id} de ${fr.student_name} ? Action définitive.`:`Remove flight #${fr.flight_id} for ${fr.student_name}? This is permanent.`)) e.target.closest('form').requestSubmit(); }}>
            {$lang==='fr'?'Confirmer':'Approve'}</button>
        </form>
        <form method="POST" action="?/denyRemoval" use:enhance>
          <input type="hidden" name="request_id" value={fr.id} />
          <button class="act-btn xs">{$lang==='fr'?'Refuser':'Deny'}</button>
        </form>
      </div>
    </div>
    {/each}
  </div>
</div>
{/if}

<!-- ── ORDERS (above student overview) ───────────────────── -->
<div class="section-label">
  {L?'Commandes':'Orders'}
  {#if pendingOrders.length}<span class="badge badge-amber">{pendingOrders.length}</span>{/if}
</div>
<div class="orders-card card" style="padding:.625rem;margin-bottom:1.25rem">
  {#if pendingOrders.length}
    {#each pendingOrders as o}
    <div class="oc-order" class:open={openOrderId===o.id}>
      <button class="oc-head" on:click={()=>toggleOrder(o.id)}>
        <span class="oc-dot"></span>
        <span class="oc-student">{o.student_name}</span>
        <span class="oc-snippet xs">{(o.description||'').slice(0,42)}{(o.description||'').length>42?'…':''}</span>
        <span class="oc-date xs mono">{new Date(o.created_at).toLocaleDateString('fr-CA',{month:'short',day:'numeric'})}</span>
        <svg class="oc-chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" style="transform:rotate({openOrderId===o.id?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {#if openOrderId===o.id}
        <div class="oc-thread">
          {#if threadLoading && !threads[o.id]}
            <div class="xs dimmed" style="padding:.5rem">{L?'Chargement…':'Loading…'}</div>
          {:else if threads[o.id]}
            <div class="oc-msgs">
              {#each threads[o.id].messages as m}
              <div class="oc-bubble {m.sender_type==='instructor'?'oc-me':'oc-them'}">
                <div class="oc-body">{m.body}</div>
                <div class="oc-time xs">{m.sender_type==='instructor'?(L?'Vous':'You'):o.student_name.split(' ')[0]} · {fmtMsgTime(m.created_at)}</div>
              </div>
              {/each}
            </div>
            <div class="oc-input-row">
              <textarea rows="2" bind:value={replyText} class="oc-input"
                placeholder={L?'Écrire un message…':'Write a message…'}
                on:keydown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendOrderMessage(o.id);}}}></textarea>
              <div class="oc-actions">
                <button class="btn btn-secondary btn-sm" on:click={()=>sendOrderMessage(o.id)}>{L?'Envoyer':'Send'}</button>
                <button class="btn btn-primary btn-sm" on:click={()=>confirmOrderChat(o.id)}>{L?'Confirmer':'Confirm'}</button>
              </div>
            </div>
            <div class="xs dimmed" style="margin-top:.3rem">{L?'Échangez autant de messages que nécessaire, puis confirmez.':'Exchange as many messages as needed, then confirm.'}</div>
          {/if}
        </div>
      {/if}
    </div>
    {/each}
  {:else}
    <div class="xs dimmed" style="padding:.4rem .25rem">{L?'Aucune commande en attente.':'No pending orders.'}</div>
  {/if}

  {#if allOrders?.length}
  <button class="orders-toggle" style="margin-top:.5rem" on:click={()=>historyOpen=!historyOpen}>
    <div style="display:flex;align-items:center;gap:.5rem">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      <span style="font-weight:600">{L?'Historique complet':'Full history'} ({allOrders.length})</span>
    </div>
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" style="transition:transform .2s;transform:rotate({historyOpen?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
  </button>
  {#if historyOpen}
  <div class="all-orders-list" style="margin-top:.5rem">
    {#each allOrders as o}
    <a href="/instructor/students/{o.student_id}" class="all-order-row-full">
      <span class="order-date xs muted mono">{new Date(o.created_at).toLocaleDateString('fr-CA',{month:'short',day:'2-digit'})}</span>
      <span class="xs" style="color:var(--txt-2);min-width:80px">{o.student_name}</span>
      <span class="xs" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--txt-3)">{o.description||'—'}</span>
      <span class="order-badge" class:pending={o.status==='pending'} class:responded={o.status==='responded'} class:completed={o.status==='completed'||o.status==='confirmed'}>
        {o.status==='pending'?(L?'En attente':'Pending'):o.status==='responded'?(L?'Répondu':'Replied'):(o.status==='completed'||o.status==='confirmed')?(L?'Confirmé':'Confirmed'):o.status}
      </span>
    </a>
    {/each}
  </div>
  {/if}
  {/if}
</div>

<!-- ── ALL STUDENTS PROGRESS ─────────────────────────────── -->
<div class="section-label">Student Progress</div>
<div class="students-grid">
  {#each allProgress as s}
    {@const totalPct = Math.round(((s.thDone||0)+(s.exPassed||0)+(s.flights||0)) / ((s.thTotal||1)+(s.exTotal||1)+25) * 100)}
    <a href="/instructor/students/{s?.id}" class="student-prog-card-compact card">
      <div class="spc-av">{(s?.name||"?")[0]}</div>
      <div class="spc-info">
        <div class="spc-name">{s?.name || "—"}</div>
        <div class="spc-quick xs muted">
          <span class="mono" style="color:var(--teal)">{s?.flights ?? 0}<span class="dimmed">/25 vols</span></span>
          <span class="sep">·</span>
          <span class="mono">{s.exPassed ?? 0}/{s.exTotal ?? 0} ex</span>
          <span class="sep">·</span>
          <span class="mono">{s.thDone ?? 0}/{s.thTotal ?? 0} th</span>
        </div>
      </div>
      <div class="spc-pct">
        <div class="spc-pct-bar"><div class="spc-pct-fill" style="width:{totalPct}%;background:{barColor(totalPct)}"></div></div>
        <span class="mono xs" style="color:{barColor(totalPct)};font-weight:700">{totalPct}%</span>
      </div>
    </a>
  {/each}
</div>


<style>
  .msg-panel{}
  .msg-form{display:flex;flex-direction:column;gap:.5rem;margin-bottom:.75rem;padding:.625rem;background:var(--bg-2);border-radius:8px}
  .msg-form .fg{display:flex;flex-direction:column;gap:.2rem}
  .msg-form .fg label{color:var(--txt-3)}
  .msg-form input,.msg-form textarea{background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:.4rem .5rem;color:var(--txt);font-size:.85rem;width:100%}
  .msg-list{display:flex;flex-direction:column;gap:.35rem;margin-top:.5rem}
  .msg-row{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;background:var(--bg-2);border-radius:7px;padding:.45rem .625rem}
  .msg-title-s{font-size:.85rem;font-weight:600;color:var(--txt);margin-bottom:.15rem}
  .orders-panel{}
  .order-reply-input{background:var(--bg-2);border:1px solid var(--border);border-radius:5px;padding:.25rem .4rem;color:var(--txt);font-size:.75rem;width:120px}
  .order-panel-row{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;padding:.5rem 0;border-bottom:1px solid var(--border)}
  .order-panel-row:last-child{border-bottom:none}
  /* Order chat */
  .orders-card{display:flex;flex-direction:column;gap:.4rem}
  .oc-order{border:1px solid var(--border);border-radius:9px;overflow:hidden;background:var(--bg-2)}
  .oc-order.open{border-color:var(--teal)}
  .oc-head{display:flex;align-items:center;gap:.5rem;width:100%;background:none;border:none;cursor:pointer;padding:.55rem .6rem;text-align:left;color:var(--txt)}
  .oc-dot{width:8px;height:8px;border-radius:50%;background:#8b5cf6;flex-shrink:0}
  .oc-student{font-weight:700;font-size:.85rem;color:var(--txt);flex-shrink:0}
  .oc-snippet{color:var(--txt-3);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .oc-date{color:var(--txt-3);flex-shrink:0}
  .oc-chev{color:var(--txt-3);transition:transform .2s;flex-shrink:0}
  .oc-thread{padding:.5rem .6rem .6rem;border-top:1px solid var(--border)}
  .oc-msgs{display:flex;flex-direction:column;gap:.4rem;max-height:300px;overflow-y:auto;margin-bottom:.5rem}
  .oc-bubble{max-width:82%;padding:.4rem .6rem;border-radius:12px;font-size:.82rem;line-height:1.35}
  .oc-bubble .oc-body{white-space:pre-wrap;word-break:break-word}
  .oc-bubble .oc-time{margin-top:.15rem;opacity:.6;font-size:.65rem}
  .oc-them{align-self:flex-start;background:var(--bg-raised);color:var(--txt);border-bottom-left-radius:3px}
  .oc-me{align-self:flex-end;background:var(--teal);color:#04221c;border-bottom-right-radius:3px}
  .oc-me .oc-time{color:#04221c}
  .oc-input-row{display:flex;gap:.4rem;align-items:flex-end}
  .oc-input{flex:1;background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:.4rem .5rem;color:var(--txt);font-size:.82rem;resize:vertical;font-family:inherit}
  .oc-actions{display:flex;flex-direction:column;gap:.3rem;flex-shrink:0}
  .order-panel-info{flex:1}
  .order-student{margin-bottom:.15rem}
  .order-desc{font-size:.85rem;color:var(--txt-2);margin-bottom:.15rem}
  .page-hd{margin-bottom:1.25rem} .page-hd h1{font-size:1.5rem} .page-hd p{color:var(--txt-2);font-size:.82rem;margin-top:.2rem}

  /* Today panel */
  .today-panel{background:var(--bg-card);border:1px solid var(--teal-border);border-radius:var(--r-lg);padding:1rem 1.25rem;margin-bottom:1.25rem}
  .tp-header{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;margin-bottom:.875rem;flex-wrap:wrap}
  .tp-title{font-family:var(--ff-head);font-size:.95rem;font-weight:700;color:var(--txt)}
  .tp-sub{margin-top:.2rem}
  .today-empty{display:flex;align-items:center;gap:.625rem;padding:.75rem 1rem;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.15);border-radius:var(--r-md);margin-bottom:1.25rem;color:var(--green)}

  .student-block{border-top:1px solid var(--border);padding:.75rem 0}
  .student-block:first-of-type{border-top:none;padding-top:0}
  .sb-row{display:flex;align-items:center;gap:.625rem;margin-bottom:.5rem;flex-wrap:wrap}
  .sb-av{width:26px;height:26px;border-radius:50%;background:var(--teal-lo);border:1px solid var(--teal-border);color:var(--teal);font-family:var(--ff-head);font-weight:800;font-size:.78rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .sb-name{font-weight:700;font-size:.9rem;flex:1}
  .sb-counts{flex-shrink:0}
  .bulk-btn{flex-shrink:0}

  .item-list{display:flex;flex-direction:column;gap:.3rem;padding-left:1.625rem}
  .today-item{display:flex;align-items:center;gap:.5rem;padding:.35rem .5rem;background:var(--bg-raised);border-radius:var(--r-xs);flex-wrap:wrap}
  .today-item form{display:inline}

  /* Stats */
  .stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem}
  .stat-card{display:flex;flex-direction:column;align-items:center;gap:.375rem;padding:1.25rem 1rem;text-align:center}
  .sv{font-family:var(--ff-mono);font-size:1.9rem;font-weight:400;line-height:1}
  .sl{font-size:.67rem;text-transform:uppercase;letter-spacing:.07em;color:var(--txt-3);font-family:var(--ff-head);font-weight:700}

  /* Students grid */
  .section-label{font-family:var(--ff-head);font-size:.67rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--txt-3);margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem}
  .section-label::after{content:'';flex:1;height:1px;background:var(--border)}
  .student-prog-card-compact{padding:.625rem .75rem;display:flex;align-items:center;gap:.625rem;text-decoration:none;transition:border-color .15s}
  .student-prog-card-compact:hover{border-color:var(--teal-border);text-decoration:none}
  .student-prog-card-compact .spc-av{width:32px;height:32px;border-radius:50%;background:var(--bg-raised);display:flex;align-items:center;justify-content:center;color:var(--teal);font-weight:700;font-size:.85rem;flex-shrink:0}
  .student-prog-card-compact .spc-info{flex:1;min-width:0}
  .student-prog-card-compact .spc-name{font-weight:600;color:var(--txt);font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .student-prog-card-compact .spc-quick{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;margin-top:.1rem}
  .student-prog-card-compact .spc-quick .sep{color:var(--txt-3);opacity:.5}
  .student-prog-card-compact .spc-pct{display:flex;flex-direction:column;align-items:flex-end;gap:.25rem;flex-shrink:0;min-width:70px}
  .student-prog-card-compact .spc-pct-bar{width:60px;height:4px;background:var(--bg-raised);border-radius:2px;overflow:hidden}
  .student-prog-card-compact .spc-pct-fill{height:100%;transition:width .25s;border-radius:2px}
  .students-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.875rem;align-items:stretch}
  .student-prog-card{padding:.875rem;display:flex;flex-direction:column;gap:.625rem;text-decoration:none;transition:border-color .15s}
  .student-prog-card:hover{border-color:var(--teal-border);text-decoration:none}

  .spc-top{display:flex;align-items:center;gap:.625rem}
  .spc-av{width:28px;height:28px;border-radius:50%;background:var(--teal-lo);border:1px solid var(--teal-border);color:var(--teal);font-family:var(--ff-head);font-weight:800;font-size:.8rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .spc-name{flex:1;font-weight:700;font-size:.875rem;color:var(--txt)}
  .spc-flights{font-size:.875rem}

  .spc-bars{display:flex;flex-direction:column;gap:.35rem}
  .spc-bar-row{display:flex;align-items:center;gap:.5rem}
  .spc-track{flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden}
  .spc-fill{height:100%;border-radius:3px;transition:width .4s}

  .spc-dots{display:flex;flex-wrap:wrap;gap:2px;margin-top:.25rem}
  .spc-dot{width:8px;height:8px;border-radius:2px}
  .spc-p{background:var(--green)}
  .spc-w{background:var(--amber);opacity:.8}
  .spc-n{background:var(--border)}
.debrief-requests-list{display:flex;flex-direction:column;gap:.5rem;margin-bottom:.5rem}
.debrief-request-card{background:var(--bg-raised);border-radius:9px;padding:.625rem .875rem;border-left:3px solid var(--amber)}
.dr-top{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem}
.dr-pilot{font-weight:700;font-size:.88rem;color:var(--txt)}
.debrief-resp-form{display:flex;flex-direction:column;gap:.4rem;margin-top:.4rem}
.debrief-textarea{background:var(--bg-2);border:1px solid var(--border);border-radius:7px;padding:.4rem .6rem;color:var(--txt);font-size:.85rem;width:100%;resize:vertical;font-family:inherit}
  .seen-pill{background:rgba(0,184,122,.1);color:var(--teal);border-radius:99px;padding:.05rem .4rem;font-size:.65rem;font-weight:600}
  .seen-pill.unseen{background:rgba(0,0,0,.06);color:var(--txt-3)}
  .orders-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;background:transparent;border:none;cursor:pointer;color:var(--txt-2);font-size:.85rem;padding:.4rem .5rem;border-radius:6px;transition:background .15s}
  .orders-toggle:hover{background:var(--bg-raised)}
  .orders-badge{background:rgba(245,158,11,.15);color:#f59e0b;padding:.1rem .4rem;border-radius:10px;font-size:.7rem;font-weight:700}
  .all-order-row-full{display:flex;align-items:center;gap:.4rem;padding:.4rem .5rem;border-radius:6px;text-decoration:none;color:inherit;border-left:2px solid transparent;transition:background .15s,border-color .15s}
  .all-order-row-full:hover{background:var(--bg-raised);border-left-color:var(--teal);text-decoration:none}
  .order-date{min-width:60px}
  .all-orders-list{display:flex;flex-direction:column;gap:.3rem}
  .all-order-row{display:flex;align-items:center;gap:.5rem;padding:.2rem 0;border-bottom:1px solid var(--border)}
  .all-order-row:last-child{border-bottom:none}
  .order-badge{font-size:.65rem;font-weight:700;padding:.1rem .35rem;border-radius:4px;text-transform:uppercase;flex-shrink:0}
  .order-badge.pending{background:rgba(251,191,36,.15);color:#b45309}
  .order-badge.responded{background:rgba(0,184,122,.1);color:var(--teal)}
  .ack-strip{background:rgba(0,184,122,.06);border:1px solid rgba(0,184,122,.2);border-radius:8px;padding:.5rem .875rem;display:flex;flex-wrap:wrap;gap:.35rem .75rem;align-items:center;margin-bottom:.5rem}
  .new-orders-strip{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:.5rem .875rem;display:flex;flex-wrap:wrap;gap:.35rem .75rem;align-items:center;margin-bottom:.5rem}
  /* Unified notifications panel */
  .notif-panel{background:rgba(245,158,11,.04);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:.625rem .875rem;margin-bottom:.75rem;display:flex;flex-direction:column;gap:.4rem}
  .notif-panel-title{display:flex;align-items:center;gap:.4rem;font-size:.75rem;font-weight:700;color:var(--txt-2);margin-bottom:.1rem}
  .notif-count{background:#f59e0b;color:#fff;border-radius:10px;padding:0 .35rem;font-size:.65rem;font-weight:700}
  .notif-row{display:flex;align-items:center;gap:.5rem;padding:.3rem 0;border-top:1px solid var(--border)}
  .notif-icon{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.75rem;flex-shrink:0}
  .notif-body{display:flex;flex-direction:column;gap:.05rem;flex:1;min-width:0}
  .notif-who{font-size:.8rem;font-weight:700;color:var(--txt)}
  .notif-what{color:var(--txt-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .notif-actions{display:flex;gap:.25rem;flex-shrink:0}
  .notif-btn{padding:.2rem .45rem;border-radius:5px;border:1px solid var(--border);background:var(--bg-2);color:var(--txt-2);font-size:.7rem;cursor:pointer;text-decoration:none;white-space:nowrap}
  .notif-ok{border-color:rgba(0,184,122,.4);color:var(--teal)}
  .notif-no{border-color:rgba(220,38,38,.3);color:#dc2626}
  .reg-notif-card{background:var(--bg-raised);border:1px solid rgba(0,232,198,.3);border-radius:10px;padding:.625rem .875rem;margin-bottom:.5rem}
  .reg-notif-title{display:flex;align-items:center;justify-content:space-between;font-size:.82rem;font-weight:700;color:var(--txt);margin-bottom:.4rem}
  .reg-badge{background:rgba(0,232,198,.2);color:var(--teal);border-radius:8px;padding:.05rem .4rem;font-size:.68rem;font-weight:700}
  .reg-item{display:flex;align-items:flex-start;gap:.5rem;padding:.35rem 0;border-top:1px solid var(--border)}
  .btn-xs{padding:.2rem .5rem;font-size:.72rem}
  .msg-toggle-btn{display:flex;align-items:center;gap:.4rem;background:none;border:none;cursor:pointer;padding:0;flex:1}
  .msg-count-pill{background:var(--bg-2);border-radius:8px;padding:.05rem .4rem;font-size:.68rem;font-weight:700;color:var(--txt-2)}
  .activity-card{padding:.75rem .875rem}
  .activity-hdr{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem}
  .act-title{font-size:.82rem;font-weight:700;color:var(--txt);flex:1}
  .act-badge{background:#ef4444;color:#fff;border-radius:99px;font-size:.7rem;font-weight:800;padding:.1rem .45rem;min-width:18px;text-align:center}
  .act-list{display:flex;flex-direction:column;gap:.3rem}
  .act-item{display:flex;align-items:center;gap:.5rem;padding:.4rem .5rem;border-radius:8px;background:var(--bg-2)}
  .act-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .act-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:.05rem}
  .act-label{font-weight:700;color:var(--txt-2)}
  .act-name{color:var(--txt-3)}
  .act-btn{background:none;border:1px solid var(--border);border-radius:6px;padding:.2rem .5rem;color:var(--teal);text-decoration:none;white-space:nowrap;flex-shrink:0;font-size:.72rem}
  .act-btn:hover{background:rgba(0,184,122,.08)}
  .act-item-link{text-decoration:none;color:inherit;transition:background .12s;border-radius:6px}
  .act-item-link:hover{background:var(--bg-raised)}
  .act-item-link:active{opacity:.7}
  .today-item-link{color:var(--txt);text-decoration:none}
  .today-item-link:hover{color:var(--teal);text-decoration:underline}
</style>