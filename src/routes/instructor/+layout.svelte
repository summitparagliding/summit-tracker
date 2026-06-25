<script>
  import '../../app.css';
  import { page } from '$app/stores';
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { lang } from '$lib/stores/lang.js';
  export let data;

  // ── Theme slider — continuous 0 (dark) → 1 (light), shared with student side ──
  import { applyThemeMix, initThemeMix } from '$lib/theme.js';
  let themeMix  = 0;
  let themeOpen = false;
  function applyMix(t) { applyThemeMix(t); themeMix = t; }
  onMount(() => { themeMix = initThemeMix(); });

  const nav = [
    { href:'/instructor',              label:'Dashboard',    ico:'dashboard'   },
    { href:'/instructor/students',     label:'Students',     ico:'students'    },
    { href:'/instructor/signoffs',     label:'Sign-offs',    ico:'signoff'     },
    { href:'/instructor/planning',     label:'Planning',     ico:'calendar'    },
    { href:'/instructor/session',      label:'Session',      ico:'checklist'   },
    { href:'/instructor/enflight',     label:'En vol',    ico:'flights'     },
    { href:'/instructor/content',      label:'Content',      ico:'content'     },
    { href:'/instructor/flights',      label:'All Flights',  ico:'allflights'  },
    { href:'/instructor/analytics',    label:'Analytics',    ico:'dashboard'   },
    { href:'/instructor/waivers',      label:'Waivers',      ico:'content'     },
    { href:'/instructor/settings',     label:'Settings',     ico:'settings'    },
  ];

  // Reactive active path — updates on every navigation
  $: activePath = $page.url.pathname;
  $: isLogin = activePath === '/instructor/login';
  function active(href) {
    if (href === '/instructor') return activePath === '/instructor' || activePath === '/instructor/';
    return activePath.startsWith(href);
  }
</script>

{#if isLogin}
  <slot />
{:else}
  <div class="inst-shell">
    <aside class="sidebar">
      <div class="sb-logo-wrap">
        <img src="/summit-logo.png" alt="Summit Paragliding" class="sb-logo logo-teal" />
        <span class="sb-role">Instructor</span>
      </div>

      <nav class="sb-nav">
        {#each nav as n}
          <a href={n.href} class="nav-item"
            class:active={n.href === '/instructor'
              ? activePath === '/instructor' || activePath === '/instructor/'
              : activePath.startsWith(n.href)}>
            <Icon name={n.ico} size={16} color="currentColor" />
            <span>{n.label}</span>
          </a>
        {/each}
      </nav>

      <div class="sb-foot">
        <!-- Language switch -->
        <div class="inst-lang-row">
          <button class="lang-btn" class:active={$lang==='en'} on:click={() => lang.set('en')}>EN</button>
          <button class="lang-btn" class:active={$lang==='fr'} on:click={() => lang.set('fr')}>FR</button>
        </div>
        <div class="inst-version">Summit v127</div>
        <!-- Theme slider — same dark→light control as student side -->
        <div class="inst-theme-row">
          <span style="font-size:.85rem;opacity:.6">🌙</span>
          <input type="range" min="0" max="100" step="1"
            value={Math.round(themeMix * 100)}
            on:input={e => applyMix(Number(e.target.value) / 100)}
            class="inst-theme-range" aria-label="Theme brightness" />
          <span style="font-size:.85rem;opacity:.6">☀</span>
        </div>
        <div class="sb-user">
          <Icon name="user" size={13} color="var(--txt-3)" />
          {data.instructor?.name || 'Instructor'}
        </div>
        <form method="POST" action="/instructor?/logout" use:enhance>
          <button class="btn btn-ghost btn-xs" style="width:100%;justify-content:flex-start;gap:.4rem">
            <Icon name="logout" size={13} />Sign out
          </button>
        </form>
      </div>
    </aside>

    <main class="inst-main">
      <slot />
    </main>
  </div>
{/if}

<style>
  .inst-lang-row{display:flex;gap:.3rem;padding:.25rem .25rem .5rem}
  .inst-version{font-size:.62rem;letter-spacing:.08em;color:var(--txt-3);opacity:.55;text-align:center;padding:.1rem 0 .35rem}
  .lang-btn{flex:1;background:var(--bg-raised);border:1px solid var(--border);color:var(--txt-3);border-radius:6px;padding:.3rem 0;font-family:var(--ff-head);font-size:.72rem;font-weight:700;letter-spacing:.06em;cursor:pointer;transition:all .15s}
  .lang-btn:hover{color:var(--txt)}
  .lang-btn.active{background:var(--teal);color:var(--txt-inv);border-color:var(--teal)}
  .inst-theme-row{display:flex;align-items:center;gap:.5rem;padding:.5rem .25rem .75rem;border-bottom:1px solid var(--border);margin-bottom:.5rem}
  .inst-theme-range{flex:1;-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;background:linear-gradient(to right,#1e293b,#cbd5e1);outline:none;cursor:pointer}
  .inst-theme-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;background:var(--teal);cursor:pointer;border:2px solid var(--bg-card)}
  .inst-theme-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--teal);cursor:pointer;border:2px solid var(--bg-card)}
  .inst-shell{display:flex;min-height:100svh}

  .sidebar{
    width:210px;flex-shrink:0;
    background:var(--bg-card);border-right:1px solid var(--border);
    display:flex;flex-direction:column;
    position:sticky;top:0;height:100svh;overflow-y:auto;
  }

  .sb-logo-wrap{
    padding:1.25rem 1.1rem;border-bottom:1px solid var(--border);
    display:flex;flex-direction:column;gap:.5rem;
  }
  .sb-logo{height:32px;width:auto;object-fit:contain}
  .sb-role{
    font-family:var(--ff-head);font-size:.62rem;font-weight:700;
    letter-spacing:.12em;text-transform:uppercase;color:var(--teal);
  }

  .sb-nav{flex:1;padding:.75rem .625rem;display:flex;flex-direction:column;gap:.1rem}
  .nav-item{
    display:flex;align-items:center;gap:.625rem;
    padding:.55rem .75rem;border-radius:var(--r-sm);
    font-family:var(--ff-head);font-size:.8rem;font-weight:600;
    color:var(--txt-3);text-decoration:none;transition:all .15s;
  }
  .nav-item:hover{color:var(--txt);background:var(--bg-raised);text-decoration:none}
  .nav-item.active{color:var(--teal) !important;background:var(--teal-lo) !important;border-left:2px solid var(--teal)}

  .sb-foot{
    padding:.875rem .875rem;border-top:1px solid var(--border);
    display:flex;flex-direction:column;gap:.5rem;
  }
  .sb-user{
    display:flex;align-items:center;gap:.4rem;
    font-size:.75rem;color:var(--txt-2);font-weight:500;
  }

  .inst-main{
    flex:1;padding:2rem;overflow-x:hidden;
    max-width:1120px;
  }

  @media(max-width:768px){
    .inst-shell{flex-direction:column}
    .sidebar{width:100%;height:auto;position:relative;flex-direction:column}
    .sb-nav{flex-direction:row;flex-wrap:wrap;padding:.5rem}
    .nav-item{font-size:.72rem;padding:.4rem .625rem}
    .sb-foot{flex-direction:row;flex-wrap:wrap;align-items:center;gap:.4rem .75rem;padding:.5rem .75rem;border-top:none;border-left:1px solid var(--border)}
    .inst-lang-row{padding:0;flex:0 0 auto}
    .inst-version{padding:0;flex:0 0 auto;text-align:left}
    .inst-theme-row{padding:0;margin:0;border-bottom:none;flex:1 1 100%;min-width:180px}
    .sb-user{flex:0 0 auto}
    .inst-main{padding:1.25rem}
  }
</style>
