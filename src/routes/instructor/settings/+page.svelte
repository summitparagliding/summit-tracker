<script>
  import { enhance } from '$app/forms';
  export let form;
  let confirmText = '';
  let showConfirm = false;
  let step = 1; // 1=initial, 2=confirm text
</script>

<svelte:head><title>Paramètres — Summit</title></svelte:head>

<div class="settings-wrap">
  <h1>Paramètres / Settings</h1>

  {#if form?.resetDone}
  <div class="reset-done">
    Réinitialisation complète effectuée. Toutes les données étudiantes ont été supprimées.
  </div>
  {/if}

  <div class="danger-zone card">
    <div class="dz-title">Zone de danger / Danger Zone</div>

    <div class="dz-item">
      <div>
        <div class="dz-label">Réinitialisation complète de l'application</div>
        <div class="xs muted" style="margin-top:.2rem">
          Supprime TOUS les étudiants, vols, exercices, paiements, messages, planifications et médias.
          Conserve : documents d'étude, questions de quiz, curriculum, compte instructeur.
        </div>
      </div>
      {#if !showConfirm}
      <button class="btn btn-danger" on:click={() => showConfirm = true}>
        Réinitialiser l'application
      </button>
      {:else if step === 1}
      <div class="confirm-box">
        <div class="xs" style="color:var(--red);font-weight:700;margin-bottom:.5rem">
          Êtes-vous certain ? Cette action est irréversible.
        </div>
        <div class="confirm-btns">
          <button class="btn btn-secondary btn-sm" on:click={() => { showConfirm=false; step=1; }}>Annuler</button>
          <button class="btn btn-danger btn-sm" on:click={() => step=2}>Oui, continuer</button>
        </div>
      </div>
      {:else}
      <form method="POST" action="?/fullReset" use:enhance class="confirm-box">
        <div class="xs" style="color:var(--red);font-weight:700;margin-bottom:.5rem">
          Tapez RESET pour confirmer la suppression de toutes les données :
        </div>
        <input bind:value={confirmText} placeholder="RESET" class="confirm-input" autocomplete="off" />
        <div class="confirm-btns">
          <button class="btn btn-secondary btn-sm" type="button"
            on:click={() => { showConfirm=false; step=1; confirmText=''; }}>Annuler</button>
          <button class="btn btn-danger btn-sm" type="submit"
            disabled={confirmText !== 'RESET'}>
            Supprimer tout
          </button>
        </div>
      </form>
      {/if}
    </div>
  </div>
</div>

<style>
  .settings-wrap{max-width:600px;padding:1rem}
  h1{font-size:1.2rem;font-weight:700;margin-bottom:1rem;color:var(--txt)}
  .card{background:var(--bg-raised);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem}
  .danger-zone{border-color:rgba(220,38,38,.3)}
  .dz-title{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#dc2626;margin-bottom:.75rem}
  .dz-item{display:flex;flex-direction:column;gap:.75rem}
  .dz-label{font-size:.9rem;font-weight:600;color:var(--txt)}
  .xs{font-size:.75rem} .muted{color:var(--txt-3)}
  .confirm-box{display:flex;flex-direction:column;gap:.4rem;background:rgba(220,38,38,.05);border:1px solid rgba(220,38,38,.2);border-radius:8px;padding:.75rem}
  .confirm-btns{display:flex;gap:.4rem}
  .confirm-input{background:var(--bg-2);border:1.5px solid #dc2626;border-radius:6px;padding:.35rem .6rem;color:var(--txt);font-size:.9rem;font-family:monospace;width:100%;box-sizing:border-box}
  .reset-done{background:rgba(0,184,122,.1);border:1px solid rgba(0,184,122,.3);border-radius:8px;padding:.75rem;color:var(--teal);font-size:.85rem;margin-bottom:.875rem}
  .btn-danger{background:#dc2626;border-color:#dc2626;color:#fff;font-weight:600}
  .btn-danger:hover:not(:disabled){background:#b91c1c}
  .btn-danger:disabled{opacity:.5;cursor:not-allowed}
</style>
