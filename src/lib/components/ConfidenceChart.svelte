<script>
  export let compare = { data: [], avgPre: null, avgPost: null, delta: null };
  export let lang = 'fr';
  $: L = lang === 'fr';
  $: rows = compare?.data || [];

  // SVG geometry
  const W = 320, H = 130, padL = 24, padR = 10, padT = 12, padB = 22;
  $: n = rows.length;
  function x(i) { return padL + (i / Math.max(n - 1, 1)) * (W - padL - padR); }
  function y(v) { return padT + (1 - (v - 1) / 4) * (H - padT - padB); } // 1..5 scale
  $: prePts  = rows.map((r, i) => r.pre  != null ? `${x(i).toFixed(1)},${y(r.pre).toFixed(1)}`  : null).filter(Boolean).join(' ');
  $: postPts = rows.map((r, i) => r.post != null ? `${x(i).toFixed(1)},${y(r.post).toFixed(1)}` : null).filter(Boolean).join(' ');

  $: deltaColor = compare.delta == null ? 'var(--txt-3)' : compare.delta > 0.2 ? 'var(--teal)' : compare.delta < -0.2 ? '#ef4444' : 'var(--amber,#f59e0b)';
  $: insight = (() => {
    if (compare.delta == null) return '';
    if (compare.delta > 0.4)  return L ? 'Tes vols renforcent ta confiance.' : 'Your flights are building your confidence.';
    if (compare.delta < -0.4) return L ? 'Tu finis souvent moins confiant qu\'au départ — à discuter avec ton instructeur.' : 'You often finish less confident than you start — worth discussing with your instructor.';
    return L ? 'Ta confiance reste stable avant et après le vol.' : 'Your confidence stays stable before and after flights.';
  })();
</script>

{#if rows.length}
<div class="cc">
  <div class="cc-legend">
    <span class="cc-key"><span class="cc-dot" style="background:#3b82f6"></span>{L?'Avant vol':'Before flight'}</span>
    <span class="cc-key"><span class="cc-dot" style="background:var(--teal)"></span>{L?'Après vol':'After flight'}</span>
  </div>

  <svg viewBox="0 0 {W} {H}" class="cc-svg" preserveAspectRatio="none">
    {#each [1,2,3,4,5] as g}
    <line x1={padL} y1={y(g)} x2={W-padR} y2={y(g)} stroke="var(--border)" stroke-width="0.5" />
    <text x={padL-5} y={y(g)+3} text-anchor="end" font-size="7" fill="var(--txt-3)">{g}</text>
    {/each}
    {#if prePts}<polyline points={prePts} fill="none" stroke="#3b82f6" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>{/if}
    {#if postPts}<polyline points={postPts} fill="none" stroke="var(--teal)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>{/if}
    {#each rows as r, i}
      {#if r.pre  != null}<circle cx={x(i)} cy={y(r.pre)}  r="2.2" fill="#3b82f6"/>{/if}
      {#if r.post != null}<circle cx={x(i)} cy={y(r.post)} r="2.4" fill="var(--teal)"/>{/if}
    {/each}
  </svg>

  <div class="cc-stats">
    <div class="cc-stat"><span class="cc-lbl">{L?'Moy. avant':'Avg before'}</span><span class="cc-val" style="color:#3b82f6">{compare.avgPre ?? '—'}</span></div>
    <div class="cc-stat"><span class="cc-lbl">{L?'Moy. après':'Avg after'}</span><span class="cc-val" style="color:var(--teal)">{compare.avgPost ?? '—'}</span></div>
    <div class="cc-stat"><span class="cc-lbl">{L?'Écart':'Delta'}</span><span class="cc-val" style="color:{deltaColor}">{compare.delta == null ? '—' : (compare.delta>0?'+':'')+compare.delta}</span></div>
  </div>
  {#if insight}<p class="cc-insight">{insight}</p>{/if}
</div>
{:else}
<p class="cc-empty">{L?'Pas encore assez de données. Tes évaluations de confiance avant et après chaque vol apparaîtront ici.':'Not enough data yet. Your before- and after-flight confidence ratings will appear here.'}</p>
{/if}

<style>
  .cc{display:flex;flex-direction:column;gap:.5rem}
  .cc-legend{display:flex;gap:1rem}
  .cc-key{display:flex;align-items:center;gap:.3rem;font-size:.7rem;color:var(--txt-2)}
  .cc-dot{width:9px;height:9px;border-radius:50%;display:inline-block}
  .cc-svg{width:100%;height:auto;display:block}
  .cc-stats{display:flex;gap:.5rem}
  .cc-stat{flex:1;display:flex;flex-direction:column;align-items:center;gap:.1rem;background:var(--bg-2,var(--bg-input));border:1px solid var(--border);border-radius:8px;padding:.35rem}
  .cc-lbl{font-size:.62rem;color:var(--txt-3);text-transform:uppercase;letter-spacing:.04em}
  .cc-val{font-size:1rem;font-weight:800;font-family:var(--ff-mono,monospace)}
  .cc-insight{font-size:.74rem;color:var(--txt-2);line-height:1.5;font-style:italic}
  .cc-empty{font-size:.76rem;color:var(--txt-3);line-height:1.5}
</style>
