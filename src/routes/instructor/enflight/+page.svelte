<script>
  import { enhance }        from '$app/forms';
  import { invalidateAll }  from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import ColourSignature from '$lib/components/ColourSignature.svelte';

  export let data;

  $: roster  = data.roster      || [];
  $: allStud = data.allStudents || [];

  $: flying  = roster.filter(r => r.status === 'flying');
  $: ground  = roster.filter(r => r.status === 'ground');
  $: landed  = roster.filter(r => r.status === 'landed');

  // Students NOT yet in today's roster (for manual add)
  $: inRoster  = new Set(roster.map(r => r.student_id));
  $: available = allStud.filter(s => !inRoster.has(s.id));

  let showAdd  = false;
  let addSearch= '';
  $: filtered  = available.filter(s =>
    !addSearch || s.name.toLowerCase().includes(addSearch.toLowerCase())
  );

  // Live clock for timers
  let now  = Date.now();
  let tick, poller;
  onMount(() => {
    tick   = setInterval(() => now = Date.now(), 1000);
    poller = setInterval(() => invalidateAll(), 5000);
  });
  onDestroy(() => { clearInterval(tick); clearInterval(poller); });

  function flightTimer(launchedAt) {
    if (!launchedAt) return '00:00';
    const sec = Math.floor((now - new Date(launchedAt).getTime()) / 1000);
    if (isNaN(sec) || sec < 0) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function duration(a, b) {
    if (!a || !b) return '—';
    const s = Math.floor((new Date(b) - new Date(a)) / 1000);
    if (isNaN(s) || s < 0) return '—';
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
    return h ? `${h}h${String(m).padStart(2,'0')}` : `${m} min`;
  }

  function hbGlow(age) {
    if (age == null || age > 120) return 'rgba(71,85,105,.3)';
    if (age < 40)  return 'rgba(0,232,198,.7)';
    if (age < 90)  return 'rgba(245,158,11,.7)';
    return 'rgba(239,68,68,.7)';
  }
  function hbText(age) {
    if (age == null || age > 120) return '';
    if (age < 40)  return `GPS · ${age}s`;
    return `GPS · ${age}s ⚠`;
  }
</script>

<svelte:head><title>En vol — Instructeur</title></svelte:head>

<div class="ev-wrap">

  <!-- ═══════════ HEADER ═══════════════════════════════════════ -->
  <div class="ev-head">
    <div>
      <h1>En vol · Live</h1>
      <div class="xs muted">
        {roster.length} pilote{roster.length!==1?'s':''} aujourd'hui ·
        actualisation auto toutes les 5s
      </div>
    </div>
    <button class="btn btn-primary btn-sm" on:click={() => { showAdd=!showAdd; addSearch=''; }}>
      + Ajouter un pilote
    </button>
  </div>

  <!-- Diagnostic strip — shows what server found -->
  {#if !roster.length}
  <div class="diag-strip">
    Aucun vol trouvé aujourd'hui. Les élèves apparaissent ici dès qu'ils soumettent leur formulaire de pré-vol dans l'app.
  </div>
  {/if}

  <!-- ═══════════ ADD PANEL ════════════════════════════════════ -->
  {#if showAdd}
  <div class="add-panel">
    <div class="add-panel-title xs">
      Ajouter manuellement un pilote non encore dans la liste
    </div>
    <input bind:value={addSearch} placeholder="Rechercher…" class="add-search" autofocus />
    {#if !filtered.length}
    <p class="xs muted" style="padding:.25rem 0">
      {available.length ? 'Aucun résultat.' : 'Tous les élèves sont déjà dans la liste.'}
    </p>
    {:else}
    <div class="add-list">
      {#each filtered as s}
      <form method="POST" action="?/add" use:enhance={() => { showAdd=false; return async ({ update }) => update(); }}>
        <input type="hidden" name="student_id" value={s.id} />
        <button type="submit" class="add-item">
          <ColourSignature mainColor={s.wing_color_1} leColor={s.wing_le_color}
            harnessColor={s.harness_color} size={28} />
          <span class="xs">{s.name}</span>
          <span class="add-arrow xs">Ajouter →</span>
        </button>
      </form>
      {/each}
    </div>
    {/if}
  </div>
  {/if}

  <!-- ═══════════ EN VOL ════════════════════════════════════════ -->
  <section class="zone flying-zone">
    <div class="zone-hdr">
      <span class="zone-name">En vol</span>
      {#if flying.length}
      <span class="zone-badge fly-badge">{flying.length} en l'air</span>
      {/if}
      <span class="zone-sub">Décollage détecté automatiquement par GPS</span>
    </div>

    {#if !flying.length}
    <div class="zone-empty">
      Personne en vol pour l'instant — les pilotes apparaissent ici automatiquement au décollage
    </div>
    {:else}
    {#each flying as r}
    <div class="fly-card" style="box-shadow:0 0 0 2px {hbGlow(r.heartbeat_age_s)}">
      <div class="fly-sig">
        <ColourSignature mainColor={r.wing_color_1} leColor={r.wing_le_color}
          harnessColor={r.harness_color} size={46} />
      </div>
      <div class="fly-body">
        <div class="fly-name">{r.student_name}</div>
        <div class="fly-clock">{flightTimer(r.launched_at)}</div>
        {#if hbText(r.heartbeat_age_s)}
        <div class="xs fly-gps" style="color:{hbGlow(r.heartbeat_age_s)}">{hbText(r.heartbeat_age_s)}</div>
        {/if}
      </div>
      <div class="fly-actions">
        <form method="POST" action="?/land" use:enhance={({cancel}) => { return async ({ update }) => update(); }}>
          <input type="hidden" name="student_id" value={r.student_id} />
          <button type="submit" class="act-btn land-btn">↓ Posé</button>
        </form>
      </div>
    </div>
    {/each}
    {/if}
  </section>

  <!-- ═══════════ EN ATTENTE ════════════════════════════════════ -->
  <section class="zone">
    <div class="zone-hdr">
      <span class="zone-name">En attente</span>
      {#if ground.length}<span class="zone-badge">{ground.length}</span>{/if}
      <span class="zone-sub">Prêt au décollage</span>
    </div>

    {#if !ground.length}
    <div class="zone-empty xs muted">
      Aucun pilote en attente — les pilotes apparaissent ici dès qu'ils démarrent un vol dans l'app
    </div>
    {:else}
    <div class="ground-list">
      {#each ground as r}
      <div class="ground-card">
        <ColourSignature mainColor={r.wing_color_1} leColor={r.wing_le_color}
          harnessColor={r.harness_color} size={32} />
        <span class="gc-name xs">{r.student_name}</span>
        {#if r.heartbeat_age_s != null && r.heartbeat_age_s < 60}
        <span class="xs" style="color:var(--teal)">GPS actif</span>
        {/if}
        <div class="gc-btns">
          <form method="POST" action="?/launch" use:enhance={() => async ({ update }) => update()}>
            <input type="hidden" name="student_id" value={r.student_id} />
            <button type="submit" class="act-btn launch-btn" title="Lancer manuellement">↑ Vol</button>
          </form>
          <form method="POST" action="?/land" use:enhance={() => async ({ update }) => update()}>
            <input type="hidden" name="student_id" value={r.student_id} />
            <button type="submit" class="act-btn" title="Posé directement" style="border-color:rgba(100,116,139,.4);color:var(--txt-3)">↓</button>
          </form>
          <form method="POST" action="?/remove" use:enhance={() => async ({ update }) => update()}>
            <input type="hidden" name="student_id" value={r.student_id} />
            <button type="submit" class="act-btn rm-btn" title="Retirer">✕</button>
          </form>
        </div>
      </div>
      {/each}
    </div>
    {/if}
  </section>

  <!-- ═══════════ POSÉ ══════════════════════════════════════════ -->
  <section class="zone">
    <div class="zone-hdr">
      <span class="zone-name">Posé</span>
      {#if landed.length}<span class="zone-badge">{landed.length}</span>{/if}
      <span class="zone-sub">Atterri</span>
    </div>

    {#if !landed.length}
    <div class="zone-empty xs muted">Personne posé</div>
    {:else}
    <div class="ground-list">
      {#each landed as r}
      <div class="ground-card" style="opacity:.75">
        <ColourSignature mainColor={r.wing_color_1} leColor={r.wing_le_color}
          harnessColor={r.harness_color} size={28} />
        <span class="gc-name xs">{r.student_name}</span>
        <span class="xs muted">{duration(r.launched_at, r.landed_at)}</span>
        <div class="gc-btns">
          <form method="POST" action="?/launch" use:enhance={() => async ({ update }) => update()}>
            <input type="hidden" name="student_id" value={r.student_id} />
            <button type="submit" class="act-btn launch-btn sm" title="Remettre en vol">↑</button>
          </form>
          <form method="POST" action="?/ground" use:enhance={() => async ({ update }) => update()}>
            <input type="hidden" name="student_id" value={r.student_id} />
            <button type="submit" class="act-btn sm" style="border-color:rgba(100,116,139,.3);color:var(--txt-3)" title="En attente">⊙</button>
          </form>
        </div>
      </div>
      {/each}
    </div>
    {/if}
  </section>

</div>

<style>
  .ev-wrap{padding:.875rem;max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:.75rem}
  .ev-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem}
  h1{font-size:1.1rem;font-weight:800;color:var(--txt);margin-bottom:.1rem}

  /* Add panel */
  .add-panel{background:var(--bg-raised);border:1px solid var(--teal-border,rgba(0,184,122,.3));border-radius:10px;padding:.75rem}
  .add-panel-title{font-family:var(--ff-head);color:var(--txt-3);margin-bottom:.4rem;display:block}
  .add-search{width:100%;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.35rem .5rem;color:var(--txt);font-size:.85rem;margin-bottom:.4rem;box-sizing:border-box}
  .add-list{display:flex;flex-direction:column;gap:.2rem;max-height:220px;overflow-y:auto}
  .add-item{display:flex;align-items:center;gap:.5rem;background:var(--bg-2);border:1px solid var(--border);border-radius:7px;padding:.3rem .5rem;cursor:pointer;text-align:left;width:100%;transition:border-color .12s}
  .add-item:hover{border-color:var(--teal)}
  .add-arrow{margin-left:auto;color:var(--teal)}

  /* Sections */
  .zone{background:var(--bg-raised);border:1px solid var(--border);border-radius:12px;overflow:hidden}
  .flying-zone{border-color:rgba(0,232,198,.3)}
  .zone-hdr{font-family:var(--ff-head);display:flex;align-items:center;gap:.5rem;padding:.55rem .875rem;border-bottom:1px solid var(--border);background:rgba(0,0,0,.06);flex-wrap:wrap}
  .zone-name{font-size:.88rem;font-weight:800;color:var(--txt)}
  .zone-badge{background:var(--bg-2);border-radius:10px;padding:.05rem .45rem;font-size:.68rem;font-weight:700;color:var(--txt-2)}
  .fly-badge{background:rgba(0,232,198,.15);color:var(--teal)}
  .zone-sub{font-size:.62rem;color:var(--txt-3);margin-left:auto}
  .zone-empty{padding:.875rem;color:var(--txt-3);font-size:.8rem}

  /* Flying cards */
  .fly-card{display:flex;align-items:center;gap:.75rem;padding:.875rem;border-bottom:1px solid var(--border);border-radius:0;transition:box-shadow .3s}
  .fly-card:last-child{border-bottom:none}
  .fly-sig{flex-shrink:0}
  .fly-body{flex:1;min-width:0}
  .fly-name{font-size:.88rem;font-weight:700;color:var(--txt)}
  .fly-clock{font-size:2rem;font-weight:800;font-family:var(--ff-head);color:var(--teal);line-height:1;letter-spacing:.04em}
  .fly-gps{margin-top:.1rem}
  .fly-actions{flex-shrink:0}

  /* Ground / Landed */
  .ground-list{display:flex;flex-direction:column;gap:0}
  .ground-card{display:flex;align-items:center;gap:.5rem;padding:.5rem .875rem;border-bottom:1px solid var(--border)}
  .ground-card:last-child{border-bottom:none}
  .gc-name{flex:1;font-weight:600;color:var(--txt)}
  .gc-btns{display:flex;gap:.3rem}

  /* Action buttons */
  .act-btn{border-radius:6px;border:1px solid var(--border);background:var(--bg-raised);cursor:pointer;padding:.3rem .6rem;font-size:.78rem;font-weight:600;white-space:nowrap}
  .launch-btn{border-color:rgba(0,184,122,.4);color:var(--teal)}
  .land-btn{border-color:rgba(245,158,11,.4);color:#f59e0b;padding:.4rem .875rem;font-size:.85rem}
  .land-btn:hover{background:rgba(245,158,11,.1)}
  .rm-btn{color:var(--txt-3);padding:.3rem .5rem}
  .sm{padding:.2rem .45rem;font-size:.72rem}

  .xs{font-size:.75rem} .muted{color:var(--txt-3)}
  .diag-strip{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:.5rem .875rem;font-size:.8rem;color:#b45309}
</style>
