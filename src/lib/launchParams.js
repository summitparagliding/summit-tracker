/**
 * Mont Yamaska launch parameters and shared weather scoring utilities.
 * Single source of truth — used by WeatherWidget, WeatherBriefing, info page, En Vol page.
 */

export const YAMASKA_LAUNCHES = [
  { key:'NE CVLY',  color:'#00b87a', idealDir:0,   dirMax:30, minSpd:5,  maxSpd:25 },
  { key:'N Cogeco', color:'#00e8c6', idealDir:337, dirMax:30, minSpd:5,  maxSpd:25 },
  { key:'O CVLY',   color:'#f59e0b', idealDir:270, dirMax:30, minSpd:5,  maxSpd:25 },
  { key:'S',        color:'#8b5cf6', idealDir:180, dirMax:30, minSpd:5,  maxSpd:25 },
];

export function angleDiff(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Compute flyability score 0–100.
 *
 * Calibration targets (Pat):
 *  2.9 gusting 4.3 W  → ~92%  (calm, near-perfect for training)
 *  3.6 gusting 15 W   → ~68%  (gusty ratio but low absolute)
 *  14 gusting 28 W    → ~70%  (100% gust factor = significant degradation)
 *  17 gusting 41      →   0%  (hard limit)
 *  SO at 45° from W   → ~70% direction score (between SSO and OSO, both flyable)
 *  Rain 50%+          → significant penalty
 *  "Excellent" label  → reserved for 90%+ only
 */
export function launchScore(windSpd, windDir, gustSpd, launch, precipProb = 0) {
  if (windSpd == null) return null;
  const { maxSpd = 25, idealDir, dirMax = 30 } = launch;

  // ── Hard limits ────────────────────────────────────────────────────────────
  if (gustSpd != null && gustSpd > 40) return 0;   // gusts > 40: not flyable
  if (windSpd > 30) return 0;                        // sustained > 30: not flyable

  // ── Speed score ────────────────────────────────────────────────────────────
  // Peak 8–14 km/h; light calms also good for training; strong tapers sharply
  let sScore;
  if (windSpd >= 5 && windSpd <= 15) {
    sScore = 0.95 + 0.05 * Math.sin(((windSpd - 5) / 10) * Math.PI);  // 0.95–1.0
  } else if (windSpd < 5) {
    sScore = 0.80 + (windSpd / 5) * 0.15;           // 0.80–0.95 for very light
  } else if (windSpd <= maxSpd) {
    sScore = 1.0 - 0.55 * (windSpd - 15) / Math.max(maxSpd - 15, 1); // 1.0→0.45
  } else {
    sScore = Math.max(0, 0.45 - (windSpd - maxSpd) / 5 * 0.40);       // drops sharply
  }

  // ── Gust penalty ───────────────────────────────────────────────────────────
  // Penalty based primarily on ABSOLUTE gust value — high absolute gusts
  // are dangerous regardless of the ratio. Ratio adds secondary penalty.
  if (gustSpd != null && gustSpd > 0) {
    // Absolute penalty: 0 at ≤10, scales to 0.55 at 40 km/h
    const absPenalty = gustSpd > 10
      ? Math.min(0.55, (gustSpd - 10) / 30 * 0.55)
      : 0;

    // Ratio penalty: small extra when gusts > 2× mean
    const ratio = gustSpd / Math.max(windSpd, 1);
    const ratioExtra = ratio > 2.0
      ? Math.min(0.10, (ratio - 2.0) * 0.04)
      : 0;

    const totalPenalty = Math.min(0.60, absPenalty + ratioExtra);
    sScore = Math.max(0, sScore * (1 - totalPenalty));
  }

  // ── Direction score ────────────────────────────────────────────────────────
  // Extended soft window: SO (45° from W) ≈ 70%, hard cutoff at 55°.
  let dScore = 1.0;
  if (idealDir != null && windDir != null) {
    const diff    = angleDiff(windDir, idealDir);
    const hardMax = 55;

    if (diff >= hardMax) {
      dScore = 0;
    } else if (diff <= 10) {
      dScore = 1.0;
    } else if (diff <= dirMax) {
      dScore = 1.0 - ((diff - 10) / Math.max(dirMax - 10, 1)) * 0.15;
    } else {
      // 30°→55°: concave falloff — 30°≈0.85, 45°≈0.70, 55°=0
      const over = diff - dirMax;
      const span = hardMax - dirMax;
      dScore = 0.85 * (1 - (over / span) ** 0.75);
    }
  }

  let score = Math.min(100, Math.round(sScore * dScore * 100));

  // ── Rain / precipitation penalty ──────────────────────────────────────────
  // Rain makes flying dangerous — significant degradation above 30%
  if (precipProb > 30) {
    const rainPenalty = Math.min(0.80, (precipProb - 30) / 70 * 0.80);
    score = Math.round(score * (1 - rainPenalty));
  }

  return score;
}

// ── Best launch across all sites ─────────────────────────────────────────────
export function bestLaunch(windSpd, windDir, gustSpd) {
  let best = null, bestScore = -1;
  for (const launch of YAMASKA_LAUNCHES) {
    const s = launchScore(windSpd, windDir, gustSpd, launch);
    if (s != null && s > bestScore) { bestScore = s; best = launch; }
  }
  return best;
}

export function bestLaunchScore(windSpd, windDir, gustSpd, precipProb = 0) {
  let best = -1;
  for (const launch of YAMASKA_LAUNCHES) {
    const s = launchScore(windSpd, windDir, gustSpd, launch, precipProb);
    if (s != null && s > best) best = s;
  }
  return best < 0 ? null : best;
}

// ── Score → colour ────────────────────────────────────────────────────────────
export function scoreColor(pct) {
  if (pct == null) return '#64748b';
  if (pct >= 90) return '#22c55e';   // bright green  — excellent
  if (pct >= 80) return '#84cc16';   // lime          — favorable
  if (pct >= 65) return '#eab308';   // yellow        — acceptable
  if (pct >= 45) return '#f97316';   // orange        — marginal
  if (pct >= 25) return '#ef4444';   // red-orange    — not recommended
  return '#dc2626';                   // dark red      — no-go
}

// ── Score → label ─────────────────────────────────────────────────────────────
export function scoreLabel(pct, lang = 'fr') {
  const L = lang === 'fr';
  if (pct == null) return L ? 'Inconnu' : 'Unknown';
  if (pct >= 90) return L ? 'Excellent'    : 'Excellent';     // very best only
  if (pct >= 80) return L ? 'Favorable'    : 'Favourable';
  if (pct >= 65) return L ? 'Acceptable'   : 'Acceptable';
  if (pct >= 45) return L ? 'Marginal'     : 'Marginal';
  if (pct >= 25) return L ? 'Déconseillé'  : 'Not ideal';
  return L ? 'Non volable' : 'No-go';
}

// ── Concise weather summary for En Vol / WeatherBriefing ─────────────────────
export function weatherSummary(lang, avgSpd, dir, peakGust, score) {
  const L     = lang === 'fr';
  const lch   = bestLaunch(avgSpd, dir, peakGust);
  const label = scoreLabel(score, lang);
  const gPart = peakGust > avgSpd + 3
    ? (L ? `, rafales ${peakGust} km/h` : `, gusts ${peakGust} km/h`)
    : '';
  return L
    ? `Vent ${avgSpd} km/h ${dirLabel(dir)}${gPart}. ${label}${lch ? ' — ' + lch.key + ' recommandé' : ''}.`
    : `Wind ${avgSpd} km/h ${dirLabel(dir)}${gPart}. ${label}${lch ? ' — ' + lch.key + ' recommended' : ''}.`;
}


// ── Direction label ───────────────────────────────────────────────────────────
export function dirLabel(deg) {
  if (deg == null) return '?';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

// ── Time-based briefing (deprecated stub) ─────────────────────────────────────
export function timeBriefing(lang, hours) { return []; }  // returns [] so {#each} never crashes
