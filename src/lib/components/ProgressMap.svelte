<!--
  Shared progress map used identically on both:
  - /student/[id]/exercises (exercises tab)
  - /student/[id]/profile   (logbook/carnet tab)
  Props: exercises[], exams[], lang
-->
<script>
  export let exercises = [];
  export let exams     = [];
  export let lang      = 'fr';
  $: L = lang === 'fr';

  function subcat(t = '') {
    const s = t.toLowerCase();
    if (/\bp2[\s\-—]/.test(s)) return 'p2';
    if (s.includes('land') || s.includes('atterr')) return 'lnd';
    const n = parseInt(s.match(/#(\d+)/)?.[1]);
    if (!isNaN(n)) {
      if (n >= 1  && n <= 10) return 'pf';
      if (n >= 11 && n <= 18) return 'lch';
      if (n >= 19 && n <= 37) return 'if';
      if (n >= 38 && n <= 42) return 'lnd';
    }
    return 'if';
  }

  function dotStatus(ex) {
    if (ex.status === 'passed')  return 'p';
    if (ex.status === 'pending') return 'w';
    return 'n';
  }
  function examDot(ex) {
    // Only mark as attempted if there is a signed-off attempt (ea.signed_off_at comes from LEFT JOIN)
    if (ex.passed === 1 && ex.signed_off_at) return 'p';  // passed
    if (ex.signed_off_at)                    return 'f';  // graded but not passed
    // ex.score_pct is only set when the attempt is signed off
    // Without a signed-off attempt, the student has not tried — show grey
    return 'n';
  }

  $: gh  = exercises.filter(x => x.category === 'ground_handling');
  $: air = exercises.filter(x => x.category === 'airborne');

  // Ground section = pf + lch + lnd
  $: pmPf  = gh.filter(x => subcat(x.title) === 'pf');
  $: pmLch = gh.filter(x => subcat(x.title) === 'lch');
  $: pmLnd = air.filter(x => subcat(x.title) === 'lnd');
  // In-flight
  $: pmIf  = air.filter(x => subcat(x.title) === 'if');
  // P2
  $: pmP2  = air.filter(x => subcat(x.title) === 'p2');

  // Exam split
  $: thExams = exams.filter(e => e.type === 'theory');
  $: prExams = exams.filter(e => e.type === 'practical' || !e.type);

  // Pass counts
  $: ghPass  = [...pmPf,...pmLch,...pmLnd].filter(e=>e.status==='passed').length;
  $: ifPass  = pmIf.filter(e=>e.status==='passed').length;
  $: p2Pass  = pmP2.filter(e=>e.status==='passed').length;
  $: thPass  = thExams.filter(e=>e.passed===1&&e.signed_off_at).length;
  $: prPass  = prExams.filter(e=>e.passed===1&&e.signed_off_at).length;

  const LABELS = {
    th_exam:  { fr:'Exam. théorique', en:'Theory Exam' },
    pr_exam:  { fr:'Exam. pratique',  en:'Practical Exam' },
    pf:       { fr:'Pré-vol',         en:'Pre-flight' },
    lch:      { fr:'Décollage',       en:'Launch' },
    lnd:      { fr:'Atterrissage',    en:'Landing' },
    inflight: { fr:'En vol',          en:'In-flight' },
    p2:       { fr:'P2',              en:'P2' },
    passed:   { fr:'Réussi',          en:'Passed' },
    pending:  { fr:'En attente',      en:'Pending' },
    none:     { fr:'Non tenté',       en:'Not tried' },
  };
  $: lbl = k => L ? LABELS[k]?.fr : LABELS[k]?.en;
</script>

<div class="pm-wrap">
  <div class="pm-title">{L ? 'CARTE DE PROGRESSION' : 'PROGRESS MAP'}</div>

  <!-- Theory exams (2) -->
  {#if thExams.length}
  <div class="pm-row">
    <span class="pm-sub xs" style="color:var(--teal)">{lbl('th_exam')}</span>
    <div class="pm-dots">
      {#each thExams as ex}
        {@const s = examDot(ex)}
        <div class="pmd pmd-{s}" title={ex.title || ex.exam_title || ''}></div>
      {/each}
    </div>
    <span class="pm-stat mono xs">{thPass}/{thExams.length}</span>
  </div>
  {/if}

  <!-- Practical exams (5) -->
  {#if prExams.length}
  <div class="pm-row">
    <span class="pm-sub xs" style="color:var(--aqua)">{lbl('pr_exam')}</span>
    <div class="pm-dots">
      {#each prExams as ex}
        {@const s = examDot(ex)}
        <div class="pmd pmd-{s}" title={ex.title || ex.exam_title || ''}></div>
      {/each}
    </div>
    <span class="pm-stat mono xs">{prPass}/{prExams.length}</span>
  </div>
  {/if}

  <!-- Ground: Pre-flight -->
  {#if pmPf.length}
  <div class="pm-row">
    <span class="pm-sub xs">{lbl('pf')}</span>
    <div class="pm-dots">
      {#each pmPf as ex}
        {@const s = dotStatus(ex)}
        {@const n = (ex.title||ex.exercise_title||'').match(/#(\d+)/)?.[1]}
        <div class="pmd pmd-{s}" title={ex.title||ex.exercise_title||''}>
          {#if s !== 'p' && n}<span class="pmd-num">{n}</span>{/if}
        </div>
      {/each}
    </div>
    <span class="pm-stat mono xs">{pmPf.filter(e=>e.status==='passed').length}/{pmPf.length}</span>
  </div>
  {/if}

  <!-- Ground: Launch -->
  {#if pmLch.length}
  <div class="pm-row">
    <span class="pm-sub xs">{lbl('lch')}</span>
    <div class="pm-dots">
      {#each pmLch as ex}
        {@const s = dotStatus(ex)}
        {@const n = (ex.title||ex.exercise_title||'').match(/#(\d+)/)?.[1]}
        <div class="pmd pmd-{s}" title={ex.title||ex.exercise_title||''}>
          {#if s !== 'p' && n}<span class="pmd-num">{n}</span>{/if}
        </div>
      {/each}
    </div>
    <span class="pm-stat mono xs">{pmLch.filter(e=>e.status==='passed').length}/{pmLch.length}</span>
  </div>
  {/if}

  <!-- Ground: Landing -->
  {#if pmLnd.length}
  <div class="pm-row">
    <span class="pm-sub xs">{lbl('lnd')}</span>
    <div class="pm-dots">
      {#each pmLnd as ex}
        {@const s = dotStatus(ex)}
        {@const n = (ex.title||ex.exercise_title||'').match(/#(\d+)/)?.[1]}
        <div class="pmd pmd-{s}" title={ex.title||ex.exercise_title||''}>
          {#if s !== 'p' && n}<span class="pmd-num">{n}</span>{/if}
        </div>
      {/each}
    </div>
    <span class="pm-stat mono xs">{pmLnd.filter(e=>e.status==='passed').length}/{pmLnd.length}</span>
  </div>
  {/if}

  <!-- In-flight -->
  {#if pmIf.length}
  <div class="pm-row">
    <span class="pm-sub xs">{lbl('inflight')}</span>
    <div class="pm-dots">
      {#each pmIf as ex}
        {@const s = dotStatus(ex)}
        {@const n = (ex.title||ex.exercise_title||'').match(/#(\d+)/)?.[1]}
        <div class="pmd pmd-{s}" title={ex.title||ex.exercise_title||''}>
          {#if s !== 'p' && n}<span class="pmd-num">{n}</span>{/if}
        </div>
      {/each}
    </div>
    <span class="pm-stat mono xs">{ifPass}/{pmIf.length}</span>
  </div>
  {/if}

  <!-- P2 -->
  {#if pmP2.length}
  <div class="pm-row">
    <span class="pm-sub xs" style="color:var(--aqua)">{lbl('p2')}</span>
    <div class="pm-dots">
      {#each pmP2 as ex, i}
        {@const s = dotStatus(ex)}
        <div class="pmd pmd-{s}" title={ex.title||ex.exercise_title||''}>
          {#if s !== 'p'}<span class="pmd-num">{i+1}</span>{/if}
        </div>
      {/each}
    </div>
    <span class="pm-stat mono xs">{p2Pass}/{pmP2.length}</span>
  </div>
  {/if}

  <!-- Legend -->
  <div class="pm-legend">
    <span class="pmd pmd-p"></span><span class="xs">{lbl('passed')}</span>
    <span class="pmd pmd-w"></span><span class="xs">{lbl('pending')}</span>
    <span class="pmd pmd-n"></span><span class="xs dimmed">{lbl('none')}</span>
  </div>
</div>

<style>
  .pm-wrap{display:flex;flex-direction:column;gap:.35rem}
  .pm-title{font-family:var(--ff-head);font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--txt-3);margin-bottom:.25rem}
  .pm-row{display:flex;align-items:center;gap:.5rem;min-height:1.4rem}
  .pm-sub{flex-shrink:0;width:72px;color:var(--txt-3);font-weight:600;text-align:right;font-size:.68rem}
  .pm-dots{display:flex;flex-wrap:wrap;gap:3px;flex:1}
  .pm-stat{color:var(--txt-3);flex-shrink:0;min-width:36px;text-align:right;font-size:.68rem}
  /* Dots */
  .pmd{width:14px;height:14px;border-radius:50%;position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:center}
  .pmd-p{background:var(--green)}
  .pmd-w{background:var(--amber)}
  .pmd-f{background:var(--red)}
  .pmd-n{background:var(--bg-2);border:1.5px solid var(--border)}
  .pmd-num{font-size:.5rem;font-weight:700;color:rgba(0,0,0,.6);line-height:1;position:absolute}
  .pmd-n .pmd-num{color:var(--txt-3)}
  .pm-legend{display:flex;align-items:center;gap:.5rem;margin-top:.25rem;flex-wrap:wrap}
  .xs{font-size:.75rem}
  .dimmed{color:var(--txt-3)}
  .mono{font-family:var(--ff-head)}
</style>
