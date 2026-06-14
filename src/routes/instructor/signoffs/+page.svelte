<script>
  import { enhance } from '$app/forms';
  import Icon from '$lib/components/Icon.svelte';
  export let data, form;
  $: ({ grouped } = data);
  $: total = grouped.reduce((a,g) => a + g.exercises.length + g.exams.length, 0);

  let expanded = {};
  let signing  = {};  // log_id/attempt_id => true

  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
  function toggle(id) { expanded[id] = !expanded[id]; expanded = {...expanded}; }
</script>

<svelte:head><title>Sign-offs — Instructor</title></svelte:head>

<div class="page-hd">
  <div>
    <h1>Sign-offs</h1>
    <p>{total} item{total !== 1 ? 's' : ''} pending across {grouped.length} student{grouped.length !== 1 ? 's' : ''}</p>
  </div>
</div>

{#if form?.ok}<div class="alert alert-ok"><Icon name="check" size={14} />Signed off successfully</div>{/if}

{#if grouped.length === 0}
  <div class="empty card">
    <div class="empty-icon"><Icon name="signoff" size={44} color="var(--teal)" /></div>
    <strong>All caught up!</strong>
    <p>No pending sign-offs right now.</p>
  </div>
{:else}
  {#each grouped as g}
    <div class="student-group card">
      <!-- Student header -->
      <button type="button" class="sg-header" on:click={() => toggle(g.student_id)}>
        <div class="sg-av">{g.student_name[0]}</div>
        <div class="sg-info">
          <div class="sg-name">{g.student_name}</div>
          <div class="sg-count dimmed xs">
            {#if g.exercises.length}{g.exercises.length} exercise{g.exercises.length!==1?'s':''}{/if}
            {#if g.exercises.length && g.exams.length} · {/if}
            {#if g.exams.length}{g.exams.length} exam{g.exams.length!==1?'s':''}{/if}
          </div>
        </div>
        <div class="sg-badges">
          {#if g.exercises.length}<span class="badge badge-pend">{g.exercises.length} ex</span>{/if}
          {#if g.exams.length}<span class="badge badge-info">{g.exams.length} exam</span>{/if}
        </div>
        <Icon name={expanded[g.student_id]?'chevronup':'chevrondown'} size={16} color="var(--txt-3)" />
      </button>

      {#if expanded[g.student_id]}
        <div class="sg-items">

          <!-- Exercises -->
          {#each g.exercises as ex}
            <div class="so-item">
              <div class="so-meta">
                <span class="badge badge-info xs">{ex.category?.replace('_',' ')}</span>
                <span class="so-title small">{ex.exercise_title}</span>
                <span class="mono dimmed xs">{fmtDate(ex.date)}</span>
              </div>
              {#if ex.attempt_notes}
                <div class="so-notes dimmed xs">
                  <Icon name="note" size={12} />
                  <em>{ex.attempt_notes}</em>
                </div>
              {/if}
              {#if signing[ex.id]}
                <form method="POST" action="?/signoffExercise" use:enhance
                  on:submit={() => signing[ex.id] = false} class="so-form">
                  <input type="hidden" name="log_id" value={ex.id} />
                  <div class="form-group">
                    <label>Notes for student</label>
                    <textarea name="instructor_notes" rows="2" placeholder="Feedback, corrections…"></textarea>
                  </div>
                  <div class="so-btns">
                    <button type="submit" name="status" value="passed" class="btn btn-success btn-sm">
                      <Icon name="check" size={13} />Pass
                    </button>
                    <button type="submit" name="status" value="failed" class="btn btn-danger btn-sm">
                      <Icon name="cross" size={13} />Fail
                    </button>
                    <button type="submit" name="status" value="in_progress" class="btn btn-secondary btn-sm">
                      More work needed
                    </button>
                  </div>
                </form>
              {:else}
                <button class="btn btn-secondary btn-xs so-action" on:click={() => { signing[ex.id]=true; signing={...signing}; }}>
                  <Icon name="edit" size={13} />Sign off
                </button>
              {/if}
            </div>
          {/each}

          <!-- Exams -->
          {#each g.exams as ex}
            <div class="so-item exam-item">
              <div class="so-meta">
                <span class="badge badge-{ex.exam_type==='theory'?'theory':'practical'} xs">{ex.exam_type} · {ex.phase.toUpperCase()}</span>
                <span class="so-title small">{ex.exam_title}</span>
                <span class="mono dimmed xs">{fmtDate(ex.date)}</span>
              </div>
              {#if ex.student_notes}
                <div class="so-notes dimmed xs">
                  <Icon name="note" size={12} />
                  <em>{ex.student_notes}</em>
                </div>
              {/if}
              {#if signing['exam_'+ex.id]}
                <form method="POST" action="?/signoffExam" use:enhance
                  on:submit={() => signing['exam_'+ex.id] = false} class="so-form">
                  <input type="hidden" name="attempt_id" value={ex.id} />
                  <div class="form-row">
                    <div class="form-group">
                      <label>Notes for student</label>
                      <textarea name="instructor_notes" rows="2" placeholder="Feedback…"></textarea>
                    </div>
                    {#if ex.exam_type === 'theory'}
                      <div class="form-group">
                        <label>Score (0–100)</label>
                        <input name="score_pct" type="number" min="0" max="100" step="1" placeholder="e.g. 78" />
                      </div>
                    {/if}
                  </div>
                  <div class="so-btns">
                    <button type="submit" name="passed" value="1" class="btn btn-success btn-sm">
                      <Icon name="check" size={13} />Pass
                    </button>
                    <button type="submit" name="passed" value="0" class="btn btn-danger btn-sm">
                      <Icon name="cross" size={13} />Fail
                    </button>
                  </div>
                </form>
              {:else}
                <button class="btn btn-secondary btn-xs so-action" on:click={() => { signing['exam_'+ex.id]=true; signing={...signing}; }}>
                  <Icon name="edit" size={13} />Sign off
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
{/if}

<style>
  .page-hd { margin-bottom:1.5rem }
  .page-hd h1 { font-size:1.6rem }
  .page-hd p { color:var(--txt-2);font-size:.82rem;margin-top:.2rem }

  .student-group { margin-bottom:.875rem;padding:0;overflow:hidden }

  .sg-header { display:flex;align-items:center;gap:.75rem;width:100%;background:none;border:none;cursor:pointer;padding:1rem 1.25rem;text-align:left;transition:background .15s }
  .sg-header:hover { background:var(--bg-raised) }
  .sg-av { width:34px;height:34px;border-radius:50%;background:var(--teal-lo);border:1.5px solid var(--teal-border);color:var(--teal);font-family:var(--ff-head);font-weight:800;font-size:.9rem;display:flex;align-items:center;justify-content:center;flex-shrink:0 }
  .sg-info { flex:1 }
  .sg-name { font-weight:700;font-size:.95rem;color:var(--txt) }
  .sg-count { margin-top:.1rem }
  .sg-badges { display:flex;gap:.35rem;flex-shrink:0 }

  .sg-items { border-top:1px solid var(--border);padding:.75rem 1.25rem;display:flex;flex-direction:column;gap:.625rem }

  .so-item { padding:.75rem;background:var(--bg-raised);border-radius:var(--r-sm);border:1px solid var(--border) }
  .exam-item { border-color:rgba(59,130,246,.2);background:rgba(59,130,246,.03) }
  .so-meta { display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.375rem }
  .so-title { flex:1;font-weight:500 }
  .so-notes { display:flex;align-items:flex-start;gap:.35rem;padding:.35rem .5rem;background:var(--bg-card);border-radius:var(--r-xs);margin-bottom:.5rem }
  .so-form { margin-top:.625rem }
  .so-btns { display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.625rem }
  .so-action { margin-top:.5rem }
</style>
