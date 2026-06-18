<script>
  import { page } from '$app/stores';
  import { t } from '$lib/i18n/index.js';
  import { lang } from '$lib/stores/lang.js';
  import Icon from '$lib/components/Icon.svelte';
  export let data;
  $: id = data.student?.id;
  $: cur = $page.url.pathname;
  $: isHome      = cur === `/student/${id}`;
  $: isTheory    = cur.startsWith(`/student/${id}/theory`);
  $: isExercises = cur.startsWith(`/student/${id}/exercises`);
  $: isFlights   = cur.startsWith(`/student/${id}/flights`);
  $: isProfile   = cur.startsWith(`/student/${id}/profile`);
  $: isInfo      = cur.startsWith(`/student/${id}/info`);
  $: isStudy     = cur.startsWith(`/student/${id}/study`);

  // ── Theme slider — continuous 0 (dark) → 1 (light) ─────────────────────
  import { onMount } from 'svelte';
  import { applyThemeMix, initThemeMix } from '$lib/theme.js';
  let themeMix = 0;
  let themeOpen = false;

  function applyMix(t) { applyThemeMix(t); themeMix = t; }

  onMount(() => { themeMix = initThemeMix(); });
  $: unread      = data.unreadCount || 0;
</script>

<div class="app-shell">
  <header class="top-bar">
    <a href="/student/{id}" class="brand" aria-label="Summit Paragliding">
      <img src="/summit-logo.png" alt="Summit Paragliding" class="brand-logo logo-teal" />
    </a>

    <span class="divider"></span>
    <span class="student-name">{data.student.name}</span>

    <div style="display:flex;align-items:center;gap:.4rem">
      <!-- Theme slider pill -->
      <div class="theme-pill-wrap">
        <button class="theme-pill" on:click={() => themeOpen = !themeOpen} aria-label="Theme">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2">
            {#if themeMix < 0.5}
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            {:else}
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            {/if}
          </svg>
        </button>
        {#if themeOpen}
        <!-- Click-outside overlay to close -->
        <button class="theme-overlay" on:click={() => themeOpen=false} aria-label="Close"></button>
        <div class="theme-dropdown">
          <div class="theme-slider-row">
            <span class="xs" style="opacity:.6;font-size:.9rem">🌙</span>
            <input type="range" min="0" max="100" step="1"
              value={Math.round(themeMix * 100)}
              on:input={e => applyMix(Number(e.target.value) / 100)}
              class="theme-range" aria-label="Theme brightness" />
            <span class="xs" style="opacity:.6;font-size:.9rem">☀</span>
          </div>
          <div class="theme-tip xs">{themeMix < 0.2 ? 'Nuit' : themeMix > 0.8 ? 'Jour' : 'Intermédiaire'}</div>
        </div>
        {/if}
      </div>

      <div class="lang-sw" role="group" aria-label="Language">
        <button class:active={$lang==='en'} on:click={() => lang.set('en')} aria-pressed={$lang==='en'}>EN</button>
        <button class:active={$lang==='fr'} on:click={() => lang.set('fr')} aria-pressed={$lang==='fr'}>FR</button>
      </div>


      <a href="/student/{id}/preflight" class="btn btn-primary btn-sm">{$t('nav_start')}</a>
    </div>
  </header>

  <main class="content">
    <slot />
  </main>

  <nav class="bottom-nav" aria-label="Main navigation">
    <a href="/student/{id}" class:active={isHome} aria-label={$t('nav_home')}>
      <Icon name="dashboard" size={16} />
      <span>{$lang==='fr'?'Accueil':'Home'}</span>
    </a>
    <a href="/student/{id}/theory" class:active={isTheory} aria-label={$t('nav_theory')}>
      <Icon name="book" size={16} />
      <span>{$lang==='fr'?'Théorie':'Theory'}</span>
    </a>
    <a href="/student/{id}/exercises" class:active={isExercises} aria-label={$t('nav_exercises')}>
      <Icon name="checklist" size={16} />
      <span>{$lang==='fr'?'Exerc.':'Exer.'}</span>
    </a>
    <a href="/student/{id}/flights" class:active={isFlights} aria-label={$t('nav_flights')}>
      <Icon name="flights" size={16} />
      <span>{$lang==='fr'?'Vols':'Flights'}</span>
    </a>
    <a href="/student/{id}/profile" class:active={isProfile} aria-label={$lang==='fr'?'Carnet':'Logbook'}>
      <svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="16" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
      </svg>
      <span>{$lang==='fr'?'Carnet':'Logbook'}</span>
    </a>
    <a href="/student/{id}/info" class:active={isInfo} aria-label={$lang==='fr'?'Info':'Info'} class="info-tab">
      <div class="nav-ico-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {#if unread > 0}<span class="notif-dot">{unread > 9 ? '9+' : unread}</span>{/if}
      </div>
      <span>Info</span>
    </a>

    <a href="/student/{id}/study" class:active={isStudy} aria-label={$lang==='fr'?'Étude':'Study'}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
      <span>{$lang==='fr'?'Étude':'Study'}</span>
    </a>
  </nav>
</div>

<style>
  .app-shell{display:flex;flex-direction:column;min-height:100svh}

  .top-bar{
    position:sticky;top:0;z-index:50;
    background:var(--bg-overlay);backdrop-filter:blur(16px);
    border-bottom:1px solid var(--border);
    padding:.625rem 1rem;
    display:flex;align-items:center;gap:.75rem;
    height:54px;
  }
  .brand{display:flex;align-items:center;flex-shrink:0;text-decoration:none}
  .brand-logo{height:30px;width:auto;object-fit:contain;display:block}
  .divider{width:1px;height:20px;background:var(--border);flex-shrink:0}
  .student-name{font-size:.78rem;color:var(--txt-2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}

  .lang-sw{display:flex;gap:2px;flex-shrink:0;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--r-sm);padding:2px}
  .lang-sw button{background:none;border:none;font-family:var(--ff-head);font-size:.65rem;font-weight:700;letter-spacing:.06em;color:var(--txt-3);cursor:pointer;padding:.2rem .4rem;border-radius:4px;transition:all .15s}
  .lang-sw button.active{background:var(--teal);color:var(--txt-inv)}

  .content{flex:1;padding:1.25rem 1rem 5.5rem;max-width:740px;margin:0 auto;width:100%}

  .bottom-nav{
    position:fixed;bottom:0;left:0;right:0;z-index:50;
    background:var(--bg-overlay);backdrop-filter:blur(16px);
    border-top:1px solid var(--border);
    display:flex;height:52px;
  }
  .nav-ico-wrap{position:relative;display:inline-flex}
  .notif-dot{position:absolute;top:-4px;right:-6px;background:var(--red);color:#fff;font-size:.6rem;font-weight:700;border-radius:10px;padding:0 4px;min-width:14px;height:14px;display:flex;align-items:center;justify-content:center;line-height:1}
  .bottom-nav a{
    flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:.25rem .1rem;color:var(--txt-3);text-decoration:none;
    font-family:var(--ff-head);font-size:.5rem;font-weight:700;
    letter-spacing:.03em;text-transform:uppercase;
    transition:color .15s;gap:.15rem;min-width:0;overflow:hidden;
  }
  .bottom-nav a:hover,.bottom-nav a.active{color:var(--teal);text-decoration:none}
  .bottom-nav a.active{background:var(--teal-lo)}
  /* Theme pill */
  .theme-pill-wrap{position:relative;flex-shrink:0}
  .theme-pill{background:none;border:1px solid var(--border);border-radius:16px;padding:.22rem .4rem;cursor:pointer;color:var(--txt-3);display:flex;align-items:center;line-height:1;transition:all .15s}
  .theme-pill:hover{border-color:var(--txt-3);color:var(--txt)}
  .theme-overlay{position:fixed;inset:0;z-index:98;background:transparent;border:none;cursor:default}
  .theme-dropdown{position:absolute;top:calc(100% + 5px);right:0;background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:.5rem .625rem;width:140px;z-index:99;box-shadow:0 4px 16px rgba(0,0,0,.3)}
  .theme-slider-row{display:flex;align-items:center;gap:.4rem}


  .theme-range{flex:1;height:4px;cursor:pointer;accent-color:var(--teal);background:linear-gradient(to right,#060d16,#f0f4f8);border-radius:3px}
  .theme-tip{text-align:center;color:var(--txt-3);margin-top:.3rem}
</style>
