<script>
  import Icon from '$lib/components/Icon.svelte';
  export let form;
</script>
<svelte:head><title>Instructor — Summit Paragliding</title></svelte:head>

<div class="inst-login">
  <div class="card login-card">
    <img src="/summit-logo.png" alt="Summit Paragliding" class="logo logo-teal" />
    <div class="role-label">Instructor Portal</div>

    {#if form?.error}
      <div class="alert alert-err"><Icon name="alert" size={14} />{form.error}</div>
    {/if}

    <form method="POST">
      <div class="form-group">
        <label for="u">Username</label>
        <input id="u" name="username" type="text" placeholder="username" autocomplete="username" />
      </div>
      <div class="form-group">
        <label for="p">Password</label>
        <input id="p" name="password" type="password" autocomplete="current-password" />
      </div>
      <button type="submit" class="btn btn-primary btn-block">Sign In</button>
    </form>

    <div class="back-link">
      <a href="/">Student login</a>
    </div>
  </div>
</div>

<style>
  .inst-login{min-height:100svh;display:flex;align-items:center;justify-content:center;padding:1rem;background:var(--bg)}
  .login-card{width:100%;max-width:360px;padding:2.5rem 2rem;box-shadow:var(--shadow-lg)}
  .logo{height:56px;width:auto;object-fit:contain;display:block;margin:0 auto 1.5rem}
  .role-label{text-align:center;font-family:var(--ff-head);font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--txt-3);margin-bottom:1.75rem}
  .back-link{margin-top:1.25rem;text-align:center;font-size:.78rem}
  .back-link a{color:var(--txt-3)}
  .back-link a:hover{color:var(--txt-2)}
</style>
