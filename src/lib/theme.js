// Single source of truth for the dark <-> light brightness slider.
//
// Backgrounds interpolate continuously, but the TEXT ink is chosen by whichever
// of two hand-tuned ink sets gives the higher contrast against the current
// background. That guarantees readable text at EVERY slider position instead of
// fading to the same grey as the background in the muddy middle.

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const rgb  = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const mix  = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// Surface ramp: [dark, light]
const BG = {
  bg:      [[7, 13, 22],  [240, 244, 248]],
  bgCard:  [[12, 22, 33], [255, 255, 255]],
  bgRaised:[[16, 28, 43], [233, 238, 244]],
  bgInput: [[16, 29, 45], [255, 255, 255]],
  border:  [[23, 35, 52], [202, 213, 225]],
  borderHi:[[31, 50, 71], [170, 190, 209]],
};

const INK_ON_DARK  = { txt:[238,244,255], txt2:[156,184,208], txt3:[112,146,173], inv:[8,15,24] };
const INK_ON_LIGHT = { txt:[17,26,37],    txt2:[58,78,97],    txt3:[96,123,148],  inv:[255,255,255] };

// WCAG relative luminance + contrast ratio
function relLum(c) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
function contrast(a, b) {
  const la = relLum(a), lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function applyThemeMix(t) {
  if (typeof document === 'undefined') return;
  t = Math.min(1, Math.max(0, t));
  const r = document.documentElement;

  const bg = mix(BG.bg[0], BG.bg[1], t);
  r.style.setProperty('--bg',        rgb(bg));
  r.style.setProperty('--bg-card',   rgb(mix(BG.bgCard[0],   BG.bgCard[1],   t)));
  r.style.setProperty('--bg-raised', rgb(mix(BG.bgRaised[0], BG.bgRaised[1], t)));
  r.style.setProperty('--bg-2',      rgb(mix(BG.bgRaised[0], BG.bgRaised[1], t)));
  r.style.setProperty('--bg-input',  rgb(mix(BG.bgInput[0],  BG.bgInput[1],  t)));
  r.style.setProperty('--border',    rgb(mix(BG.border[0],   BG.border[1],   t)));
  r.style.setProperty('--border-hi', rgb(mix(BG.borderHi[0], BG.borderHi[1], t)));
  r.style.setProperty('--bg-overlay', `rgba(${bg[0]},${bg[1]},${bg[2]},0.92)`);

  // Pick the higher-contrast ink set for this background
  const useLight = contrast(INK_ON_LIGHT.txt, bg) > contrast(INK_ON_DARK.txt, bg);
  const ink = useLight ? INK_ON_LIGHT : INK_ON_DARK;
  r.style.setProperty('--txt',     rgb(ink.txt));
  r.style.setProperty('--txt-2',   rgb(ink.txt2));
  r.style.setProperty('--txt-3',   rgb(ink.txt3));
  r.style.setProperty('--txt-inv', rgb(ink.inv));

  // Accent darkens on light backgrounds so it stays legible
  r.style.setProperty('--teal',        useLight ? '#0a8f5e' : '#00b87a');
  r.style.setProperty('--teal-hi',     useLight ? '#0b7d53' : '#00e890');
  r.style.setProperty('--teal-border', useLight ? 'rgba(10,143,94,0.32)' : 'rgba(0,184,122,0.22)');
  r.style.setProperty('--teal-lo',     useLight ? 'rgba(10,143,94,0.10)' : 'rgba(0,184,122,0.10)');

  r.setAttribute('data-theme', useLight ? 'light' : 'dark');
  try { localStorage.setItem('summit-theme-mix', String(t)); } catch (e) {}
}

export function initThemeMix() {
  let t = 0;
  try { const s = parseFloat(localStorage.getItem('summit-theme-mix') ?? '0'); t = isNaN(s) ? 0 : s; } catch (e) {}
  applyThemeMix(t);
  return t;
}
