<script>
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { lang } from '$lib/stores/lang.js';

  export let data, form;
  $: flight    = data.flight;
  $: flightNum = data.flightNum;
  $: exercises = data.exercises || [];

  // ── URL params from active-flight ─────────────────────────
  let launchTime = '', landTime = '', airSecs = 0;
  let readonly = false;
  onMount(() => {
    const p = new URLSearchParams(window.location.search);
    launchTime = p.get('lt') || '';
    landTime   = p.get('ld') || '';
    airSecs    = Number(p.get('air')) || 0;
    readonly   = p.get('readonly') === '1' || flight?.status === 'complete';
    // Pre-fill from completed flight data
    if (flight?.status === 'complete') {
      launchQ      = flight.launch_quality    || 0;
      landingQ     = flight.landing_quality   || 0;
      flightType   = flight.flight_type       || '';
      launchType   = flight.launch_type       || '';
      landingSite  = flight.landing_site      || '';
      wentWell     = flight.what_went_well    || '';
      toImprove    = flight.what_to_improve   || '';
      personalNotes= flight.personal_notes    || '';
      nextGoals    = flight.next_goals        || '';
    }
  });

  // ── Form state ─────────────────────────────────────────────
  let launchQ = 0, landingQ = 0;
  let flightType = '', launchType = '', landingSite = '';
  let confRating = 3;
  let wentWell = '', toImprove = '', personalNotes = '', nextGoals = '';
  const confOptions = {
    fr: [{v:1,l:"Très incertain"},{v:2,l:"Incertain"},{v:3,l:"Neutre"},{v:4,l:"Confiant"},{v:5,l:"Très confiant"}],
    en: [{v:1,l:"Very uncertain"},{v:2,l:"Uncertain"},{v:3,l:"Neutral"},{v:4,l:"Confident"},{v:5,l:"Very confident"}]
  };
  // selectedExIds: Set of exercise IDs the student checked
  let selectedExIds = new Set();
  let submitting = false;
  let formErrors = [];

  // ── Exercise grouping (same subcats as exercises tab) ──────
  function subcat(ex) {
    const t = ex.title.toLowerCase();
    if (t.includes('p2-') || t.startsWith('p2 —') || t.startsWith('p2 -')) return 'p2';
    const num = parseInt(ex.title.match(/#(\d+)/)?.[1]);
    if (!isNaN(num)) {
      if (num <= 10) return 'pf';
      if (num <= 18) return 'lch';
      if (num <= 37) return 'if';
      if (num <= 42) return 'lnd';
    }
    return 'if';
  }

  const catDefs = [
    { key:'if',  enLabel:'In-flight (#19–37)',      frLabel:'En vol (#19–37)'       },
    { key:'lnd', enLabel:'Landing (#38–42)',         frLabel:'Atterrissage (#38–42)' },
    { key:'p2',  enLabel:'P2',                      frLabel:'P2'                    },
    { key:'pf',  enLabel:'Pre-flight (#1–10)',       frLabel:'Pré-vol (#1–10)'       },
    { key:'lch', enLabel:'Launch (#11–18)',          frLabel:'Décollage (#11–18)'    },
  ];

  $: groups = catDefs
    .map(def => ({
      ...def,
      list: exercises.filter(e => subcat(e) === def.key)
    }))
    .filter(g => g.list.length);

  // Open state per category — in-flight open by default
  let open = { if:false, lnd:false, p2:false, pf:false, ps:false, lch:false };

  function toggleEx(ex) {
    // Can't re-log a passed exercise
    if (ex.status === 'passed') return;
    const s = new Set(selectedExIds);
    if (s.has(ex.id)) s.delete(ex.id);
    else s.add(ex.id);
    selectedExIds = s;
  }

  function catLabel(g) {
    return $lang === 'fr' ? g.frLabel : g.enLabel;
  }

  // Count selected per group
  function selCount(g) {
    return g.list.filter(e => selectedExIds.has(e.id)).length;
  }

  // Star quality
  const qColors  = ['','var(--red)','var(--amber)','var(--txt-2)','var(--green)','var(--teal)'];
  const qLabelsE = ['','Poor','Fair','OK','Good','Excellent'];
  const qLabelsF = ['','Faible','Passable','OK','Bien','Excellent'];
  $: qL = $lang === 'fr' ? qLabelsF : qLabelsE;

  function fmtDur(s) {
    if (!s) return '—';
    const h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
    return h>0 ? `${h}h ${m}m` : `${m}m`;
  }
  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString($lang==='fr'?'fr-CA':'en-CA') : '';
  }

  // Suggest next incomplete airborne exercise
  $: nextSuggested = exercises.find(e =>
    (subcat(e) === 'if' || subcat(e) === 'lnd') &&
    e.status !== 'passed' && e.status !== 'pending'
  );

  // Next objectives — upcoming exercises in curriculum (chronological) order
  $: upcomingObjectives = exercises.filter(e =>
    (subcat(e) === 'if' || subcat(e) === 'lnd') && e.status !== 'passed'
  ).slice(0, 4);
  function addObjective(e) {
    if (readonly) return;
    const t = ($lang==='fr' && e.title_fr) ? e.title_fr : e.title;
    nextGoals = nextGoals ? (nextGoals.replace(/\s*$/,'') + '\n• ' + t) : ('• ' + t);
  }

  // Validation
  function validate() {
    if (!confRating) {
      alert($lang==='fr'?'Veuillez sélectionner votre niveau de confiance (1–5).':'Please select your confidence level (1–5).');
      return false;
    }
    formErrors = [];
    if (!launchType)   formErrors.push($lang==='fr'?'Type de décollage requis':'Select launch type');
    if (!landingSite)  formErrors.push($lang==='fr'?'Zone d\'atterrissage requise':'Select landing site');
    if (!flightType)   formErrors.push($lang==='fr'?'Type de vol requis':'Select flight type');
    if (!launchQ)      formErrors.push($lang==='fr'?'Évaluez le décollage':'Rate launch quality');
    if (!landingQ)     formErrors.push($lang==='fr'?'Évaluez l\'atterrissage':'Rate landing quality');
    return formErrors.length === 0;
  }
</script>

<svelte:head>
  <title>{$lang==='fr'?'Formulaire post-vol':'Post-Flight Form'} — Summit</title>
</svelte:head>

<div class="pf-header">
  <img src="/wings-logo.jpg" alt="" class="pf-logo" />
  <div>
    <h1>{$lang==='fr'?'Formulaire post-vol':'Post-Flight Form'}</h1>
    <p class="dimmed small">{fmtDate(flight?.date)} · {flight?.site?.replace(/_/g,' ')||'—'}</p>
  </div>
</div>

{#if form?.error}
  <div class="alert alert-err"><Icon name="alert" size={14} />{form.error}</div>
{/if}

<form method="POST" action="?/complete" enctype="multipart/form-data"
  on:submit|preventDefault={e => { if (validate()) { submitting=true; e.target.submit(); } }}>

  <!-- Hidden fields -->
  <input type="hidden" name="flight_num"       value={flightNum} />
  <input type="hidden" name="start_time"       value={launchTime} />
  <input type="hidden" name="end_time"         value={landTime} />
  <input type="hidden" name="airborne_seconds" value={airSecs} />

  <!-- Selected exercise IDs — one hidden input per selected ID -->
  {#each [...selectedExIds] as exId}
    <input type="hidden" name="exercise_log_id" value={exId} />
  {/each}
  <!-- Also send titles for the flight record display -->
  {#each exercises.filter(e => selectedExIds.has(e.id)) as ex}
    <input type="hidden" name="exercises_done"
      value={$lang==='fr'&&ex.title_fr ? ex.title_fr : ex.title} />
  {/each}

  <!-- Auto-detected times banner -->
  {#if launchTime || landTime}
    <div class="time-banner">
      <div class="tb-item">
        <Icon name="flights" size={14} color="var(--green)" />
        <span class="xs">{$lang==='fr'?'Décollage':'Launch'}
          <strong class="mono">{launchTime||'—'}</strong></span>
      </div>
      <span class="tb-arrow dimmed">→</span>
      <div class="tb-item">
        <Icon name="flag" size={14} color="var(--red)" />
        <span class="xs">{$lang==='fr'?'Atterrissage':'Landing'}
          <strong class="mono">{landTime||'—'}</strong></span>
      </div>
      {#if airSecs > 0}
        <span class="tb-dur mono teal">{fmtDur(airSecs)}</span>
      {/if}
    </div>
  {/if}

  <!-- Launch type -->
  <div class="card card-sm field-block">
    <div class="section-label"><Icon name="flights" size={13} />
      {$lang==='fr'?'Type de décollage':'Launch Type'}
    </div>
    <div class="type-grid-2">
      {#each [['forward',$lang==='fr'?'Face voile':'Forward'],['reverse',$lang==='fr'?'Dos voile':'Reverse']] as [val,lbl]}
        <label class="site-chip">
          <input type="radio" name="launch_type" value={val} bind:group={launchType} />
          <span class="sc-inner"><span class="sc-name">{lbl}</span></span>
        </label>
      {/each}
    </div>
  </div>

  <!-- Landing site -->
  <div class="card card-sm field-block">
    <div class="section-label"><Icon name="flag" size={13} />
      {$lang==='fr'?'Zone d\'atterrissage':'Landing Site'}
    </div>
    <div class="land-grid">
      {#each [
        ['n_club',    $lang==='fr'?'Club':'Club',      'N'],
        ['o_jardin',  'Jardin',                        'O'],
        ['o_alt',     'Alt. O',                        'O'],
        ['s_alt',     'Alt. S',                        'S'],
        ['arbrissage',$lang==='fr'?'Arbrissage':'Trees',''],
      ] as [val,lbl,dir]}
        <label class="site-chip">
          <input type="radio" name="landing_site" value={val} bind:group={landingSite} />
          <span class="sc-inner">
            <span class="sc-name">{lbl}</span>
            {#if dir}<span class="sc-dir">{dir}</span>{/if}
          </span>
        </label>
      {/each}
    </div>
  </div>

  <!-- Flight type -->
  <div class="card card-sm field-block">
    <div class="section-label"><Icon name="compass" size={13} />
      {$lang==='fr'?'Type de vol':'Flight Type'}
    </div>
    <div class="type-grid">
      {#each [
        ['regular',         $lang==='fr'?'Régulier':'Regular'],
        ['soaring',         'Soaring'],
        ['thermal',         $lang==='fr'?'Thermique':'Thermal'],
        ['thermal_soaring', $lang==='fr'?'Thermique + Soaring':'Thermal + Soaring'],
      ] as [val,lbl]}
        <label class="site-chip">
          <input type="radio" name="flight_type" value={val} bind:group={flightType} />
          <span class="sc-inner sc-sm"><span class="sc-name">{lbl}</span></span>
        </label>
      {/each}
    </div>
  </div>

  <!-- Thermal stats -->
  {#if flightType === 'thermal' || flightType === 'thermal_soaring'}
    <div class="card card-sm field-block">
      <div class="section-label"><Icon name="altitude" size={13} />
        {$lang==='fr'?'Stats thermiques':'Thermal Stats'}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>{$lang==='fr'?'Thermiques captés':'Thermals Caught'}</label>
          <input name="thermals_caught" type="number" min="0" placeholder="3" />
        </div>
        <div class="form-group">
          <label>{$lang==='fr'?'Mètres gagnés':'Metres Gained'}</label>
          <input name="meters_gained" type="number" placeholder="450" />
        </div>
      </div>
    </div>
  {:else if flightType === 'soaring'}
    <div class="card card-sm field-block">
      <div class="section-label"><Icon name="altitude" size={13} />Soaring</div>
      <div class="form-group" style="margin-bottom:0">
        <label>{$lang==='fr'?'Mètres gagnés':'Metres Gained'}</label>
        <input name="meters_gained" type="number" placeholder="200" />
      </div>
    </div>
  {/if}

  <!-- ── EXERCISES — linked to carte de progression ────────── -->
  <div class="card card-sm field-block">
    <div class="section-label"><Icon name="checklist" size={13} />
      {$lang==='fr'?'Exercices pratiqués':'Exercises Practised'}
    </div>

    <!-- Next suggestion -->
    {#if nextSuggested}
      <div class="suggest-pill">
        <Icon name="target" size={13} color="var(--teal)" />
        <span class="xs">
          {$lang==='fr'?'Suggestion :':'Suggestion:'}
          <strong>{$lang==='fr'&&nextSuggested.title_fr ? nextSuggested.title_fr : nextSuggested.title}</strong>
        </span>
      </div>
    {/if}

    <!-- Collapsible groups -->
    {#each groups as grp}
      <div class="ex-grp">
        <button type="button" class="ex-grp-hdr"
          on:click={() => { open[grp.key] = !open[grp.key]; }}>
          <span class="ex-grp-lbl">{catLabel(grp)}</span>
          {#if selCount(grp) > 0}
            <span class="ex-grp-count">{selCount(grp)}</span>
          {/if}
          <Icon name={open[grp.key]?'chevronup':'chevrondown'} size={14} color="var(--txt-3)" />
        </button>

        {#if open[grp.key]}
          <div class="ex-grp-list">
            {#each grp.list as ex}
              {@const isSelected = selectedExIds.has(ex.id)}
              {@const isPassed   = ex.status === 'passed'}
              {@const isPending  = ex.status === 'pending'}
              <div class="ex-item-wrap">
                <button type="button"
                  class="ex-item"
                  class:is-selected={isSelected}
                  class:is-passed={isPassed}
                  class:is-pending={isPending}
                  on:click={() => toggleEx(ex)}
                  disabled={isPassed || isPending}
                  title={isPassed ? ($lang==='fr'?'Déjà réussi':'Already passed')
                       : isPending ? ($lang==='fr'?'Déjà soumis':'Already submitted') : ''}>

                  <div class="ex-indicator">
                    {#if isPassed}
                      <div class="ind-pass"><Icon name="check" size={12} color="#fff" /></div>
                    {:else if isPending}
                      <div class="ind-pend"><Icon name="clock" size={12} color="#fff" /></div>
                    {:else if isSelected}
                      <div class="ind-sel"><Icon name="check" size={12} color="#fff" /></div>
                    {:else}
                      <div class="ind-empty"></div>
                    {/if}
                  </div>

                  <span class="ex-title" class:dimmed={isPassed || isPending}>
                    {$lang==='fr'&&ex.title_fr ? ex.title_fr : ex.title}
                  </span>

                  {#if isPassed}
                    <span class="ex-badge passed">{$lang==='fr'?'Réussi':'Passed'}</span>
                  {:else if isPending}
                    <span class="ex-badge pending">{$lang==='fr'?'En attente':'Pending'}</span>
                  {:else if isSelected}
                    <span class="ex-badge selected">{$lang==='fr'?'Sélectionné':'Selected'}</span>
                  {/if}
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    <!-- Summary of selected -->
    {#if selectedExIds.size > 0}
      <div class="ex-summary">
        <Icon name="info" size={13} color="var(--teal)" />
        <span class="xs">
          {selectedExIds.size} {$lang==='fr'?'exercice(s) sélectionné(s) — une demande sera soumise à l\'instructeur':'exercise(s) selected — a request will be submitted to the instructor'}
        </span>
      </div>
    {/if}
  </div>

  <!-- Quality ratings -->
  <div class="card card-sm field-block">
    <div class="section-label"><Icon name="star" size={13} />
      {$lang==='fr'?'Qualité':'Quality'}
    </div>
    <div class="quality-row">
      {#each [[$lang==='fr'?'Décollage':'Launch','launch',launchQ,(n)=>launchQ=n],[$lang==='fr'?'Atterrissage':'Landing','landing',landingQ,(n)=>landingQ=n]] as [lbl,key,val,setter]}
        <input type="hidden" name="{key}_quality" value={val} />
        <div class="q-block">
          <div class="q-lbl xs dimmed">{lbl}</div>
          <div class="star-row">
            {#each [1,2,3,4,5] as n}
              <button type="button" class="star-btn" on:click={() => setter(n)}>
                <svg width="26" height="26" viewBox="0 0 24 24">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                    fill={val >= n ? 'var(--amber)' : 'none'}
                    stroke={val >= n ? 'var(--amber)' : 'var(--border-hi)'}
                    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            {/each}
            {#if val > 0}
              <span class="q-word xs" style="color:{qColors[val]}">{qL[val]}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Reflection -->
  <div class="card card-sm field-block">
    <div class="section-label"><Icon name="note" size={13} />
      {$lang==='fr'?'Réflexion':'Reflection'}
    </div>
    <div class="form-group">
      <label>{$lang==='fr'?'Qu\'est-ce qui s\'est bien passé?':'What went well?'}</label>
      <textarea name="what_went_well" rows="2" bind:value={wentWell} disabled={readonly}
        placeholder="{$lang==='fr'?'Gonflage propre, bonne approche…':'Clean inflation, good approach…'}"></textarea>
    </div>
    <div class="form-group">
      <label>{$lang==='fr'?'Quoi améliorer?':'What to improve?'}</label>
      <textarea name="what_to_improve" rows="2" bind:value={toImprove} disabled={readonly}
        placeholder="{$lang==='fr'?'Timing du flare…':'Flare timing…'}"></textarea>
    </div>
    <div class="form-group" style="margin-bottom:0">
      <label>{$lang==='fr'?'Notes personnelles':'Personal Notes'}</label>
      <textarea name="personal_notes" rows="2" bind:value={personalNotes} disabled={readonly}></textarea>
    </div>
    
    <div class="form-group conf-group">
      <label style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
        {$lang==='fr'?'Comment te sens-tu après le vol ?':'How do you feel after the flight?'}
        {#if !confRating && !readonly}<span style="color:var(--red);font-size:.68rem;font-weight:700">{$lang==='fr'?'— requis':'— required'}</span>{/if}
      </label>
      <div class="conf-scale" style={!confRating && !readonly ? 'outline:1.5px solid var(--red);outline-offset:4px;border-radius:8px;' : ''}>
        {#each confOptions[$lang||'fr'] as o}
          <label class="conf-opt" class:sel={confRating===o.v}>
            <input type="radio" name="confidence_rating" value={o.v} bind:group={confRating} disabled={readonly} />
            <span>{o.l}</span>
          </label>
        {/each}
      </div>
    </div>
  </div>

  <!-- Goals (flight 3+) -->
  {#if flightNum >= 3}
    <div class="card card-sm field-block card-teal">
      <div class="section-label"><Icon name="target" size={13} />
        {$lang==='fr'?'Objectifs prochain vol':'Goals for Next Flight'}
      </div>
      <p class="xs" style="color:var(--teal);margin-bottom:.5rem">Vol #{flightNum}</p>
      {#if upcomingObjectives.length && !readonly}
        <p class="xs" style="color:var(--txt-3);margin-bottom:.35rem">
          {$lang==='fr'?'Suggestions selon ta progression (touche pour ajouter) :':'Suggested from your progression (tap to add):'}
        </p>
        <div class="obj-chips">
          {#each upcomingObjectives as e, i}
            <button type="button" class="obj-chip" on:click={()=>addObjective(e)}>
              <span class="obj-num">{i+1}</span>{($lang==='fr'&&e.title_fr)?e.title_fr:e.title}
            </button>
          {/each}
        </div>
      {/if}
      <textarea name="next_goals" rows="3" bind:value={nextGoals} disabled={readonly}
        placeholder="{$lang==='fr'?'Travailler sur les 360°…':'Work on 360° turns…'}"></textarea>
    </div>
  {/if}

  <!-- Validation errors -->
  {#if formErrors.length}
    <div class="alert alert-err">
      {#each formErrors as err}<div class="xs">· {err}</div>{/each}
    </div>
  {/if}

  <div class="submit-area">
    <a href="/student/{data.student?.id}" class="btn btn-secondary">
      {$lang==='fr'?'Pour plus tard':'Save for Later'}
    </a>
    <button type="submit" class="btn btn-success btn-lg"
      style="flex:1;justify-content:center" disabled={submitting}>
      {#if submitting}
        <span class="spinner"></span>{$lang==='fr'?'Enregistrement…':'Saving…'}
      {:else}
        {$lang==='fr'?'Compléter le vol':'Complete Flight'}
      {/if}
    </button>
  </div>
</form>

<style>
  .pf-header{font-family:var(--ff-head);display:flex;align-items:center;gap:.875rem;margin-bottom:1.25rem}
  .pf-logo{width:44px;height:44px;border-radius:var(--r-sm);object-fit:cover;border:1px solid var(--border);flex-shrink:0}
  .pf-header h1{font-family:var(--ff-head);font-size:1.3rem}
  .field-block{margin-bottom:.875rem}

  .time-banner{display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;background:rgba(0,184,122,.07);border:1px solid var(--teal-border);border-radius:var(--r-md);margin-bottom:.875rem;flex-wrap:wrap}
  .tb-item{display:flex;align-items:center;gap:.4rem}
  .tb-arrow{font-size:.8rem}
  .tb-dur{font-size:.875rem;margin-left:auto}

  .type-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
  .type-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
  .land-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem}
  @media(max-width:360px){.land-grid{grid-template-columns:repeat(2,1fr)}}
  .site-chip{cursor:pointer}
  .site-chip input{display:none}
  .sc-inner{display:flex;flex-direction:column;align-items:center;padding:.75rem .5rem;border:1.5px solid var(--border);border-radius:var(--r-sm);transition:all .15s;gap:.1rem}
  .sc-sm{padding:.5rem .4rem}
  .site-chip input:checked+.sc-inner{border-color:var(--teal);background:var(--teal-lo)}
  .sc-name{font-family:var(--ff-head);font-weight:700;font-size:.82rem;color:var(--txt)}
  .sc-dir{font-size:.65rem;font-family:var(--ff-head);color:var(--txt-3)}
  .site-chip input:checked+.sc-inner .sc-name,
  .site-chip input:checked+.sc-inner .sc-dir{color:var(--teal)}

  /* Exercise accordion */
  .suggest-pill{display:flex;align-items:center;gap:.4rem;padding:.4rem .75rem;background:var(--teal-lo);border:1px solid var(--teal-border);border-radius:var(--r-sm);margin-bottom:.5rem}
  .ex-grp{border-bottom:1px solid var(--border)}
  .ex-grp:last-of-type{border-bottom:none}
  .ex-grp-hdr{font-family:var(--ff-head);display:flex;align-items:center;gap:.5rem;width:100%;background:none;border:none;cursor:pointer;padding:.6rem 0;text-align:left}
  .ex-grp-lbl{flex:1;font-family:var(--ff-head);font-size:.78rem;font-weight:700;color:var(--txt-2)}
  .ex-grp-count{background:var(--teal);color:var(--txt-inv);font-family:var(--ff-head);font-size:.65rem;font-weight:700;padding:.1rem .4rem;border-radius:var(--r-full);min-width:18px;text-align:center}
  .ex-grp-list{display:flex;flex-direction:column;gap:.2rem;padding-bottom:.4rem}

  /* Exercise items — button not label, for proper disabled state */
  .ex-item{display:flex;align-items:center;gap:.625rem;width:100%;background:none;border:1px solid var(--border);border-radius:var(--r-sm);padding:.55rem .75rem;cursor:pointer;text-align:left;transition:all .15s}
  .ex-item:hover:not(:disabled){background:var(--bg-raised);border-color:var(--border-hi)}
  .ex-item.is-selected{border-color:var(--teal);background:var(--teal-lo)}
  .ex-item.is-passed{border-color:rgba(34,197,94,.2);background:rgba(34,197,94,.03);cursor:default;opacity:.75}
  .ex-item.is-pending{border-color:rgba(245,158,11,.25);background:rgba(245,158,11,.04);cursor:default}
  .ex-item:disabled{cursor:default}

  .ex-indicator{flex-shrink:0}
  .ind-pass{width:20px;height:20px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center}
  .ind-pend{width:20px;height:20px;border-radius:50%;background:var(--amber);display:flex;align-items:center;justify-content:center}
  .ind-sel{width:20px;height:20px;border-radius:50%;background:var(--amber);display:flex;align-items:center;justify-content:center}
  .ind-empty{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border)}

  .ex-title{font-family:var(--ff-head);flex:1;font-size:.855rem;font-weight:500;color:var(--txt);text-align:left}
  .ex-title.dimmed{font-family:var(--ff-head);color:var(--txt-3)}

  .ex-badge{font-family:var(--ff-head);font-size:.68rem;font-weight:700;padding:.15rem .5rem;border-radius:var(--r-full);white-space:nowrap;flex-shrink:0}
  .ex-badge.passed{background:rgba(34,197,94,.15);color:var(--green);border:1px solid rgba(34,197,94,.25)}
  .ex-badge.pending{background:var(--amber-lo);color:var(--amber);border:1px solid rgba(245,158,11,.25)}
  .ex-badge.selected{background:var(--amber-lo);color:var(--amber);border:1px solid rgba(245,158,11,.3)}

  .ex-summary{display:flex;align-items:center;gap:.4rem;padding:.5rem .75rem;background:var(--teal-lo);border-radius:var(--r-xs);margin-top:.5rem}

  /* Quality */
  .quality-row{display:flex;flex-direction:column;gap:.875rem}
  .q-block{display:flex;flex-direction:column;gap:.3rem}
  .q-lbl{font-weight:600;margin-bottom:.1rem}
  .star-row{display:flex;align-items:center;gap:.15rem}
  .star-btn{background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center}
  .q-word{margin-left:.5rem;font-weight:600}

  .submit-area{display:flex;gap:.75rem;margin-top:1.25rem;padding-bottom:1.5rem}
  .conf-group{margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border)}
  .conf-scale{display:flex;gap:.4rem;margin-top:.4rem;flex-wrap:wrap}
  .conf-opt{flex:1 1 calc(50% - .4rem);min-width:120px}
  .conf-opt input{display:none}
  .conf-opt span{display:block;text-align:center;padding:.55rem .5rem;border:1px solid var(--border);border-radius:8px;background:var(--bg-raised);color:var(--txt-2);font-size:.82rem;font-weight:600;cursor:pointer;transition:all .12s}
  .conf-opt.sel span{background:var(--teal);color:var(--txt-inv);border-color:var(--teal)}
  .obj-chips{display:flex;flex-direction:column;gap:.3rem;margin-bottom:.5rem}
  .obj-chip{display:flex;align-items:center;gap:.5rem;text-align:left;background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;padding:.45rem .6rem;color:var(--txt);font-size:.82rem;cursor:pointer;font-family:inherit}
  .obj-chip:hover{border-color:var(--teal)}
  .obj-num{flex-shrink:0;width:18px;height:18px;border-radius:50%;background:var(--teal);color:var(--txt-inv);font-size:.68rem;font-weight:800;display:grid;place-items:center}
  .ex-item-wrap{display:flex;flex-direction:column;gap:.2rem}
  .ex-item:disabled{cursor:not-allowed;opacity:.75}
</style>
