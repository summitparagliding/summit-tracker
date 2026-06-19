<script>
  import { lang } from '$lib/stores/lang.js';
  export let data;
  export let form;

  $: L = $lang === 'fr';
  $: names = data.names || [];

  let query = '';
  let pin   = '';
  let open  = false;

  $: filtered = query.trim().length >= 1
    ? names.filter(s => s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : names.slice(0, 8);

  function pick(name) {
    query = name;
    open  = false;
  }

  function onNameInput() {
    open = true;
  }

  function onPinInput(e) {
    pin = e.target.value.replace(/\D/g, '').slice(0, 6);
    e.target.value = pin;
  }

  // Close dropdown when clicking outside
  function onBlur() {
    setTimeout(() => { open = false; }, 150);
  }
</script>

<svelte:head><title>Summit Paragliding</title></svelte:head>

<div class="lp">
  <div class="glow"></div>

  <div class="lang-row">
    <button class:active={$lang==='en'} on:click={() => lang.set('en')}>EN</button>
    <span>·</span>
    <button class:active={$lang==='fr'} on:click={() => lang.set('fr')}>FR</button>
  </div>

  <div class="card lcard">
    <div class="logo-wrap">
      <img src="/summit-logo.png" alt="Summit Paragliding" class="logo" />
    </div>
    <div class="subtitle">{L ? 'Portail étudiant' : 'Student portal'}</div>

    {#if form?.error}
    <div class="err-box">{form.error}</div>
    {/if}

    <form method="POST">
      <!-- Name with custom dropdown autocomplete -->
      <div class="field">
        <label for="fn">{L ? 'Votre nom' : 'Your name'}</label>
        <div class="ac-wrap">
          <input
            id="fn" type="text" name="name"
            bind:value={query}
            on:input={onNameInput}
            on:focus={() => open = true}
            on:blur={onBlur}
            placeholder={L ? 'Tapez votre nom…' : 'Type your name…'}
            autocomplete="off" spellcheck="false"
            required
          />
          {#if open && filtered.length}
          <ul class="ac-list">
            {#each filtered as s}
            <li on:mousedown|preventDefault={() => pick(s.name)}>{s.name}</li>
            {/each}
          </ul>
          {/if}
        </div>
      </div>

      <!-- PIN -->
      <div class="field">
        <label for="fp">{L ? 'Code PIN' : 'PIN code'}</label>
        <input
          id="fp" type="password" name="pin"
          value={pin}
          on:input={onPinInput}
          inputmode="numeric"
          autocomplete="current-password"
          placeholder="••••"
          maxlength="6"
          required
        />
        <p class="pin-hint">{L ? 'Première connexion ? Votre code PIN est les 4 derniers chiffres de votre numéro de téléphone.' : 'First time? Your PIN is the last 4 digits of your phone number.'}</p>
      </div>

      <button type="submit" class="btn-submit">
        {L ? 'Entrer' : 'Enter'}
      </button>
    </form>

    <div class="links">
      <a href="/register">{L ? 'Pas encore inscrit ? Faire une demande' : 'Not registered? Request access'} →</a>
      <a href="/instructor/login" class="inst">{L ? 'Accès instructeur' : 'Instructor access'}</a>
    </div>
  </div>
</div>

<style>
  .lp{min-height:100svh;display:flex;align-items:center;justify-content:center;padding:1rem;background:var(--bg);position:relative;overflow:hidden}
  .glow{position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 15%,rgba(0,184,122,.07) 0%,transparent 55%)}
  .lang-row{position:fixed;top:1.25rem;right:1.25rem;display:flex;align-items:center;gap:.4rem;z-index:10;font-size:.7rem;font-weight:700;letter-spacing:.06em}
  .lang-row button{background:none;border:none;color:var(--txt-3);cursor:pointer;padding:.2rem .35rem;border-radius:4px}
  .lang-row button.active{color:var(--teal)}
  .lang-row span{color:var(--txt-3)}
  .lcard{width:100%;max-width:380px;padding:2.5rem 2rem;position:relative;z-index:1}
  .logo-wrap{display:flex;justify-content:center;margin-bottom:1.75rem}
  .logo{height:72px;object-fit:contain}
  .subtitle{text-align:center;font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--txt-3);margin-bottom:1.75rem}
  .err-box{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:.5rem .75rem;color:#f87171;font-size:.82rem;margin-bottom:.875rem;text-align:center}
  .field{margin-bottom:1rem}
  .field label{display:block;font-size:.78rem;font-weight:600;color:var(--txt-2);margin-bottom:.3rem}
  .field input{width:100%;padding:.65rem .875rem;box-sizing:border-box;background:var(--bg-2, #0f1e2e);border:1.5px solid var(--border);border-radius:8px;color:var(--txt);font-size:.95rem;font-family:inherit;outline:none;transition:border-color .15s}
  .field input[type="password"]{font-size:1.2rem;letter-spacing:.2em;text-align:center}
  .field input:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(0,232,198,.1)}
  .pin-hint{margin:.45rem 0 0;font-size:.72rem;line-height:1.45;color:var(--txt-3);text-align:center}
  .ac-wrap{position:relative}
  .ac-list{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg-card,#0b1620);border:1.5px solid rgba(0,232,198,.25);border-radius:9px;list-style:none;margin:0;padding:.3rem;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,.3);max-height:220px;overflow-y:auto}
  .ac-list li{padding:.55rem .75rem;border-radius:6px;cursor:pointer;font-size:.9rem;color:var(--txt)}
  .ac-list li:hover{background:rgba(0,184,122,.12);color:var(--teal)}
  .btn-submit{width:100%;padding:.8rem;margin-top:.25rem;background:var(--teal,#00e8c6);color:#003C4E;border:none;border-radius:8px;font-size:.95rem;font-weight:800;cursor:pointer;transition:opacity .15s}
  .btn-submit:hover{opacity:.9}
  .links{margin-top:1.25rem;display:flex;flex-direction:column;align-items:center;gap:.5rem}
  .links a{font-size:.78rem;color:var(--teal);text-decoration:none}
  .links a.inst{color:var(--txt-3);font-size:.72rem}
</style>
