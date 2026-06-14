<script>
  import { page } from '$app/stores';
</script>

<div style="min-height:100svh;display:flex;align-items:center;justify-content:center;background:#060d16;color:#eef4ff;font-family:sans-serif;padding:2rem;text-align:center">
  <div>
    <div style="font-size:3rem;margin-bottom:1rem">⚠️</div>
    <h1 style="color:#00b87a;margin-bottom:.5rem">{$page.status}</h1>
    <p style="color:#8fb3cc;margin-bottom:1.5rem;max-width:400px">{$page.error?.message || 'Une erreur est survenue.'}</p>
    <a href="/" style="background:#00b87a;color:#003C4E;padding:.6rem 1.5rem;border-radius:8px;font-weight:700;text-decoration:none">
      Retour
    </a>
  </div>
</div>
