<script>
  export let data;
  export let form;
</script>

<svelte:head><title>Approbation — Summit</title></svelte:head>

<div class="ap-wrap">
  <a href="/instructor" class="ap-back xs">← Retour au tableau de bord</a>

  <h1 class="ap-title">Demande d'inscription</h1>

  <!-- Student info card -->
  <div class="ap-info-card">
    <div class="ap-name">{data.req.name}</div>
    {#if data.req.phone}<div class="xs muted">{data.req.phone}</div>{/if}
    {#if data.req.email}<div class="xs muted">{data.req.email}</div>{/if}
    {#if data.req.message}
    <div class="ap-msg xs">{data.req.message}</div>
    {/if}
  </div>

  <!-- Error display -->
  {#if form?.error}
  <div class="ap-error xs">{form.error}</div>
  {/if}

  <!-- Approval form — plain POST, no enhance -->
  <form method="POST" action="?/approve" class="ap-form">
    <label class="ap-lbl">
      <span class="xs" style="color:var(--txt-2);font-weight:600;text-transform:uppercase;letter-spacing:.06em;font-size:.7rem">
        Code PIN à attribuer (4–6 chiffres)
      </span>
      <input
        name="pin"
        type="tel"
        inputmode="numeric"
        autocomplete="off"
        maxlength="6"
        placeholder="ex. 1234"
        class="ap-pin-input"
      />
      <span class="xs muted">Exemple : les 4 derniers chiffres du numéro de téléphone</span>
    </label>

    <button type="submit" class="ap-approve-btn">
      ✓ Approuver et créer le compte
    </button>
  </form>

  <!-- Reject form -->
  <form method="POST" action="?/reject" style="margin-top:.5rem"
    onsubmit="return confirm('Refuser cette demande ?')">
    <button type="submit" class="ap-reject-btn">Refuser la demande</button>
  </form>
</div>

<style>
  .ap-wrap{padding:1.25rem;max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:.75rem}
  .ap-back{color:var(--teal);text-decoration:none;font-size:.78rem}
  .ap-title{font-size:1.1rem;font-weight:800;color:var(--txt);margin:0}
  .ap-info-card{background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:.875rem;display:flex;flex-direction:column;gap:.2rem}
  .ap-name{font-size:.95rem;font-weight:700;color:var(--txt)}
  .ap-msg{margin-top:.35rem;color:var(--txt-2);font-style:italic}
  .ap-error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:7px;padding:.5rem .625rem;color:#f87171}
  .ap-form{display:flex;flex-direction:column;gap:.5rem}
  .ap-lbl{display:flex;flex-direction:column;gap:.3rem}
  .ap-pin-input{
    background:var(--bg-2);border:2px solid var(--teal);border-radius:9px;
    padding:.7rem .875rem;color:var(--txt);font-size:1.6rem;font-family:monospace;
    text-align:center;letter-spacing:.25em;width:100%;box-sizing:border-box;
    outline:none;
  }
  .ap-pin-input:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(0,232,198,.15)}
  .ap-approve-btn{
    width:100%;padding:.8rem;
    background:var(--teal,#00e8c6);color:#003C4E;
    border:none;border-radius:9px;font-size:.95rem;font-weight:800;
    cursor:pointer;
  }
  .ap-approve-btn:hover{opacity:.9}
  .ap-approve-btn:active{transform:scale(.98)}
  .ap-reject-btn{
    width:100%;padding:.6rem;
    background:none;border:1px solid var(--border);border-radius:9px;
    color:var(--txt-3);font-size:.85rem;cursor:pointer;
  }
  .ap-reject-btn:hover{border-color:#ef4444;color:#ef4444}
  .xs{font-size:.75rem} .muted{color:var(--txt-3)}
</style>
