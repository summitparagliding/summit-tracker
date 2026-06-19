<script>
  import QuizEngine from '$lib/components/QuizEngine.svelte';
 import { enhance } from '$app/forms';
 import Icon from '$lib/components/Icon.svelte';
 import { t } from '$lib/i18n/index.js';
 import { lang } from '$lib/stores/lang.js';
 export let data, form;
 $: ({ blocks, exams, defs, student, quiz } = data);

 let activeTab = 'theory';
 let expandedBlock = null;
 const loc = (obj, field) => ($lang === 'fr' && obj[field+'_fr']) ? obj[field+'_fr'] : obj[field];

 // Quiz state
 let quizQuestions = [];
 let quizIdx = 0;
 let quizAnswer = null;
 let quizScore = 0;
 let quizDone = false;
 let quizShuffled = false;

 function startQuiz() {
 quizQuestions = [...(quiz || [])].sort(() => Math.random() - 0.5).slice(0, 20);
 quizIdx = 0; quizAnswer = null; quizScore = 0; quizDone = false;
 }
 function answerQuiz(opt) {
 if (quizAnswer) return;
 quizAnswer = opt;
 if (opt === quizQuestions[quizIdx].correct) quizScore++;
 }
 function nextQuiz() {
 if (quizIdx < quizQuestions.length - 1) { quizIdx++; quizAnswer = null; }
 else quizDone = true;
 }
 $: currentQ = quizQuestions[quizIdx];
 $: opts = currentQ ? ['A','B','C','D'].map(k => ({ key:k, text: $lang==='fr' ? currentQ[`opt_${k.toLowerCase()}_fr`] : currentQ[`opt_${k.toLowerCase()}_en`] || currentQ[`opt_${k.toLowerCase()}_fr`] })) : [];

 $: grouped = {
 p1: blocks.filter(b=>b.phase==='p1'),
 p2: blocks.filter(b=>b.phase==='p2'),
 other: blocks.filter(b=>b.phase!=='p1'&&b.phase!=='p2')
 };
 $: theoryExams = defs.filter(d=>d.type==='theory');
 function bestAttempt(examId) {
 const list = exams.filter(e=>e.exam_id===examId);
 return list.find(a=>a.passed===1&&a.signed_off_at) || list.find(a=>a.signed_off_at) || list[0] || null;
 }
</script>

<svelte:head><title>{$t('theory_title')} — Summit</title></svelte:head>

<!-- Theory progress map -->
<div class="th-map card card-sm">
 {#each [
 [$lang==='fr'?'P1':'P1', blocks.filter(b=>b.phase==='p1')],
 [$lang==='fr'?'P2':'P2', blocks.filter(b=>b.phase==='p2')],
 ] as [lbl, grp]}
 {#if grp.length}
 <div class="thm-row">
 <div class="thm-label">{lbl}</div>
 <div class="thm-dots">
 {#each grp as b, i}
 <div class="thm-dot {b.completed?'done':''}" title={loc(b,'title')}>
 {#if !b.completed}<span class="thm-num">{i+1}</span>{/if}
 </div>
 {/each}
 </div>
 <span class="thm-stat mono xs">{grp.filter(b=>b.completed).length}/{grp.length}</span>
 </div>
 {/if}
 {/each}
 <div class="thm-row">
 <div class="thm-label">{$lang==='fr'?'Examens':'Exams'}</div>
 <div class="thm-dots">
 {#each theoryExams as ex}
 {@const att = bestAttempt(ex.id)}
 <div class="thm-dot exam-dot {att?.passed===1&&att?.signed_off_at?'done':att?'pend':''}" title={ex.title}></div>
 {/each}
 </div>
 <span class="thm-stat mono xs">{theoryExams.filter(ex=>{const a=bestAttempt(ex.id);return a?.passed===1&&a?.signed_off_at}).length}/{theoryExams.length}</span>
 </div>
</div>

<h1 style="font-size:1.35rem;margin-bottom:1.25rem">{$t('theory_title')}</h1>

<div class="tabs">
 <button class="tab" class:active={activeTab==='theory'} on:click={()=>activeTab='theory'}>
 {$t('theory_blocks')}
 </button>
 <button class="tab" class:active={activeTab==='exams'} on:click={()=>activeTab='exams'}>
 {$t('theory_exams')}
 </button>
 <button class="tab" class:active={activeTab==='quiz'} on:click={()=>{activeTab='quiz';startQuiz();}}>
 Quiz
 </button>
</div>

<!-- THEORY BLOCKS -->
{#if activeTab === 'theory'}
 {#if form?.ok}<div class="alert alert-ok"><Icon name="check" size={14} />Saved</div>{/if}
 {#if blocks.length === 0}
 <div class="empty card"><div class="empty-icon"><Icon name="book" size={40} color="var(--teal)" /></div><strong>{$t('theory_no_content')}</strong></div>
 {/if}
 {#each [['p1',$t('theory_p1')],['p2',$t('theory_p2')],['other',$t('theory_general')]] as [phase,label]}
 {#if grouped[phase].length}
 <div class="phase-label">{label}</div>
 {#each grouped[phase] as b}
 <div class="theory-card card" class:done={b.completed}>
 <button type="button" class="tc-header"
 on:click={()=>expandedBlock = expandedBlock===b.id?null:b.id}>
 <div class="tc-status">
 {#if b.completed}
 <Icon name="check" size={16} color="var(--green)" />
 {:else}
 <div class="tc-circle"></div>
 {/if}
 </div>
 <div class="tc-title">{loc(b,'title')}</div>
 <Icon name={expandedBlock===b.id?'chevronup':'chevrondown'} size={15} color="var(--txt-3)" />
 </button>

 {#if !expandedBlock || expandedBlock !== b.id}
 {#if loc(b,'description')}
 <p class="tc-desc dimmed small">{loc(b,'description')}</p>
 {/if}
 {/if}

 {#if expandedBlock === b.id}
 {#if loc(b,'content')}
 <div class="tc-content">{@html loc(b,'content').replace(/\n/g,'<br>')}</div>
 {:else if loc(b,'description')}
 <p class="tc-content dimmed">{loc(b,'description')}</p>
 {:else}
 <p class="tc-content dimmed">No content added yet.</p>
 {/if}
 <div class="tc-actions">
 {#if !b.completed}
 <form method="POST" action="?/markDone" use:enhance>
 <input type="hidden" name="block_id" value={b.id} />
 <button class="btn btn-success btn-sm">
 <Icon name="check" size={13} />{$t('theory_mark_done')}
 </button>
 </form>
 {:else}
 <span class="badge badge-pass"><Icon name="check" size={11} />{$t('theory_completed')}</span>
 <form method="POST" action="?/markUndone" use:enhance style="display:inline">
 <input type="hidden" name="block_id" value={b.id} />
 <button class="btn btn-ghost btn-xs">{$t('theory_undo')}</button>
 </form>
 {/if}
 </div>
 {/if}
 </div>
 {/each}
 {/if}
 {/each}
{/if}

<!-- EXAMS -->
{#if activeTab === 'exams'}
 {#if form?.examOk}<div class="alert alert-ok"><Icon name="check" size={14} />Submitted to instructor</div>{/if}
 {#if form?.examErr}<div class="alert alert-err"><Icon name="alert" size={14} />{form.examErr}</div>{/if}
 {#if theoryExams.length === 0}
 <div class="empty card"><div class="empty-icon"><Icon name="note" size={40} color="var(--teal)" /></div><strong>{$t('theory_no_exams')}</strong></div>
 {:else}
 {#each theoryExams as exam}
 {@const attempt = bestAttempt(exam.id)}
 <div class="exam-card card">
 <div class="exam-top">
 <div>
 <div class="exam-title">{$lang==='fr'&&exam.title_fr?exam.title_fr:exam.title}</div>
 <span class="badge badge-{exam.phase} xs" style="margin-top:.3rem">{exam.phase.toUpperCase()}</span>
 </div>
 <div>
 {#if attempt?.passed===1&&attempt?.signed_off_at}
 <span class="badge badge-pass"><Icon name="check" size={11} />{$t('theory_passed')}</span>
 {:else if attempt?.passed===0}
 <span class="badge badge-fail"><Icon name="cross" size={11} />{$t('theory_failed')}</span>
 {:else if attempt}
 <span class="badge badge-pend"><Icon name="clock" size={11} />{$t('theory_submitted')}</span>
 {:else}
 <span class="badge badge-muted">{$t('theory_not_tried')}</span>
 {/if}
 </div>
 </div>
 {#if exam.description}
 <p class="dimmed small" style="margin:.5rem 0">{$lang==='fr'&&exam.description_fr?exam.description_fr:exam.description}</p>
 {/if}
 {#if attempt?.instructor_notes && attempt.instructor_notes !== 'Approuvé en lot' && attempt.instructor_notes !== 'Approved in bulk'}
 <div class="inst-note">
 <Icon name="note" size={13} color="var(--teal)" />
 <em>{attempt.instructor_notes}</em>
 </div>
 {/if}
 {#if !attempt||attempt.passed===0}
 <form method="POST" action="?/submitExam" use:enhance class="exam-form">
 <input type="hidden" name="exam_id" value={exam.id} />
 <div class="form-group">
 <label>{$lang==='fr'?'Notes pour l\'instructeur':'Notes for instructor'}</label>
 <textarea name="student_notes" rows="2" placeholder="{$t('theory_notes_ph')}"></textarea>
 </div>
 <button type="submit" class="btn btn-primary btn-sm">
 <Icon name="share" size={13} />{$t('theory_submit')}
 </button>
 </form>
 {/if}
 </div>
 {/each}
 {/if}
{/if}

<!-- QUIZ -->
{#if activeTab === 'quiz'}
<div class="quiz-wrap" style="padding:.25rem 0">
  <QuizEngine onClose={() => activeTab = 'theory'} />
</div>
{/if}

<style>
 .th-map{margin-bottom:1rem}
 .thm-row{display:flex;align-items:center;gap:.5rem;min-height:1.4rem;margin-bottom:.35rem}
 .thm-row:last-child{margin-bottom:0}
 /* Quiz */
 .quiz-wrap{padding:.25rem 0;max-width:600px}
 .quiz-start,.quiz-done{text-align:center;padding:2rem 1rem;display:flex;flex-direction:column;align-items:center;gap:.75rem}
 .quiz-icon{font-size:3rem}
 .quiz-start h2,.quiz-done h2{font-size:1.1rem;font-weight:700;color:var(--txt);margin:0}
 .quiz-start p,.quiz-msg{font-size:.85rem;color:var(--txt-2);max-width:340px;line-height:1.5}
 .quiz-score-big{font-size:3rem;font-weight:800;font-family:var(--ff-mono);color:var(--teal)}
 .quiz-pct{font-size:1.3rem;font-weight:700;font-family:var(--ff-mono)}
 .quiz-progress{margin-bottom:.875rem}
 .qp-bar{height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:.3rem}
 .qp-fill{height:100%;background:var(--teal);border-radius:3px;transition:width .3s}
 .quiz-card{background:var(--bg-raised);border-radius:12px;padding:1rem;display:flex;flex-direction:column;gap:.75rem}
 .quiz-cat{color:var(--teal);font-weight:600;text-transform:uppercase;letter-spacing:.05em}
 .quiz-q{font-size:.95rem;font-weight:600;color:var(--txt);line-height:1.5}
 .quiz-opts{display:flex;flex-direction:column;gap:.4rem}
 .quiz-opt{display:flex;align-items:flex-start;gap:.625rem;padding:.6rem .75rem;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-2);color:var(--txt);text-align:left;cursor:pointer;transition:all .15s;font-size:.88rem}
 .quiz-opt:hover:not(:disabled){border-color:var(--teal);background:rgba(0,184,122,.08)}
 .quiz-opt.correct{border-color:var(--green);background:rgba(22,163,74,.12);color:var(--green)}
 .quiz-opt.wrong{border-color:var(--red);background:rgba(220,38,38,.1);color:var(--red)}
 .quiz-opt.neutral{opacity:.45}
 .quiz-opt:disabled{cursor:default}
 .opt-key{font-weight:800;font-family:var(--ff-mono);min-width:18px;color:var(--txt-3)}
 .quiz-opt.correct .opt-key{color:var(--green)}
 .quiz-opt.wrong .opt-key{color:var(--red)}
 .quiz-explain{border-radius:8px;padding:.625rem .75rem;background:rgba(0,184,122,.06);border:1px solid rgba(0,184,122,.2);font-size:.83rem;color:var(--txt-2);line-height:1.5}
 .quiz-explain.correct-bg{background:rgba(22,163,74,.08);border-color:rgba(22,163,74,.25)}
 .quiz-next{align-self:flex-end}
 .thm-label{width:72px;flex-shrink:0;text-align:right;font-size:.68rem;font-weight:600;color:var(--txt-3);white-space:nowrap}
 .thm-dots{display:flex;flex-wrap:wrap;gap:3px;flex:1}
 .thm-dot{width:14px;height:14px;border-radius:50%;background:var(--bg-2);border:1.5px solid var(--border);transition:background .2s;flex-shrink:0;display:flex;align-items:center;justify-content:center;position:relative}
 .thm-dot.done{background:var(--green);border-color:var(--green)}
 .thm-dot.exam-dot{border-radius:50%}
 .thm-dot.pend{background:var(--amber);border-color:var(--amber)}
 .thm-num{font-size:.5rem;color:var(--txt-3);font-weight:700;line-height:1;pointer-events:none}
 .thm-stat{flex-shrink:0;color:var(--txt-3);min-width:36px;text-align:right;font-size:.68rem}
 .phase-label { font-family:var(--ff-head);font-size:.67rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--teal);margin:1.25rem 0 .5rem }
 .theory-card { margin-bottom:.5rem;padding:.875rem 1rem;transition:border-color .15s }
 .theory-card.done { border-color:rgba(34,197,94,.2) }
 .tc-header { display:flex;align-items:center;gap:.75rem;width:100%;background:none;border:none;cursor:pointer;text-align:left;padding:0 }
 .tc-status { flex-shrink:0;width:20px;display:flex;align-items:center;justify-content:center }
 .tc-circle { width:16px;height:16px;border-radius:50%;border:2px solid var(--border) }
 .tc-title { flex:1;font-weight:600;font-size:.9rem;color:var(--txt) }
 .tc-desc { margin-top:.5rem;padding-left:1.75rem }
 .tc-content { font-size:.855rem;color:var(--txt);margin-top:.875rem;padding-left:1.75rem;line-height:1.75 }
 .tc-actions { display:flex;align-items:center;gap:.75rem;margin-top:.875rem;padding-left:1.75rem }

 .exam-card { margin-bottom:.75rem }
 .exam-top { display:flex;justify-content:space-between;align-items:flex-start;gap:.75rem;flex-wrap:wrap }
 .exam-title { font-weight:700;font-size:.925rem }
 .inst-note { display:flex;align-items:flex-start;gap:.4rem;font-size:.8rem;color:var(--teal);padding:.5rem .75rem;background:var(--teal-lo);border-radius:var(--r-xs);margin:.5rem 0 }
 .exam-form { margin-top:.875rem;border-top:1px solid var(--border);padding-top:.875rem }
</style>
