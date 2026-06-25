<script>
 import { enhance } from '$app/forms';
 import Icon from '$lib/components/Icon.svelte';
 import ProgressMap from '$lib/components/ProgressMap.svelte';
 import { lang } from '$lib/stores/lang.js';
 export let data, form;
 $: ({ logs, practicalExams, examDefs, progressMap, student } = data);

 let activeTab = 'ground';
 let loggingEx    = null;
  let editingNotes = null;   // exercise id whose notes form is open
  let expandedEx   = null;   // exercise id whose card is currently expanded
 const loc = (obj, field) => ($lang==='fr' && obj[field+'_fr']) ? obj[field+'_fr'] : obj[field];

 // ── Subcategory grouping ────────────────────────────────────
 // Ground: Pre-flight(#1–10), Launch(#11–18)
 // Air: In-flight(19-37), Landing(38-42), P2
 const SUB = {
 'pf': { en:'Pre-flight (#1–10)', fr:'Pré-vol (#1–10)' },
 'lch': { en:'Launch (#11–18)', fr:'Décollage (#11–18)' },
 'if': { en:'In-flight (#19–37)', fr:'En vol (#19–37)' },
 'lnd': { en:'Landing / Post-flight (#38–42)',fr:'Atterrissage (#38–42)' },
 'p2': { en:'P2 Skills', fr:'Compétences P2' },
 };

 function subcat(title) {
 const t = title.toLowerCase();
 if (t.startsWith('p2-') || t.includes(' p2-') || t.includes('p2 —') || t.includes('p2 -')) return 'p2';
 const num = parseInt(title.match(/#(\d+)/)?.[1]);
 if (!isNaN(num)) {
 if (num >= 1 && num <= 10) return 'pf';
 if (num >= 11 && num <= 18) return 'lch';
 if (num >= 19 && num <= 37) return 'if';
 if (num >= 38 && num <= 42) return 'lnd';
 }
 return 'if';
 }

 // Ground = ground_handling (#1-18) + landing (#38-42) = 23
 // In-flight = airborne #19-37 = 19
 // P2 = airborne P2 = 15
 $: ghLogs  = logs.filter(l => l.category === 'ground_handling' || (l.category === 'airborne' && subcat(l.exercise_title) === 'lnd'));
 $: ifLogs  = logs.filter(l => l.category === 'airborne' && subcat(l.exercise_title) === 'if');
 $: p2Logs  = logs.filter(l => l.category === 'airborne' && subcat(l.exercise_title) === 'p2');
 $: ghPassed = ghLogs.filter(l => l.status === 'passed').length;
 $: ifPassed = ifLogs.filter(l => l.status === 'passed').length;
 $: p2Passed = p2Logs.filter(l => l.status === 'passed').length;

 // Ground subcategories: Pre-flight, Launch, Landing
 $: ghGroups = [
   { key:'pf',  list: ghLogs.filter(l => subcat(l.exercise_title) === 'pf') },
   { key:'lch', list: ghLogs.filter(l => subcat(l.exercise_title) === 'lch') },
   { key:'lnd', list: ghLogs.filter(l => subcat(l.exercise_title) === 'lnd') },
 ].filter(g => g.list.length);

 // In-flight group
 $: ifGroups = [{ key:'if', list: ifLogs }].filter(g => g.list.length);

 // P2 group
 $: p2Groups = [{ key:'p2', list: p2Logs }].filter(g => g.list.length);

 $: groups = activeTab === 'ground' ? ghGroups : activeTab === 'inflight' ? ifGroups : p2Groups;

 // Collapse state per subcat
 let collapsed = { pf:false, lch:false, lnd:false, if:false, p2:false };

 // Progress map data — passed to shared ProgressMap component
 $: pmEx   = progressMap?.exercises || [];
 $: pmExams = progressMap?.exams || [];

 function dotStatus(ex) {
 if (ex.status === 'passed') return 'p';
 if (ex.status === 'pending') return 'w';
 return 'n';
 }
 function examDotStatus(ex) {
 if (ex.passed===1 && ex.signed_off_at) return 'p';
 if (ex.signed_off_at) return 'f';
 if (ex.id) return 'w';
 return 'n';
 }

 function bestAttempt(examId) {
 const list = practicalExams.filter(e => e.exam_id === examId);
 return list.find(a => a.passed===1) || list.find(a => a.signed_off_at) || list[0] || null;
 }

 function subLabel(key) {
 return $lang === 'fr' ? SUB[key].fr : SUB[key].en;
 }

 $: L = $lang === 'fr';
</script>

<svelte:head><title>{L?'Exercices':'Exercises'} — Summit</title></svelte:head>

<!-- ── Progress map ───────────────────────────────────────── -->
<div class="card card-sm">
  <ProgressMap exercises={pmEx} exams={pmExams} lang={$lang} />
</div>

<h1 style="font-size:1.25rem;margin:.75rem 0 .5rem">{L?'Exercices':'Exercises'}</h1>

<div class="tabs-wrap">
<div class="tabs ex-tabs">
 <button class="tab ex-tab" class:active={activeTab==='ground'} on:click={()=>activeTab='ground'}>
   {L?'Sol':'Ground'} <span class="tc mono xs">{ghPassed}/23</span>
 </button>
 <button class="tab ex-tab" class:active={activeTab==='inflight'} on:click={()=>activeTab='inflight'}>
   {L?'En vol':'In-flight'} <span class="tc mono xs">{ifPassed}/19</span>
 </button>
 <button class="tab ex-tab" class:active={activeTab==='p2'} on:click={()=>activeTab='p2'}>
   P2 <span class="tc mono xs">{p2Passed}/15</span>
 </button>
 <button class="tab ex-tab" class:active={activeTab==='practical'} on:click={()=>activeTab='practical'}>
   {L?'Examens':'Exams'}
 </button>
</div>
<!-- Right-edge fade hints at more tabs to scroll to -->
<div class="tabs-fade"></div>
</div>

{#if form?.ok}
 <div class="alert alert-info" style="margin-bottom:.75rem">
 <Icon name="clock" size={14} />
 {L?'Soumis — en attente de validation':'Submitted — awaiting sign-off'}
 </div>
{/if}
{#if form?.err}
 <div class="alert alert-err" style="margin-bottom:.75rem">
 <Icon name="flag" size={14} />
 {form.err}
 </div>
{/if}

<!-- ── Ground / Air ────────────────────────────────────────── -->
{#if activeTab !== 'practical'}
 {#if groups.length === 0}
 <div class="empty card"><div class="empty-icon"><Icon name="checklist" size={36} color="var(--teal)" /></div><strong>{L?'Aucun exercice':'No exercises'}</strong></div>
 {:else}
 {#each groups as grp}
 {@const passed = grp.list.filter(e=>e.status==='passed').length}
 {@const pending = grp.list.filter(e=>e.status==='pending').length}
 <div class="subcat-block">
 <!-- Subcategory header -->
 <button type="button" class="subcat-hdr" on:click={()=>collapsed[grp.key]=!collapsed[grp.key]}>
 <div class="sh-left">
 <span class="sh-label">{subLabel(grp.key)}</span>
 <!-- Mini progress bar -->
 <div class="sh-bar">
 <div class="sh-fill pass" style="width:{grp.list.length?passed/grp.list.length*100:0}%"></div>
 <div class="sh-fill pend" style="width:{grp.list.length?pending/grp.list.length*100:0}%;margin-left:{grp.list.length?passed/grp.list.length*100:0}%"></div>
 </div>
 </div>
 <div class="sh-right">
 {#if pending > 0}<span class="badge-pend-sm">{pending}</span>{/if}
 <span class="sh-count mono xs dimmed">{passed}/{grp.list.length}</span>
 <Icon name={collapsed[grp.key]?'chevrondown':'chevronup'} size={14} color="var(--txt-3)" />
 </div>
 </button>

 {#if !collapsed[grp.key]}
 <div class="ex-list">
 {#each grp.list as ex}
 {@const exId = ex.ex_id}
 {@const status = ex.status || 'not_started'}
 {@const isPassed = status === 'passed'}
 {@const isPending = status === 'pending'}
 <div class="ex-card" class:is-passed={isPassed} class:is-pending={isPending}>
 <button class="ex-top ex-top-btn" type="button"
   on:click={() => expandedEx = (expandedEx === exId ? null : exId)}>
 <div class="ex-indicator">
 {#if isPassed}
 <div class="ind-pass"><Icon name="check" size={12} color="#fff" /></div>
 {:else if isPending}
 <div class="ind-pend"><Icon name="clock" size={12} color="var(--txt-inv)" /></div>
 {:else}
 <div class="ind-empty"></div>
 {/if}
 </div>
 <div class="ex-body">
 <div class="ex-title" class:dimmed-done={isPassed}>{loc(ex,'exercise_title')}</div>
 </div>
 {#if isPassed}
 <span class="badge-ex pass"></span>
 {:else if isPending}
 <span class="badge-ex pend">{L?'En attente':'Pending'}</span>
 {/if}
 <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"
   style="flex-shrink:0;color:var(--txt-3);margin-left:.25rem;transition:transform .2s;transform:rotate({expandedEx===exId?180:0}deg)">
 <polyline points="6 9 12 15 18 9"/>
 </svg>
 </button>

 {#if expandedEx === exId}
 <div class="ex-expanded">
 {#if loc(ex,'exercise_desc')}
 <div class="ex-desc xs dimmed">{loc(ex,'exercise_desc')}</div>
 {/if}
 {#if ex.instructor_notes}
 <div class="ex-note">
 <Icon name="note" size={12} color="var(--teal)" />
 <span class="xs">{ex.instructor_name||'Instructeur'}: <em>{ex.instructor_notes}</em></span>
 </div>
 {/if}
 {#if ex.attempt_notes && isPassed}
 <div class="ex-note" style="border-left-color:var(--txt-3)">
 <Icon name="note" size={12} color="var(--txt-2)" />
 <span class="xs">{L?'Mes notes':'My notes'}: <em>{ex.attempt_notes}</em></span>
 </div>
 {/if}

 {#if isPassed}
 {#if ex.signed_off_at}
 <div class="xs muted" style="margin-top:.25rem">
 <Icon name="check" size={11} color="var(--teal)" />
 {L?'Réussi le':'Passed on'} {ex.signed_off_at.slice(0,10)}
 {#if ex.instructor_name}— {ex.instructor_name}{/if}
 </div>
 {/if}
 {#if editingNotes === exId}
 <form method="POST" action="?/updateAttemptNotes" use:enhance
   on:submit={()=>editingNotes=null} class="log-form">
 <input type="hidden" name="exercise_id" value={exId} />
 <div class="form-group">
 <label>{L?'Mes notes sur cet exercice':'My notes on this exercise'}</label>
 <textarea name="attempt_notes" rows="2">{ex.attempt_notes || ''}</textarea>
 </div>
 <div style="display:flex;gap:.5rem">
 <button type="submit" class="btn btn-primary btn-sm">
 <Icon name="check" size={13} />{L?'Enregistrer':'Save'}
 </button>
 <button type="button" class="btn btn-ghost btn-sm" on:click={()=>editingNotes=null}>
 {L?'Annuler':'Cancel'}
 </button>
 </div>
 </form>
 {:else}
 <button class="log-btn-sm" on:click={()=>editingNotes=exId}>
 <Icon name="edit" size={13} />{ex.attempt_notes ? (L?'Modifier mes notes':'Edit my notes') : (L?'+ Ajouter une note':'+ Add a note')}
 </button>
 {/if}
 {:else if isPending}
 <div class="pend-note xs dimmed">
 <Icon name="clock" size={11} />{L?'En attente de validation par l\'instructeur':'Awaiting instructor validation'}
 </div>
 {:else if loggingEx === exId}
 <form method="POST" action="?/logAttempt" use:enhance
 on:submit={()=>loggingEx=null} class="log-form">
 <input type="hidden" name="exercise_id" value={exId} />
 <div class="form-group">
 <label>{L?'Notes sur cette tentative':'Notes about this attempt'}</label>
 <textarea name="attempt_notes" rows="2"
 placeholder="{L?'Comment ça s\'est passé?':'How did it go?'}"></textarea>
 </div>
 <div style="display:flex;gap:.5rem">
 <button type="submit" class="btn btn-primary btn-sm">
 <Icon name="check" size={13} />{L?'Soumettre':'Submit'}
 </button>
 <button type="button" class="btn btn-ghost btn-sm" on:click={()=>loggingEx=null}>
 {L?'Annuler':'Cancel'}
 </button>
 </div>
 </form>
 {:else}
 <button class="log-btn-sm" on:click={()=>loggingEx=exId}>
 <Icon name="plus" size={13} />{L?'+ Enregistrer tentative':'+ Log Attempt'}
 </button>
 {/if}
 </div>
 {/if}
 </div>
 {/each}
 </div>
 {/if}
 </div>
 {/each}
 {/if}
{/if}

<!-- ── Practical exams ─────────────────────────────────────── -->
{#if activeTab === 'practical'}
 {#if examDefs.length === 0}
 <div class="empty card"><div class="empty-icon"><Icon name="award" size={36} color="var(--teal)" /></div><strong>{L?'Aucun examen pratique':'No practical exams'}</strong></div>
 {:else}
 {#each examDefs as exam}
 {@const attempt = bestAttempt(exam.id)}
 {@const isPassed = attempt?.passed===1 && attempt?.signed_off_at}
 <div class="ex-card" class:is-passed={isPassed}>
 <div class="ex-top">
 <div class="ex-indicator">
 {#if isPassed}<div class="ind-pass"><Icon name="check" size={12} color="#fff" /></div>
 {:else if attempt}<div class="ind-pend"><Icon name="clock" size={12} color="var(--txt-inv)" /></div>
 {:else}<div class="ind-empty"></div>{/if}
 </div>
 <div class="ex-body">
 <div class="ex-title" class:dimmed-done={isPassed}>{$lang==='fr'&&exam.title_fr?exam.title_fr:exam.title}</div>
 {#if !isPassed && exam.description}
 <p class="xs dimmed" style="margin-top:.2rem">{$lang==='fr'&&exam.description_fr?exam.description_fr:exam.description}</p>
 {/if}
 {#if attempt?.score_pct != null}
 <div style="margin-top:.35rem">
 <span class="mono" style="color:{attempt.score_pct>=60?'var(--green)':'var(--red)'};font-size:1.2rem">{attempt.score_pct}%</span>
 </div>
 {/if}
 {#if attempt?.instructor_notes && !isPassed}
 <div class="ex-note"><Icon name="note" size={12} color="var(--teal)" /><em class="xs">{attempt.instructor_notes}</em></div>
 {/if}
 </div>
 {#if isPassed}
 <span class="badge-ex pass"> {L?'Réussi':'Passed'}</span>
 {:else if attempt?.passed===0}
 <span class="badge-ex fail">{L?'Non réussi':'Failed'}</span>
 {:else if attempt}
 <span class="badge-ex pend">{L?'En attente':'Pending'}</span>
 {:else}
 <span class="badge-ex none">{L?'Pas tenté':'Not tried'}</span>
 {/if}
 </div>
 {#if !attempt || attempt.passed===0}
 <form method="POST" action="?/submitPractical" use:enhance class="log-form">
 <input type="hidden" name="exam_id" value={exam.id} />
 <div class="form-group">
 <label>{L?'Vos notes':'Your notes'}</label>
 <textarea name="student_notes" rows="2"
 placeholder="{L?'Comment ça s\'est passé?':'How did it go?'}"></textarea>
 </div>
 <button type="submit" class="btn btn-primary btn-sm">
 <Icon name="share" size={13} />{L?'Soumettre la tentative':'Submit Attempt'}
 </button>
 </form>
 {/if}
 </div>
 {/each}
 {/if}
{/if}

<style>
 /* Progress map */
 .pmap{margin-bottom:.875rem}
 .pmap-title{font-family:var(--ff-head);font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--txt-3);margin-bottom:.75rem}
 .pmap-row{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem}
 .pmap-sub{flex-shrink:0;font-family:var(--ff-head);font-weight:700;font-size:.68rem;color:var(--txt-2);min-width:80px}
 .pmap-dots{display:flex;flex-wrap:wrap;gap:2px;flex:1}
 .pmap-stat{flex-shrink:0;color:var(--txt-3);min-width:32px;text-align:right}
 .pmap-legend{display:flex;align-items:center;gap:.5rem;margin-top:.625rem;flex-wrap:wrap}

 /* Dot squares */
 .pmd{width:15px;height:15px;border-radius:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;position:relative;transition:background .2s}
 .pmd-p{background:var(--green)}
 .pmd-w{background:var(--amber)}
 .pmd-f{background:var(--red)}
 .pmd-n{background:rgba(150,200,230,0.22);border:1px solid rgba(150,200,230,0.18)}
 .pmd-num{font-family:var(--ff-head);font-size:7px;color:rgba(180,220,255,0.65);font-weight:700;line-height:1;pointer-events:none}

 /* Tabs */
 .tc{margin-left:.3rem;color:var(--txt-3)}

 /* Subcat blocks */
 .subcat-block{margin-bottom:.5rem}
 .subcat-hdr{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;padding:.5rem 0;gap:.75rem}
 .sh-left{display:flex;align-items:center;gap:.625rem;flex:1;min-width:0}
 .sh-label{font-family:var(--ff-head);font-size:.78rem;font-weight:700;color:var(--txt-2);white-space:nowrap}
 .sh-bar{flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden;position:relative;max-width:120px}
 .sh-fill{position:absolute;top:0;height:100%;border-radius:2px;transition:width .3s}
 .sh-fill.pass{background:var(--green);left:0}
 .sh-fill.pend{background:var(--amber)}
 .sh-right{display:flex;align-items:center;gap:.5rem;flex-shrink:0}
 .sh-count{}
 .badge-pend-sm{background:var(--amber);color:var(--txt-inv);font-family:var(--ff-head);font-size:.65rem;font-weight:700;padding:.1rem .4rem;border-radius:var(--r-full);min-width:18px;text-align:center}

 /* Exercise cards */
 .ex-list{display:flex;flex-direction:column;gap:.3rem;padding-left:.5rem;border-left:2px solid var(--border);margin-left:.5rem;margin-bottom:.5rem}
 .ex-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);padding:.7rem .875rem;transition:border-color .15s}
 .ex-card.is-passed{border-color:rgba(34,197,94,.15);background:rgba(34,197,94,.02)}
  .ex-top-btn{display:flex;align-items:center;gap:.6rem;width:100%;background:none;border:none;padding:0;cursor:pointer;text-align:left}
  .ex-top-btn:hover .ex-title{color:var(--teal)}
  .ex-expanded{padding-top:.5rem;margin-top:.5rem;border-top:1px dashed var(--border);display:flex;flex-direction:column;gap:.4rem}

 .ex-card.is-pending{border-color:rgba(245,158,11,.2)}

 .ex-top{display:flex;align-items:flex-start;gap:.625rem}
 .ex-indicator{flex-shrink:0;margin-top:.15rem}
 .ind-pass{width:20px;height:20px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center}
 .ind-pend{width:20px;height:20px;border-radius:50%;background:var(--amber);display:flex;align-items:center;justify-content:center}
 .ind-empty{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border)}
 .ex-body{flex:1;min-width:0}
 .ex-title{font-weight:600;font-size:.875rem;color:var(--txt);line-height:1.35}
 /* Dimmed (not strikeout) for completed */
 .ex-title.dimmed-done{color:var(--txt-3);font-weight:400}
 .ex-desc{margin-top:.2rem}
 .ex-note{display:flex;align-items:flex-start;gap:.35rem;padding:.35rem .5rem;background:var(--teal-lo);border-radius:var(--r-xs);margin-top:.4rem;color:var(--txt-2)}

 /* Badges */
 .badge-ex{font-family:var(--ff-head);font-size:.7rem;font-weight:700;padding:.2rem .55rem;border-radius:var(--r-full);flex-shrink:0;white-space:nowrap}
 .badge-ex.pass{background:rgba(34,197,94,.15);color:var(--green);border:1px solid rgba(34,197,94,.25)}
 .badge-ex.pend{background:var(--amber-lo);color:var(--amber);border:1px solid rgba(245,158,11,.25)}
 .badge-ex.fail{background:var(--red-lo);color:var(--red);border:1px solid rgba(239,68,68,.25)}
 .badge-ex.none{background:var(--bg-raised);color:var(--txt-3);border:1px solid var(--border)}

 .pend-note{display:flex;align-items:center;gap:.35rem;margin-top:.4rem;padding:.3rem .5rem;background:var(--amber-lo);border-radius:var(--r-xs)}
 .log-form{margin-top:.75rem;border-top:1px solid var(--border);padding-top:.75rem}
 .log-btn-sm{display:inline-flex;align-items:center;gap:.35rem;margin-top:.4rem;background:none;border:1px solid var(--border);color:var(--txt-3);font-family:var(--ff-head);font-size:.75rem;font-weight:700;padding:.3rem .7rem;border-radius:var(--r-sm);cursor:pointer;transition:all .15s}
 .log-btn-sm:hover{border-color:var(--teal);color:var(--teal)}

 .pend-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-top:.4rem;padding:.35rem .5rem;background:var(--amber-lo);border-radius:var(--r-xs)}
 .cancel-btn{display:inline-flex;align-items:center;gap:.3rem;font-family:var(--ff-head);font-size:.72rem;font-weight:700;color:var(--red);background:none;border:1px solid rgba(239,68,68,.3);border-radius:var(--r-xs);padding:.2rem .5rem;cursor:pointer;transition:all .15s}
 .cancel-btn:hover{background:var(--red-lo)}

  /* Item 5: make all 4 tabs (Ground / In-flight / P2 / Exams) fit better on phones */
  .tabs-wrap{position:relative}
  .ex-tabs{scrollbar-width:none;-ms-overflow-style:none}
  .ex-tabs::-webkit-scrollbar{display:none}
  .ex-tab{padding:.55rem .55rem !important;font-size:.72rem !important;letter-spacing:.02em !important}
  .tabs-fade{position:absolute;right:0;top:0;width:32px;height:calc(100% - 1px);pointer-events:none;background:linear-gradient(to right, transparent, var(--bg))}
</style>
