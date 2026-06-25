<script>
  import { lang } from '$lib/stores/lang.js';
  import QuizEngine from '$lib/components/QuizEngine.svelte';
  export let data;
  $: L = $lang === 'fr';

  let selectedItem = null;
  let showQuiz     = false;

  function openPDF(item) { selectedItem = item; }
  function closePDF()    { selectedItem = null; }
  function dlUrl(u) {
    return u.includes('/api/file') ? u + (u.includes('?') ? '&' : '?') + 'dl=1' : u;
  }
</script>

<svelte:head><title>{L ? 'Étude' : 'Study'} — Summit</title></svelte:head>

{#if selectedItem}
<!-- ══ PDF VIEWER (iframe) ══════════════════════════════════════ -->
<div class="pdf-overlay">
  <div class="pdf-bar">
    <button class="pdf-btn" on:click={closePDF}>← {L ? 'Retour' : 'Back'}</button>
    <span class="pdf-name">{selectedItem.title}</span>
    <a class="pdf-btn" href={selectedItem.file_url} target="_blank" rel="noopener">{L ? 'Plein écran' : 'Full screen'} ↗</a>
    <a class="pdf-btn" href={dlUrl(selectedItem.file_url)} download={selectedItem.title + '.pdf'}>↓</a>
  </div>
  <iframe src={selectedItem.file_url} title={selectedItem.title} class="pdf-frame" allow="fullscreen"></iframe>
  <a class="pdf-hint" href={selectedItem.file_url} target="_blank" rel="noopener">
    {L ? 'Le document ne s\'affiche pas ? Touchez ici pour l\'ouvrir en plein écran.' : 'Not showing? Tap here to open it full screen.'}
  </a>
</div>

{:else if showQuiz}
<div class="quiz-wrap">
  <QuizEngine onClose={() => showQuiz = false} />
</div>

{:else}
<!-- ══ DOCUMENT LIST ══════════════════════════════════════════ -->
<h1 class="page-title">{L ? 'Étude' : 'Study'}</h1>

<div class="section-label">{L ? 'Documents' : 'Documents'}</div>
{#if data.libraryItems?.length}
<div class="lib-list">
  {#each data.libraryItems as item}
  <button class="lib-item" on:click={() => openPDF(item)}>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      stroke-width="1.6" style="flex-shrink:0;color:var(--teal)">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
    <div style="flex:1;min-width:0">
      <div class="lib-title">{item.title}</div>
      {#if item.description}
      <div class="xs muted">{item.description}</div>
      {/if}
    </div>
    <span style="color:var(--teal);font-size:1.1rem;flex-shrink:0">→</span>
  </button>
  {/each}
</div>
{:else}
<p class="xs muted">{L ? 'Aucun document disponible.' : 'No documents available.'}</p>
{/if}

<div class="section-label" style="margin-top:1.5rem">Quiz</div>
<button class="quiz-launch" on:click={() => showQuiz = true}>
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
    stroke-width="1.6" style="flex-shrink:0;color:var(--teal)">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
  <div>
    <div style="font-weight:600;font-size:.9rem;color:var(--txt)">
      {L ? 'Démarrer un quiz' : 'Start a quiz'}
    </div>
    <div class="xs muted">
      {data.quizCount || 233} {L ? 'questions — 7 catégories' : 'questions — 7 categories'}
    </div>
  </div>
  <span style="color:var(--teal);font-size:1.2rem;flex-shrink:0">→</span>
</button>
{/if}

<style>
  .page-title{font-family:var(--ff-head);font-size:1.15rem;font-weight:700;color:var(--txt);margin-bottom:.75rem}
  .section-label{font-family:var(--ff-head);font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--txt-3);margin-bottom:.4rem}
  .xs{font-size:.75rem} .muted{color:var(--txt-3)}
  /* PDF overlay — covers everything including bottom nav */
  .pdf-overlay{position:fixed;inset:0;z-index:500;background:#1a1a2e;display:flex;flex-direction:column}
  .pdf-bar{display:flex;align-items:center;gap:.5rem;padding:.5rem .6rem;background:#0d0d1a;border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0}
  .pdf-btn{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#e2e8f0;text-decoration:none;cursor:pointer;padding:.4rem .7rem;font-size:.82rem;white-space:nowrap;font-family:inherit}
  .pdf-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbd5e1;font-size:.85rem;font-weight:600}
  .pdf-frame{flex:1;width:100%;border:none;display:block;background:#525659}
  .pdf-hint{display:block;text-align:center;padding:.4rem;background:#0d0d1a;color:#00e8c6;font-size:.72rem;text-decoration:none;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0}
  /* Document list */
  .lib-list{display:flex;flex-direction:column;gap:.4rem}
  .lib-item{display:flex;align-items:center;gap:.625rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:.625rem .875rem;cursor:pointer;text-align:left;width:100%;transition:border-color .15s}
  .lib-item:hover{border-color:var(--teal-border)}
  .lib-title{font-family:var(--ff-head);font-weight:600;font-size:.9rem;color:var(--txt)}
  /* Quiz launch */
  .quiz-launch{display:flex;align-items:center;gap:.75rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:.75rem .875rem;cursor:pointer;text-align:left;width:100%;transition:border-color .15s}
  .quiz-launch:hover{border-color:var(--teal-border)}
  .quiz-wrap{padding:.25rem 0}
</style>
