<script>
  import { lang } from '$lib/stores/lang.js';
  export let onClose = () => {};
  $: L = $lang === 'fr';

  let phase    = 'setup';
  let count    = 20;
  let category = 'all';
  let questions = [];
  let answers  = {};   // { [idx]: 'a'|'b'|'c'|'d' }
  let idx      = 0;
  let loading  = false;
  let available = null; // how many Qs available for chosen category

  $: currentQ = questions[idx];
  $: opts = currentQ ? [
    { key:'a', text: L ? currentQ.opt_a_fr : (currentQ.opt_a_en||currentQ.opt_a_fr) },
    { key:'b', text: L ? currentQ.opt_b_fr : (currentQ.opt_b_en||currentQ.opt_b_fr) },
    { key:'c', text: L ? currentQ.opt_c_fr : (currentQ.opt_c_en||currentQ.opt_c_fr) },
    { key:'d', text: L ? currentQ.opt_d_fr : (currentQ.opt_d_en||currentQ.opt_d_fr) },
  ].filter(o => o.text) : [];
  $: picked  = answers[idx] ?? null;
  $: isLast  = idx === questions.length - 1;

  // Only compute score at end (never during quiz)
  $: score    = phase === 'done' ? Object.entries(answers).filter(([i,a]) => questions[+i]?.correct === a).length : 0;
  $: wrongs   = phase === 'done' ? questions.filter((_,i) => answers[i] && answers[i] !== questions[i].correct) : [];
  $: pct      = questions.length ? Math.round(score/questions.length*100) : 0;

  // Category question count preview
  async function previewCount(cat) {
    try {
      const url = cat === 'all' ? '/api/quiz-questions' : `/api/quiz-questions?category=${encodeURIComponent(cat)}`;
      const res = await fetch(url);
      const all = await res.json();
      available = all.length;
    } catch(e) { available = null; }
  }

  $: if (phase === 'setup') previewCount(category);

  async function startQuiz() {
    loading = true;
    try {
      const url = category === 'all' ? '/api/quiz-questions' : `/api/quiz-questions?category=${encodeURIComponent(category)}`;
      const res  = await fetch(url);
      let all    = await res.json();
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      const n = count === 'all' ? all.length : Math.min(Number(count), all.length);
      questions = all.slice(0, n);
    } catch(e) { questions = []; }
    answers = {}; idx = 0; phase = 'quiz'; loading = false;
  }

  function pick(key) { answers = { ...answers, [idx]: key }; }
  function prev()    { if (idx > 0) idx--; }
  function next()    { if (isLast) phase = 'done'; else idx++; }
  function restart() { phase = 'setup'; questions = []; answers = {}; idx = 0; }

  const CATS = [
    { value:'all',            fr:'Tout',           en:'All' },
    { value:'météo',          fr:'Météo',           en:'Weather' },
    { value:'aérodynamique',  fr:'Aérodynamique',   en:'Aerodynamics' },
    { value:'matériel',       fr:'Matériel',         en:'Equipment' },
    { value:'réglementation', fr:'Réglementation',  en:'Regulations' },
    { value:'technique',      fr:'Technique',        en:'Technique' },
    { value:'sécurité',       fr:'Sécurité',         en:'Safety' },
    { value:'environnement',  fr:'Environnement',    en:'Environment' },
  ];
</script>

{#if phase === 'setup'}
<div class="qe-wrap">
  <div class="qe-header">
    <span class="qe-title">Quiz</span>
    <button class="qe-close" on:click={onClose}>✕</button>
  </div>

  <div class="setup-group">
    <div class="setup-label">{L?'Catégorie :':'Category:'}</div>
    <div class="cat-grid">
      {#each CATS as c}
      <button class="cat-chip" class:sel={category===c.value} on:click={() => category=c.value}>
        {L ? c.fr : c.en}
      </button>
      {/each}
    </div>
  </div>

  <div class="setup-group">
    <div class="setup-label">
      {L?'Nombre de questions :':'Questions:'}
      {#if available !== null}
      <span class="avail-note xs muted">({available} {L?'disponibles':'available'})</span>
      {/if}
    </div>
    <div class="count-row">
      {#each [20, 40, 'all'] as c}
      <button class="count-btn" class:sel={count===c} on:click={() => count=c}>
        {c === 'all' ? (L?'Toutes':'All') : c}
      </button>
      {/each}
    </div>
  </div>

  <button class="qe-start" disabled={loading} on:click={startQuiz}>
    {loading ? (L?'Chargement…':'Loading…') : (L?'Commencer':'Start')}
  </button>
</div>

{:else if phase === 'quiz' && currentQ}
<div class="qe-wrap">
  <div class="qe-header">
    <button class="qe-back-btn" on:click={() => phase='setup'}>← {L?'Quitter':'Quit'}</button>
    <span class="qe-prog">{idx+1} / {questions.length}</span>
    <span style="width:32px"></span>
  </div>

  <div class="qe-progress-bar">
    <div class="qe-progress-fill" style="width:{(idx+1)/questions.length*100}%"></div>
  </div>

  <div class="qe-question">
    {L ? currentQ.question_fr : (currentQ.question_en || currentQ.question_fr)}
  </div>

  <div class="qe-opts">
    {#each opts as o}
    <button class="qe-opt" class:picked={picked === o.key} on:click={() => pick(o.key)}>
      <span class="qe-key">{o.key.toUpperCase()}</span>
      <span class="qe-val">{o.text}</span>
    </button>
    {/each}
  </div>

  <div class="qe-nav">
    <button class="qe-nav-btn" on:click={prev} disabled={idx === 0}>← {L?'Précédent':'Prev'}</button>
    <button class="qe-nav-btn primary" on:click={next}>
      {isLast ? (L?'Terminer':'Finish') : (L?'Suivant':'Next')} →
    </button>
  </div>
</div>

{:else if phase === 'done'}
<div class="qe-wrap">
  <div class="qe-header">
    <span class="qe-title">{L?'Résultats':'Results'}</span>
    <button class="qe-close" on:click={onClose}>✕</button>
  </div>

  <div class="res-score-block">
    <div class="res-score">{score}<span class="res-total">/{questions.length}</span></div>
    <div class="res-pct" style="color:{pct>=80?'#16a34a':pct>=60?'#eab308':'#dc2626'}">{pct}%</div>
    <div class="res-msg xs muted">
      {pct>=80?(L?'Excellent!':'Excellent!'):pct>=60?(L?'Bon travail':'Good job'):(L?'Continuez à étudier':'Keep studying')}
    </div>
  </div>

  {#if wrongs.length}
  <div class="res-wrongs-title xs" style="font-weight:700;color:var(--txt-2);margin:.25rem 0">
    {L ? `À revoir (${wrongs.length}) :` : `Review (${wrongs.length}):`}
  </div>
  <div class="res-wrongs">
    {#each wrongs as q, i}
    {@const userAns = answers[questions.indexOf(q)]}
    <div class="res-wrong-item">
      <div class="rwq">{L ? q.question_fr : (q.question_en||q.question_fr)}</div>
      <div class="rwa">
        <span class="rwa-wrong">✗ {L ? q[`opt_${userAns}_fr`] : (q[`opt_${userAns}_en`]||q[`opt_${userAns}_fr`])}</span>
        <span class="rwa-correct">✓ {L ? q[`opt_${q.correct}_fr`] : (q[`opt_${q.correct}_en`]||q[`opt_${q.correct}_fr`])}</span>
      </div>
    </div>
    {/each}
  </div>
  {:else}
  <div class="xs" style="color:#16a34a;text-align:center;padding:.5rem">
    {L?'Parfait — aucune erreur!':'Perfect — no mistakes!'}
  </div>
  {/if}

  <div class="qe-nav">
    <button class="qe-nav-btn" on:click={restart}>{L?'Nouveau quiz':'New quiz'}</button>
    <button class="qe-nav-btn primary" on:click={onClose}>{L?'Fermer':'Close'}</button>
  </div>
</div>
{/if}

<style>
  .qe-wrap{display:flex;flex-direction:column;gap:.75rem;padding:.25rem 0}
  .qe-header{font-family:var(--ff-head);display:flex;align-items:center;justify-content:space-between;gap:.5rem}
  .qe-title{font-family:var(--ff-head);font-weight:700;font-size:1rem;color:var(--txt)}
  .qe-close{background:none;border:none;font-size:1.1rem;color:var(--txt-3);cursor:pointer;padding:.25rem}
  .qe-back-btn{background:none;border:none;font-size:.8rem;color:var(--txt-3);cursor:pointer;padding:.2rem 0}
  .qe-prog{font-size:.82rem;color:var(--txt-2);text-align:center}
  .qe-progress-bar{height:3px;background:var(--border);border-radius:99px;overflow:hidden}
  .qe-progress-fill{height:100%;background:var(--teal);border-radius:99px;transition:width .3s}
  .qe-question{font-size:.95rem;font-weight:600;color:var(--txt);line-height:1.5;padding:.75rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:10px}
  .qe-opts{display:flex;flex-direction:column;gap:.35rem}
  .qe-opt{display:flex;align-items:flex-start;gap:.6rem;padding:.6rem .75rem;border-radius:9px;border:1.5px solid var(--border);background:var(--bg-raised);cursor:pointer;text-align:left;transition:border-color .15s;width:100%}
  .qe-opt:hover{border-color:var(--teal-border)}
  .qe-opt.picked{border-color:var(--teal);background:rgba(0,184,122,.07)}
  .qe-key{flex-shrink:0;background:var(--bg-2);border-radius:4px;padding:.1rem .35rem;font-family:monospace;font-size:.72rem;font-weight:700;color:var(--txt-3);margin-top:.1rem}
  .qe-val{font-size:.88rem;color:var(--txt);line-height:1.4;text-align:left}
  .qe-nav{display:flex;gap:.5rem;margin-top:.25rem}
  .qe-nav-btn{flex:1;padding:.6rem;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--txt);font-size:.85rem;cursor:pointer;transition:all .15s}
  .qe-nav-btn:disabled{opacity:.4;cursor:not-allowed}
  .qe-nav-btn.primary{background:var(--teal);border-color:var(--teal);color:#fff;font-weight:600}
  .setup-group{display:flex;flex-direction:column;gap:.4rem}
  .setup-label{font-family:var(--ff-head);font-size:.78rem;font-weight:600;color:var(--txt-2);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:.4rem}
  .cat-grid{display:flex;flex-wrap:wrap;gap:.3rem}
  .cat-chip{padding:.28rem .6rem;border-radius:16px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--txt-2);font-size:.75rem;cursor:pointer;transition:all .15s}
  .cat-chip.sel{border-color:var(--teal);background:rgba(0,184,122,.1);color:var(--teal);font-weight:700}
  .count-row{display:flex;gap:.35rem}
  .count-btn{flex:1;padding:.5rem;border-radius:7px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--txt);font-size:.88rem;cursor:pointer;transition:all .15s}
  .count-btn.sel{border-color:var(--teal);background:rgba(0,184,122,.1);color:var(--teal);font-weight:700}
  .avail-note{font-weight:400}
  .qe-start{padding:.7rem;border-radius:9px;background:var(--teal);border:none;color:#fff;font-size:.95rem;font-weight:700;cursor:pointer;transition:opacity .15s}
  .qe-start:disabled{opacity:.5;cursor:not-allowed}
  /* Results */
  .res-score-block{text-align:center;padding:.5rem 0}
  .res-score{font-size:3.5rem;font-weight:800;color:var(--teal);line-height:1;font-family:monospace}
  .res-total{font-size:1.8rem;color:var(--txt-3)}
  .res-pct{font-size:1.2rem;font-weight:700}
  .res-msg{margin-top:.2rem}
  .res-wrongs{display:flex;flex-direction:column;gap:.5rem;max-height:50vh;overflow-y:auto}
  .res-wrong-item{background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:.5rem .625rem}
  .rwq{font-size:.82rem;color:var(--txt);margin-bottom:.3rem;line-height:1.4}
  .rwa{display:flex;flex-direction:column;gap:.15rem}
  .rwa-wrong{font-size:.78rem;color:#dc2626}
  .rwa-correct{font-size:.78rem;color:#16a34a}
  .xs{font-size:.75rem} .muted{color:var(--txt-3)}
</style>
