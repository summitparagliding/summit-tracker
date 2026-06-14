<script>
  import { uploadFile } from '$lib/upload.js';
  import { uploadWithProgress } from '$lib/uploadWithProgress.js';
  import ConfidenceTrend from '$lib/components/ConfidenceTrend.svelte';
 import { enhance } from '$app/forms';
 import { page } from '$app/stores';
 import Icon from '$lib/components/Icon.svelte';
 import FlightReplay from '$lib/components/FlightReplay.svelte';
 export let data, form;
 $: ({ student, dash, payments, paymentProofs, bills, orders, confidenceTrend } = data);
  $: ct = confidenceTrend || { trend:'neutral', baseline:null, recent:null, last:null, data:[] };
 $: ({ stats, theory, exercises, exams, flights } = dash);

 let activeTab = 'overview';
  // Deep-link support: /instructor/students/123?tab=payments lands directly on that tab
  $: {
    const t = $page.url.searchParams.get('tab');
    if (t && ['overview','theory','exercises','flights','contact','payments','bills','orders'].includes(t)) {
      activeTab = t;
    }
  }
  let billProgress = 0;
  let proofUploadingId = null;
  let proofProgress    = 0;
  let billUploading = false;
  let billError = '';
 let replayFlight = null;

 function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
 function fmtDur(s) {
 if (!s) return '—';
 const h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
 return h>0?`${h}h ${m}m`:`${m}m`;
 }
 function pct(a,b) { return b ? Math.round(a/b*100) : 0; }
 function ftLabel(t) {
   const m = { regular:'Regular', soaring:'Soaring', thermal:'Thermal', thermal_soaring:'Thermal+Soaring' };
   return m[t] || t || '—';
 }

 $: completedFlights = flights.filter(f=>f.status==='complete');
</script>

<svelte:head><title>{student.name} — Instructor</title></svelte:head>

<!-- Header -->
<div class="stu-header">
 <span class="big-av">{student.name[0]}</span>
 <div class="stu-info">
 <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.25rem">
  <h1>{student.name}</h1>
  <div style="display:flex;gap:.5rem">
    <a href="/api/student/{student.id}/report?lang=fr" class="btn btn-secondary btn-sm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      PDF — FR
    </a>
    <a href="/api/student/{student.id}/report?lang=en" class="btn btn-secondary btn-sm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      PDF — EN
    </a>
  </div>
</div>
 <div class="stu-meta">
 {#if student.email}<span> {student.email}</span>{/if}
 {#if student.phone}<span> {student.phone}</span>{/if}
 <span> {fmtDate(student.enrollment_date)}</span>
 </div>
 </div>
 <a href="/instructor/students" class="btn btn-secondary btn-sm">← Students</a>
</div>

<!-- Progress strip -->
<div class="prog-strip card">
 {#each [
 [stats.flightCount, 'Flights', 'var(--sky)'],
 [fmtDur(stats.airtime),'Air Time', 'var(--teal)'],
 [`${stats.theoryDone}/${stats.theoryTotal}`,'Theory','var(--txt)'],
 [`${stats.exDone}/${stats.exTotal}`, 'Exercises', 'var(--green)'],
 [`${stats.examsDone}/${stats.examsTotal}`,'Exams', 'var(--txt)'],
 ] as [val,lbl,col]}
 <div class="ps-item">
 <span class="ps-val" style="color:{col}">{val}</span>
 <span class="ps-lbl">{lbl}</span>
 </div>
 {/each}
</div>

<div class="tabs">
 {#each [['overview','Overview'],['theory','Theory'],['exercises','Exercises'],['flights','Flights'],['contact','Contact'],['payments','Payments'],['bills','Bills'],['orders','Orders']] as [id,label]}
 <button class="tab" class:active={activeTab===id} on:click={()=>activeTab=id}>{label}</button>
 {/each}
</div>

<!-- OVERVIEW -->
{#if activeTab==='overview'}
{#if ct.data?.length}
<div class="card" style="padding:.625rem .875rem;margin-bottom:.75rem">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
    <span class="xs" style="font-weight:700;color:var(--txt-2)">Confiance — Confidence trend</span>
    <span class="xs muted">{ct.data.length} vol{ct.data.length>1?'s':''}</span>
  </div>
  <ConfidenceTrend data={ct.data} trend={ct.trend} baseline={ct.baseline} recent={ct.recent} last={ct.last} />
</div>
{/if}
 <div class="two-col">
 <div class="card">
 <h3 class="sec-title">Admin</h3>
 {#if form?.pinOk}<div class="alert alert-ok">PIN updated </div>{/if}
 {#if form?.pinErr}<div class="alert alert-err">{form.pinErr}</div>{/if}
 <form method="POST" action="?/resetPin" use:enhance>
 <div class="form-group">
 <label>Reset PIN</label>
 <div style="display:flex;gap:.5rem;align-items:flex-end">
 <input name="pin" type="text" inputmode="numeric" maxlength="4"
 placeholder="New 4-digit PIN" pattern="\d{4}"
 style="max-width:120px;letter-spacing:.2em;font-family:var(--ff-mono)" />
 <button type="submit" class="btn btn-secondary btn-sm">Reset</button>
 </div>
 </div>
 </form>

 {#if form?.notesOk}<div class="alert alert-ok">Notes saved </div>{/if}
 <form method="POST" action="?/updateNotes" use:enhance>
 <div class="form-group">
 <label>Instructor Notes</label>
 <textarea name="notes" rows="4">{student.notes ?? ''}</textarea>
 </div>
 <button type="submit" class="btn btn-secondary btn-sm">Save Notes</button>
 </form>
 </div>

 <div class="card">
 <h3 class="sec-title">Course Progress</h3>
 {#each [
 ['Theory', stats.theoryDone, stats.theoryTotal, 'var(--sky)'],
 ['Exercises', stats.exDone, stats.exTotal, 'var(--green)'],
 ['Exams', stats.examsDone, stats.examsTotal, 'var(--amber)'],
 ] as [label, done, total, col]}
 <div class="prog-row">
 <span class="pr-lbl">{label}</span>
 <div class="progress-bar" style="flex:1">
 <div class="progress-fill" style="width:{pct(done,total)}%;background:{col}"></div>
 </div>
 <span class="pr-num mono small">{done}/{total}</span>
 </div>
 {/each}
 </div>
 </div>
{/if}

<!-- THEORY -->
{#if activeTab==='theory'}
 <div class="table-wrap">
 <table>
 <thead><tr><th>Block</th><th>Phase</th><th>Status</th><th>Completed</th></tr></thead>
 <tbody>
 {#each theory as b}
 <tr>
 <td style="font-weight:500">{b.title}</td>
 <td><span class="badge badge-purple">{b.phase.toUpperCase()}</span></td>
 <td>{#if b.completed}<span class="badge badge-pass">Done</span>{:else}<span class="badge badge-pend">Pending</span>{/if}</td>
 <td class="mono small muted">{b.completed_at ? fmtDate(b.completed_at) : '—'}</td>
 </tr>
 {/each}
 </tbody>
 </table>
 </div>

 <!-- Theory exams ONLY -->
 {#if exams.filter(e => e.exam_type === 'theory').length}
 <h3 class="sec-title" style="margin:1.25rem 0 .75rem">Examens théoriques</h3>
 <div class="table-wrap">
 <table>
 <thead><tr><th>Examen</th><th>Phase</th><th>Soumis</th><th>Résultat</th><th>Notes</th></tr></thead>
 <tbody>
 {#each exams.filter(e => e.exam_type === 'theory') as e}
 <tr>
 <td style="font-weight:500">{e.exam_title}</td>
 <td><span class="badge badge-purple">{e.phase?.toUpperCase() || 'P1'}</span></td>
 <td class="mono small muted">{e.created_at ? fmtDate(e.created_at) : '—'}</td>
 <td>
 {#if e.passed===1 && e.signed_off_at}
 <span class="badge badge-pass">Réussi</span>
 {:else if e.passed===0}
 <span class="badge badge-fail">Échoué</span>
 {:else if e.student_notes}
 <span class="badge badge-pend">À valider</span>
 {:else}
 <span class="badge badge-none">Non tenté</span>
 {/if}
 </td>
 <td class="small muted">{e.instructor_notes || e.student_notes || '—'}</td>
 </tr>
 {/each}
 </tbody>
 </table>
 </div>
 {/if}
{/if}

<!-- EXERCISES -->
{#if activeTab==='exercises'}
 <div class="table-wrap">
 <table>
 <thead><tr><th>Exercise</th><th>Category</th><th>Status</th><th>Date</th><th>Notes</th></tr></thead>
 <tbody>
 {#each exercises as ex}
 <tr>
 <td style="font-weight:500">{ex.exercise_title}</td>
 <td class="small muted">{ex.category?.replace('_',' ')}</td>
 <td>
 {#if ex.status==='passed'} <span class="badge badge-pass">Passed</span>
 {:else if ex.status==='failed'}<span class="badge badge-fail">Failed</span>
 {:else if ex.status==='pending'}<span class="badge badge-pend">Pending</span>
 {:else} <span class="badge badge-none">Not attempted</span>
 {/if}
 </td>
 <td class="mono small muted">{ex.date ? fmtDate(ex.date) : '—'}</td>
 <td class="small muted">{ex.instructor_notes || ex.attempt_notes || '—'}</td>
 </tr>
 {/each}
 </tbody>
 </table>
 </div>
{/if}

<!-- FLIGHTS -->
{#if activeTab==='flights'}
  {#if replayFlight}
    <FlightReplay flight={replayFlight} onClose={() => replayFlight = null} />
  {/if}
  {#if completedFlights.length}
  <div class="table-wrap">
  <table>
  <thead><tr><th>Date</th><th>Site</th><th>Duration</th><th>Distance</th><th>Launch</th><th>Landing</th><th>Type</th><th>Replay</th><th>Share</th></tr></thead>
  <tbody>
  {#each completedFlights as f}
  <tr>
  <td class="mono small muted">{fmtDate(f.date)}</td>
  <td>{f.site||'—'}</td>
  <td class="mono small" style="color:var(--sky)">{fmtDur(f.duration_seconds)}</td>
  <td class="mono small">{f.distance_km!=null?f.distance_km+' km':'—'}</td>
  <td>{f.launch_quality ? f.launch_quality+'/5' : '—'}</td>
  <td>{f.landing_quality ? f.landing_quality+'/5' : '—'}</td>
  <td><span class="badge badge-info">{ftLabel(f.flight_type)}</span></td>
  <td>
    {#if f.track_geojson}
      <button class="btn btn-primary btn-sm" on:click={() => replayFlight = f}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><polygon points="5,3 19,12 5,21"/></svg>
        Replay
      </button>
    {:else}—{/if}
  </td>
  <td><a href="/flight/{f.id}" target="_blank" class="btn btn-secondary btn-sm">View</a></td>
  </tr>
  {/each}
  </tbody>
  </table>
  </div>
  {:else}
  <div class="empty"><div class="ico"></div>No flights logged yet</div>
  {/if}
{/if}

<!-- DANGER ZONE -->
<div class="danger-zone">
  <form method="POST" action="?/resetStudent" use:enhance>
    <button class="btn btn-danger btn-sm"
      on:click|preventDefault={e => {
        if (confirm(`⚠️ Remettre ${student.name} à zéro ?

Ceci effacera TOUS ses exercices, vols, examens, théorie, commandes et factures. L'étudiant gardera son compte.

Cette action est irréversible.`))
          e.target.form.submit();
      }}>
      Remettre à zéro (reset)
    </button>
  </form>
</div>

<!-- CONTACT -->
{#if activeTab==='contact'}
<div class="contact-wrap">
  {#if form?.contactOk}<div class="alert alert-ok">Contact info saved</div>{/if}
  <div class="contact-card">
    <div class="sec-title">Student Contact</div>
    <div class="contact-grid">
      <div class="cg-row"><span class="cg-lbl">Name</span><span class="cg-val">{student.name}</span></div>
      {#if student.phone}<div class="cg-row"><span class="cg-lbl">Phone</span><a href="tel:{student.phone}" class="cg-val link">{student.phone}</a></div>{/if}
      {#if student.email}<div class="cg-row"><span class="cg-lbl">Email</span><a href="mailto:{student.email}" class="cg-val link">{student.email}</a></div>{/if}
    </div>
  </div>
  {#if student.emergency_contact_name}
  <div class="contact-card em-card">
    <div class="sec-title"> Emergency Contact</div>
    <div class="contact-grid">
      <div class="cg-row"><span class="cg-lbl">Name</span><span class="cg-val">{student.emergency_contact_name}</span></div>
      {#if student.emergency_contact_relationship}<div class="cg-row"><span class="cg-lbl">Relation</span><span class="cg-val">{student.emergency_contact_relationship}</span></div>{/if}
      {#if student.emergency_contact_phone}<div class="cg-row"><span class="cg-lbl">Phone</span><a href="tel:{student.emergency_contact_phone}" class="cg-val link">{student.emergency_contact_phone}</a></div>{/if}
    </div>
  </div>
  {/if}
  <form method="POST" action="?/saveContact" use:enhance class="contact-form">
    <div class="sec-title" style="margin-top:1rem">Edit Contact Info</div>
    <div class="row2">
      <div class="fg"><label>Phone</label><input name="phone" value={student.phone||''} placeholder="+1 514 xxx xxxx" /></div>
      <div class="fg"><label>Email</label><input name="email" type="email" value={student.email||''} /></div>
    </div>
    <div class="row3">
      <div class="fg"><label>Emergency name</label><input name="emergency_contact_name" value={student.emergency_contact_name||''} /></div>
      <div class="fg"><label>Relationship</label><input name="emergency_contact_relationship" value={student.emergency_contact_relationship||''} placeholder="Parent, spouse…" /></div>
      <div class="fg"><label>Emergency phone</label><input name="emergency_contact_phone" value={student.emergency_contact_phone||''} /></div>
    </div>
    <button type="submit" class="btn btn-primary btn-sm">Save Contact Info</button>
  </form>
</div>
{/if}

<!-- PAYMENTS -->
{#if activeTab==='payments'}
<div class="pay-wrap">
  {#if form?.payOk}<div class="alert alert-ok">Payment recorded</div>{/if}
  <!-- Billing setup -->
  <div class="bill-setup-card">
    <div class="sec-title">Frais de formation / Billing</div>
    <div class="bill-setup-grid">
      <div>
        <div class="xs muted" style="margin-bottom:.2rem">Montant total dû</div>
        <form method="POST" action="?/setTotalDue" use:enhance class="bill-amt-form">
          <input name="amount" type="number" step="0.01" min="0" placeholder="0.00"
            value={student?.total_due||''} class="bill-amt-input" />
          <button class="btn btn-secondary btn-sm" type="submit">Définir</button>
        </form>
      </div>
      <div>
        <div class="xs muted" style="margin-bottom:.2rem">Facture (PDF ou image)</div>
        <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
          {#if student?.bill_url}
            <a href={student.bill_url} target="_blank" class="btn btn-ghost btn-xs">Voir</a>
            <button class="btn btn-danger btn-xs" on:click={async () => {
              await fetch('/api/bill', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({student_id:student.id}) });
              location.reload();
            }}>Retirer</button>
          {:else}
            <label class="btn btn-secondary btn-sm" style="cursor:pointer">
              {billUploading ? `${billProgress}%` : 'Joindre facture'}
              <input type="file" accept=".pdf,image/*" style="display:none" disabled={billUploading} on:change={async e => {
                const file = e.target.files[0]; if (!file) return;
                billUploading = true; billProgress = 0; billError = '';
                const fd = new FormData();
                fd.append('file', file);
                fd.append('student_id', student.id);
                fd.append('title', file.name);
                try {
                  await uploadWithProgress('/api/bill', fd, { onProgress: p => billProgress = p });
                  location.reload();
                } catch(err) { billError = err.message; billUploading = false; }
              }} />
            </label>
            {#if billUploading}
            <div style="width:100%;height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:.25rem">
              <div style="height:100%;width:{billProgress}%;background:var(--teal);border-radius:2px;transition:width .15s"></div>
            </div>
            {/if}
            {#if billError}<div class="xs" style="color:#ef4444;margin-top:.25rem">{billError}</div>{/if}
          {/if}
        </div>
      </div>
    </div>
    <!-- Balance overview -->
    {#if (student?.total_due||0) > 0}
    {@const paid = payments?.reduce((s,p)=>s+(p.status==='paid'?Number(p.amount||0):0),0)||0}
    {@const due  = student?.total_due||0}
    <div class="bill-balance-strip">
      <span class="xs">{due.toFixed(2)} $ dû</span>
      <span class="xs" style="color:var(--teal)">− {paid.toFixed(2)} $ payé</span>
      <span class="xs" style="font-weight:700;color:{due-paid>0?'var(--red)':'var(--teal)'}">= {(due-paid).toFixed(2)} $ solde</span>
    </div>
    {/if}
  </div>
  <div class="pay-summary">
    <span class="pay-total-lbl">Total paid</span>
    <span class="pay-total mono">{payments?.reduce((s,p)=>s+(p.status==='paid'?p.amount:0),0).toFixed(2)} $</span>
  </div>
  <div class="pay-list">
    {#each (payments||[]) as p}
      <div class="pay-row" class:pay-pending={p.status==='pending'}>
        <span class="pay-date mono xs">{p.date}</span>
        <span class="pay-method xs">{p.method||'—'}</span>
        <span class="pay-note xs muted">{p.notes||''}</span>
        <span class="pay-status badge {p.status==='paid'?'badge-ok':p.status==='rejected'?'badge-rej':'badge-warn'}">{p.status}</span>
        <span class="pay-amt mono">{Number(p.amount||0).toFixed(2)} $</span>
        {#if p.status === 'pending'}
          <form method="POST" action="?/approvePayment" use:enhance style="display:contents">
            <input type="hidden" name="id" value={p.id} />
            <button class="btn btn-success btn-xs" title="Approuver">✓ OK</button>
          </form>
          <form method="POST" action="?/rejectPayment" use:enhance style="display:contents">
            <input type="hidden" name="id" value={p.id} />
            <button class="btn btn-danger btn-xs" title="Refuser">✕</button>
          </form>
        {:else if paymentProofs?.[p.id]}
          <a href={paymentProofs[p.id].url} target="_blank" class="btn btn-ghost btn-xs">Preuve</a>
        {:else}
          <label class="btn btn-ghost btn-xs" style="cursor:pointer">
            {proofUploadingId === p.id ? `${proofProgress}%` : 'Preuve'}
            <input type="file" accept="image/*,.pdf" style="display:none"
              disabled={proofUploadingId === p.id}
              on:change={async e => {
                const file = e.target.files[0]; if (!file) return;
                proofUploadingId = p.id; proofProgress = 0;
                try {
                  const res = await uploadFile(file, {
                    purpose: 'payment_proof',
                    meta:    { payment_id: p.id },
                    onProgress: pct => { proofProgress = pct; }
                  });
                  if (res.ok) location.reload();
                } finally {
                  proofUploadingId = null;
                  proofProgress = 0;
                }
              }} />
          </label>
        {/if}
      </div>
    {:else}
      <div class="muted xs" style="padding:.75rem">No payments recorded yet.</div>
    {/each}
  </div>
  <form method="POST" action="?/addPayment" use:enhance class="pay-form">
    <div class="sec-title">Add Payment</div>
    <div class="row3">
      <div class="fg"><label>Amount ($)</label><input name="amount" type="number" step="0.01" min="0" placeholder="500.00" required /></div>
      <div class="fg"><label>Date</label><input name="date" type="date" value={new Date().toISOString().slice(0,10)} /></div>
      <div class="fg"><label>Method</label>
        <select name="method">
          <option value="interac">Interac</option>
          <option value="cash">Cash</option>
          <option value="cheque">Cheque</option>
          <option value="card">Card</option>
        </select>
      </div>
    </div>
    <div class="row2">
      <div class="fg"><label>Notes</label><input name="notes" placeholder="Acompte, solde…" /></div>
      <div class="fg"><label>Status</label>
        <select name="status"><option value="paid">Paid</option><option value="partial">Partial</option><option value="pending">Pending</option></select>
      </div>
    </div>
    <button type="submit" class="btn btn-primary btn-sm">Record Payment</button>
  </form>
</div>
{/if}<!-- BILLS -->
{#if activeTab==='bills'}
<div class="pay-wrap">
  <div class="sec-title">Factures / Documents</div>
  <!-- Upload -->
  <div class="bill-upload-card">
    <label class="bill-upload-lbl">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5 a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      {billUploading ? `Envoi ${billProgress}%` : 'Téléverser une facture (PDF ou image)'}
      <input type="file" accept=".pdf,image/*" style="display:none" disabled={billUploading} on:change={async e => {
        const file = e.target.files[0]; if (!file) return;
        const title = prompt('Titre de la facture:', file.name) || file.name;
        billUploading = true; billProgress = 0; billError = '';
        const fd = new FormData();
        fd.append('file', file);
        fd.append('student_id', student.id);
        fd.append('title', title);
        try {
          await uploadWithProgress('/api/bill', fd, { onProgress: p => billProgress = p });
          location.reload();
        } catch(err) { billError = err.message; billUploading = false; }
      }} />
    </label>
    {#if billUploading}
    <div style="width:100%;height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:.4rem">
      <div style="height:100%;width:{billProgress}%;background:var(--teal);border-radius:2px;transition:width .15s"></div>
    </div>
    {/if}
    {#if billError}<div class="xs" style="color:#ef4444;margin-top:.25rem">{billError}</div>{/if}
  </div>
  {#if !bills?.length}
    <div class="muted xs" style="padding:.75rem">Aucune facture.</div>
  {:else}
    <div class="bill-list">
      {#each (bills||[]) as b}
      <div class="bill-row">
        <div class="bill-info">
          <div class="bill-title">{b.title}</div>
          <div class="xs muted">{new Date(b.uploaded_at).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;gap:.35rem;align-items:center">
          <a href={b.r2_key ? '/api/file?key='+encodeURIComponent(b.r2_key) : b.url}
             target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Voir</a>
          <form method="POST" action="?/deleteBill" use:enhance style="display:inline">
            <input type="hidden" name="id" value={b.id} />
            <button class="btn btn-danger btn-xs" on:click|preventDefault={e=>{if(confirm('Supprimer?'))e.target.form.submit();}}>X</button>
          </form>
        </div>
      </div>
      {/each}
    </div>
  {/if}
</div>
{/if}

<!-- ORDERS -->
{#if activeTab==='orders'}
<div class="pay-wrap">
  <div class="sec-title">Commandes / Demandes</div>
  {#if !orders?.length}
    <div class="muted xs" style="padding:.75rem">Aucune commande.</div>
  {:else}
    <div class="bill-list">
      {#each (orders||[]) as o}
      <div class="order-detail-row">
        <div class="order-d-info">
          <div class="xs muted">{new Date(o.created_at).toLocaleDateString()}</div>
          <div class="order-d-desc">{o.description}</div>
          {#if o.instructor_response}<div class="xs" style="color:var(--teal);margin-top:.2rem">Réponse: {o.instructor_response}</div>{/if}
        </div>
        <div style="display:flex;gap:.35rem;align-items:flex-start;flex-direction:column;flex-shrink:0">
          <span class="badge {o.status==='confirmed'?'badge-pass':o.status==='responded'?'badge-info':'badge-pend'}">{o.status}</span>
          {#if o.status === 'pending'}
          <form method="POST" action="?/respondOrder" use:enhance style="display:flex;flex-direction:column;gap:.25rem">
            <input type="hidden" name="order_id" value={o.id} />
            <input name="response" placeholder="Réponse…" class="mini-input" />
            <button class="btn btn-primary btn-xs" type="submit">Répondre</button>
          </form>
          {/if}
          {#if o.status === 'responded' || o.status === 'pending'}
          <form method="POST" action="?/confirmOrder" use:enhance>
            <input type="hidden" name="order_id" value={o.id} />
            <button class="btn btn-secondary btn-xs">Confirmer réception</button>
          </form>
          {/if}
          {#if o.status === 'confirmed'}
          <button class="btn btn-ghost btn-xs" on:click={() => {
            const lines = [
              'SUMMIT PARAGLIDING — BON DE COMMANDE',
              '═══════════════════════════════════',
              'Client: ' + student.name,
              'Date: ' + new Date().toLocaleDateString('fr-CA'),
              '',
              'Commande:',
              o.description,
              '',
              'Statut: CONFIRMÉ',
              '',
              '─────────────────────────────────────',
              'Summit Paragliding · SummitParagliding.com',
              '+1 438 763 1350',
            ].join('\n');
            const w = window.open('', '_blank');
            w.document.write('<pre style="font-family:monospace;padding:2rem;white-space:pre-wrap">' + lines + '<\/pre>');
            w.document.title = 'Bon de commande — ' + student.name;
            w.print();
          }}>
            Imprimer bon
          </button>
          {/if}
          <form method="POST" action="?/deleteOrder" use:enhance style="display:inline">
            <input type="hidden" name="id" value={o.id} />
            <button class="btn btn-danger btn-xs" on:click|preventDefault={e=>{if(confirm('Supprimer?'))e.target.form.submit();}}>X</button>
          </form>
        </div>
      </div>
      {/each}
    </div>
  {/if}
</div>
{/if}

<style>
 .stu-header { display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap; }
 .big-av { width:52px;height:52px;border-radius:50%;background:var(--sky-lo);border:2px solid rgba(14,165,233,.3);color:var(--sky);font-family:var(--ff-head);font-weight:800;font-size:1.4rem;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
 .stu-info { flex:1; }
 .stu-info h1 { font-size:1.5rem;margin-bottom:.2rem; }
 .stu-meta { display:flex;flex-wrap:wrap;gap:.75rem;font-size:.82rem;color:var(--txt-2); }

 .prog-strip { display:flex;flex-wrap:wrap;gap:0;margin-bottom:1.5rem;padding:.875rem 1.25rem; }
 .ps-item { flex:1;min-width:80px;text-align:center; }
 .ps-item+.ps-item { border-left:1px solid var(--border); }
 .ps-val { display:block;font-family:var(--ff-mono);font-size:1.2rem;font-weight:500;line-height:1;margin-bottom:.2rem; }
 .ps-lbl { font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--txt-3); }

 .two-col { display:grid;grid-template-columns:1fr 1fr;gap:1.25rem; }
 @media(max-width:700px){.two-col{grid-template-columns:1fr;}}
 .sec-title { font-size:.78rem;text-transform:uppercase;letter-spacing:.07em;color:var(--txt-3);margin-bottom:.875rem; }

 .prog-row { display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem; }
 .pr-lbl { font-size:.8rem;color:var(--txt-2);width:70px;flex-shrink:0; }
 .pr-num { width:36px;text-align:right;flex-shrink:0;color:var(--txt-2); }
/* Contact & Payments — appended for v42 */
  .contact-wrap,.pay-wrap{display:flex;flex-direction:column;gap:1rem;max-width:600px}
  .contact-card{background:var(--bg-raised);border-radius:10px;padding:.875rem}
  .em-card{border-left:3px solid var(--red)}
  .contact-grid{display:flex;flex-direction:column;gap:.3rem}
  .cg-row{display:flex;gap:.5rem;align-items:baseline;padding:.25rem 0;border-bottom:1px solid var(--border)}
  .cg-row:last-child{border-bottom:none}
  .cg-lbl{font-size:.72rem;font-weight:700;color:var(--txt-3);min-width:80px;text-transform:uppercase;letter-spacing:.04em}
  .cg-val{font-size:.88rem;color:var(--txt)}
  .link{color:var(--teal);text-decoration:none}
  .contact-form{background:var(--bg-raised);border-radius:10px;padding:.875rem;display:flex;flex-direction:column;gap:.625rem}
  .row2{display:grid;grid-template-columns:1fr 1fr;gap:.625rem}
  .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.625rem}
  @media(max-width:500px){.row2,.row3{grid-template-columns:1fr}}
  .fg{display:flex;flex-direction:column;gap:.25rem}
  .fg label{font-size:.75rem;font-weight:600;color:var(--txt-3)}
  .fg input,.fg select{background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.35rem .5rem;color:var(--txt);font-size:.85rem}
  .pay-summary{background:rgba(0,184,122,.08);border:1px solid rgba(0,184,122,.2);border-radius:10px;padding:.75rem 1rem;display:flex;align-items:center;justify-content:space-between}
  .pay-total-lbl{font-size:.8rem;font-weight:600;color:var(--txt-2)}
  .pay-total{font-size:1.4rem;font-weight:700;color:var(--teal)}
  .pay-list{background:var(--bg-raised);border-radius:10px;overflow:hidden}
  .pay-row{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem;padding:.45rem .75rem;border-bottom:1px solid var(--border);font-size:.82rem}
  .pay-row.pay-pending{background:rgba(245,158,11,.05)}
  .pay-date{flex-shrink:0;min-width:80px}
  .pay-method{flex-shrink:0;min-width:60px}
  .pay-note{flex:1;min-width:0}
  .pay-status{flex-shrink:0}
  .pay-amt{flex-shrink:0;min-width:60px;text-align:right}
  .badge-rej{background:rgba(239,68,68,.15);color:var(--red)}
  .pay-row:last-child{border-bottom:none}
  .pay-form{background:var(--bg-raised);border-radius:10px;padding:.875rem;display:flex;flex-direction:column;gap:.625rem}
  .badge-warn{background:rgba(217,119,6,.15);color:var(--amber)}
  .muted{color:var(--txt-3)}
  .bill-upload-card{background:var(--bg-raised);border-radius:10px;padding:.75rem;margin-bottom:.75rem}
  .bill-upload-lbl{display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.85rem;color:var(--teal);font-weight:600;border:2px dashed var(--teal);border-radius:8px;padding:.625rem;justify-content:center}
  .bill-list{display:flex;flex-direction:column;gap:.4rem}
  .bill-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem;background:var(--bg-raised);border-radius:8px;padding:.5rem .75rem}
  .bill-info{flex:1}
  .bill-title{font-size:.85rem;font-weight:600;color:var(--txt)}
  .order-detail-row{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;background:var(--bg-raised);border-radius:8px;padding:.5rem .75rem}
  .order-d-info{flex:1}
  .order-d-desc{font-size:.85rem;color:var(--txt-2);margin-top:.15rem}
.mini-input{background:var(--bg-2);border:1px solid var(--border);border-radius:5px;padding:.25rem .4rem;color:var(--txt);font-size:.78rem;width:120px}
.danger-zone{margin:.75rem 0;padding:.625rem .875rem;background:rgba(220,38,38,.05);border:1px solid rgba(220,38,38,.2);border-radius:8px;display:flex;align-items:center;justify-content:flex-end}
  .bill-setup-card{background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:.75rem;margin-bottom:.875rem}
  .bill-setup-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:.5rem}
  @media(max-width:480px){.bill-setup-grid{grid-template-columns:1fr}}
  .bill-amt-form{display:flex;gap:.4rem;align-items:center}
  .bill-amt-input{background:var(--bg-2);border:1px solid var(--border);border-radius:7px;padding:.3rem .6rem;color:var(--txt);font-size:.88rem;width:7rem}
  .bill-balance-strip{display:flex;gap:.75rem;flex-wrap:wrap;margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--border)}
</style>

