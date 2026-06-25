<script>
  import ConfidenceTrend from '$lib/components/ConfidenceTrend.svelte';
  export let data;
  $: ({ students } = data);
  let expandedId = null;  // which student card is expanded (all collapsed by default)

  function pct(a, b) { return b > 0 ? Math.round(a / b * 100) : 0; }
  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' });
  }
  function phaseOf(s) {
    if (s.thP1Done >= s.thP1Total && s.thP1Total > 0 && s.flightCount >= 3) return 'P2';
    return 'P1';
  }
  function nextStep(s) {
    if (s.flightCount === 0 && s.ghPassed < 5) return { label: 'Exercices sol à compléter', pct: pct(s.ghPassed, Math.max(s.ghTotal, 1)), urgent: false };
    if (s.flightCount === 0 && s.ghPassed >= 5 && s.thP1Done < s.thP1Total) return { label: 'Théorie P1 à compléter', pct: pct(s.thP1Done, s.thP1Total), urgent: false };
    if (s.readyForFirstFlight && s.flightCount === 0) return { label: 'Prêt pour le 1er vol', pct: 100, urgent: true };
    if (s.flightCount > 0 && s.flightCount < 5 && s.exPassed < s.exTotal) return { label: 'Vols en cours (Phase initiale)', pct: pct(s.flightCount, 5), urgent: false };
    if (s.readyForP1Signoff) return { label: 'Prêt pour signature P1', pct: 100, urgent: true };
    if (phaseOf(s) === 'P2') return { label: 'Formation P2 en cours', pct: pct(s.exPassed, s.exTotal), urgent: false };
    return { label: 'Formation en cours', pct: pct(s.exPassed + s.thDone, s.exTotal + s.thTotal), urgent: false };
  }
  function overallPct(s) {
    const total = (s.exTotal + s.thTotal + s.theoryExams) || 1;
    const done  = s.exPassed + s.thDone + s.theoryExamsPassed;
    return pct(done, total);
  }
  function barColor(p) {
    if (p >= 80) return 'var(--teal)';
    if (p >= 50) return 'var(--amber)';
    return 'var(--red)';
  }

  $: readyFirstFlight  = students.filter(s => s.readyForFirstFlight);
  $: readyP1Signoff    = students.filter(s => s.readyForP1Signoff);
  $: readyP2           = students.filter(s => s.readyForP2Start);
  $: stalled           = students.filter(s => {
    if (!s.lastActivity) return false;
    const days = (Date.now() - new Date(s.lastActivity)) / 86400000;
    return days > 14;
  });

  // Sort: urgent first, then by overall pct desc
  $: sorted = [...students].sort((a, b) => {
    const ua = nextStep(a).urgent ? 1 : 0;
    const ub = nextStep(b).urgent ? 1 : 0;
    if (ub !== ua) return ub - ua;
    return overallPct(b) - overallPct(a);
  });
</script>

<svelte:head><title>Analytique — Instructeur</title></svelte:head>

<div class="page-wrap">
  <h1>Analytique</h1>
  <p class="sub">Progression réelle de chaque étudiant selon le parcours de la formation.</p>

  <!-- Attention flags -->
  {#if readyFirstFlight.length || readyP1Signoff.length || readyP2.length || stalled.length}
  <div class="flags-row">
    {#if readyFirstFlight.length}
    <div class="flag-card flag-green">
      <div class="flag-num">{readyFirstFlight.length}</div>
      <div class="flag-lbl">Prêt(s) 1er vol</div>
      <div class="flag-names xs">{readyFirstFlight.map(s=>s.name).join(', ')}</div>
    </div>
    {/if}
    {#if readyP1Signoff.length}
    <div class="flag-card flag-teal">
      <div class="flag-num">{readyP1Signoff.length}</div>
      <div class="flag-lbl">Prêt(s) signature P1</div>
      <div class="flag-names xs">{readyP1Signoff.map(s=>s.name).join(', ')}</div>
    </div>
    {/if}
    {#if readyP2.length}
    <div class="flag-card flag-aqua">
      <div class="flag-num">{readyP2.length}</div>
      <div class="flag-lbl">Prêt(s) P2</div>
      <div class="flag-names xs">{readyP2.map(s=>s.name).join(', ')}</div>
    </div>
    {/if}
    {#if stalled.length}
    <div class="flag-card flag-amber">
      <div class="flag-num">{stalled.length}</div>
      <div class="flag-lbl">Inactif +14j</div>
      <div class="flag-names xs">{stalled.map(s=>s.name).join(', ')}</div>
    </div>
    {/if}
  </div>
  {/if}

  <!-- Per-student progression -->
  <div class="student-grid">
    {#each sorted as s}
      {@const overall = overallPct(s)}
      {@const next    = nextStep(s)}
      {@const phase   = phaseOf(s)}
      <div class="stu-card" class:urgent={next.urgent}>
        <!-- Collapsed header — always visible, 2 lines of dense info -->
        <button class="stu-collapse-btn" on:click={() => expandedId = expandedId === s.id ? null : s.id}>
          <div class="stu-av">{s.name[0]}</div>
          <div class="stu-collapse-info">
            <div class="stu-collapse-line1">
              <span class="stu-name">{s.name}</span>
              <span class="stu-phase phase-{phase.toLowerCase()}">{phase}</span>
              {#if s.confidence?.trend && s.confidence.trend !== 'neutral'}
                <span class="conf-mini" style="color:{s.confidence.trend==='up'?'#16a34a':s.confidence.trend==='down'?'#dc2626':'#eab308'}">
                  {s.confidence.trend==='up'?'↑':s.confidence.trend==='down'?'↓':'→'} {s.confidence.last ?? ''}
                </span>
              {/if}
            </div>
            <div class="stu-collapse-line2 xs">
              <span class="mono" style="color:{barColor(overall)}">{overall}%</span>
              <span class="sep">·</span>
              <span class="mono" style="color:var(--teal)">{s.flightCount}/25 vols</span>
              <span class="sep">·</span>
              <span class="mono">{s.exPassed}/{s.exTotal} ex</span>
              <span class="sep">·</span>
              <span class="mono">{s.thDone}/{s.thTotal} th</span>
              {#if s.pendingSignoffs > 0}
                <span class="sep">·</span>
                <span class="mono" style="color:var(--amber)">{s.pendingSignoffs} ⧖</span>
              {/if}
            </div>
          </div>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"
            style="flex-shrink:0;color:var(--txt-3);transition:transform .2s;transform:rotate({expandedId===s.id?180:0}deg)">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {#if expandedId === s.id}
        <div class="stu-expanded">
        <div class="stu-top">
          <a href="/instructor/students/{s.id}" class="btn btn-ghost btn-xs">Voir le dossier complet</a>
        </div>

        <!-- Overall progress bar -->
        <div class="overall-bar-wrap">
          <div class="overall-bar" style="width:{overall}%;background:{barColor(overall)}"></div>
        </div>
        <div class="overall-pct xs" style="color:{barColor(overall)}">{overall}% formation complétée
          <span class="calc-hint xs dimmed">= ({s.exPassed} ex + {s.thDone} th + {s.theoryExamsPassed} exam) / ({s.exTotal} + {s.thTotal} + {s.theoryExams})</span>
        </div>

        <!-- Metric grid -->
        <div class="metric-grid">
          <div class="metric">
            <div class="metric-val" style="color:var(--teal)">{s.flightCount}</div>
            <div class="metric-lbl xs">Vols</div>
          </div>
          <div class="metric">
            <div class="metric-val">{s.exPassed}<span class="metric-tot">/{s.exTotal}</span></div>
            <div class="metric-lbl xs">Exercices</div>
          </div>
          <div class="metric">
            <div class="metric-val">{s.thDone}<span class="metric-tot">/{s.thTotal}</span></div>
            <div class="metric-lbl xs">Théorie</div>
          </div>
          <div class="metric">
            <div class="metric-val">{s.pendingSignoffs > 0 ? s.pendingSignoffs : '—'}</div>
            <div class="metric-lbl xs" style="{s.pendingSignoffs>0?'color:var(--amber)':''}">En attente</div>
          </div>
        </div>

        <!-- Sub-bars: ground vs air -->
        <div class="sub-bars">
          <div class="sub-bar-row">
            <span class="xs muted" style="min-width:40px">Sol</span>
            <div class="sub-bar-track">
              <div class="sub-bar-fill" style="width:{pct(s.ghPassed,s.ghTotal)}%;background:var(--teal)"></div>
            </div>
            <span class="xs mono" style="min-width:30px;text-align:right">{s.ghPassed}/{s.ghTotal}</span>
          </div>
          <div class="sub-bar-row">
            <span class="xs muted" style="min-width:40px">Vol</span>
            <div class="sub-bar-track">
              <div class="sub-bar-fill" style="width:{pct(s.airPassed,s.airTotal)}%;background:var(--sky)"></div>
            </div>
            <span class="xs mono" style="min-width:30px;text-align:right">{s.airPassed}/{s.airTotal}</span>
          </div>
        </div>

        <!-- Next step -->
        <div class="next-step" class:next-urgent={next.urgent}>
          <div class="next-bar-wrap">
            <div class="next-bar" style="width:{next.pct}%;background:{next.urgent?'var(--teal)':'var(--txt-3)'}"></div>
          </div>
          <div class="next-label xs">{next.label}</div>
        </div>

        <!-- Confidence trend -->
        {#if s.confidence?.data?.length}
        <div class="conf-section">
          <div class="xs muted" style="margin-bottom:.25rem;font-weight:700">Confiance (auto-évaluation)</div>
          <ConfidenceTrend
            data={s.confidence.data}
            trend={s.confidence.trend}
            baseline={s.confidence.baseline}
            recent={s.confidence.recent}
            last={s.confidence.last} />
        </div>
        {/if}

        <!-- Last activity -->
        {#if s.lastActivity}
        <div class="last-act xs dimmed">Dernière activité: {fmtDate(s.lastActivity)}</div>
        {/if}
        </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Methodology note -->
  <div class="method-note">
    <div class="method-title xs">Comment le pourcentage est calculé</div>
    <div class="method-body xs dimmed">
      Progression globale = (exercices réussis + blocs théorie complétés + examens théoriques réussis) / (total exercices + total blocs théorie + total examens théoriques) × 100.
      Les vols ne sont pas comptés dans le pourcentage — ils sont affichés séparément car il n'y a pas de nombre cible fixe.
      «Sol» = exercices au sol (ground handling). «Vol» = exercices en l'air (airborne).
    </div>
  </div>
</div>

<style>
  .page-wrap{padding:1.25rem;max-width:900px}
  h1{font-size:1.3rem;font-weight:700;color:var(--txt);margin-bottom:.2rem}
  .sub{font-size:.82rem;color:var(--txt-3);margin-bottom:1.25rem}

  /* Flags */
  .flags-row{display:flex;flex-wrap:wrap;gap:.625rem;margin-bottom:1.25rem}
  .flag-card{background:var(--bg-raised);border-radius:10px;padding:.625rem .875rem;border-left:3px solid var(--border);min-width:140px}
  .flag-green{border-left-color:var(--teal)}
  .flag-teal{border-left-color:var(--aqua)}
  .flag-aqua{border-left-color:#60a5fa}
  .flag-amber{border-left-color:var(--amber)}
  .flag-num{font-size:1.5rem;font-weight:800;font-family:var(--ff-head);color:var(--txt);line-height:1}
  .flag-lbl{font-size:.78rem;font-weight:700;color:var(--txt-2);margin:.15rem 0}
  .flag-names{color:var(--txt-3)}

  /* Student grid */
  .student-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.875rem;margin-bottom:1.25rem}
  .stu-card{background:var(--bg-raised);border-radius:12px;padding:.875rem;display:flex;flex-direction:column;gap:.5rem;border:1px solid var(--border)}
  .stu-card.urgent{border-color:rgba(0,184,122,.3);box-shadow:0 0 0 1px rgba(0,184,122,.15)}
  .stu-top{display:flex;align-items:center;gap:.625rem}
  .stu-av{width:32px;height:32px;border-radius:50%;background:rgba(0,184,122,.15);color:var(--teal);font-weight:800;font-size:.95rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .stu-info{flex:1;display:flex;flex-direction:column;gap:.1rem}
  .stu-name{font-weight:700;font-size:.9rem;color:var(--txt)}
  .stu-phase{font-size:.65rem;font-weight:700;padding:.1rem .35rem;border-radius:4px;width:fit-content}
  .phase-p1{background:rgba(0,184,122,.15);color:var(--teal)}
  .phase-p2{background:rgba(0,232,198,.15);color:var(--aqua)}

  /* Bars */
  .overall-bar-wrap{height:7px;background:var(--border);border-radius:4px;overflow:hidden}
  .overall-bar{height:100%;border-radius:4px;transition:width .4s}
  .overall-pct{line-height:1.4}
  .calc-hint{display:block;font-family:var(--ff-head)}
  .metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.25rem;text-align:center;background:var(--bg-2);border-radius:8px;padding:.4rem}
  .metric{}
  .metric-val{font-family:var(--ff-head);font-size:.9rem;font-weight:700;color:var(--txt)}
  .metric-tot{font-size:.72rem;color:var(--txt-3);font-weight:400}
  .metric-lbl{color:var(--txt-3)}
  .sub-bars{display:flex;flex-direction:column;gap:.25rem}
  .sub-bar-row{display:flex;align-items:center;gap:.4rem}
  .sub-bar-track{flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden}
  .sub-bar-fill{height:100%;border-radius:3px;transition:width .4s}
  .next-step{background:var(--bg-2);border-radius:7px;padding:.4rem .5rem}
  .next-urgent{background:rgba(0,184,122,.08);border:1px solid rgba(0,184,122,.2)}
  .next-bar-wrap{height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:.25rem}
  .next-bar{height:100%;border-radius:2px;transition:width .3s}
  .next-label{color:var(--txt-2);font-weight:600}
  .last-act{text-align:right}

  /* Methodology */
  .method-note{background:var(--bg-raised);border-radius:10px;padding:.75rem 1rem;border-left:3px solid var(--border)}
  .method-title{font-weight:700;color:var(--txt-2);margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.05em}
  .method-body{line-height:1.6}
  .xs{font-size:.75rem}
  .dimmed{color:var(--txt-3)}
  .mono{font-family:var(--ff-head)}

  .stu-collapse-btn{display:flex;align-items:center;gap:.6rem;width:100%;background:none;border:none;padding:0;cursor:pointer;text-align:left;color:inherit}
  .stu-collapse-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:.15rem}
  .stu-collapse-line1{display:flex;align-items:center;gap:.4rem}
  .stu-collapse-line2{display:flex;align-items:center;gap:.35rem;color:var(--txt-3);flex-wrap:wrap}
  .stu-collapse-line2 .sep{opacity:.4}
  .conf-mini{font-weight:700;font-family:var(--ff-mono,monospace);font-size:.7rem}
  .stu-expanded{display:flex;flex-direction:column;gap:.5rem;margin-top:.625rem;padding-top:.625rem;border-top:1px solid var(--border)}
  .stu-expanded .stu-top{justify-content:flex-end}
  .conf-section{padding-top:.4rem}
</style>
