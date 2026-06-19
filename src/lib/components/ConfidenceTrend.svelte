<script>
  export let data = [];      // [{rating, date}]
  export let trend = 'neutral';
  export let baseline = null;
  export let recent = null;
  export let last = null;
  export let compact = false; // compact mode for instructor list
  export let lang = 'fr';
  $: L = lang === 'fr';

  $: hasData = data.length > 0;
  $: sparkPoints = buildSparkline(data);

  function buildSparkline(rows) {
    if (!rows.length) return '';
    const W = 80, H = 28, pad = 3;
    const n = Math.min(rows.length, 20);
    const slice = rows.slice(-n);
    const minR = 1, maxR = 5;
    const pts = slice.map((r, i) => {
      const x = pad + (i / Math.max(n - 1, 1)) * (W - pad * 2);
      const y = H - pad - ((r.rating - minR) / (maxR - minR)) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return pts.join(' ');
  }

  $: trendColor = trend === 'up' ? '#16a34a' : trend === 'down' ? '#dc2626' : '#eab308';
  $: trendIcon  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
</script>

{#if hasData}
<div class="ct-wrap" class:compact>
  <!-- Sparkline -->
  <svg viewBox="0 0 80 28" class="ct-spark" aria-hidden="true">
    <polyline points={sparkPoints} fill="none" stroke={trendColor} stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- Last point dot -->
    {#if sparkPoints}
    {@const lastPt = sparkPoints.split(' ').pop().split(',')}
    <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill={trendColor} />
    {/if}
  </svg>

  <!-- Stats -->
  <div class="ct-stats">
    {#if baseline !== null}
    <div class="ct-stat">
      <span class="ct-label">{L?'Base':'Base'}</span>
      <span class="ct-val">{baseline}</span>
    </div>
    {/if}
    {#if recent !== null && recent !== baseline}
    <div class="ct-stat">
      <span class="ct-label">{L?'Récent':'Recent'}</span>
      <span class="ct-val" style="color:{trendColor}">{recent}</span>
    </div>
    {/if}
    <div class="ct-stat">
      <span class="ct-label">{L?'Dernier':'Last'}</span>
      <span class="ct-val" style="color:{trendColor}; font-weight:700">{last}/5</span>
    </div>
    <div class="ct-trend" style="color:{trendColor}">{trendIcon}</div>
  </div>
</div>
{:else}
<span class="ct-empty">—</span>
{/if}

<style>
  .ct-wrap{display:flex;align-items:center;gap:.625rem}
  .ct-spark{width:80px;height:28px;flex-shrink:0}
  .ct-stats{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  .ct-stat{display:flex;flex-direction:column;align-items:center;gap:.05rem}
  .ct-label{font-size:.6rem;color:var(--txt-3);text-transform:uppercase;letter-spacing:.04em}
  .ct-val{font-size:.78rem;font-family:var(--ff-mono);color:var(--txt-2)}
  .ct-trend{font-size:1rem;font-weight:700;margin-left:.1rem}
  .ct-empty{color:var(--txt-3);font-size:.78rem}
  .compact .ct-spark{width:56px;height:20px}
  .compact .ct-val{font-size:.7rem}
  .compact .ct-label{font-size:.56rem}
</style>
