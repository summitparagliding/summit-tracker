<script>
  import { enhance } from '$app/forms';
  export let data;
  $: ({ days } = data);

  function fmtDate(d) {
    return d ? new Date(d+'T12:00:00').toLocaleDateString('fr-CA',{weekday:'long',month:'long',day:'numeric'}) : '—';
  }

  const ACTIVITY_LABELS = {
    flight:         'Vol',
    first_flight:   '1er vol',
    ground:         'Sol',
    theory:         'Théorie / Autre',
  };
  const ACTIVITY_COLORS = {
    flight:       '#3b82f6',   // blue — en vol
    first_flight: '#60a5fa',   // light blue — 1er vol
    ground:       '#22c55e',   // green — sol
    theory:       '#f1f5f9',   // off-white — théorie
  };

  const today = new Date().toISOString().slice(0,10);
  $: upcoming = days.filter(d => d.date >= today);
  $: past     = days.filter(d => d.date < today).sort((a,b) => b.date.localeCompare(a.date));
  let pastOpen = false;

  let publishing = {};
  let editId = null;
  let editForms = {};
  let editData = {};
  function startEdit(d) { editId = d.id; editData = { date:d.date||'', launch_site:d.launch_site||'', plan_text:d.plan_text||'', max_students:d.max_students||12 }; }
  let deleting   = {};

  async function publish(day) {
    publishing[day.id] = true;
    const dateStr = fmtDate(day.date);
    const wind = day.wind_min != null ? `Vent: ${day.wind_min}–${day.wind_max} km/h ${day.wind_dir||''}`.trim() : '';
    const attendees = day.registrations?.length
      ? `\nInscrits (${day.registrations.length}): ${day.registrations.map(r=>`${r.student_name} (${ACTIVITY_LABELS[r.activity_type]||r.activity_type||'Vol'})`).join(', ')}`
      : '';
    const msg =
      `<b>Summit Paragliding — ${dateStr}</b>\n\n` +
      `${day.plan_text || 'Plan à confirmer'}\n\n` +
      (wind ? `${wind}\n` : '') +
      (day.launch_site ? `Site: ${day.launch_site}\n` : '') +
      `Max ${day.max_students} participants` +
      attendees + '\n\n' +
      `Confirmez votre présence dans l'application Summit Paragliding!`;
    const res  = await fetch('/api/telegram', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ training_day_id: day.id, message: msg }),
    });
    const json = await res.json();
    publishing[day.id] = false;
    if (json.ok) { alert('Publié sur Telegram!'); location.reload(); }
    else alert('Erreur Telegram: ' + (json.error||'unknown'));
  }

  // Group registrations by activity type
  function byActivity(registrations) {
    const groups = {};
    for (const r of (registrations || [])) {
      const key = r.activity_type || 'flight';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return groups;
  }
</script>

<div class="page-wrap">
  <div class="page-hdr">
    <h1>Planning</h1>
    <a href="/instructor/planning/new" class="btn btn-primary">+ Nouvelle journée</a>
  </div>

  {#if !days.length}
    <div class="empty">Aucune journée planifiée. <a href="/instructor/planning/new">Créer</a></div>
  {:else}

    <!-- Upcoming days -->
    {#if upcoming.length}
    <div class="day-list">
      {#each upcoming as d}
        {@const groups = byActivity(d.registrations)}
        <div class="day-card" class:published={d.published}>
          <div class="day-top">
            <div class="day-date">{fmtDate(d.date)}</div>
            <div class="day-badges">
              {#if d.published}<span class="badge badge-ok">Publié</span>{:else}<span class="badge badge-muted">Brouillon</span>{/if}
              {#if d.telegram_sent}<span class="badge badge-tg">Telegram</span>{/if}
            </div>
          </div>

          {#if d.plan_text}<p class="day-plan">{d.plan_text}</p>{/if}
          <div class="day-meta xs muted">
            {d.registrations?.length || 0} / {d.max_students} confirmés
            {#if d.launch_site} · Site: {d.launch_site}{/if}
            {#if d.wind_min != null} · Vent: {d.wind_min}–{d.wind_max} km/h{/if}
          </div>

          <!-- Attendee list grouped by activity -->
          {#if d.registrations?.length}
          <div class="attendee-section">
            {#each Object.entries(groups) as [act, students]}
            <div class="act-group">
              <span class="act-group-lbl xs" style="color:{ACTIVITY_COLORS[act]||'var(--txt-3)'}">
                {ACTIVITY_LABELS[act] || act} ({students.length})
              </span>
              <div class="att-pills">
                {#each students as r}
                  <span class="att-pill" style="border-color:{ACTIVITY_COLORS[act]||'var(--border)'}20;color:{ACTIVITY_COLORS[act]||'var(--txt)'}">
                    {r.student_name}
                  </span>
                {/each}
              </div>
            </div>
            {/each}
          </div>
          {:else}
          <div class="xs muted" style="margin-top:.3rem">Aucune confirmation.</div>
          {/if}

          <div class="day-actions">
            <!-- Publish options -->
            {#if !d.published_to_app}
            <!-- Not yet published: offer App only, Telegram only, or Both -->
            <form method="POST" action="?/publishToApp" use:enhance style="display:contents">
              <input type="hidden" name="id" value={d.id} />
              <button class="btn btn-secondary btn-sm">App</button>
            </form>
            <form method="POST" action="?/publishToTelegram" use:enhance style="display:contents">
              <input type="hidden" name="id" value={d.id} />
              <button class="btn btn-secondary btn-sm">Telegram</button>
            </form>
            <form method="POST" action="?/publishToBoth" use:enhance style="display:contents">
              <input type="hidden" name="id" value={d.id} />
              <button class="btn btn-primary btn-sm">App + Telegram</button>
            </form>
            {:else}
            <!-- Already published: show "Update App" (silent update, no new Telegram) -->
            <form method="POST" action="?/updateApp" use:enhance style="display:contents">
              <input type="hidden" name="id" value={d.id} />
              <button class="btn btn-secondary btn-sm" title="Mise à jour silencieuse sur l'app — sans nouveau message Telegram">
                ↻ Mettre à jour app
              </button>
            </form>
            <form method="POST" action="?/publishToTelegram" use:enhance style="display:contents">
              <input type="hidden" name="id" value={d.id} />
              <button class="btn btn-secondary btn-sm">Telegram</button>
            </form>
            {/if}
            <!-- Edit + Delete -->
            <button class="btn btn-ghost btn-sm" on:click={() => editId===d.id ? editId=null : startEdit(d)}>
              {editId===d.id ? 'Annuler' : 'Modifier'}
            </button>
            <form method="POST" action="?/deleteDay" use:enhance style="margin-left:.25rem">
              <input type="hidden" name="id" value={d.id} />
              <button class="btn btn-danger btn-sm"
                on:click|preventDefault={e => { if(confirm('Supprimer cette journée?')) e.target.form.submit(); }}>
                ✕
              </button>
            </form>
          </div>
        </div>
        {#if editId === d.id}
        <form method="POST" action="?/editDay" use:enhance class="edit-form"
          on:submit={() => setTimeout(()=>editId=null, 300)}
          bind:this={editForms[d.id]}>
          <input type="hidden" name="id" value={d.id} />
          <div class="edit-row">
            <label class="fg"><span class="xs muted">Date</span>
              <input type="date" name="date" bind:value={editData.date} required class="edit-input" />
            </label>
            <label class="fg"><span class="xs muted">Site de décollage</span>
              <input type="text" name="launch_site" bind:value={editData.launch_site} class="edit-input" placeholder="Mont Yamaska" />
            </label>
            <label class="fg"><span class="xs muted">Max</span>
              <input type="number" name="max_students" bind:value={editData.max_students} min="1" max="20" class="edit-input" style="width:60px" />
            </label>
          </div>
          <label class="fg"><span class="xs muted">Plan / notes</span>
            <textarea name="plan_text" bind:value={editData.plan_text} rows="2" class="edit-input" style="width:100%;resize:vertical"></textarea>
          </label>
          <input type="hidden" name="activity_types" value={JSON.stringify(d.activity_types||[])} />
          <div class="edit-save-row">
            <button type="submit" formaction="?/editDay" class="btn btn-secondary btn-sm"
              title="Sauvegarde sans notifier — pour publier plus tard">
              Sauvegarder
            </button>
            <button type="submit" formaction="?/editAndPublishApp" class="btn btn-secondary btn-sm"
              title="Sauvegarde et met à jour silencieusement dans l'app">
              + Publier app
            </button>
            <button type="submit" formaction="?/editAndPublishBoth" class="btn btn-primary btn-sm"
              title="Sauvegarde, met à jour l'app, et envoie un message Telegram">
              + App + Telegram
            </button>
          </div>
        </form>
        {/if}
      {/each}
    </div>
    {:else}
      <div class="empty">Aucune journée à venir. <a href="/instructor/planning/new">Créer</a></div>
    {/if}

    <!-- Past days (collapsed) -->
    {#if past.length}
    <div class="past-section">
      <button class="past-toggle" on:click={() => pastOpen = !pastOpen}>
        <span class="xs">Journées passées ({past.length})</span>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"
          style="transition:transform .2s;transform:rotate({pastOpen?180:0}deg)">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {#if pastOpen}
      <div class="day-list past-list">
        {#each past as d}
          <div class="day-card past-card">
            <div class="day-top">
              <div class="day-date" style="color:var(--txt-3)">{fmtDate(d.date)}</div>
              {#if d.telegram_sent}<span class="badge badge-tg">Telegram</span>{/if}
            </div>
            {#if d.plan_text}<p class="day-plan" style="color:var(--txt-3)">{d.plan_text}</p>{/if}
            <div class="day-meta xs muted">{d.registrations?.length || 0} / {d.max_students} confirmés</div>
            <form method="POST" action="?/deleteDay" use:enhance style="margin-top:.4rem">
              <input type="hidden" name="id" value={d.id} />
              <button class="btn btn-ghost btn-xs"
                on:click|preventDefault={e => { if(confirm('Supprimer?')) e.target.form.submit(); }}>
                Supprimer
              </button>
            </form>
          </div>
        {/each}
      </div>
      {/if}
    </div>
    {/if}

  {/if}
</div>

<style>
  .page-wrap{padding:1.25rem;max-width:700px}
  .page-hdr{font-family:var(--ff-head);display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem}
  h1{font-size:1.3rem;font-weight:700;color:var(--txt)}
  .empty{color:var(--txt-3);padding:2rem;text-align:center}
  .day-list{display:flex;flex-direction:column;gap:.75rem}
  .day-card{background:var(--bg-raised);border-radius:10px;padding:.875rem;border-left:3px solid var(--border)}
  .day-card.published{border-left-color:var(--teal)}
  .past-card{border-left-color:transparent;opacity:.8}
  .day-top{display:flex;align-items:center;gap:.75rem;margin-bottom:.4rem;flex-wrap:wrap}
  .day-date{font-weight:700;font-size:.95rem;color:var(--txt)}
  .day-badges{display:flex;gap:.3rem}
  .badge-ok{background:rgba(0,184,122,.15);color:var(--teal)}
  .badge-muted{background:var(--bg-2);color:var(--txt-3)}
  .badge-tg{background:rgba(0,136,204,.15);color:#0088cc}
  .day-plan{font-size:.85rem;color:var(--txt-2);margin:.3rem 0;line-height:1.4}
  .day-meta{margin:.3rem 0}
  /* Attendees */
  .attendee-section{margin:.5rem 0;display:flex;flex-direction:column;gap:.35rem}
  .act-group{display:flex;flex-direction:column;gap:.2rem}
  .act-group-lbl{font-family:var(--ff-head);font-weight:700;text-transform:uppercase;letter-spacing:.05em}
  .att-pills{display:flex;flex-wrap:wrap;gap:.25rem}
  .att-pill{background:var(--bg-2);border:1px solid;border-radius:12px;font-size:.72rem;font-weight:600;padding:.15rem .5rem}
  .day-actions{margin-top:.625rem;display:flex;align-items:center;flex-wrap:wrap;gap:.5rem}
  .past-section{margin-top:1.25rem}
  .past-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:.5rem .875rem;cursor:pointer;color:var(--txt-3);margin-bottom:.5rem}
  .past-list{opacity:.85}
  .xs{font-size:.75rem}
  .muted{color:var(--txt-3)}
.edit-form{display:flex;flex-direction:column;gap:.5rem;padding:.625rem;background:var(--bg-2);border-radius:8px;margin-top:.5rem;border:1px solid var(--teal-border)}
.edit-row{display:flex;gap:.5rem;flex-wrap:wrap}
.fg{display:flex;flex-direction:column;gap:.15rem}
.edit-input{background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:.3rem .5rem;color:var(--txt);font-size:.85rem;font-family:inherit}
.edit-form{display:flex;flex-direction:column;gap:.5rem;padding:.625rem .875rem;background:var(--bg-2);border-radius:8px;margin:.5rem 0;border:1px solid var(--teal-border)}
.edit-row{display:flex;gap:.5rem;flex-wrap:wrap}
.fg{display:flex;flex-direction:column;gap:.15rem}
.edit-input{background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:.3rem .5rem;color:var(--txt);font-size:.85rem;font-family:inherit}
  .edit-save-row{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--border)}
  .edit-save-row .btn{flex:1;min-width:max-content}
</style>
