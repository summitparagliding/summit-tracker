<script>
  import { enhance } from '$app/forms';
  export let form;
</script>

<svelte:head><title>Inscription — Summit Paragliding</title></svelte:head>

<div class="reg-page">
  <div class="reg-card">
    <div class="reg-logo">Summit Paragliding</div>
    <h1 class="reg-title">Demande d'inscription</h1>
    <p class="reg-sub">
      Remplissez ce formulaire et votre instructeur vous contactera sous peu pour confirmer votre inscription et vous remettre votre code PIN.
    </p>

    {#if form?.success}
    <div class="reg-success">
      <div style="font-size:1.5rem">✓</div>
      <div style="font-weight:700;margin:.25rem 0">Demande envoyée !</div>
      <div class="xs muted">Votre instructeur va vous contacter sous peu.</div>
    </div>
    {:else}
    <form method="POST" use:enhance class="reg-form">
      {#if form?.error}
      <div class="reg-error xs">{form.error}</div>
      {/if}

      <label class="reg-label">
        <span class="xs">Nom complet *</span>
        <input name="name" type="text" required placeholder="Prénom Nom" class="reg-input" />
      </label>

      <label class="reg-label">
        <span class="xs">Téléphone</span>
        <input name="phone" type="tel" placeholder="+1 438 000-0000" class="reg-input" />
      </label>

      <label class="reg-label">
        <span class="xs">Courriel</span>
        <input name="email" type="email" placeholder="vous@exemple.com" class="reg-input" />
      </label>

      <label class="reg-label">
        <span class="xs">Message (optionnel)</span>
        <textarea name="message" rows="3" placeholder="Questions, disponibilités, niveau d'expérience…" class="reg-input reg-textarea"></textarea>
      </label>

      <button type="submit" class="reg-submit">Envoyer ma demande</button>
    </form>
    {/if}

    <div class="reg-footer xs muted">
      Déjà inscrit ? <a href="/" style="color:var(--teal)">Se connecter avec mon PIN</a>
    </div>
  </div>
</div>

<style>
  :global(body){background:#003C4E}
  .reg-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
  .reg-card{background:var(--bg-raised,#1a2a2e);border:1px solid rgba(0,232,198,.2);border-radius:16px;padding:2rem;width:100%;max-width:400px}
  .reg-logo{font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--teal,#00e8c6);margin-bottom:1rem}
  .reg-title{font-size:1.3rem;font-weight:800;color:#fff;margin-bottom:.4rem}
  .reg-sub{font-size:.82rem;color:rgba(255,255,255,.6);line-height:1.6;margin-bottom:1.25rem}
  .reg-form{display:flex;flex-direction:column;gap:.75rem}
  .reg-label{display:flex;flex-direction:column;gap:.3rem}
  .reg-label .xs{color:rgba(255,255,255,.6)}
  .reg-input{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:.5rem .625rem;color:#fff;font-size:.9rem;width:100%;box-sizing:border-box}
  .reg-input:focus{outline:none;border-color:var(--teal,#00e8c6)}
  .reg-textarea{resize:vertical;min-height:70px}
  .reg-submit{background:var(--teal,#00e8c6);color:#003C4E;border:none;border-radius:8px;padding:.7rem;font-weight:800;font-size:.9rem;cursor:pointer;width:100%;margin-top:.25rem}
  .reg-submit:hover{opacity:.9}
  .reg-success{text-align:center;padding:1.5rem;background:rgba(0,232,198,.1);border-radius:10px;color:#fff}
  .reg-error{color:#f87171;background:rgba(239,68,68,.1);border-radius:6px;padding:.4rem .6rem;margin-bottom:.25rem}
  .reg-footer{text-align:center;margin-top:1.25rem;color:rgba(255,255,255,.4)}
  .xs{font-size:.75rem} .muted{color:rgba(255,255,255,.4)}
</style>
