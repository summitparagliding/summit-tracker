<script>
  export let mainColor    = '#3b82f6';   // wing body
  export let leColor      = '#e2e8f0';   // leading edge band
  export let harnessColor = '#1e293b';   // pilot circle
  export let size         = 52;
  export let name         = '';

  // Legacy prop support
  export let wing1   = null;
  export let wing2   = null;
  export let harness = null;

  $: mc  = (wing1   && wing1   !== '#3b82f6') ? wing1   : mainColor;
  $: lec = (wing2   && wing2   !== '#e2e8f0') ? wing2   : leColor;
  $: hc  = (harness && harness !== '#1e293b') ? harness : harnessColor;

  // Dimensions — preserving sketch proportions exactly
  // Wing: wide semi-arch, flat bottom, distinct LE band at top, pilot circle below
  $: W  = Math.round(size * 2.5);
  $: H  = Math.round(size * 1.35);

  // Wing geometry (all as fractions of W/H)
  $: lx = W * 0.07;   // left x
  $: rx = W * 0.93;   // right x
  $: ty = H * 0.07;   // top arc apex y
  $: by = H * 0.60;   // flat bottom y
  $: ey = H * 0.62;   // edge of side panels (slightly below flat bottom)

  // Leading edge inner arc (creates the band)
  $: ley = H * 0.30;  // inner arc y (gives the band height)

  // Pilot circle
  $: pcx = W / 2;
  $: pcy = H * 0.87;
  $: pr  = H * 0.10;

  // SVG paths
  // Outer wing arch: left corner → top arc → right corner
  $: outerArc  = `M ${lx},${by} C ${lx},${ty} ${rx},${ty} ${rx},${by}`;
  // Inner arc (leading edge bottom boundary)
  $: innerArc  = `C ${rx},${ley} ${lx},${ley} ${lx},${by}`;
  // Full wing path (for main color)
  $: wingPath  = `${outerArc} L ${rx},${ey} L ${lx},${ey} Z`;
  // Leading edge band = outer arc → inner arc (closed region at top of wing)
  $: lePath    = `${outerArc} ${innerArc} Z`;
  // Divider line between LE and body
  $: dividerD  = `M ${lx},${by} C ${lx},${ley} ${rx},${ley} ${rx},${by}`;
</script>

<div class="sig" title="{name}">
  <svg viewBox="0 0 {W} {H}" width={W} height={H}
       xmlns="http://www.w3.org/2000/svg" overflow="visible">

    <!-- Wing body (main colour) -->
    <path d={wingPath} fill={mc} stroke="none"/>

    <!-- Leading edge band (overlay top portion) -->
    <path d={lePath} fill={lec} stroke="none"/>

    <!-- Wing outline -->
    <path d={wingPath} fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1.2"
      stroke-linejoin="round" stroke-linecap="round"/>

    <!-- Leading edge divider line -->
    <path d={dividerD} fill="none" stroke="rgba(0,0,0,0.13)" stroke-width="0.9"
      stroke-linejoin="round"/>

    <!-- Cell lines — subtle vertical lines across wing body -->
    {#each [0.2, 0.35, 0.5, 0.65, 0.8] as t}
    {@const cx = lx + (rx - lx) * t}
    {@const topYAtT = ty + (ley - ty) * Math.sin(Math.PI * t) * 0.2}
    <line x1={cx} y1={ley + (by - ley) * 0.3} x2={cx} y2={by}
      stroke="rgba(0,0,0,0.07)" stroke-width="0.7"/>
    {/each}

    <!-- Pilot / harness circle -->
    <circle cx={pcx} cy={pcy} r={pr}
      fill={hc} stroke="rgba(0,0,0,0.18)" stroke-width="1"/>

    <!-- Inner circle detail (like helmet visor) -->
    <circle cx={pcx} cy={pcy} r={pr * 0.45}
      fill="rgba(255,255,255,0.18)" stroke="none"/>
  </svg>
</div>

<style>
  .sig{display:inline-flex;align-items:center;line-height:0;flex-shrink:0}
</style>
