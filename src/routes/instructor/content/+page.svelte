<script>
  import { uploadFile } from '$lib/upload.js';
  import { uploadWithProgress } from '$lib/uploadWithProgress.js';
  import { enhance } from '$app/forms';
  import Icon from '$lib/components/Icon.svelte';
  export let data, form;
  $: ({ theory, exercises, exams, sitePhotos, quiz, libraryItems } = data);
  let editingQuiz = null;
  let showAddQuiz = false;
  function fmtOpts(raw) {
    if (!raw) return '';
    try { const o = JSON.parse(raw); return Array.isArray(o) ? o.join('\n') : raw; } catch(e) { return raw; }
  }

  const LAUNCHES = [
    { key:'NE CVLY', type:'launch', label:'NE CVLY' },
    { key:'N Cogeco', type:'launch', label:'N Cogeco' },
    { key:'O CVLY',  type:'launch', label:'O CVLY' },
    { key:'S',       type:'launch', label:'S' },
  ];
  const LANDINGS = [
    { key:'main',  type:'landing', label:'Principal NE' },
    { key:'west',  type:'landing', label:'Jardin Ouest' },
    { key:'scott', type:'landing', label:'M. Scott Ouest' },
  ];

  function sitePhoto(key, type) {
    return (sitePhotos||[]).find(p => p.site_key===key && p.site_type===type)?.url || null;
  }

  let sitePhotoUploading = null;
  let sitePhotoProgress  = 0;
  async function uploadSitePhoto(key, type, file) {
    sitePhotoUploading = key + ':' + type;
    sitePhotoProgress  = 0;
    try {
      const res = await uploadFile(file, {
        purpose: 'site_photo',
        meta:    { site_key: key, site_type: type },
        onProgress: p => { sitePhotoProgress = p; }
      });
      if (res.ok) location.reload();
    } finally {
      sitePhotoUploading = null;
      sitePhotoProgress  = 0;
    }
  }

  let activeTab = 'theory';
  let libMode = 'file';
  let libSubmitting = false;
  let libErr = '';
  let libProgress = 0;

  async function submitLibraryItem() {
    const title = document.getElementById('lib-title')?.value?.trim();
    if (!title) { libErr = 'Titre requis'; return; }
    libErr = '';
    libSubmitting = true;

    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', document.getElementById('lib-desc')?.value || '');

      if (libMode === 'file') {
        const fileEl = document.getElementById('lib-file');
        const file   = fileEl?.files?.[0];
        if (!file) { libErr = 'Sélectionner un fichier PDF'; libSubmitting = false; return; }
        fd.append('file', file);
      } else {
        const url = (document.getElementById('lib-url')?.value || '').trim();
        if (!url) { libErr = 'URL requise'; libSubmitting = false; return; }
        fd.append('file_url', url);
      }

      const res = await fetch('?/addLibraryItem', {
        method: 'POST',
        body:   fd,
        headers: { 'x-sveltekit-action': 'true' }
      });

      if (res.ok || res.status === 204) {
        location.reload();
      } else {
        // Try to read error from response
        const text = await res.text().catch(() => '');
        const match = text.match(/"err":"([^"]+)"/);
        libErr = match ? match[1] : `Erreur ${res.status} — vérifiez la taille du fichier`;
      }
    } catch(e) {
      libErr = 'Erreur réseau: ' + e.message;
    }
    libSubmitting = false;
  }
  let editingBlock = null;  // theory block being edited
  let editingEx    = null;  // exercise being edited
  let expandedBlock = null;

  $: ghEx  = exercises.filter(e => e.category === 'ground_handling');
  $: airEx = exercises.filter(e => e.category === 'airborne');
</script>

<svelte:head><title>Course Content — Instructor</title></svelte:head>

<div class="page-hd">
  <div><h1>Course Content</h1><p>Theory blocks, exercises, and exams</p></div>
</div>

{#if form?.ok || form?.ok === 'theory_updated' || form?.ok === 'exercise_updated'}
  <div class="alert alert-ok"><Icon name="check" size={14} />Saved</div>
{/if}
{#if form?.err}<div class="alert alert-err"><Icon name="alert" size={14} />{form.err}</div>{/if}

<div class="tabs">
  <button class="tab" class:active={activeTab==='theory'}    on:click={()=>activeTab='theory'}>Theory ({theory.length})</button>
  <button class="tab" class:active={activeTab==='exercises'} on:click={()=>activeTab='exercises'}>Exercises ({exercises.length})</button>
  <button class="tab" class:active={activeTab==='exams'}     on:click={()=>activeTab='exams'}>Exams ({exams.length})</button>
  <button class="tab" class:active={activeTab==='info'}      on:click={()=>activeTab='info'}>Info / Sites</button>
  <button class="tab" class:active={activeTab==='quiz'}      on:click={()=>activeTab='quiz'}>Quiz ({quiz?.length||0})</button>
  <button class="tab" class:active={activeTab==='library'}  on:click={()=>activeTab='library'}>Étude / Docs ({libraryItems?.length||0})</button>
</div>

<!-- ── THEORY ─────────────────────────────────────────────────── -->
{#if activeTab === 'theory'}
  <div class="content-layout">
    <!-- Add form -->
    <div class="add-card card">
      <h2>Add Theory Block</h2>
      <form method="POST" action="?/addTheory" use:enhance>
        <div class="form-row">
          <div class="form-group"><label>Title (EN) *</label><input name="title" required placeholder="e.g. Basic Aerodynamics" /></div>
          <div class="form-group"><label>Titre (FR)</label><input name="title_fr" placeholder="ex. Aérodynamique de base" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Phase</label>
            <select name="phase"><option value="p1">P1</option><option value="p2">P2</option><option value="general">General</option></select>
          </div>
          <div class="form-group"><label>Order</label><input name="order_idx" type="number" value="0" min="0" style="max-width:80px" /></div>
        </div>
        <div class="form-group"><label>Description (EN)</label><textarea name="description" rows="2" placeholder="One-line summary…"></textarea></div>
        <div class="form-group"><label>Description (FR)</label><textarea name="description_fr" rows="2" placeholder="Résumé…"></textarea></div>
        <div class="form-group"><label>Full Content (EN)</label><textarea name="content" rows="5" placeholder="Study material, key points… HTML allowed"></textarea></div>
        <div class="form-group"><label>Contenu complet (FR)</label><textarea name="content_fr" rows="5" placeholder="Matière, points clés…"></textarea></div>
        <button type="submit" class="btn btn-primary btn-sm"><Icon name="plus" size={13} />Add Block</button>
      </form>
    </div>

    <!-- List -->
    <div>
      {#if theory.length === 0}
        <div class="empty card"><div class="empty-icon"><Icon name="book" size={36} color="var(--teal)" /></div><strong>No theory blocks yet</strong></div>
      {:else}
        {#each ['p1','p2','general'] as phase}
          {@const blks = theory.filter(t=>t.phase===phase)}
          {#if blks.length}
            <div class="phase-lbl">{phase.toUpperCase()}</div>
            {#each blks as b}
              <div class="content-card card">
                <div class="cc-top">
                  <button type="button" class="cc-expand" on:click={()=>expandedBlock=expandedBlock===b.id?null:b.id}>
                    <Icon name={expandedBlock===b.id?'chevronup':'chevrondown'} size={14} color="var(--txt-3)" />
                  </button>
                  <div class="cc-title">{b.title}</div>
                  {#if b.title_fr}<div class="cc-fr dimmed xs">{b.title_fr}</div>{/if}
                  <div class="cc-acts">
                    <button type="button" class="btn btn-ghost btn-xs" on:click={()=>editingBlock=editingBlock===b.id?null:b.id}>
                      <Icon name="edit" size={13} />Edit
                    </button>
                    <form method="POST" action="?/deleteTheory" use:enhance style="display:inline">
                      <input type="hidden" name="id" value={b.id} />
                      <button class="btn btn-danger btn-xs" on:click|preventDefault={e=>{if(confirm('Delete?'))e.target.form.submit();}}>
                        <Icon name="trash" size={13} />
                      </button>
                    </form>
                  </div>
                </div>

                <!-- Preview -->
                {#if expandedBlock === b.id && !editingBlock}
                  <div class="cc-preview">
                    {#if b.description}<p class="small muted">{b.description}</p>{/if}
                    {#if b.content}<div class="content-body small">{@html b.content.replace(/\n/g,'<br>')}</div>{/if}
                    {#if b.content_fr}<hr style="border-color:var(--border);margin:.75rem 0" /><div class="content-body small dimmed">{@html b.content_fr.replace(/\n/g,'<br>')}</div>{/if}
                  </div>
                {/if}

                <!-- Edit form -->
                {#if editingBlock === b.id}
                  <form method="POST" action="?/updateTheory" use:enhance
                    on:submit={()=>editingBlock=null} class="edit-form">
                    <input type="hidden" name="id" value={b.id} />
                    <div class="form-row">
                      <div class="form-group"><label>Title (EN)</label><input name="title" value={b.title} required /></div>
                      <div class="form-group"><label>Titre (FR)</label><input name="title_fr" value={b.title_fr||''} /></div>
                    </div>
                    <div class="form-row">
                      <div class="form-group"><label>Phase</label>
                        <select name="phase">
                          <option value="p1" selected={b.phase==='p1'}>P1</option>
                          <option value="p2" selected={b.phase==='p2'}>P2</option>
                          <option value="general" selected={b.phase==='general'}>General</option>
                        </select>
                      </div>
                      <div class="form-group"><label>Order</label><input name="order_idx" type="number" value={b.order_idx} style="max-width:80px" /></div>
                    </div>
                    <div class="form-group"><label>Description (EN)</label><textarea name="description" rows="2">{b.description||''}</textarea></div>
                    <div class="form-group"><label>Description (FR)</label><textarea name="description_fr" rows="2">{b.description_fr||''}</textarea></div>
                    <div class="form-group"><label>Content (EN)</label><textarea name="content" rows="6">{b.content||''}</textarea></div>
                    <div class="form-group"><label>Contenu (FR)</label><textarea name="content_fr" rows="6">{b.content_fr||''}</textarea></div>

                    <!-- Media note -->
                    <div class="media-note">
                      <Icon name="info" size={13} color="var(--teal)" />
                      <span class="xs">To embed images or videos, paste HTML directly into the content field: <code>&lt;img src="URL"&gt;</code> or <code>&lt;iframe src="youtube-embed-url"&gt;&lt;/iframe&gt;</code></span>
                    </div>

                    <div style="display:flex;gap:.5rem;margin-top:.75rem">
                      <button type="submit" class="btn btn-primary btn-sm"><Icon name="save" size={13} />Save Changes</button>
                      <button type="button" class="btn btn-ghost btn-sm" on:click={()=>editingBlock=null}>Cancel</button>
                    </div>
                  </form>
                {/if}
              </div>
            {/each}
          {/if}
        {/each}
      {/if}
    </div>
  </div>
{/if}

<!-- ── EXERCISES ──────────────────────────────────────────────── -->
{#if activeTab === 'exercises'}
  <div class="content-layout">
    <div class="add-card card">
      <h2>Add Exercise</h2>
      <form method="POST" action="?/addExercise" use:enhance>
        <div class="form-group"><label>Title (EN) *</label><input name="title" required placeholder="e.g. Forward Inflation" /></div>
        <div class="form-group"><label>Titre (FR)</label><input name="title_fr" placeholder="ex. Gonflage face voile" /></div>
        <div class="form-row">
          <div class="form-group"><label>Category</label>
            <select name="category"><option value="ground_handling">Ground Handling</option><option value="airborne">Airborne</option></select>
          </div>
          <div class="form-group"><label>Order</label><input name="order_idx" type="number" value="0" min="0" style="max-width:80px" /></div>
        </div>
        <div class="form-group"><label>Description (EN)</label><textarea name="description" rows="3"></textarea></div>
        <div class="form-group"><label>Description (FR)</label><textarea name="description_fr" rows="3"></textarea></div>
        <button type="submit" class="btn btn-primary btn-sm"><Icon name="plus" size={13} />Add Exercise</button>
      </form>
    </div>

    <div>
      {#each [['ground_handling','Ground Handling',ghEx],['airborne','Airborne',airEx]] as [cat,label,list]}
        <div class="phase-lbl">{label}</div>
        {#if list.length === 0}<p class="dimmed small" style="margin-bottom:.75rem">None yet</p>
        {:else}
          {#each list as ex}
            <div class="content-card card">
              <div class="cc-top">
                <div class="cc-title">{ex.title}</div>
                {#if ex.title_fr}<div class="cc-fr dimmed xs">{ex.title_fr}</div>{/if}
                <div class="cc-acts">
                  <button type="button" class="btn btn-ghost btn-xs" on:click={()=>editingEx=editingEx===ex.id?null:ex.id}>
                    <Icon name="edit" size={13} />Edit
                  </button>
                  <form method="POST" action="?/deleteExercise" use:enhance style="display:inline">
                    <input type="hidden" name="id" value={ex.id} />
                    <button class="btn btn-danger btn-xs" on:click|preventDefault={e=>{if(confirm('Delete?'))e.target.form.submit();}}>
                      <Icon name="trash" size={13} />
                    </button>
                  </form>
                </div>
              </div>
              {#if ex.description && editingEx !== ex.id}
                <p class="small muted" style="margin-top:.35rem">{ex.description}</p>
              {/if}
              {#if editingEx === ex.id}
                <form method="POST" action="?/updateExercise" use:enhance
                  on:submit={()=>editingEx=null} class="edit-form">
                  <input type="hidden" name="id" value={ex.id} />
                  <div class="form-group"><label>Title (EN)</label><input name="title" value={ex.title} required /></div>
                  <div class="form-group"><label>Titre (FR)</label><input name="title_fr" value={ex.title_fr||''} /></div>
                  <div class="form-row">
                    <div class="form-group"><label>Category</label>
                      <select name="category">
                        <option value="ground_handling" selected={ex.category==='ground_handling'}>Ground Handling</option>
                        <option value="airborne" selected={ex.category==='airborne'}>Airborne</option>
                      </select>
                    </div>
                    <div class="form-group"><label>Order</label><input name="order_idx" type="number" value={ex.order_idx} style="max-width:80px" /></div>
                  </div>
                  <div class="form-group"><label>Description (EN)</label><textarea name="description" rows="3">{ex.description||''}</textarea></div>
                  <div class="form-group"><label>Description (FR)</label><textarea name="description_fr" rows="3">{ex.description_fr||''}</textarea></div>
                  <div style="display:flex;gap:.5rem;margin-top:.5rem">
                    <button type="submit" class="btn btn-primary btn-sm"><Icon name="save" size={13} />Save</button>
                    <button type="button" class="btn btn-ghost btn-sm" on:click={()=>editingEx=null}>Cancel</button>
                  </div>
                </form>
              {/if}
            </div>
          {/each}
        {/if}
      {/each}
    </div>
  </div>
{/if}

<!-- ── EXAMS ──────────────────────────────────────────────────── -->
{#if activeTab === 'exams'}
  <div class="content-layout">
    <div class="add-card card">
      <h2>Add Exam</h2>
      <form method="POST" action="?/addExam" use:enhance>
        <div class="form-group"><label>Title (EN) *</label><input name="title" required placeholder="e.g. P1 Theory Exam" /></div>
        <div class="form-group"><label>Titre (FR)</label><input name="title_fr" placeholder="ex. Examen théorique P1" /></div>
        <div class="form-row">
          <div class="form-group"><label>Type</label><select name="type"><option value="theory">Theory</option><option value="practical">Practical</option></select></div>
          <div class="form-group"><label>Phase</label><select name="phase"><option value="p1">P1</option><option value="p2">P2</option></select></div>
        </div>
        <div class="form-group"><label>Description</label><textarea name="description" rows="3"></textarea></div>
        <div class="form-group"><label>Description (FR)</label><textarea name="description_fr" rows="3"></textarea></div>
        <button type="submit" class="btn btn-primary btn-sm"><Icon name="plus" size={13} />Add Exam</button>
      </form>
    </div>
    <div>
      {#if exams.length === 0}
        <div class="empty card"><div class="empty-icon"><Icon name="note" size={36} color="var(--teal)" /></div><strong>No exams yet</strong></div>
      {:else}
        {#each exams as ex}
          <div class="content-card card">
            <div class="cc-top">
              <div>
                <div class="cc-title">{ex.title}</div>
                {#if ex.title_fr}<div class="cc-fr dimmed xs">{ex.title_fr}</div>{/if}
                <div style="display:flex;gap:.4rem;margin-top:.25rem">
                  <span class="badge badge-info xs">{ex.type}</span>
                  <span class="badge badge-p{ex.phase==='p1'?'1':'2'} xs">{ex.phase.toUpperCase()}</span>
                </div>
              </div>
              <form method="POST" action="?/deleteExam" use:enhance style="flex-shrink:0">
                <input type="hidden" name="id" value={ex.id} />
                <button class="btn btn-danger btn-xs" on:click|preventDefault={e=>{if(confirm('Delete?'))e.target.form.submit();}}>
                  <Icon name="trash" size={13} />
                </button>
              </form>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<!-- ── INFO / SITES ──────────────────────────────────────────── -->
{#if activeTab === 'info'}
<div class="info-tab-wrap">
  <p class="xs dimmed" style="margin-bottom:1rem">Gérez les photos des sites de décollage et d'atterrissage. Ces photos s'affichent sur la page Info des étudiants.</p>

  <div class="phase-lbl">Sites de décollage</div>
  <div class="site-photo-grid">
    {#each LAUNCHES as site}
    <div class="site-photo-card">
      <div class="sp-label">{site.label}</div>
      {#if sitePhoto(site.key, site.type)}
        <img src={sitePhoto(site.key, site.type)} alt={site.label} class="sp-img" />
      {:else}
        <div class="sp-placeholder">Photo à venir</div>
      {/if}
      <label class="btn btn-secondary btn-sm sp-upload-btn">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        {sitePhotoUploading === site.key + ':' + site.type ? `${sitePhotoProgress}%` : (sitePhoto(site.key, site.type) ? 'Remplacer' : 'Téléverser')}
        <input type="file" accept="image/*" style="display:none"
          disabled={sitePhotoUploading === site.key + ':' + site.type}
          on:change={e => { const f=e.target.files[0]; if(f) uploadSitePhoto(site.key, site.type, f); }} />
      </label>
      {#if sitePhotoUploading === site.key + ':' + site.type && sitePhotoProgress > 0}
      <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:.25rem">
        <div style="height:100%;width:{sitePhotoProgress}%;background:var(--teal);transition:width .15s"></div>
      </div>
      {/if}
    </div>
    {/each}
  </div>

  <div class="phase-lbl" style="margin-top:1.25rem">Zones d'atterrissage</div>
  <div class="site-photo-grid">
    {#each LANDINGS as site}
    <div class="site-photo-card">
      <div class="sp-label">{site.label}</div>
      {#if sitePhoto(site.key, site.type)}
        <img src={sitePhoto(site.key, site.type)} alt={site.label} class="sp-img" />
      {:else}
        <div class="sp-placeholder">Photo à venir</div>
      {/if}
      <label class="btn btn-secondary btn-sm sp-upload-btn">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        {sitePhotoUploading === site.key + ':' + site.type ? `${sitePhotoProgress}%` : (sitePhoto(site.key, site.type) ? 'Remplacer' : 'Téléverser')}
        <input type="file" accept="image/*" style="display:none"
          disabled={sitePhotoUploading === site.key + ':' + site.type}
          on:change={e => { const f=e.target.files[0]; if(f) uploadSitePhoto(site.key, site.type, f); }} />
      </label>
      {#if sitePhotoUploading === site.key + ':' + site.type && sitePhotoProgress > 0}
      <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:.25rem">
        <div style="height:100%;width:{sitePhotoProgress}%;background:var(--teal);transition:width .15s"></div>
      </div>
      {/if}
    </div>
    {/each}
  </div>
</div>
{/if}

<!-- QUIZ ─────────────────────────────────────────────────────────────────── -->
{#if activeTab === 'quiz'}
<div class="quiz-tab-wrap">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
    <span class="xs dimmed">{quiz?.length||0} question(s)</span>
    <button class="btn btn-primary btn-sm" on:click={() => { showAddQuiz = !showAddQuiz; editingQuiz = null; }}>+ Ajouter</button>
  </div>

  {#if showAddQuiz}
  <form method="POST" action="?/addQuiz" use:enhance on:submit={() => { showAddQuiz=false; }} class="quiz-edit-form">
    <div class="qf-grid">
      <label class="xs">Question (FR) *<textarea name="question_fr" rows="2" required></textarea></label>
      <label class="xs">Question (EN)<textarea name="question_en" rows="2"></textarea></label>
      <label class="xs">Option A (FR)<input name="opt_a_fr" /></label>
      <label class="xs">Option B (FR)<input name="opt_b_fr" /></label>
      <label class="xs">Option C (FR)<input name="opt_c_fr" /></label>
      <label class="xs">Option D (FR)<input name="opt_d_fr" /></label>
      <label class="xs">Bonne réponse<select name="correct"><option value="a">A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option></select></label>
      <label class="xs">Explication (FR)<textarea name="explain_fr" rows="2"></textarea></label>
      <label class="xs">Phase<select name="phase"><option value="p1">P1</option><option value="p2">P2</option></select></label>
      <label class="xs">Catégorie<input name="category" value="general" /></label>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:.5rem">
      <button type="submit" class="btn btn-primary btn-sm">Sauvegarder</button>
      <button type="button" class="btn btn-ghost btn-sm" on:click={() => showAddQuiz=false}>Annuler</button>
    </div>
  </form>
  {/if}

  <div class="quiz-list">
    {#each (quiz||[]) as q}
    <div class="quiz-card">
      {#if editingQuiz === q.id}
      {@const qfr = q.question_fr||''}
      {@const qen = q.question_en||''}
      {@const qa = q.opt_a_fr||''}{@const qb = q.opt_b_fr||''}{@const qcc = q.opt_c_fr||''}{@const qd = q.opt_d_fr||''}
      {@const qex = q.explain_fr||''}{@const qcat = q.category||'general'}
      <form method="POST" action="?/updateQuiz" use:enhance on:submit={() => editingQuiz=null} class="quiz-edit-form">
        <input type="hidden" name="id" value={q.id} />
        <div class="qf-grid">
          <label class="xs">Question (FR) *<textarea name="question_fr" rows="2">{qfr}</textarea></label>
          <label class="xs">Question (EN)<textarea name="question_en" rows="2">{qen}</textarea></label>
          <label class="xs">Option A (FR)<input name="opt_a_fr" value={qa} /></label>
          <label class="xs">Option B (FR)<input name="opt_b_fr" value={qb} /></label>
          <label class="xs">Option C (FR)<input name="opt_c_fr" value={qcc} /></label>
          <label class="xs">Option D (FR)<input name="opt_d_fr" value={qd} /></label>
          <label class="xs">Bonne réponse
            <select name="correct">
              {#each ['a','b','c','d'] as opt}
              <option value={opt} selected={q.correct===opt}>{opt.toUpperCase()}</option>
              {/each}
            </select>
          </label>
          <label class="xs">Explication (FR)<textarea name="explain_fr" rows="2">{qex}</textarea></label>
          <label class="xs">Phase<select name="phase"><option value="p1" selected={q.phase==='p1'}>P1</option><option value="p2" selected={q.phase==='p2'}>P2</option></select></label>
          <label class="xs">Catégorie<input name="category" value={qcat} /></label>
        </div>
        <div style="display:flex;gap:.5rem;margin-top:.5rem">
          <button type="submit" class="btn btn-primary btn-sm">Sauvegarder</button>
          <button type="button" class="btn btn-ghost btn-sm" on:click={() => editingQuiz=null}>Annuler</button>
        </div>
      </form>
      {:else}
      <div class="quiz-q">{q.question_fr}</div>
      {#if q.question_en}<div class="quiz-q-en xs muted">{q.question_en}</div>{/if}
      <div class="quiz-opts">
        {#each [['a',q.opt_a_fr],['b',q.opt_b_fr],['c',q.opt_c_fr],['d',q.opt_d_fr]] as [letter,opt]}
          {#if opt}
          <span class="quiz-opt" class:quiz-opt-correct={q.correct===letter}>
            <b>{letter.toUpperCase()}.</b> {opt}
          </span>
          {/if}
        {/each}
      </div>
      {#if q.explain_fr}<div class="quiz-explain xs muted">{q.explain_fr}</div>{/if}
      <div class="xs muted" style="margin-top:.25rem">{q.phase?.toUpperCase()} · {q.category}</div>
      <div style="display:flex;gap:.4rem;margin-top:.5rem">
        <button class="btn btn-ghost btn-xs" on:click={() => { editingQuiz=q.id; showAddQuiz=false; }}>Modifier</button>
        <form method="POST" action="?/deleteQuiz" use:enhance style="display:inline">
          <input type="hidden" name="id" value={q.id} />
          <button class="btn btn-danger btn-xs" on:click|preventDefault={e=>{if(confirm('Supprimer cette question?'))e.target.form.submit();}}>Supprimer</button>
        </form>
      </div>
      {/if}
    </div>
    {/each}
  </div>
</div>
{/if}

{#if activeTab === 'library'}
<div class="lib-tab-wrap">
  <h2 style="font-size:1rem;font-weight:700;margin-bottom:.875rem">Documents d'étude</h2>
  <p class="xs muted" style="margin-bottom:.75rem">Les documents apparaissent dans l'onglet Étude des étudiants. Utilisez des liens directs vers des PDFs (ex: /Manuel-FFVL.pdf pour les fichiers dans /static).</p>

  <!-- Add new document -->
  <div class="card" style="padding:.875rem;margin-bottom:.875rem">
    {#if libErr}<div class="xs" style="color:#ef4444;margin-bottom:.4rem">{libErr}</div>{/if}
    

    <form id="lib-add-form" style="display:flex;flex-direction:column;gap:.5rem">
      <div class="fg"><label class="fg-lbl">Titre du document</label>
        <input id="lib-title" required placeholder="ex: Manuel FFVL — Pilote à l'aile" class="inp" /></div>
      <div class="fg"><label class="fg-lbl">Description (optionnel)</label>
        <input id="lib-desc" placeholder="Court résumé du contenu" class="inp" /></div>

      <div class="lib-source-row">
        <label class="fg-lbl" style="margin-bottom:.25rem">Source</label>
        <div style="display:flex;gap:.5rem;margin-bottom:.4rem">
          <button type="button" class="lib-tab-btn" class:lib-tab-active={libMode==='file'}
            on:click={() => libMode = 'file'}>Uploader un PDF</button>
          <button type="button" class="lib-tab-btn" class:lib-tab-active={libMode==='url'}
            on:click={() => libMode = 'url'}>URL externe</button>
        </div>
        {#if libMode === 'file'}
        <input type="file" id="lib-file" accept=".pdf,.PDF,.png,.jpg" class="inp"
          style="padding:.3rem;cursor:pointer" />
        {:else}
        <input id="lib-url" placeholder="https://… ou /chemin/fichier.pdf" class="inp" />
        {/if}
      </div>

      <button type="button" class="btn btn-primary btn-sm"
        on:click={submitLibraryItem} disabled={libSubmitting}>
        {libSubmitting ? (libProgress > 0 ? `${libProgress}%` : 'Envoi…') : '+ Ajouter document'}
      </button>
      {#if libSubmitting && libProgress > 0}
      <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:.35rem">
        <div style="height:100%;width:{libProgress}%;background:var(--teal);border-radius:2px;transition:width .15s"></div>
      </div>
      {/if}
    </form>
  </div>

  <!-- Existing documents -->
  <div style="display:flex;flex-direction:column;gap:.4rem">
    {#if libraryItems?.length}
    {#each libraryItems as item}
    <div class="card lib-doc-card">
      <div style="display:flex;align-items:flex-start;gap:.625rem">
        <div style="flex:1">
          <div class="xs" style="font-weight:700;color:var(--txt)">{item.title}</div>
          {#if item.description}<div class="xs muted">{item.description}</div>{/if}
          <div class="xs muted" style="margin-top:.2rem;font-family:monospace;font-size:.7rem">{item.file_url}</div>
        </div>
        <form method="POST" action="?/deleteLibraryItem" use:enhance>
          <input type="hidden" name="id" value={item.id} />
          <button class="btn btn-danger btn-xs"
            on:click|preventDefault={e=>{if(confirm('Supprimer ce document?'))e.target.form.submit();}}>
            Supprimer
          </button>
        </form>
      </div>
    </div>
    {/each}
    {:else}
    <p class="xs muted">Aucun document. Ajoutez-en un ci-dessus.</p>
    {/if}
  </div>
</div>
{/if}

<style>
  .quiz-tab-wrap{max-width:700px}
  .quiz-list{display:flex;flex-direction:column;gap:.5rem}
  .quiz-card{background:var(--bg-raised);border-radius:9px;padding:.75rem}
  .quiz-q{font-size:.88rem;font-weight:600;color:var(--txt);line-height:1.4}
  .quiz-q-en{margin-top:.15rem}
  .quiz-opts{display:flex;flex-direction:column;gap:.15rem;margin:.35rem 0}
  .quiz-opt{font-size:.81rem;color:var(--txt-2);padding:.1rem 0}
  .quiz-opt-correct{color:var(--teal);font-weight:600}
  .quiz-explain{margin-top:.25rem;font-style:italic}
  .quiz-edit-form{background:var(--bg-2);border-radius:8px;padding:.75rem;display:flex;flex-direction:column;gap:.5rem;margin-bottom:.75rem}
  .qf-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
  @media(max-width:480px){.qf-grid{grid-template-columns:1fr}}
  .qf-grid label{display:flex;flex-direction:column;gap:.2rem}
  .qf-grid label input,.qf-grid label textarea,.qf-grid label select{background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:.3rem .45rem;color:var(--txt);font-size:.85rem;width:100%;font-family:inherit}
  .qf-grid label textarea{resize:vertical}
  .info-tab-wrap{max-width:700px}
  .site-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.75rem;margin-bottom:.5rem}
  .site-photo-card{background:var(--bg-raised);border-radius:10px;padding:.75rem;display:flex;flex-direction:column;gap:.5rem;align-items:center;text-align:center}
  .sp-label{font-weight:700;font-size:.85rem;color:var(--txt)}
  .sp-img{width:100%;height:90px;object-fit:cover;border-radius:7px}
  .sp-placeholder{background:var(--bg-2);border-radius:7px;height:90px;width:100%;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:var(--txt-3);border:2px dashed var(--border)}
  .sp-upload-btn{cursor:pointer;width:100%;justify-content:center}
  .page-hd { margin-bottom:1.5rem }
  .page-hd h1 { font-size:1.6rem }
  .page-hd p { color:var(--txt-2);font-size:.82rem;margin-top:.2rem }

  .content-layout { display:grid;grid-template-columns:360px 1fr;gap:1.5rem;align-items:start }
  @media(max-width:800px){ .content-layout { grid-template-columns:1fr } }
  .add-card h2 { font-size:1rem;margin-bottom:1.1rem }

  .phase-lbl { font-family:var(--ff-head);font-size:.67rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--teal);margin:.875rem 0 .4rem }

  .content-card { margin-bottom:.5rem;padding:.875rem 1rem }
  .cc-top { display:flex;align-items:flex-start;gap:.625rem;flex-wrap:wrap }
  .cc-expand { background:none;border:none;cursor:pointer;flex-shrink:0;padding:0;margin-top:.1rem }
  .cc-title { flex:1;font-weight:600;font-size:.875rem;color:var(--txt) }
  .cc-fr { flex-basis:100%;margin-left:1.5rem;margin-top:.1rem }
  .cc-acts { display:flex;gap:.35rem;margin-left:auto;flex-shrink:0 }

  .cc-preview { margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border) }
  .content-body { line-height:1.7;color:var(--txt-2) }

  .edit-form { margin-top:.875rem;padding-top:.875rem;border-top:1px solid var(--border) }
  .media-note { display:flex;align-items:flex-start;gap:.4rem;padding:.5rem .75rem;background:var(--teal-lo);border-radius:var(--r-xs);font-size:.78rem;color:var(--txt-2) }
  .media-note code { font-family:var(--ff-mono);font-size:.72rem;background:var(--bg-raised);padding:.1rem .3rem;border-radius:3px }
  .lib-tab-wrap{max-width:700px}
  .lib-doc-card{padding:.625rem .75rem}
  .fg{display:flex;flex-direction:column;gap:.2rem;margin-bottom:.4rem}
  .fg-lbl{font-size:.72rem;font-weight:600;color:var(--txt-3);text-transform:uppercase;letter-spacing:.04em}
  .inp{background:var(--bg-2);border:1px solid var(--border);border-radius:7px;padding:.35rem .6rem;color:var(--txt);font-size:.88rem;width:100%}
  .lib-tab-btn{padding:.25rem .6rem;border:1px solid var(--border);border-radius:6px;background:var(--bg-2);color:var(--txt-3);font-size:.75rem;cursor:pointer}
  .lib-tab-active{border-color:var(--teal);color:var(--teal);background:rgba(0,184,122,.08)}
  .lib-source-row{display:flex;flex-direction:column}
</style>
