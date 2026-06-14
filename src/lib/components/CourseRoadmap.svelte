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
      fr_what:`Examen théorique P2 ACVL/HPAC : minimum 75%. Validation finale par l'instructeur de tous les exercices en vol et des compétences P2. La certification P2 (Récréatif) permet le vol autonome sur sites approuvés au Canada.`,
      en_what:`ACVL/HPAC P2 theory exam: minimum 75%. Final instructor validation of all in-flight exercises and P2 skills. P2 (Recreational) certification allows autonomous flying at approved Canadian sites.`,
      done:    p2ExamOk,
      partial: p2ExamWrit && !p2ExamOk,
      fr_prog: p2ExamOk ? 'Certifié P2 ✓' : p2ExamWrit ? 'Réussi — en attente signature' : 'Non complété',
      en_prog: p2ExamOk ? 'P2 Certified ✓' : p2ExamWrit ? 'Passed — awaiting sign-off' : 'Not completed',
      fr_next: p2ExamOk ? null : p2ExamWrit ? 'Contacter l\'instructeur pour la validation P2' : 'Planifier l\'examen P2 avec l\'instructeur',
      en_next: p2ExamOk ? null : p2ExamWrit ? 'Contact instructor for P2 validation' : 'Schedule P2 exam with instructor',
    },
  ];

  $: doneCount  = steps.filter(s => s.done).length;

  // Weighted progress: fully done = 1.0, partial = proportional, not started = 0
  // Uses the actual counts already computed above
  $: weightedProgress = (() => {
    const weights = [
      // P1 theory: p1TheoryDone / p1TheoryTotal
      Math.min(1, p1TheoryDone / Math.max(p1TheoryTotal, 1)),
      // Ground exercises: groundDone / groundTotal
      Math.min(1, groundDone / Math.max(groundTotal, 1)),
      // Practical exams: p1PracDone / p1PracTotal
      Math.min(1, p1PracDone / Math.max(p1PracTotal, 1)),
      // P1 theory exam: binary
      p1ExamOk ? 1 : p1ExamWrit ? 0.5 : 0,
      // Flights: flightCount / FLIGHT_TOTAL
      Math.min(1, flightCount / Math.max(FLIGHT_TOTAL, 1)),
      // In-flight exercises: inFlightDone / inFlightTotal
      Math.min(1, inFlightDone / Math.max(inFlightTotal, 1)),
      // P2 exercises: p2ExDone / p2ExTotal
      Math.min(1, p2ExDone / Math.max(p2ExTotal, 1)),
      // P2 theory: p2TheoryDone / p2TheoryTotal
      Math.min(1, p2TheoryDone / Math.max(p2TheoryTotal, 1)),
      // P2 exam: binary
      p2ExamOk ? 1 : p2ExamWrit ? 0.5 : 0,
    ];
    const total = weights.reduce((s, w) => s + w, 0);
    return Math.round((total / steps.length) * 100);
  })();

  $: pct        = weightedProgress;
  $: currentIdx = steps.findIndex(s => !s.done);

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
  <!-- ── Collapsed summary ─────────────────────────────────────────────────── -->
  <button class="rm-hdr" on:click={toggleExpand}>
    <div class="rm-left">
      <span class="xs" style="font-weight:700;color:var(--txt-2)">{L ? 'Parcours de formation' : 'Training path'}</span>
      <span class="xs muted">
        {doneCount}/{steps.length} {L ? 'étapes' : 'steps'} ·
        {#if doneCount === steps.length}
          <span style="color:var(--teal);font-weight:700">{L ? 'Certifié P2 ✓' : 'P2 Certified ✓'}</span>
        {:else if currentIdx >= 0}
          {steps[currentIdx][L?'fr':'en']}
        {/if}
      </span>
    </div>
    <div class="rm-right">
      <span class="xs mono" style="color:var(--teal);font-weight:700">{pct}%</span>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"
        style="color:var(--txt-3);transition:transform .2s;transform:rotate({expanded?180:0}deg)">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  </button>
  <div class="rm-bar-bg"><div class="rm-bar" style="width:{pct}%"></div></div>

  <!-- ── Expanded ──────────────────────────────────────────────────────────── -->
  {#if expanded}
  <div class="rm-steps">
    {#each steps as step, i}
    {#if i === 0 || steps[i-1].phase !== step.phase}
    <div class="rm-phase-lbl xs">{step.phase}</div>
    {/if}

    <button class="rm-row" on:click={() => clickStep(step)}>
      <div class="rm-bullet" style="color:{bulletColor(step)};border-color:{bulletBorder(step)};background:{bulletBg(step)}">
        {#if step.done}
        <svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="2 6 5 9 10 3"/></svg>
        {:else if step.partial}◐
        {:else}<span style="font-size:.6rem;font-weight:800">{i+1}</span>
        {/if}
      </div>
      <div class="rm-lbl">
        <span class="xs" style="font-weight:{(!step.done&&currentIdx===i)||step.done?700:500};color:{step.done?'var(--txt)':currentIdx===i?'var(--txt)':'var(--txt-3)'}">{L ? step.fr : step.en}</span>
        <span class="xs" style="color:{bulletColor(step)}">{L ? step.fr_prog : step.en_prog}</span>
      </div>
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"
        style="flex-shrink:0;color:var(--txt-3);transition:transform .2s;transform:rotate({openId===step.id?180:0}deg)">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    {#if openId === step.id}
    <div class="rm-detail">
      <p class="xs" style="color:var(--txt-2);line-height:1.65;margin-bottom:.4rem">{L ? step.fr_what : step.en_what}</p>
      {#if !step.done && (L ? step.fr_next : step.en_next)}
      <div class="rm-next xs">
        <svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="5"/><line x1="7" y1="4.5" x2="7" y2="7.5"/><circle cx="7" cy="9.5" r=".35" fill="currentColor"/></svg>
        {L ? step.fr_next : step.en_next}
      </div>
      {:else if step.done}
      <div class="xs" style="color:var(--teal);font-weight:700">✓ {L ? 'Étape complétée' : 'Step completed'}</div>
      {/if}
      {#if !step.done}
      {@const nextStep = nextIncompleteAfter(step)}
      {#if nextStep}
      <button class="rm-next-btn xs" on:click|stopPropagation={() => jumpToNext(step)}>
        <span class="rm-next-lbl">{L ? 'Étape suivante' : 'Next step'}:</span>
        <span class="rm-next-name">{L ? nextStep.fr : nextStep.en}</span>
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 6 15 12 9 18"/>
        </svg>
      </button>
      {/if}
      {/if}
    </div>
    {/if}
    {/each}
  </div>
  {/if}
</div>

<style>
  .rm{padding:.1rem 0}
  .rm-hdr{width:100%;display:flex;align-items:center;justify-content:space-between;gap:.75rem;background:none;border:none;cursor:pointer;padding:.3rem 0;text-align:left}
  .rm-left{display:flex;flex-direction:column;gap:.08rem}
  .rm-right{display:flex;align-items:center;gap:.35rem;flex-shrink:0}
  .rm-bar-bg{height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:.4rem}
  .rm-bar{height:100%;background:var(--teal);border-radius:2px;transition:width .4s}
  .rm-steps{display:flex;flex-direction:column}
  .rm-phase-lbl{font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--txt-3);padding:.5rem 0 .1rem;border-top:1px solid var(--border);margin-top:.2rem}
  .rm-phase-lbl:first-child{border-top:none;padding-top:.2rem;margin-top:0}
  .rm-row{width:100%;display:flex;align-items:center;gap:.5rem;padding:.4rem 0;background:none;border:none;border-bottom:1px solid var(--border);cursor:pointer;text-align:left}
  .rm-row:last-child{border-bottom:none}
  .rm-bullet{width:22px;height:22px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;font-size:.9rem}
  .rm-lbl{flex:1;min-width:0;display:flex;flex-direction:column;gap:.05rem}
  .rm-detail{padding:.25rem .25rem .55rem 2.35rem}
  .rm-next{display:flex;align-items:flex-start;gap:.35rem;color:#f59e0b;background:rgba(245,158,11,.07);border-radius:6px;padding:.3rem .45rem;line-height:1.5}
  .xs{font-size:.75rem} .muted{color:var(--txt-3)} .mono{font-family:var(--ff-mono,monospace)}
  .rm-next-btn{display:flex;align-items:center;gap:.4rem;width:100%;margin-top:.4rem;padding:.4rem .5rem;background:rgba(0,232,198,.08);border:1px solid rgba(0,232,198,.25);border-radius:6px;color:var(--teal);cursor:pointer;text-align:left;transition:background .12s}
  .rm-next-btn:hover{background:rgba(0,232,198,.14)}
  .rm-next-btn svg{margin-left:auto;flex-shrink:0;color:var(--teal)}
  .rm-next-lbl{font-weight:700;flex-shrink:0}
  .rm-next-name{font-weight:500;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
</style>
