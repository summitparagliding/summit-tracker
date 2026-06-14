<script>
  import '../../app.css';
  import { page } from '$app/stores';
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { lang } from '$lib/stores/lang.js';
  export let data;

  // ── Theme slider — continuous 0 (dark) → 1 (light), shared with student side ──
  let themeMix  = 0;
  let themeOpen = false;
  const DARK = {bg:[6,13,22],bgCard:[11,22,32],bgRaised:[15,28,44],bgInput:[15,30,46],border:[22,34,51],borderHi:[30,51,72],txt:[238,244,255],txt2:[143,179,204],txt3:[77,122,150],txtInv:[8,15,24]};
  const LIGHT= {bg:[240,244,248],bgCard:[255,255,255],bgRaised:[232,237,243],bgInput:[255,255,255],border:[200,212,224],borderHi:[168,189,208],txt:[15,25,35],txt2:[55,74,92],txt3:[107,141,168],txtInv:[255,255,255]};
  function lerpC(dk,lt,t){return `rgb(${Math.round(dk[0]+(lt[0]-dk[0])*t)},${Math.round(dk[1]+(lt[1]-dk[1])*t)},${Math.round(dk[2]+(lt[2]-dk[2])*t)})`}
  function applyMix(t) {
    const r = document.documentElement;
    r.style.setProperty('--bg',lerpC(DARK.bg,LIGHT.bg,t));
    r.style.setProperty('--bg-card',lerpC(DARK.bgCard,LIGHT.bgCard,t));
    r.style.setProperty('--bg-raised',lerpC(DARK.bgRaised,LIGHT.bgRaised,t));
    r.style.setProperty('--bg-input',lerpC(DARK.bgInput,LIGHT.bgInput,t));
    r.style.setProperty('--bg-2',lerpC(DARK.bgRaised,LIGHT.bgRaised,t));
    r.style.setProperty('--border',lerpC(DARK.border,LIGHT.border,t));
    r.style.setProperty('--border-hi',lerpC(DARK.borderHi,LIGHT.borderHi,t));
    r.style.setProperty('--txt',lerpC(DARK.txt,LIGHT.txt,t));
    r.style.setProperty('--txt-2',lerpC(DARK.txt2,LIGHT.txt2,t));
    r.style.setProperty('--txt-3',lerpC(DARK.txt3,LIGHT.txt3,t));
    r.style.setProperty('--txt-inv',lerpC(DARK.txtInv,LIGHT.txtInv,t));
    r.style.setProperty('--bg-overlay',`rgba(${Math.round(DARK.bg[0]+(LIGHT.bg[0]-DARK.bg[0])*t)},${Math.round(DARK.bg[1]+(LIGHT.bg[1]-DARK.bg[1])*t)},${Math.round(DARK.bg[2]+(LIGHT.bg[2]-DARK.bg[2])*t)},0.92)`);
    r.setAttribute('data-theme', t > 0.55 ? 'light' : 'dark');
    localStorage.setItem('summit-theme-mix', String(t));
    themeMix = t;
  }
  onMount(() => {
    const saved = parseFloat(localStorage.getItem('summit-theme-mix') ?? '0');
    themeMix = isNaN(saved) ? 0 : saved;
    applyMix(themeMix);
  });

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
        <div class="inst-version">Summit v121</div>
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
    .sb-foot{flex-direction:row;padding:.5rem .75rem;border-top:none;border-left:1px solid var(--border)}
    .inst-main{padding:1.25rem}
  }
</style>
