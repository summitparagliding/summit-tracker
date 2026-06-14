<script>
  import Icon from '$lib/components/Icon.svelte';
  import { t } from '$lib/i18n/index.js';
  import { lang } from '$lib/stores/lang.js';
  export let data, form;
  $: defaultGlider = data.defaultGlider || '';

  let mental = 0;
  let site = '';
  let windSpeed = '';
  let formErrors = [];

  function validate() {
    formErrors = [];
    if (!site)      formErrors.push($lang==='fr'?'Sélectionnez un site de décollage':'Select a launch site');
    if (!windSpeed) formErrors.push($lang==='fr'?'Sélectionnez la vitesse du vent':'Select wind speed');
    if (!mental)    formErrors.push($lang==='fr'?'Indiquez votre état d\'esprit':'Indicate your mental state')
    return formErrors.length === 0;
  }
  const sites = [
    { id:'ne', label:'NE', dir:'NE' },
    { id:'n',  label:'N',  dir:'N'  },
    { id:'o',  label:'O',  dir:'O'  },
    { id:'s',  label:'S',  dir:'S'  },
  ];
  const windDirs = ['NE','NNE','N','NNW','NW','WNW','W','WSW','SW','SSW','S'];
  const windSpeeds = [
    { val:'calm',     label:$t('wind_calm')      },
    { val:'light',    label:$t('wind_light')     },
    { val:'moderate', label:$t('wind_moderate')  },
    { val:'strong',   label:$t('wind_strong')    },
    { val:'toostrong',label:$t('wind_too_strong')},
  ];
  const mentalColors = ['','var(--red)','var(--amber)','var(--txt-2)','var(--green)','var(--teal)'];
  const mentalLabels = ['', $t('pf_anxious'), $t('pf_unsure'), $t('pf_ok'), $t('pf_good'), $t('pf_great')];
</script>

<svelte:head><title>{$t('pf_title')} — Summit</title></svelte:head>

<div class="pf-head">
  <img src="/wings-logo.jpg" alt="" class="pf-logo" />
  <div>
    <h1>{$t('pf_title')}</h1>
    <p class="dimmed small">{$t('pf_sub')}</p>
  </div>

    <!-- Confidence level -->
    <div class="field-group" style="margin-top:.875rem">
    </div>
</div>

{#if form?.error}
  <div class="alert alert-err"><Icon name="alert" size={14} />{form.error}</div>
{/if}

<form method="POST" on:submit|preventDefault={e => { if(validate()) e.target.submit(); }}>

  <!-- Site -->
  <div class="card card-sm field-block">
    <div class="section-label"><Icon name="flag" size={13} />{$t('pf_site')}</div>
    <div class="site-grid">
      {#each sites as s}
        <label class="site-chip">
          <input type="radio" name="site" value={s.id} required bind:group={site} />
          <span class="sc-inner">
            <span class="sc-name">{s.label}</span>
            <span class="sc-dir">{s.dir}</span>
          </span>
        </label>
      {/each}
    </div>
  </div>

  <!-- Wind -->
  <div class="card card-sm field-block">
    <div class="section-label"><Icon name="wind" size={13} />{$t('pf_wind')}</div>
    <div class="form-row">
      <div class="form-group">
        <label for="ws">{$t('pf_speed')}</label>
        <select id="ws" name="wind_speed" bind:value={windSpeed}>
          <option value="">—</option>
          {#each windSpeeds as w}<option value={w.val}>{w.label}</option>{/each}
        </select>
      </div>
      <div class="form-group">
        <label for="wd">{$t('pf_direction')}</label>
        <select id="wd" name="wind_direction">
          <option value="">—</option>
          {#each windDirs as d}<option>{d}</option>{/each}
        </select>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:0">
      <label for="cn">{$t('pf_notes')}</label>
      <textarea id="cn" name="conditions_notes" rows="2" placeholder="{$t('pf_notes_ph')}"></textarea>
    </div>
  </div>

  <!-- Glider -->
  <div class="form-group">
    <label for="gl">{$t('pf_glider')}</label>
    <input id="gl" name="glider" type="text" placeholder="{$t('pf_glider_ph')}" value={defaultGlider} />
  </div>

  <!-- Mental state -->
  <div class="card card-sm field-block">
    <div class="section-label"><Icon name="target" size={13} />{$t('pf_feeling')}</div>
    <input type="hidden" name="mental_condition" value={mental} />
    <div class="mental-row">
      {#each [1,2,3,4,5] as n}
        <button type="button" class="mental-btn"
          class:sel={mental===n}
          style={mental===n ? `border-color:${mentalColors[n]};background:${mentalColors[n]}18;color:${mentalColors[n]}` : ''}
          on:click={() => mental = n}>
          <span class="m-num">{n}</span>
          <span class="m-lbl">{mentalLabels[n]}</span>
        </button>
      {/each}
    </div>
    {#if mental > 0}
      <p class="mental-note" style="border-left-color:{mentalColors[mental]};color:{mentalColors[mental]}">
        {#if mental <= 2}{$t('pf_warn_low')}
        {:else if mental === 3}{$t('pf_warn_mid')}
        {:else}{$t('pf_warn_high')}{/if}
      </p>
    {/if}
  </div>

  {#if formErrors.length}
    <div class="alert alert-err" style="margin-bottom:.75rem">
      {#each formErrors as err}<div>· {err}</div>{/each}
    </div>
  {/if}
  <div class="form-actions">
    <a href="/student/{data.student.id}" class="btn btn-secondary">
      <Icon name="chevronleft" size={14} />{$t('pf_cancel')}
    </a>
    <button type="submit" class="btn btn-success btn-lg" style="flex:1;justify-content:center">
      {$t('pf_start')}
    </button>
  </div>
</form>

<style>
  .pf-head { display:flex;align-items:center;gap:.875rem;margin-bottom:1.5rem }
  .pf-logo { width:44px;height:44px;border-radius:var(--r-sm);object-fit:cover;border:1px solid var(--border);flex-shrink:0 }
  .pf-head h1 { font-size:1.3rem }

  .field-block { margin-bottom:.875rem }

  .site-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem }
  .site-chip { cursor:pointer }
  .site-chip input { display:none }
  .sc-inner { display:flex;flex-direction:column;align-items:center;padding:.875rem .5rem;border:1.5px solid var(--border);border-radius:var(--r-md);transition:all .15s;gap:.15rem }
  .site-chip input:checked + .sc-inner { border-color:var(--teal);background:var(--teal-lo) }
  .sc-name { font-family:var(--ff-head);font-weight:700;font-size:.9rem;color:var(--txt) }
  .sc-dir { font-size:.68rem;font-family:var(--ff-mono);color:var(--txt-3) }
  .site-chip input:checked + .sc-inner .sc-name,
  .site-chip input:checked + .sc-inner .sc-dir { color:var(--teal) }

  .mental-row { display:flex;gap:.375rem;margin-bottom:.625rem }
  .mental-btn { flex:1;display:flex;flex-direction:column;align-items:center;padding:.6rem .25rem;border:1.5px solid var(--border);border-radius:var(--r-sm);background:transparent;cursor:pointer;transition:all .15s;gap:.15rem }
  .m-num { font-family:var(--ff-mono);font-size:1rem;font-weight:500;color:var(--txt-2) }
  .m-lbl { font-size:.58rem;text-transform:uppercase;letter-spacing:.04em;font-family:var(--ff-head);font-weight:700;color:var(--txt-3) }
  .mental-note { font-size:.8rem;padding:.5rem .75rem;background:var(--bg-raised);border-radius:var(--r-xs);border-left:3px solid;line-height:1.5 }

  .form-actions { display:flex;gap:.75rem;margin-top:1.25rem }
</style>
