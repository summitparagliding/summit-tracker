<script>
  import { enhance } from '$app/forms';
  import ColourSignature from '$lib/components/ColourSignature.svelte';
  export let data;
  $: students = data.students || [];
  $: archived = data.archived || [];
  let tab = 'active';
  const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-CA') : '—';
</script>

<svelte:head><title>Étudiants — Instructeur</title></svelte:head>

<div class="page-head">
  <h1>Étudiants</h1>
  <a href="/instructor/students/new" class="btn btn-primary">+ Nouvel étudiant</a>
</div>

<!-- Tabs -->
<div class="tab-row">
  <button class="tab" class:active={tab==='active'} on:click={() => tab='active'}>
    Actifs <span class="tc">{students.length}</span>
  </button>
  <button class="tab" class:active={tab==='archived'} on:click={() => tab='archived'}>
    Archivés <span class="tc">{archived.length}</span>
  </button>
</div>

<!-- Active students -->
{#if tab === 'active'}
  {#if students.length}
  <div class="table-wrap">
    <table>
      <colgroup>
        <col style="width:30%"/>
        <col style="width:24%"/>
        <col style="width:12%"/>
        <col style="width:34%"/>
      </colgroup>
      <thead><tr>
        <th>Nom</th>
        <th>Contact</th>
        <th>Inscrit</th>
        <th style="text-align:right">Actions</th>
      </tr></thead>
      <tbody>
      {#each students as s}
      <tr>
        <td>
          <a href="/instructor/students/{s.id}" class="name-link">
            <span class="av">{(s.name||'?')[0]}</span>
            {s.name||'—'}
            {#if s.wing_color_1 || s.harness_color}
            <ColourSignature
              mainColor={s.wing_color_1||'#3b82f6'}
              leColor={s.wing_le_color||s.wing_color_2||'#ffffff'}
              harnessColor={s.harness_color||'#1e293b'}
              size={22} />
            {/if}
          </a>
        </td>
        <td class="xs muted">
          {#if s.email}<div>{s.email}</div>{/if}
          {#if s.phone}<div>{s.phone}</div>{/if}
        </td>
        <td class="xs muted mono">{fmtDate(s.enrollment_date)}</td>
        <td class="actions">
          <a href="/instructor/students/{s.id}" class="btn btn-secondary btn-sm">Voir</a>
          <form method="POST" action="?/deactivate" use:enhance style="display:contents">
            <input type="hidden" name="id" value={s.id} />
            <button class="btn btn-ghost btn-sm"
              on:click|preventDefault={e=>{if(confirm('Archiver '+s.name+'?'))e.target.form.submit()}}>
              Archiver
            </button>
          </form>
          <form method="POST" action="?/deleteStudent" use:enhance style="display:contents">
            <input type="hidden" name="id" value={s.id} />
            <button class="btn btn-danger btn-sm"
              on:click|preventDefault={e=>{if(confirm('SUPPRIMER '+s.name+'?\n\nIrréversible.'))e.target.form.submit()}}>
              Supprimer
            </button>
          </form>
        </td>
      </tr>
      {/each}
      </tbody>
    </table>
  </div>
  {:else}
  <div class="empty-state">
    <p class="muted">Aucun étudiant actif.</p>
    <a href="/instructor/students/new" class="btn btn-primary">+ Nouvel étudiant</a>
  </div>
  {/if}
{/if}

<!-- Archived students -->
{#if tab === 'archived'}
  {#if archived.length}
  <div class="table-wrap">
    <table>
      <colgroup>
        <col style="width:36%"/>
        <col style="width:24%"/>
        <col style="width:40%"/>
      </colgroup>
      <thead><tr>
        <th>Nom</th>
        <th>Contact</th>
        <th style="text-align:right">Actions</th>
      </tr></thead>
      <tbody>
      {#each archived as s}
      <tr>
        <td>
          <span class="av sm">{(s.name||'?')[0]}</span>
          <span class="xs muted" style="margin-left:.4rem">{s.name||'—'}</span>
        </td>
        <td class="xs muted">{s.email||''}</td>
        <td class="actions">
          <form method="POST" action="?/reactivate" use:enhance style="display:contents">
            <input type="hidden" name="id" value={s.id} />
            <button class="btn btn-ghost btn-sm">Réactiver</button>
          </form>
          <form method="POST" action="?/deleteStudent" use:enhance style="display:contents">
            <input type="hidden" name="id" value={s.id} />
            <button class="btn btn-danger btn-sm"
              on:click|preventDefault={e=>{if(confirm('SUPPRIMER définitivement '+s.name+'?\nIrréversible.'))e.target.form.submit()}}>
              Supprimer
            </button>
          </form>
        </td>
      </tr>
      {/each}
      </tbody>
    </table>
  </div>
  {:else}
  <p class="muted xs" style="padding:.5rem 0">Aucun étudiant archivé.</p>
  {/if}
{/if}

<style>
  .page-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem}
  h1{font-size:1.2rem;font-weight:700;color:var(--txt)}
  .tab-row{display:flex;gap:.25rem;margin-bottom:.75rem;background:var(--bg-raised);border-radius:9px;padding:.2rem;width:fit-content}
  .tab{padding:.3rem .75rem;border-radius:7px;border:none;cursor:pointer;font-size:.78rem;font-weight:600;color:var(--txt-3);background:none}
  .tab.active{background:var(--bg-card);color:var(--txt);box-shadow:0 1px 3px rgba(0,0,0,.12)}
  .tc{background:var(--bg-2);border-radius:99px;padding:.05rem .3rem;font-size:.68rem;font-family:var(--ff-mono)}
  .table-wrap{overflow-x:auto;border-radius:10px;border:1px solid var(--border)}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  th,td{vertical-align:middle;padding:.45rem .625rem;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  th{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--txt-3);background:var(--bg-raised);border-bottom:1px solid var(--border)}
  td{border-bottom:1px solid var(--border);font-size:.82rem;color:var(--txt)}
  tr:last-child td{border-bottom:none}
  .name-link{display:flex;align-items:center;gap:.5rem;text-decoration:none;color:var(--txt);font-weight:500}
  .name-link:hover{color:var(--teal)}
  .av{width:26px;height:26px;border-radius:50%;background:rgba(0,184,122,.12);color:var(--teal);font-weight:700;font-size:.72rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .av.sm{display:inline-flex;width:22px;height:22px;font-size:.65rem}
  .actions{display:flex;gap:.3rem;align-items:center;justify-content:flex-end}
  .empty-state{padding:2rem 1rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:.75rem}
  .name-link{display:flex;align-items:center;gap:.4rem;text-decoration:none;color:var(--txt)}
  @media(max-width:768px){
    table{table-layout:auto}
    /* hide Contact + Inscrit columns so Name + Actions fit on a phone */
    th:nth-child(2),td:nth-child(2),th:nth-child(3),td:nth-child(3){display:none}
    th,td{white-space:normal}
    .actions{flex-wrap:wrap;justify-content:flex-start;gap:.25rem}
  }
</style>
