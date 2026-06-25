<script>
  /**
   * Summit Paragliding Training Path
   * Exact curriculum provided by Pat Jackson, HPAC-certified instructor:
   *
   * P1 phase:
   *   23 ground handling exercises  (category='ground_handling')
   *   5  practical exams (ground)   (exam type='practical', phase='p1')
   *   9  P1 theory blocks           (theory_blocks phase='p1')
   *   1  P1 theory exam             (exam type='theory', phase='p1')
   *   → P1 certification complete
   *
   * P2 phase:
   *   25 flights total
   *   19 in-flight exercises        (airborne, non-P2 titles)
   *   15 P2 exercises               (airborne, titles start 'P2 — ')
   *   7  P2 theory blocks           (theory_blocks phase='p2')
   *   1  P2 exam                    (exam phase='p2')
   *   → P2 certification complete
   */
  export let stats     = {};
  // readiness: authoritative DB-derived counts from getStudentReadiness()
  // ghPassed/ghTotal = ground_handling, airPassed/airTotal = airborne
  export let readiness = null;
  export let theory    = [];
  export let exercises = [];
  export let exams     = [];
  export let lang      = 'fr';
  import { overallProgress } from '$lib/progress.js';
  $: L = lang === 'fr';

  // ── DB-authoritative counts (single source of truth) ──────────────────────
  // Ground: from readiness (direct DB query) if available, else count from exercises array
  $: groundDone  = readiness?.ghPassed  ?? exercises.filter(e => e.category==='ground_handling' && e.status==='passed').length;
  $: groundTotal = readiness?.ghTotal ?? exercises.filter(e => e.category==='ground_handling').length;

  // Airborne: from readiness (direct DB query) if available
  $: airDone     = readiness?.airPassed ?? exercises.filter(e => e.category==='airborne' && e.status==='passed').length;
  $: airTotal    = readiness?.airTotal  ?? exercises.filter(e => e.category==='airborne').length;

  // Split airborne into in-flight vs P2 by title prefix 'P2 — '
  $: airborneAll    = exercises.filter(e => e.category === 'airborne');
  $: inFlightExs    = airborneAll.filter(e => !e.exercise_title?.startsWith('P2 — '));
  $: p2Exs          = airborneAll.filter(e =>  e.exercise_title?.startsWith('P2 — '));
  $: inFlightTotal  = inFlightExs.length || 19;
  $: p2ExTotal      = p2Exs.length || 15;
  $: inFlightDone   = Math.min(inFlightExs.filter(e => e.status==='passed').length, inFlightTotal);
  $: p2ExDone       = Math.min(p2Exs.filter(e => e.status==='passed').length, p2ExTotal);

  // Flights
  $: flightCount = readiness?.flightCount ?? stats.flightCount ?? 0;
  const FLIGHT_TOTAL = 25;

  // Theory — P1 and P2 by phase field
  $: p1Theory      = theory.filter(t => !t.phase || t.phase==='p1' || t.phase==='P1');
  $: p1TheoryDone  = readiness?.p1TheoryDone  ?? p1Theory.filter(t => t.completed).length;
  $: p1TheoryTotal = (readiness?.p1TheoryTotal ?? p1Theory.length) || 9;
  $: p2Theory      = theory.filter(t => t.phase==='p2' || t.phase==='P2');
  $: p2TheoryDone  = p2Theory.filter(t => t.completed).length;
  $: p2TheoryTotal = p2Theory.length || 7;

  // Practical exams
  $: p1PracDone  = exams.filter(e => (e.phase==='p1'||e.phase==='P1') && e.type==='practical' && e.passed===1 && e.signed_off_at).length;
  $: p1PracTotal = 5;
  // P1 theory exam
  $: p1ExamOk    = readiness?.p1ExamsPassed > 0 || exams.some(e => (e.phase==='p1'||e.phase==='P1') && e.type!=='practical' && e.passed===1 && e.signed_off_at);
  $: p1ExamWrit  = exams.some(e => (e.phase==='p1'||e.phase==='P1') && e.type!=='practical' && e.passed===1);
  // P2 exam
  $: p2ExamOk    = readiness?.p2ExamsPassed > 0 || exams.some(e => (e.phase==='p2'||e.phase==='P2') && e.passed===1 && e.signed_off_at);
  $: p2ExamWrit  = exams.some(e => (e.phase==='p2'||e.phase==='P2') && e.passed===1);

  // ── 9 curriculum steps ────────────────────────────────────────────────────
  $: steps = [
    // ── P1 ──────────────────────────────────────────────────────────────────
    {
      id:'p1_theory', phase:'P1',
      fr:'Théorie P1', en:'P1 Theory',
      fr_what:`Compléter les ${p1TheoryTotal} blocs théoriques P1 dans l'onglet Étude : météorologie, aérodynamique, matériel, réglementation ACVL/Transport Canada, sécurité. Lire le Manuel FFVL.`,
      en_what:`Complete the ${p1TheoryTotal} P1 theory blocks in the Study tab: meteorology, aerodynamics, equipment, ACVL/Transport Canada regulations, safety. Read the FFVL Manual.`,
      done:    p1TheoryDone >= p1TheoryTotal,
      partial: p1TheoryDone > 0 && p1TheoryDone < p1TheoryTotal,
      fr_prog: p1Theory.length > 0 ? `${p1TheoryDone} / ${p1TheoryTotal} blocs` : `0 / ${p1TheoryTotal} blocs`,
      en_prog: p1Theory.length > 0 ? `${p1TheoryDone} / ${p1TheoryTotal} blocks` : `0 / ${p1TheoryTotal} blocks`,
      fr_next: p1TheoryDone < p1TheoryTotal ? `${p1TheoryTotal - p1TheoryDone} bloc(s) restant(s) — onglet Étude` : null,
      en_next: p1TheoryDone < p1TheoryTotal ? `${p1TheoryTotal - p1TheoryDone} block(s) remaining — Study tab` : null,
    },
    {
      id:'ground', phase:'P1',
      fr:'Exercices sol', en:'Ground Exercises',
      fr_what:`${groundTotal} exercices de manipulation au sol : gonflage face voile (forward), gonflage dos voile (reverse), contrôle directionnel, kiting en vent modéré et fort. Validation par l'instructeur requise pour chaque exercice.`,
      en_what:`${groundTotal} ground handling exercises: forward inflation, reverse inflation, directional control, kiting in moderate and strong wind. Instructor sign-off required for each exercise.`,
      done:    groundDone >= groundTotal && groundTotal > 0,
      partial: groundDone > 0 && groundDone < groundTotal,
      fr_prog: `${groundDone} / ${groundTotal} exercices sol`,
      en_prog: `${groundDone} / ${groundTotal} ground exercises`,
      fr_next: groundDone < groundTotal ? `${groundTotal - groundDone} exercice(s) sol à valider` : null,
      en_next: groundDone < groundTotal ? `${groundTotal - groundDone} ground exercise(s) to sign off` : null,
    },
    {
      id:'p1_prac', phase:'P1',
      fr:'Examens pratiques sol P1', en:'P1 Ground Practical Exams',
      fr_what:`${p1PracTotal} évaluations pratiques au sol avec l'instructeur : démonstration de la maîtrise des gonflages, du contrôle en vol et des procédures d'urgence au sol. Signés par l'instructeur.`,
      en_what:`${p1PracTotal} practical ground evaluations with instructor: demonstration of launch mastery, glider control and ground emergency procedures. Instructor-signed.`,
      done:    p1PracDone >= p1PracTotal,
      partial: p1PracDone > 0 && p1PracDone < p1PracTotal,
      fr_prog: `${p1PracDone} / ${p1PracTotal} évaluations pratiques`,
      en_prog: `${p1PracDone} / ${p1PracTotal} practical evaluations`,
      fr_next: p1PracDone < p1PracTotal ? `${p1PracTotal - p1PracDone} évaluation(s) pratique(s) restante(s)` : null,
      en_next: p1PracDone < p1PracTotal ? `${p1PracTotal - p1PracDone} practical evaluation(s) remaining` : null,
    },
    {
      id:'p1_exam', phase:'P1',
      fr:'Examen théorique P1', en:'P1 Theory Exam',
      fr_what:`Examen écrit ACVL/FFVL P1 : minimum 75%. Couvre toute la théorie du manuel. Passé avec l'instructeur et contresigné. La certification P1 (Novice) est délivrée après réussite de cet examen et de toutes les évaluations pratiques.`,
      en_what:`ACVL/FFVL P1 written exam: minimum 75%. Covers all manual theory. Taken with instructor and countersigned. P1 (Novice) certification issued after passing this exam and all practical evaluations.`,
      done:    p1ExamOk,
      partial: p1ExamWrit && !p1ExamOk,
      fr_prog: p1ExamOk ? 'Réussi et certifié P1 ✓' : p1ExamWrit ? 'Réussi — en attente signature instructeur' : 'Non complété',
      en_prog: p1ExamOk ? 'Passed & P1 certified ✓'  : p1ExamWrit ? 'Passed — awaiting instructor sign-off' : 'Not completed',
      fr_next: p1ExamOk ? null : p1ExamWrit ? 'Contacter l\'instructeur pour la validation finale' : 'Planifier l\'examen P1 avec l\'instructeur',
      en_next: p1ExamOk ? null : p1ExamWrit ? 'Contact instructor for final validation' : 'Schedule P1 exam with instructor',
    },
    // ── P2 ──────────────────────────────────────────────────────────────────
    {
      id:'flights', phase:'P2',
      fr:'Vols de formation (25)', en:'Training Flights (25)',
      fr_what:`Accumuler ${FLIGHT_TOTAL} vols complets depuis Yamaska. Les vols se réalisent tout au long du P1 et du P2. Chaque vol est consigné dans le carnet de bord avec les données GPS, qualité de décollage et d'atterrissage.`,
      en_what:`Accumulate ${FLIGHT_TOTAL} complete flights from Yamaska. Flights occur throughout P1 and P2. Each flight is logged in the logbook with GPS data, launch and landing quality.`,
      done:    flightCount >= FLIGHT_TOTAL,
      partial: flightCount >= 1 && flightCount < FLIGHT_TOTAL,
      fr_prog: `${flightCount} / ${FLIGHT_TOTAL} vols`,
      en_prog: `${flightCount} / ${FLIGHT_TOTAL} flights`,
      fr_next: flightCount < FLIGHT_TOTAL ? `Encore ${FLIGHT_TOTAL - flightCount} vol(s)` : null,
      en_next: flightCount < FLIGHT_TOTAL ? `${FLIGHT_TOTAL - flightCount} more flight(s)` : null,
    },
    {
      id:'inflight', phase:'P2',
      fr:'Exercices en vol (19)', en:'In-Flight Exercises (19)',
      fr_what:`${inFlightTotal} exercices en vol validés par l'instructeur : oreilles, accélérateur, virages engagés, décrochage contrôlé, thermique 360°, procédures d'urgence. Voir la liste complète dans l'onglet Exercices.`,
      en_what:`${inFlightTotal} in-flight exercises signed off by instructor: big ears, speed bar, steep turns, controlled stall, thermal 360s, emergency procedures. Full list in the Exercises tab.`,
      done:    inFlightDone >= inFlightTotal && inFlightTotal > 0,
      partial: inFlightDone > 0 && inFlightDone < inFlightTotal,
      fr_prog: `${inFlightDone} / ${inFlightTotal} exercices en vol`,
      en_prog: `${inFlightDone} / ${inFlightTotal} in-flight exercises`,
      fr_next: inFlightDone < inFlightTotal ? `${inFlightTotal - inFlightDone} exercice(s) en vol à valider` : null,
      en_next: inFlightDone < inFlightTotal ? `${inFlightTotal - inFlightDone} in-flight exercise(s) to sign off` : null,
    },
    {
      id:'p2ex', phase:'P2',
      fr:'Exercices P2 (15)', en:'P2 Exercises (15)',
      fr_what:`${p2ExTotal} exercices avancés P2 : manœuvres de sécurité actives, vol cross-country de base, lecture de météo avancée, technique thermique avancée. Validés par l'instructeur en vue de la certification P2.`,
      en_what:`${p2ExTotal} advanced P2 exercises: active safety manoeuvres, basic cross-country flying, advanced weather reading, advanced thermal technique. Instructor-validated for P2 certification.`,
      done:    p2ExDone >= p2ExTotal && p2ExTotal > 0,
      partial: p2ExDone > 0 && p2ExDone < p2ExTotal,
      fr_prog: `${p2ExDone} / ${p2ExTotal} exercices P2`,
      en_prog: `${p2ExDone} / ${p2ExTotal} P2 exercises`,
      fr_next: p2ExDone < p2ExTotal ? `${p2ExTotal - p2ExDone} exercice(s) P2 à valider` : null,
      en_next: p2ExDone < p2ExTotal ? `${p2ExTotal - p2ExDone} P2 exercise(s) to sign off` : null,
    },
    {
      id:'p2_theory', phase:'P2',
      fr:'Théorie P2 (7 blocs)', en:'P2 Theory (7 blocks)',
      fr_what:`${p2TheoryTotal} blocs théoriques P2 dans l'onglet Étude : météo avancée (CAPE, cisaillement), navigation cross-country, réglementation de l'espace aérien, thermique et dynamique de pente avancés, sécurité active.`,
      en_what:`${p2TheoryTotal} P2 theory blocks in the Study tab: advanced meteorology (CAPE, wind shear), cross-country navigation, airspace regulations, advanced thermal and ridge soaring, active safety.`,
      done:    p2TheoryDone >= p2TheoryTotal,
      partial: p2TheoryDone > 0 && p2TheoryDone < p2TheoryTotal,
      fr_prog: p2Theory.length > 0 ? `${p2TheoryDone} / ${p2TheoryTotal} blocs` : `0 / ${p2TheoryTotal} blocs`,
      en_prog: p2Theory.length > 0 ? `${p2TheoryDone} / ${p2TheoryTotal} blocks` : `0 / ${p2TheoryTotal} blocks`,
      fr_next: p2TheoryDone < p2TheoryTotal ? `${p2TheoryTotal - p2TheoryDone} bloc(s) P2 restant(s) — onglet Étude` : null,
      en_next: p2TheoryDone < p2TheoryTotal ? `${p2TheoryTotal - p2TheoryDone} P2 block(s) remaining — Study tab` : null,
    },
    {
      id:'p2_exam', phase:'P2',
      fr:'Examen P2 — Certification', en:'P2 Exam — Certification',
      fr_what:`Examen théorique P2 ACVL/HPAC : minimum 75%. Validation finale par l'instructeur de tous les exercices en vol et des compétences P2. La licence P2 (Récréatif) HPAC, avec assurance responsabilité de 10 M$, permet le vol autonome partout dans le monde — sauf aux États-Unis.`,
      en_what:`ACVL/HPAC P2 theory exam: minimum 75%. Final instructor validation of all in-flight exercises and P2 skills. The HPAC P2 (Recreational) licence, with 10M liability insurance, allows autonomous flying worldwide — except in the United States.`,
      done:    p2ExamOk,
      partial: p2ExamWrit && !p2ExamOk,
      fr_prog: p2ExamOk ? 'Certifié P2 ✓' : p2ExamWrit ? 'Réussi — en attente signature' : 'Non complété',
      en_prog: p2ExamOk ? 'P2 Certified ✓' : p2ExamWrit ? 'Passed — awaiting sign-off' : 'Not completed',
      fr_next: p2ExamOk ? null : p2ExamWrit ? 'Contacter l\'instructeur pour la validation P2' : 'Planifier l\'examen P2 avec l\'instructeur',
      en_next: p2ExamOk ? null : p2ExamWrit ? 'Contact instructor for P2 validation' : 'Schedule P2 exam with instructor',
    },
  ];

  $: doneCount  = steps.filter(s => s.done).length;

  // Weighted progress — delegated to the shared single-source-of-truth so the
  // dashboard, profile and instructor views all show the identical number.
  $: weightedProgress = overallProgress({ exercises, exams, theory, readiness, stats });

  $: pct        = weightedProgress;
  $: currentIdx = steps.findIndex(s => !s.done);

  const clamp = v => Math.min(1, Math.max(0, v || 0));
  $: stepFrac = {
    p1_theory: clamp(p1TheoryDone / Math.max(p1TheoryTotal, 1)),
    ground:    clamp(groundDone   / Math.max(groundTotal, 1)),
    p1_prac:   clamp(p1PracDone   / Math.max(p1PracTotal, 1)),
    p1_exam:   p1ExamOk ? 1 : p1ExamWrit ? 0.5 : 0,
    flights:   clamp(flightCount  / Math.max(FLIGHT_TOTAL, 1)),
    inflight:  clamp(inFlightDone / Math.max(inFlightTotal, 1)),
    p2ex:      clamp(p2ExDone     / Math.max(p2ExTotal, 1)),
    p2_theory: clamp(p2TheoryDone / Math.max(p2TheoryTotal, 1)),
    p2_exam:   p2ExamOk ? 1 : p2ExamWrit ? 0.5 : 0,
  };
  function phaseName(p) {
    if (p === 'P1') return L ? 'Brevet initial — Novice' : 'Initial — Novice';
    if (p === 'P2') return L ? 'Brevet — Récréatif' : 'Recreational';
    return '';
  }
  $: phasePct = (ph) => {
    const ids = steps.filter(s => s.phase === ph).map(s => s.id);
    if (!ids.length) return 0;
    return Math.round(ids.reduce((a, id) => a + (stepFrac[id] || 0), 0) / ids.length * 100);
  };

  // ── Individual items per step (extreme detail) ────────────────────────────
  const exState = e => e.status === 'passed' ? 'done' : e.status === 'pending' ? 'partial' : 'todo';
  const thState = t => t.completed ? 'done' : 'todo';
  const pxState = e => (e.passed === 1 && e.signed_off_at) ? 'done' : e.passed === 1 ? 'partial' : 'todo';
  const thTitle = t => t.title || t.block_title || t.name || t.label || (L ? 'Bloc théorique' : 'Theory block');
  $: stepItems = {
    p1_theory: p1Theory.map(t => ({ title: thTitle(t), state: thState(t) })),
    ground:    exercises.filter(e => e.category === 'ground_handling').map(e => ({ title: e.exercise_title, state: exState(e) })),
    p1_prac:   exams.filter(e => (e.phase==='p1'||e.phase==='P1') && e.type==='practical').map(e => ({ title: e.title || (L?'Évaluation pratique':'Practical evaluation'), state: pxState(e) })),
    inflight:  inFlightExs.map(e => ({ title: e.exercise_title, state: exState(e) })),
    p2ex:      p2Exs.map(e => ({ title: (e.exercise_title||'').replace('P2 — ','').replace('P2 - ',''), state: exState(e) })),
    p2_theory: p2Theory.map(t => ({ title: thTitle(t), state: thState(t) })),
  };
  const stateColor = s => s === 'done' ? 'var(--teal)' : s === 'partial' ? '#f59e0b' : 'var(--txt-3)';

  // ── Interaction ───────────────────────────────────────────────────────────
  let expanded = false;
  let openId   = null;

  $: if (expanded && openId === null && currentIdx >= 0) {
    openId = steps[currentIdx].id;
  }

  function toggleExpand() {
    expanded = !expanded;
    if (!expanded) openId = null;
  }

  // Find next incomplete step in CURRICULUM ORDER (P1 theory → ground → prac → P1 exam
  // → flights → in-flight ex → P2 ex → P2 theory → P2 exam). Same array order.
  function nextIncompleteAfter(step) {
    const idx = steps.findIndex(s => s.id === step.id);
    for (let i = idx + 1; i < steps.length; i++) {
      if (!steps[i].done) return steps[i];
    }
    // None after; look from start (in case current step is the only one done)
    for (let i = 0; i < idx; i++) {
      if (!steps[i].done) return steps[i];
    }
    return null;
  }

  function clickStep(step) {
    // Simple toggle: tap an open step to close, tap a closed step to open.
    // The "next step" is a separate explicit button inside the panel.
    openId = (openId === step.id) ? null : step.id;
  }

  function jumpToNext(step) {
    const next = nextIncompleteAfter(step);
    if (next) openId = next.id;
  }

  function bulletColor(s) {
    return s.done ? 'var(--teal)' : s.partial ? '#f59e0b' : 'var(--txt-3)';
  }
  function bulletBorder(s) {
    return s.done ? 'var(--teal)' : s.partial ? '#f59e0b' : 'var(--border)';
  }
  function bulletBg(s) {
    return s.done ? 'rgba(0,232,198,.12)' : s.partial ? 'rgba(245,158,11,.1)' : 'transparent';
  }
</script>

<div class="rm">
  <!-- ── Header ─────────────────────────────────────────────── -->
  <button class="rm-hdr" on:click={toggleExpand}>
    <div class="rm-left">
      <span class="rm-title">{L ? 'Parcours de formation' : 'Training path'}</span>
      <span class="rm-sub">
        {#if doneCount === steps.length}
          <span class="rm-cert">★ {L ? 'Certifié P2' : 'P2 Certified'}</span>
        {:else if currentIdx >= 0}
          {doneCount}/{steps.length} · {L ? 'à suivre' : 'next'}: {steps[currentIdx][L?'fr':'en']}
        {/if}
      </span>
    </div>
    <div class="rm-right">
      <span class="rm-pct">{pct}<span class="rm-pct-s">%</span></span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"
        class="rm-chev" style="transform:rotate({expanded?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
  </button>
  <div class="rm-bar-bg"><div class="rm-bar" style="width:{pct}%"></div></div>

  <!-- ── Timeline ───────────────────────────────────────────── -->
  {#if expanded}
  <div class="rm-tl">
    {#each steps as step, i}
    {#if i === 0 || steps[i-1].phase !== step.phase}
    <div class="rm-phase">
      <span class="rm-phase-badge">{step.phase}</span>
      <span class="rm-phase-name">{phaseName(step.phase)}</span>
      <span class="rm-phase-pct">{phasePct(step.phase)}%</span>
    </div>
    {/if}

    <div class="rm-item" class:is-current={currentIdx===i} class:is-open={openId===step.id}>
      <div class="rm-rail" class:rail-done={step.done} class:rail-last={i===steps.length-1}></div>
      <button class="rm-dot" data-state={step.done?'done':step.partial?'partial':'todo'} on:click={() => clickStep(step)}>
        {#if step.done}
          <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6"><polyline points="2 6 5 9 10 3"/></svg>
        {:else}{i+1}{/if}
      </button>
      <button class="rm-body" on:click={() => clickStep(step)}>
        <div class="rm-line1">
          <span class="rm-name" data-state={step.done?'done':currentIdx===i?'current':'todo'}>{L ? step.fr : step.en}</span>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"
            class="rm-chev" style="transform:rotate({openId===step.id?180:0}deg);flex-shrink:0;opacity:.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="rm-mini"><div class="rm-mini-fill" data-state={step.done?'done':step.partial?'partial':'todo'} style="width:{(stepFrac[step.id]||0)*100}%"></div></div>
        <span class="rm-prog" data-state={step.done?'done':step.partial?'partial':'todo'}>{L ? step.fr_prog : step.en_prog}</span>
      </button>

      {#if openId === step.id}
      <div class="rm-detail">
        <p class="rm-what">{L ? step.fr_what : step.en_what}</p>

        {#if stepItems[step.id]?.length}
        <div class="rm-items">
          {#each stepItems[step.id] as it}
          <div class="rm-it">
            <span class="rm-it-dot" data-state={it.state}>
              {#if it.state==='done'}<svg viewBox="0 0 12 12" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.6"><polyline points="2 6 5 9 10 3"/></svg>
              {:else if it.state==='partial'}<span class="rm-it-half"></span>{/if}
            </span>
            <span class="rm-it-title" style="color:{it.state==='todo'?'var(--txt-3)':'var(--txt-2)'}">{it.title}</span>
            {#if it.state==='partial'}<span class="rm-it-tag" style="color:#f59e0b">{L?'en attente':'pending'}</span>{/if}
          </div>
          {/each}
        </div>
        {/if}

        {#if !step.done && (L ? step.fr_next : step.en_next)}
        <div class="rm-next">
          <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="5.5"/><line x1="7" y1="4" x2="7" y2="7.5"/><circle cx="7" cy="10" r=".4" fill="currentColor"/></svg>
          <span>{L ? step.fr_next : step.en_next}</span>
        </div>
        {:else if step.done}
        <div class="rm-doneline">✓ {L ? 'Étape complétée' : 'Step completed'}</div>
        {/if}
        {#if !step.done}
        {@const nextStep = nextIncompleteAfter(step)}
        {#if nextStep}
        <button class="rm-next-btn" on:click|stopPropagation={() => jumpToNext(step)}>
          <span class="rm-next-lbl">{L ? 'Étape suivante' : 'Next step'}</span>
          <span class="rm-next-name">{L ? nextStep.fr : nextStep.en}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
        {/if}
        {/if}
      </div>
      {/if}
    </div>
    {/each}
  </div>
  {/if}
</div>

<style>
  .rm{padding:.1rem 0}
  .rm-hdr{font-family:var(--ff-head);width:100%;display:flex;align-items:center;justify-content:space-between;gap:.75rem;background:none;border:none;cursor:pointer;padding:.15rem 0 .5rem;text-align:left}
  .rm-left{display:flex;flex-direction:column;gap:.12rem;min-width:0}
  .rm-title{font-family:var(--ff-head);font-weight:800;font-size:.92rem;color:var(--txt);letter-spacing:.01em}
  .rm-sub{font-size:.74rem;color:var(--txt-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rm-cert{color:var(--teal);font-weight:800}
  .rm-right{display:flex;align-items:center;gap:.45rem;flex-shrink:0}
  .rm-pct{font-family:var(--ff-head,inherit);font-weight:800;font-size:1.35rem;color:var(--teal);line-height:1}
  .rm-pct-s{font-size:.8rem;opacity:.7;margin-left:1px}
  .rm-chev{color:var(--txt-3);transition:transform .2s}
  .rm-bar-bg{height:6px;background:var(--border);border-radius:99px;overflow:hidden}
  .rm-bar{height:100%;background:linear-gradient(90deg,var(--teal),var(--teal-hi,#00e890));border-radius:99px;transition:width .5s var(--ease,ease)}

  .rm-tl{margin-top:.9rem;display:flex;flex-direction:column}
  .rm-phase{display:flex;align-items:center;gap:.5rem;margin:.7rem 0 .5rem;padding-top:.55rem;border-top:1px solid var(--border)}
  .rm-phase:first-child{border-top:none;padding-top:0;margin-top:0}
  .rm-phase-badge{font-family:var(--ff-head,inherit);font-weight:800;font-size:.66rem;letter-spacing:.05em;color:var(--teal);background:var(--teal-lo,rgba(0,184,122,.12));border:1px solid var(--teal-border,rgba(0,184,122,.25));border-radius:5px;padding:.12rem .4rem}
  .rm-phase-name{font-size:.74rem;font-weight:700;color:var(--txt-2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rm-phase-pct{font-family:var(--ff-mono,monospace);font-size:.72rem;font-weight:700;color:var(--txt-3)}

  .rm-item{position:relative;padding-left:2.1rem;padding-bottom:.2rem}
  .rm-rail{position:absolute;left:.68rem;top:1.4rem;bottom:-.2rem;width:2px;background:var(--border)}
  .rm-rail.rail-done{background:var(--teal)}
  .rm-rail.rail-last{display:none}
  .rm-dot{position:absolute;left:0;top:.35rem;width:1.45rem;height:1.45rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--ff-head,inherit);font-size:.7rem;font-weight:800;cursor:pointer;border:2px solid var(--border);background:var(--bg-card);color:var(--txt-3);z-index:1;transition:all .2s}
  .rm-dot[data-state="done"]{background:var(--teal);border-color:var(--teal);color:var(--txt-inv,#04130d)}
  .rm-dot[data-state="partial"]{border-color:#f59e0b;color:#f59e0b}
  .rm-body{width:100%;display:flex;flex-direction:column;gap:.28rem;background:none;border:none;cursor:pointer;text-align:left;padding:.45rem 0}
  .rm-line1{display:flex;align-items:center;gap:.4rem}
  .rm-name{font-size:.84rem;font-weight:600;color:var(--txt-3);flex:1;min-width:0}
  .rm-name[data-state="done"]{color:var(--txt);font-weight:700}
  .rm-name[data-state="current"]{color:var(--txt);font-weight:800}
  .rm-mini{height:4px;background:var(--border);border-radius:99px;overflow:hidden}
  .rm-mini-fill{height:100%;border-radius:99px;background:var(--txt-3);transition:width .5s var(--ease,ease)}
  .rm-mini-fill[data-state="done"]{background:var(--teal)}
  .rm-mini-fill[data-state="partial"]{background:#f59e0b}
  .rm-prog{font-size:.7rem;color:var(--txt-3)}
  .rm-prog[data-state="done"]{color:var(--teal);font-weight:600}
  .rm-prog[data-state="partial"]{color:#f59e0b}

  .rm-detail{padding:.1rem 0 .65rem}
  .rm-what{font-size:.76rem;color:var(--txt-2);line-height:1.65;margin-bottom:.45rem}
  .rm-next{display:flex;align-items:flex-start;gap:.4rem;font-size:.74rem;color:#f59e0b;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:7px;padding:.4rem .5rem;line-height:1.5}
  .rm-next svg{flex-shrink:0;margin-top:1px}
  .rm-doneline{font-size:.74rem;color:var(--teal);font-weight:700}
  .rm-next-btn{display:flex;align-items:center;gap:.45rem;width:100%;margin-top:.45rem;padding:.45rem .55rem;background:var(--teal-lo,rgba(0,184,122,.08));border:1px solid var(--teal-border,rgba(0,184,122,.25));border-radius:7px;color:var(--teal);cursor:pointer;text-align:left;font-size:.74rem;transition:background .12s}
  .rm-next-btn:hover{background:var(--teal-lo,rgba(0,184,122,.16))}
  .rm-next-lbl{font-weight:800;flex-shrink:0}
  .rm-next-name{font-weight:500;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
  .rm-next-btn svg{margin-left:auto;flex-shrink:0}

  .rm-items{display:flex;flex-direction:column;gap:.1rem;margin:.1rem 0 .5rem;padding:.5rem .6rem;background:var(--bg-card);border:1px solid var(--border);border-radius:8px}
  .rm-it{display:flex;align-items:center;gap:.5rem;padding:.22rem 0}
  .rm-it-dot{width:15px;height:15px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--txt-inv,#04130d)}
  .rm-it-dot[data-state="done"]{background:var(--teal);border-color:var(--teal)}
  .rm-it-dot[data-state="partial"]{border-color:#f59e0b}
  .rm-it-half{width:7px;height:7px;border-radius:50%;background:#f59e0b}
  .rm-it-title{font-family:var(--ff-head);font-size:.74rem;line-height:1.35;flex:1;min-width:0}
  .rm-it-tag{font-family:var(--ff-head);font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;flex-shrink:0}
</style>
