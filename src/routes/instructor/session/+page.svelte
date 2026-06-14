<script>
  import { enhance } from '$app/forms';
  export let data, form;
  $: ({ students, exercises } = data);

  // ── State ──────────────────────────────────────────────────────────────────
  let step          = 1;          // 1=select students, 2=pick exercises
  let sessionDate   = new Date().toISOString().slice(0,10);
  let sessionId     = null;
  let selectedStudents = new Set();  // chosen for this session
  let exStudents    = {};          // { [exerciseId]: Set<studentId> } — overrides per exercise
  let activeCategory = 'ground_handling';
  let search        = '';
  let log           = [];          // summary list
  let done          = false;

  $: if (form?.sessionId) { sessionId = form.sessionId; step = 2; }
  $: if (form?.signedOff != null) { done = true; }

  $: filteredEx = exercises.filter(e =>
    e.category === activeCategory &&
    (!search || (e.title_fr||e.title).toLowerCase().includes(search.toLowerCase()))
  );

  const cats = [
    { key:'ground_handling', label:'Sol / GH' },
    { key:'airborne',        label:'Vol / Air' },
    { key:'theory',          label:'Théorie' },
  ];

  // Toggle session student
  function toggleStudent(id) {
    selectedStudents.has(id) ? selectedStudents.delete(id) : selectedStudents.add(id);
    selectedStudents = selectedStudents;
  }

  // For an exercise, get the active student set (default = all session students)
  function getExStudents(exId) {
    return exStudents[exId] ?? new Set(selectedStudents);
  }

  // Toggle a student for a specific exercise
  function toggleExStudent(exId, stuId) {
    if (!exStudents[exId]) exStudents[exId] = new Set(selectedStudents);
    exStudents[exId].has(stuId) ? exStudents[exId].delete(stuId) : exStudents[exId].add(stuId);
    exStudents = { ...exStudents };
  }

  // Select/deselect all for an exercise
  function allForEx(exId) {
    if (!exStudents[exId]) { exStudents[exId] = new Set(selectedStudents); }
    else if (exStudents[exId].size === selectedStudents.size) { exStudents[exId] = new Set(); }
    else { exStudents[exId] = new Set(selectedStudents); }
    exStudents = { ...exStudents };
  }

  // Build a flat log entry for each exercise+student pair ready to submit
  $: sessionStudents = students.filter(s => selectedStudents.has(s.id));

  function addToLog(ex) {
    const stuSet = getExStudents(ex.id);
    if (!stuSet.size) return;
    const stuIds = [...stuSet];
    const stus   = students.filter(s => stuIds.includes(s.id));
    log = [...log, { ex, stus }];
  }

  function removeFromLog(i) { log = log.filter((_,j) => j !== i); }

  function reset() {
    step=1; sessionId=null; selectedStudents=new Set(); exStudents={}; log=[]; done=false;
  }
</script>

<div class="sess-page">
  <h1>Session</h1>

  {#if done}
  <!-- ── Done ── -->
  <div class="card done-card">
    <div class="done-check">✓</div>
    <h2>{log.length} exercice(s) validé(s)</h2>
    <p class="muted xs">Tous les exercices ont été signés dans les carnets.</p>
    <button class="btn btn-primary" on:click={reset}>Nouvelle session</button>
  </div>

  {:else if step === 1}
  <!-- ── Step 1: Choose students ── -->
  <div class="card step-card">
    <div class="step-pill">1</div>
    <h2>Étudiants présents</h2>
    <div class="fg">
      <label class="fg-lbl">Date</label>
      <input type="date" class="date-input" bind:value={sessionDate} />
    </div>
    <div class="stu-grid">
      {#each students as s}
      <button class="stu-chip" class:sel={selectedStudents.has(s.id)} on:click={() => toggleStudent(s.id)}>
        {s.name}
      </button>
      {/each}
    </div>
    <form method="POST" action="?/startSession" use:enhance>
      <input type="hidden" name="date" value={sessionDate} />
      {#each [...selectedStudents] as id}<input type="hidden" name="student_ids" value={id} />{/each}
      <button type="submit" class="btn btn-primary w-full" disabled={selectedStudents.size === 0}
        style="margin-top:1rem">
        Continuer avec {selectedStudents.size} étudiant(s) →
      </button>
    </form>
  </div>

  {:else}
  <!-- ── Step 2: Pick exercises ── -->
  <div class="sess-active">
    <div class="sess-hdr">
      <span class="xs muted">{sessionDate} · {sessionStudents.length} étudiant(s)</span>
      <div class="sess-chips">
        {#each sessionStudents as s}<span class="stu-mini">{s.name.split(' ')[0]}</span>{/each}
      </div>
    </div>

    <!-- Category tabs -->
    <div class="cat-tabs">
      {#each cats as c}
      <button class="cat-tab" class:active={activeCategory===c.key}
        on:click={() => activeCategory=c.key}>{c.label}</button>
      {/each}
    </div>

    <input type="text" class="ex-search" bind:value={search} placeholder="Rechercher exercice…" />

    <!-- Exercise list with pre-selected students -->
    <div class="ex-list">
      {#each filteredEx as ex}
      {@const stuSet = getExStudents(ex.id)}
      {@const inLog  = log.some(l => l.ex.id === ex.id)}
      <div class="ex-row" class:in-log={inLog}>
        <div class="ex-top">
          <span class="ex-name">{ex.title_fr || ex.title}</span>
          <button class="add-btn" class:added={inLog} on:click={() => addToLog(ex)}
            disabled={stuSet.size === 0}>
            {inLog ? 'Ajouté' : '+ Ajouter'}
          </button>
        </div>
        <!-- Student toggles for this exercise (pre-selected) -->
        <div class="ex-stus">
          <button class="all-btn" on:click={() => allForEx(ex.id)}>
            {stuSet.size===sessionStudents.length?'Tout décocher':'Tout cocher'}
          </button>
          {#each sessionStudents as s}
          <button class="stu-ex-chip" class:sel={stuSet.has(s.id)}
            on:click={() => toggleExStudent(ex.id, s.id)}>
            {s.name.split(' ')[0]}
          </button>
          {/each}
        </div>
      </div>
      {/each}
    </div>

    <!-- Log preview & submit -->
    {#if log.length}
    <div class="log-panel">
      <div class="log-title xs">À valider ({log.length})</div>
      {#each log as entry, i}
      <div class="log-entry">
        <div class="xs" style="flex:1">
          <strong>{entry.ex.title_fr || entry.ex.title}</strong>
          <span class="muted"> — {entry.stus.map(s=>s.name.split(' ')[0]).join(', ')}</span>
        </div>
        <button class="rm-btn" on:click={() => removeFromLog(i)}>✕</button>
      </div>
      {/each}
      <form method="POST" action="?/signOffAll" use:enhance style="margin-top:.625rem">
        <input type="hidden" name="session_id" value={sessionId} />
        {#each log as entry}
          {#each entry.stus as s}
          <input type="hidden" name="entries" value="{entry.ex.id}:{s.id}" />
          {/each}
        {/each}
        <button type="submit" class="btn btn-primary w-full">
          Signer {log.reduce((n,l)=>n+l.stus.length,0)} validations
        </button>
      </form>
    </div>
    {/if}
  </div>
  {/if}
</div>

<style>
  .sess-page{padding:1rem;max-width:680px}
  h1{font-size:1.2rem;font-weight:700;margin-bottom:.875rem;color:var(--txt)}
  h2{font-size:.95rem;font-weight:700;margin:.25rem 0 .75rem;color:var(--txt)}
  .card{background:var(--bg-raised);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:.75rem;position:relative}
  .step-pill{position:absolute;top:-10px;left:14px;width:22px;height:22px;border-radius:50%;background:var(--teal);color:#fff;font-weight:700;font-size:.75rem;display:flex;align-items:center;justify-content:center}
  .fg{display:flex;flex-direction:column;gap:.25rem;margin-bottom:.75rem}
  .fg-lbl{font-size:.72rem;font-weight:600;color:var(--txt-3);text-transform:uppercase;letter-spacing:.05em}
  .date-input{background:var(--bg-2);border:1px solid var(--border);border-radius:7px;padding:.35rem .6rem;color:var(--txt);font-size:.88rem;width:100%}
  .stu-grid{display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.5rem}
  .stu-chip{padding:.3rem .7rem;border-radius:20px;border:1.5px solid var(--border);background:var(--bg-2);color:var(--txt-2);font-size:.82rem;cursor:pointer;transition:all .15s}
  .stu-chip.sel{background:rgba(0,184,122,.12);border-color:var(--teal);color:var(--teal);font-weight:600}
  .w-full{width:100%;justify-content:center}
  .muted{color:var(--txt-3)} .xs{font-size:.78rem}
  .done-card{text-align:center;padding:2rem}
  .done-check{font-size:2.5rem;color:var(--teal)}

  /* Step 2 */
  .sess-active{display:flex;flex-direction:column;gap:.625rem}
  .sess-hdr{display:flex;flex-direction:column;gap:.3rem}
  .sess-chips{display:flex;flex-wrap:wrap;gap:.25rem}
  .stu-mini{background:rgba(0,184,122,.1);color:var(--teal);border-radius:12px;padding:.15rem .5rem;font-size:.72rem;font-weight:600}
  .cat-tabs{display:flex;gap:.3rem;flex-wrap:wrap}
  .cat-tab{padding:.3rem .7rem;border-radius:18px;border:1px solid var(--border);background:var(--bg-2);color:var(--txt-2);font-size:.78rem;cursor:pointer;transition:all .15s}
  .cat-tab.active{background:var(--teal);color:#fff;border-color:var(--teal)}
  .ex-search{width:100%;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:.35rem .6rem;color:var(--txt);font-size:.85rem}
  .ex-list{display:flex;flex-direction:column;gap:.4rem;max-height:50vh;overflow-y:auto}
  .ex-row{background:var(--bg-raised);border:1px solid var(--border);border-radius:9px;padding:.5rem .625rem;transition:border-color .15s}
  .ex-row.in-log{border-color:var(--teal);background:rgba(0,184,122,.04)}
  .ex-top{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.35rem}
  .ex-name{font-size:.83rem;color:var(--txt);font-weight:500}
  .add-btn{font-size:.72rem;padding:.2rem .5rem;border-radius:6px;border:1.5px solid var(--teal);color:var(--teal);background:transparent;cursor:pointer;white-space:nowrap;transition:all .15s}
  .add-btn:hover:not(:disabled){background:var(--teal);color:#fff}
  .add-btn.added{background:var(--teal);color:#fff}
  .add-btn:disabled{opacity:.4;cursor:not-allowed}
  .ex-stus{display:flex;flex-wrap:wrap;gap:.25rem;align-items:center}
  .all-btn{font-size:.66rem;padding:.15rem .4rem;border-radius:5px;border:1px solid var(--border);background:var(--bg-2);color:var(--txt-3);cursor:pointer}
  .stu-ex-chip{padding:.2rem .55rem;border-radius:14px;border:1.5px solid var(--border);background:var(--bg-2);color:var(--txt-3);font-size:.73rem;cursor:pointer;transition:all .12s}
  .stu-ex-chip.sel{border-color:var(--teal);color:var(--teal);background:rgba(0,184,122,.08);font-weight:600}

  /* Log */
  .log-panel{background:var(--bg-raised);border:1px solid var(--teal-border,var(--teal));border-radius:10px;padding:.625rem}
  .log-title{font-weight:700;color:var(--txt-2);margin-bottom:.4rem}
  .log-entry{display:flex;align-items:flex-start;gap:.4rem;padding:.2rem 0;border-bottom:1px solid var(--border)}
  .log-entry:last-of-type{border:none}
  .rm-btn{background:none;border:none;color:var(--txt-3);cursor:pointer;font-size:.8rem;flex-shrink:0;padding:.1rem .3rem}
</style>
