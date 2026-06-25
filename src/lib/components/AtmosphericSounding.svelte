<script>
  export let lang = 'fr';
  export let lat  = 45.472332;
  export let lon  = -72.882132;

  $: L = lang === 'fr';

  const LEVELS = [
    { hPa: 1000, alt: 200  },
    { hPa: 850,  alt: 1500 },
    { hPa: 700,  alt: 3000 },
    { hPa: 500,  alt: 5500 },
  ];

  const HOURS = [
    { label:'07h', hr:7  },
    { label:'09h', hr:9  },
    { label:'11h', hr:11 },
    { label:'13h', hr:13 },
    { label:'15h', hr:15 },
    { label:'17h', hr:17 },
    { label:'19h', hr:19 },
  ];

  let loading  = true;
  let error    = null;
  let allData  = {}; // { hr: [{alt, temp, dewpt}] }
  let summaryOpen = true;
  let selected = 11; // default to 11h

  import { onMount } from 'svelte';
  import { YAMASKA_LAUNCHES, angleDiff, bestLaunch } from '$lib/launchParams.js';

  async function fetch_sounding() {
    error = null; loading = true; allData = {};
    const tvars  = LEVELS.map(l=>`temperature_${l.hPa}hPa`).join(',');
    const rvars  = LEVELS.map(l=>`relative_humidity_${l.hPa}hPa`).join(',');
    // Only fetch wind at levels supported by Open-Meteo: 1000, 850, 700, 500 hPa
    const wsvars = LEVELS.map(l=>`wind_speed_${l.hPa}hPa`).join(',');
    const wdvars = LEVELS.map(l=>`wind_direction_${l.hPa}hPa`).join(',');
    try {
      const url = '/api/weather?' + new URLSearchParams({
        latitude: lat, longitude: lon,
        hourly:   `${tvars},${rvars},${wsvars},${wdvars},wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability`,
        timezone: 'America/Toronto',
        forecast_days: '2',
        models:        'best_match',   // gem_seamless doesn't have pressure-level winds
        wind_speed_unit: 'kmh',
      });
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.hourly?.time?.length) throw new Error(json.reason || 'No data');
      const h = json.hourly;
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone:'America/Toronto' });

      HOURS.forEach(({ hr }) => {
        let idx = h.time.findIndex(t => t.startsWith(todayStr) && parseInt(t.slice(11,13),10) === hr);
        // Fallback: first available hour for that time
        if (idx < 0) idx = h.time.findIndex(t => parseInt(t.slice(11,13),10) === hr);
        if (idx < 0) return;
        allData[hr] = LEVELS.map(l => {
          const temp = h[`temperature_${l.hPa}hPa`]?.[idx];
          const rh   = h[`relative_humidity_${l.hPa}hPa`]?.[idx];
          const dewpt = (temp!=null && rh!=null) ? +(temp - (100-rh)/5).toFixed(1) : null;
          const ws  = h[`wind_speed_${l.hPa}hPa`]?.[idx];
          const wd  = h[`wind_direction_${l.hPa}hPa`]?.[idx];
          return { alt: l.alt, hPa: l.hPa, temp, dewpt, rh, ws, wd };
        }).filter(p => p.temp != null);
      });

      // Store surface conditions (10m) for summary
      HOURS.forEach(({ hr }) => {
        const idx = h.time.findIndex(t => t.startsWith(todayStr) && parseInt(t.slice(11,13),10) === hr);
        if (idx < 0) return;
        if (!allData[hr]) allData[hr] = [];
        allData[hr]._surface = {
          ws10:   h.wind_speed_10m?.[idx] ?? null,
          wd10:   h.wind_direction_10m?.[idx] ?? null,
          gust10: h.wind_gusts_10m?.[idx]    ?? null,
          precip: h.precipitation_probability?.[idx] ?? null,
        };
      });
      if (!Object.keys(allData).length) throw new Error(L?'Aucun profil disponible':'No profile data');
      // Auto-select first available hour
      const avail = HOURS.filter(h => allData[h.hr]);
      if (avail.length && !allData[selected]) selected = avail[Math.floor(avail.length/2)].hr;
    } catch(e) { error = e.message; }
    loading = false;
  }

  // ── Smart sounding summary ────────────────────────────────────────────────
  function dirLabel(deg) {
    if (deg == null) return '?';
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
  }

  function buildSummary(data, lang) {
    const L   = lang === 'fr';
    const hrs = Object.keys(data).map(Number).sort((a,b) => a-b);
    if (!hrs.length) return null;

    // ── Helper: average surface data over a set of hours ─────────────────
    function avgSurf(hList) {
      const v = hList.filter(h => data[h]?._surface?.ws10 != null);
      if (!v.length) return null;
      const ws   = v.reduce((s,h) => s + data[h]._surface.ws10, 0) / v.length;
      const gst  = v.reduce((s,h) => s + (data[h]._surface.gust10 || 0), 0) / v.length;
      const prec = v.reduce((s,h) => s + (data[h]._surface.precip  || 0), 0) / v.length;
      const midH = v[Math.floor(v.length / 2)];
      const wd   = data[midH]?._surface?.wd10;
      return { ws: Math.round(ws), gst: Math.round(gst), precip: Math.round(prec), dir: wd != null ? dirLabel(wd) : null };
    }

    // ── Per-period surface conditions ─────────────────────────────────────
    const periods = [
      { key:'dawn',  fr:'Matin (7h-10h)',       en:'Morning (7-10h)',       hrs: hrs.filter(h => h >= 7  && h <= 10) },
      { key:'mid',   fr:'Mi-journée (10h-13h)',  en:'Mid-morning (10-13h)', hrs: hrs.filter(h => h >= 10 && h <= 13) },
      { key:'aft',   fr:'Après-midi (13h-17h)',  en:'Afternoon (13-17h)',   hrs: hrs.filter(h => h >= 13 && h <= 17) },
      { key:'eve',   fr:'Soirée (17h-20h)',      en:'Evening (17-20h)',     hrs: hrs.filter(h => h >= 17 && h <= 20) },
    ];

    // ── Thermal lapse rate for the main flying window ─────────────────────
    function lapseRateAt(hr) {
      const pts = data[hr];
      if (!pts?.length) return null;
      const sfc = pts[0];
      const top = pts[pts.length - 1];
      if (sfc?.temp == null || top?.temp == null) return null;
      return (sfc.temp - top.temp) / ((top.alt - sfc.alt) / 1000);
    }

    const flyHrs   = hrs.filter(h => h >= 10 && h <= 16);
    const sampleHr = flyHrs[Math.floor(flyHrs.length / 2)];
    const lr       = sampleHr != null ? lapseRateAt(sampleHr) : null;

    // ── Cloud base (LCL) ──────────────────────────────────────────────────
    let lcl = null;
    if (sampleHr != null) {
      const pts = data[sampleHr] || [];
      const sfc = pts[0];
      if (sfc?.temp != null && sfc?.dewpt != null) {
        const spread = sfc.temp - sfc.dewpt;
        lcl = Math.round(sfc.alt + spread * 125);
      }
    }

    // ── Estimated thermal ceiling (parcel theory) ─────────────────────────
    let thermalCeil = null;
    if (sampleHr != null) {
      const pts = data[sampleHr] || [];
      const sfc = pts[0];
      if (sfc?.temp != null) {
        const DALR = -9.8;
        for (let i = 1; i < pts.length; i++) {
          const parcel = sfc.temp + DALR * (pts[i].alt - sfc.alt) / 1000;
          if (parcel <= pts[i].temp) { thermalCeil = pts[i].alt; break; }
        }
      }
    }

    // ── Wind at altitude ──────────────────────────────────────────────────
    function windAtLevel(hPa) {
      const v = hrs.filter(h => data[h]?.find?.(p => p.hPa === hPa)?.ws != null);
      if (!v.length) return null;
      const ws  = Math.round(v.reduce((s,h) => s + (data[h].find(p=>p.hPa===hPa)?.ws || 0), 0) / v.length);
      const mid = v[Math.floor(v.length / 2)];
      const wd  = data[mid]?.find?.(p => p.hPa === hPa)?.wd;
      return { ws, dir: wd != null ? dirLabel(wd) : null };
    }
    const w850 = windAtLevel(850);
    const w700 = windAtLevel(700);
    const w500 = windAtLevel(500);

    // ── Wind direction changes ────────────────────────────────────────────
    const surfaceByHr = hrs.filter(h => data[h]?._surface?.wd10 != null)
      .map(h => ({ hr: h, dir: data[h]._surface.wd10 }));

    let dirChange = null;
    if (surfaceByHr.length >= 2) {
      let prev = surfaceByHr[0].dir;
      for (let i = 1; i < surfaceByHr.length; i++) {
        const diff = Math.abs(((surfaceByHr[i].dir - prev + 540) % 360) - 180);
        if (diff > 45) {
          dirChange = { from: dirLabel(prev), to: dirLabel(surfaceByHr[i].dir), hr: surfaceByHr[i].hr };
          break;
        }
        prev = surfaceByHr[i].dir;
      }
    }

    // ── Verdict per period ────────────────────────────────────────────────
    function periodVerdict(surf, lrForPeriod, isStudent) {
      if (!surf) return L ? 'Données insuffisantes' : 'Insufficient data';

      // Rain overrides everything — flying in rain is dangerous and miserable
      if (surf.precip >= 70) return L
        ? 'Non volable — pluie forte. Visibilite reduite, voile alourdi. Annuler la session.'
        : 'Not flyable — heavy rain. Reduced visibility, wet glider. Cancel session.';
      if (surf.precip >= 50) return L
        ? 'Fortement deconseille — averses probables. La pluie rend les atterrissages glissants et le vol dangereux.'
        : 'Strongly discouraged — showers likely. Rain makes landings slippery and flying hazardous.';
      if (surf.precip >= 30) return L
        ? 'Risque de precipitation. Surveiller attentivement et rester pret a atterrir si des averses se forment.'
        : 'Precipitation risk. Monitor carefully and be ready to land if showers develop.';

      // Check which Yamaska launches are viable for this wind
      const viableLaunches = surf.dir != null && surf.ws != null
        ? YAMASKA_LAUNCHES.filter(lch => {
            const dirDeg = ({'N':0,'NNE':22.5,'NE':45,'ENE':67.5,'E':90,'ESE':112.5,'SE':135,'SSE':157.5,'S':180,'SSO':202.5,'SO':225,'OSO':247.5,'O':270,'ONO':292.5,'NO':315,'NNO':337.5})[surf.dir] ?? null;
            if (dirDeg === null) return false;
            return angleDiff(dirDeg, lch.idealDir) < 50;
          })
        : [];
      const noViableLaunch = viableLaunches.length === 0;

      // Wind limits
      if (surf.ws > 28) return L
        ? `Vent trop fort (${surf.ws} km/h). Non volable — depasse la limite de securite pour etudiants.`
        : `Wind too strong (${surf.ws} km/h). Not flyable — exceeds student safety limit.`;
      if (surf.gst > 35) return L
        ? `Rafales excessives (${surf.gst} km/h). Non volable meme si le vent moyen est acceptable.`
        : `Excessive gusts (${surf.gst} km/h). Not flyable even if average wind is acceptable.`;

      // No viable launch for this wind direction
      if (noViableLaunch && surf.ws > 5) return L
        ? `Direction non favorable pour Yamaska (${surf.dir}). Aucun decollage disponible dans ce vent. Attendre un changement de direction.`
        : `Wind direction not favourable for Yamaska (${surf.dir}). No launch available in this wind. Wait for direction shift.`;

      // Strong thermal warning for students
      if (lrForPeriod != null && lrForPeriod >= 8) return L
        ? `Thermiques forts prevus (${lrForPeriod.toFixed(1)} deg/km). Conditions potentiellement dangereuses pour etudiants — turbulences intenses, risque de fermeture. Vol deconseille sans instructeur present.`
        : `Strong thermals expected (${lrForPeriod.toFixed(1)} deg/km). Potentially dangerous for students — severe turbulence, collapse risk. Not recommended without instructor present.`;
      if (lrForPeriod != null && lrForPeriod >= 6.5) return L
        ? `Thermiques actifs (${lrForPeriod.toFixed(1)} deg/km). Conditions dynamiques — voler avec l'instructeur, rester en proximite de l'atterrissage.`
        : `Active thermals (${lrForPeriod.toFixed(1)} deg/km). Dynamic conditions — fly with instructor, stay near landing field.`;

      const launch = viableLaunches[0];
      const launchNote = launch ? (L ? ` — ${launch.key} recommande` : ` — ${launch.key} recommended`) : '';

      if (surf.ws < 3) return L
        ? `Calme${launchNote}. Vent ${surf.ws} km/h${surf.dir?' '+surf.dir:''}. Dans les parametres de l'ecole.`
        : `Calm${launchNote}. Wind ${surf.ws} km/h${surf.dir?' '+surf.dir:''}. Within school parameters.`;
      if (surf.ws <= 14 && surf.gst <= 18) return L
        ? `Dans les parametres ecole${launchNote}. Vent ${surf.ws} km/h${surf.dir ? ' ' + surf.dir : ''}${surf.gst > surf.ws + 3 ? ', rafales ' + surf.gst : ''}.`
        : `Within school parameters${launchNote}. Wind ${surf.ws} km/h${surf.dir ? ' ' + surf.dir : ''}${surf.gst > surf.ws + 3 ? ', gusts ' + surf.gst : ''}.`;
      if (surf.ws <= 20 && surf.gst <= 26) return L
        ? `Conditions acceptables${launchNote}. Surveiller les rafales (${surf.gst} km/h). Pilotes experientes seulement.`
        : `Acceptable conditions${launchNote}. Watch gusts (${surf.gst} km/h). Experienced pilots only.`;
      return L
        ? `Conditions marginales. Vent ${surf.ws} km/h, rafales ${surf.gst} km/h. Jugement de l'instructeur requis.`
        : `Marginal conditions. Wind ${surf.ws} km/h, gusts ${surf.gst} km/h. Instructor judgement required.`;
    }

    // ── Build output lines (no colored emojis) ────────────────────────────
    const lines = [];

    // SECTION 1: Atmospheric stability
    lines.push({ type:'header', text: L ? 'Profil atmospherique' : 'Atmospheric profile' });

    if (lr != null) {
      const stable   = lr < 5;
      const marginal = lr >= 5 && lr < 6.5;
      const unstable = lr >= 6.5;
      const lrStr    = lr.toFixed(1);

      if (unstable) {
        lines.push({ type:'body', text: L
          ? `Atmosphere instable — lapse rate ${lrStr} deg/km. Activite thermique prevue en milieu de journee.`
          : `Unstable atmosphere — lapse rate ${lrStr} deg/km. Thermal activity expected mid-day.`
        });
      } else if (marginal) {
        lines.push({ type:'body', text: L
          ? `Atmosphere marginalement instable — lapse rate ${lrStr} deg/km. Thermiques faibles possibles.`
          : `Marginally unstable — lapse rate ${lrStr} deg/km. Weak thermals possible.`
        });
      } else {
        lines.push({ type:'body', text: L
          ? `Atmosphere stable — lapse rate ${lrStr} deg/km. Peu ou pas d'activite thermique.`
          : `Stable atmosphere — lapse rate ${lrStr} deg/km. Little to no thermal activity.`
        });
      }
    }

    if (lcl != null) {
      lines.push({ type:'data', label: L ? 'Base des nuages estimee (LCL)' : 'Estimated cloud base (LCL)',
        value: lcl < 4000
          ? `${lcl} m — ${L ? 'plafond moderement bas, visibilite correcte' : 'moderately low ceiling, acceptable visibility'}`
          : `${lcl} m — ${L ? 'plafond haut, excellente visibilite prevue' : 'high ceiling, excellent visibility expected'}` });
    }

    if (thermalCeil != null && thermalCeil < 3500) {
      lines.push({ type:'data', label: L ? 'Plafond thermique estime' : 'Estimated thermal ceiling',
        value: `${thermalCeil} m` });
    }

    // SECTION 2: Winds
    lines.push({ type:'header', text: L ? 'Vents' : 'Winds' });

    periods.forEach(p => {
      if (!p.hrs.length) return;
      const s = avgSurf(p.hrs);
      if (!s) return;
      const gPart = s.gst > s.ws + 4 ? (L ? `, rafales ${s.gst} km/h` : `, gusts ${s.gst} km/h`) : '';
      const dPart = s.dir ? ` ${s.dir}` : '';
      const pPart = s.precip > 20 ? (L ? ` — ${s.precip}% precipitation` : ` — ${s.precip}% chance of rain`) : '';
      lines.push({ type:'wind', period: L ? p.fr : p.en,
        value: `${s.ws} km/h${dPart}${gPart}${pPart}` });
    });

    if (w850) lines.push({ type:'data', label: L ? 'Vent a 1500m (850hPa)' : 'Wind at 1500m (850hPa)',
      value: `${w850.ws} km/h${w850.dir ? ' '+w850.dir : ''}` });
    if (w700) lines.push({ type:'data', label: L ? 'Vent a 3000m (700hPa)' : 'Wind at 3000m (700hPa)',
      value: `${w700.ws} km/h${w700.dir ? ' '+w700.dir : ''}` });
    if (w500) lines.push({ type:'data', label: L ? 'Vent a 5500m (500hPa)' : 'Wind at 5500m (500hPa)',
      value: `${w500.ws} km/h${w500.dir ? ' '+w500.dir : ''}` });

    if (dirChange) {
      lines.push({ type:'note', text: L
        ? `Changement de direction notable vers ${dirChange.hr}h : ${dirChange.from} vers ${dirChange.to}. Recalculer la flyabilite apres cette heure.`
        : `Notable direction shift around ${dirChange.hr}h: ${dirChange.from} to ${dirChange.to}. Re-evaluate flyability after this time.`
      });
    }

    // Check wind shear
    const shearHr = flyHrs.find(h => {
      const s850 = data[h]?.find?.(p => p.hPa === 850)?.ws;
      const s10  = data[h]?._surface?.ws10;
      return s850 != null && s10 != null && Math.abs(s850 - s10) > 20;
    });
    if (shearHr != null) {
      const s850 = data[shearHr].find(p => p.hPa === 850)?.ws;
      const s10  = data[shearHr]._surface?.ws10;
      lines.push({ type:'warn', text: L
        ? `Cisaillement vertical important vers ${shearHr}h : ${Math.round(s10)} km/h au sol vs ${Math.round(s850)} km/h a 1500m. Conditions potentiellement dangereuses en hauteur.`
        : `Significant wind shear around ${shearHr}h: ${Math.round(s10)} km/h at surface vs ${Math.round(s850)} km/h at 1500m. Potentially dangerous aloft.`
      });
    }

    // SECTION 3: Precipitation
    const maxPrecip = Math.max(0, ...hrs.map(h => data[h]?._surface?.precip || 0));
    if (maxPrecip > 0) {
      lines.push({ type:'header', text: L ? 'Precipitation' : 'Precipitation' });
      if (maxPrecip >= 70) {
        lines.push({ type:'warn', text: L
          ? `Précipitations fortes prévues (${maxPrecip}%). Le vol est pratiquement impossible sous la pluie : visibilité réduite, voile alourdie, aire de décollage glissante et vitesse de décrochage plus élevée en vol. Annuler ou reporter la session.`
          : `Heavy precipitation likely (${maxPrecip}%). Flying in rain is nearly impossible: reduced visibility, a waterlogged heavier wing, a slippery launch area, and a higher stall speed in the air. Cancel or postpone the session.`
        });
      } else if (maxPrecip >= 40) {
        lines.push({ type:'warn', text: L
          ? `Precipitation probable (${maxPrecip}%). Les averses mouillent le tissu et alourdissent la voile, reduisent la visibilite et rendent les atterrissages glissants. Vol fortement deconseille.`
          : `Precipitation likely (${maxPrecip}%). Showers wet the glider, reduce visibility and make landings slippery. Flying strongly discouraged.`
        });
      } else if (maxPrecip >= 25) {
        lines.push({ type:'note', text: L
          ? `Risque de precipitation (${maxPrecip}%). Surveiller l'evolution et etre pret a rentrer rapidement si des averses se forment.`
          : `Precipitation risk (${maxPrecip}%). Monitor the sky and be ready to land quickly if showers develop.`
        });
      } else {
        lines.push({ type:'body', text: L
          ? `Precipitation peu probable (${maxPrecip}%). Conditions seches prevues.`
          : `Precipitation unlikely (${maxPrecip}%). Dry conditions expected.`
        });
      }
    }

    // SECTION 4: Per-period verdicts
    lines.push({ type:'header', text: L ? 'Verdict par periode' : 'Flying verdict by period' });
    periods.forEach(p => {
      if (!p.hrs.length) return;
      const s = avgSurf(p.hrs);
      // Get lapse rate for this period's midpoint
      const midHr = p.hrs[Math.floor(p.hrs.length / 2)];
      const lrP   = lapseRateAt(midHr);
      const v     = periodVerdict(s, lrP, true);
      lines.push({ type:'verdict', period: L ? p.fr : p.en, text: v });
    });

    return lines;
  }

  $: summary = (Object.keys(allData).length && !loading) ? buildSummary(allData, lang) : null;

  onMount(fetch_sounding);

  $: pts = allData[selected] || [];

  // ── SVG constants ─────────────────────────────────────────────────────────
  const SVG_W = 300, SVG_H = 260;
  const ML = 40, MR = 14, MT = 12, MB = 28;
  const PW = SVG_W - ML - MR;
  const PH = SVG_H - MT - MB;

  // Y: non-linear scale — 0-3000m gets 75% of height, 3000-6000m gets 25%
  function yPos(alt) {
    const BREAK = 3000, ALT_MAX = 5500;
    if (alt <= BREAK) {
      return MT + PH * (1 - (alt / BREAK) * 0.75);
    } else {
      const frac = (alt - BREAK) / (ALT_MAX - BREAK);
      return MT + PH * (0.25 - frac * 0.25);
    }
  }

  const TEMP_MIN = -20, TEMP_MAX = 30;
  function xPos(t) {
    return ML + (t - TEMP_MIN) / (TEMP_MAX - TEMP_MIN) * PW;
  }

  function makePath(data, key) {
    const pts = data.filter(p => p[key] != null);
    if (pts.length < 2) return '';
    return pts.map((p,i) =>
      `${i===0?'M':'L'}${xPos(p[key]).toFixed(1)},${yPos(p.alt).toFixed(1)}`
    ).join(' ');
  }

  // DALR from surface
  function dalrPath(pts) {
    if (!pts.length) return '';
    const sfc = pts[0];
    if (sfc?.temp == null) return '';
    const DALR = -9.8; // °C per 1000m
    const topAlt  = 4000;
    const topTemp = sfc.temp + DALR * (topAlt - sfc.alt) / 1000;
    return `M${xPos(sfc.temp).toFixed(1)},${yPos(sfc.alt).toFixed(1)} L${xPos(topTemp).toFixed(1)},${yPos(topAlt).toFixed(1)}`;
  }

  // LCL: where temp meets dewpoint
  function lclAlt(pts) {
    if (!pts.length) return null;
    const sfc = pts[0];
    if (sfc?.temp == null || sfc?.dewpt == null) return null;
    const spread = sfc.temp - sfc.dewpt;
    if (spread <= 0) return sfc.alt;
    return Math.round(sfc.alt + spread * 125); // 125m per °C spread
  }

  // Thermal trigger: where DALR parcel cools to env temp
  function thermalTrigger(pts) {
    if (!pts.length) return null;
    const sfc = pts[0];
    if (!sfc?.temp) return null;
    const DALR = -9.8;
    for (let i = 1; i < pts.length; i++) {
      const parcel = sfc.temp + DALR * (pts[i].alt - sfc.alt) / 1000;
      if (parcel <= pts[i].temp) return pts[i].alt;
    }
    return null;
  }

  // Y-axis gridlines
  // Y gridlines ONLY at exact pressure level altitudes — perfect alignment
  const yGrids = [{ alt:200,  label:'200m (1000hPa)' }, { alt:1500, label:'1500m (850hPa)' }, { alt:3000, label:'3000m (700hPa)' }, { alt:5500, label:'5500m (500hPa)' }];
  const xGrids = [-15, -10, -5, 0, 5, 10, 15, 20, 25];
</script>

<div class="snd-wrap">
  <div class="snd-hdr">
    <span class="snd-title">{L?'Sondage atmosphérique':'Atmospheric sounding'}</span>
    <div class="snd-legend">
      <span class="leg-item"><span class="leg-line" style="background:#ef4444"></span><span class="xs">T</span></span>
      <span class="leg-item"><span class="leg-line" style="background:#22c55e"></span><span class="xs">Td</span></span>
      <span class="leg-item"><span class="leg-line dalr-line"></span><span class="xs">DALR</span></span>
    </div>
    <button class="snd-btn" on:click={fetch_sounding} disabled={loading}>↺</button>
  </div>

  {#if Object.keys(allData).length}
  <!-- Time selector -->
  <div class="time-chips">
    {#each HOURS as {label, hr}}
    {#if allData[hr]}
    <button class="time-chip" class:sel={selected===hr} on:click={() => selected=hr}>
      {label}
    </button>
    {/if}
    {/each}
  </div>
  {/if}

  {#if loading}
  <div class="snd-state"><div class="spin"></div><span class="xs muted">{L?'Chargement…':'Loading…'}</span></div>

  {:else if error}
  <div class="snd-state">
    <span class="xs" style="color:#dc2626">{error}</span>
    <button class="btn btn-xs btn-secondary" on:click={fetch_sounding} style="margin-left:.4rem">
      {L?'Réessayer':'Retry'}
    </button>
  </div>

  {:else if pts.length}
  {@const lcl = lclAlt(pts)}
  {@const trig = thermalTrigger(pts)}

  <svg viewBox="0 0 {SVG_W} {SVG_H}" width="100%" style="display:block;overflow:visible;max-width:{SVG_W}px">
    <!-- Background -->
    <rect x={ML} y={MT} width={PW} height={PH} fill="var(--bg-2)" rx="3"/>

    <!-- Y gridlines at exact pressure level altitudes -->
    {#each yGrids as g}
    <line x1={ML} y1={yPos(g.alt)} x2={ML+PW} y2={yPos(g.alt)}
      stroke="var(--border)" stroke-width="0.8" stroke-dasharray="3,3"/>
    <text x={ML-4} y={yPos(g.alt)+3.5} font-size="7.5" fill="var(--txt-3)" text-anchor="end"
      font-family="monospace">{g.alt>=1000?(g.alt/1000).toFixed(1)+'k':g.alt}</text>
    {/each}

    <!-- X gridlines + temp labels -->
    {#each xGrids as t}
    {#if t >= TEMP_MIN && t <= TEMP_MAX}
    <line x1={xPos(t)} y1={MT} x2={xPos(t)} y2={MT+PH}
      stroke="{t===0?'rgba(100,150,200,.5)':'var(--border)'}"
      stroke-width="{t===0?1.2:0.4}" stroke-dasharray="{t===0?'':  '2,4'}"/>
    <text x={xPos(t)} y={MT+PH+14} font-size="7.5" fill="var(--txt-3)" text-anchor="middle">{t}°</text>
    {/if}
    {/each}

    <!-- 0°C label -->
    <text x={xPos(0)} y={MT-3} font-size="7" fill="rgba(100,150,200,.8)" text-anchor="middle">0°C</text>

    <!-- LCL line (cloud base) -->
    {#if lcl && lcl < 5000}
    <line x1={ML} y1={yPos(lcl)} x2={ML+PW} y2={yPos(lcl)}
      stroke="#60a5fa" stroke-width="1.2" stroke-dasharray="4,3" opacity="0.8"/>
    <text x={ML+PW+3} y={yPos(lcl)+3} font-size="7" fill="#60a5fa">LCL</text>
    <text x={ML+PW+3} y={yPos(lcl)+11} font-size="6.5" fill="#60a5fa" opacity="0.7">{lcl}m</text>
    {/if}

    <!-- Thermal trigger dot -->
    {#if trig && trig < 5000}
    <circle cx={xPos(pts.find(p=>p.alt>=trig)?.temp ?? 20)} cy={yPos(trig)} r="5"
      fill="none" stroke="#f97316" stroke-width="1.5"/>
    <text x={ML+PW+3} y={yPos(trig)+3} font-size="7" fill="#f97316">TH</text>
    <text x={ML+PW+3} y={yPos(trig)+11} font-size="6.5" fill="#f97316" opacity="0.7">{trig}m</text>
    {/if}

    <!-- DALR line -->
    {#if dalrPath(pts)}
    <path d={dalrPath(pts)} fill="none" stroke="#f97316" stroke-width="1.2"
      stroke-dasharray="5,4" opacity="0.7"/>
    {/if}

    <!-- Dewpoint curve -->
    {#if makePath(pts, 'dewpt')}
    <path d={makePath(pts, 'dewpt')} fill="none" stroke="#22c55e" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>
    {#each pts.filter(p=>p.dewpt!=null) as p}
    <circle cx={xPos(p.dewpt)} cy={yPos(p.alt)} r="2.5" fill="#22c55e"/>
    {/each}
    {/if}

    <!-- Temperature curve -->
    {#if makePath(pts, 'temp')}
    <path d={makePath(pts, 'temp')} fill="none" stroke="#ef4444" stroke-width="2.5"
      stroke-linejoin="round" stroke-linecap="round"/>
    {#each pts as p}
    <circle cx={xPos(p.temp)} cy={yPos(p.alt)} r="3" fill="#ef4444"/>
    <!-- Temp label at each level -->
    <text x={xPos(p.temp)+5} y={yPos(p.alt)-4} font-size="7.5" fill="#ef4444" font-weight="bold">
      {p.temp?.toFixed(1)}°
    </text>
    {/each}
    {/if}

    <!-- Axis labels -->
    <text x={ML+PW/2} y={SVG_H-3} font-size="8" fill="var(--txt-3)" text-anchor="middle">
      {L?'Température (°C)':'Temperature (°C)'}
    </text>
    <text x="8" y={MT+PH/2} font-size="8" fill="var(--txt-3)" text-anchor="middle"
      transform="rotate(-90,8,{MT+PH/2})">{L?'Altitude (m)':'Altitude (m)'}</text>

    <!-- Pressure level labels -->
    {#each pts as p}
    <text x={ML-4} y={yPos(p.alt)+14} font-size="6.5" fill="var(--txt-3)" text-anchor="end" opacity="0.6">
      {p.hPa}
    </text>
    {/each}
  </svg>

  <!-- Info strip -->
  <div class="snd-info">
    {#if lcl}<span class="xs muted">{L?'Base nuages':'Cloud base'}: <b style="color:#60a5fa">{lcl}m</b></span>{/if}
    {#if trig}<span class="xs muted">{L?'Thermiques':'Thermals'}: <b style="color:#f97316">{trig}m</b></span>{/if}
    {#if pts[0]?.dewpt!=null}<span class="xs muted">{L?'Écart T-Td sol':'Sfc T-Td'}: <b style="color:var(--txt)">{(pts[0].temp-pts[0].dewpt).toFixed(1)}°</b></span>{/if}
  </div>

  <!-- Analyse du jour — prominent button + structured sections -->
  {#if summary?.length}
  <button class="snd-prom-btn" on:click={() => summaryOpen = !summaryOpen}>
    <div class="snd-prom-btn-left">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12h4l3-9 4 18 3-9h4"/>
      </svg>
      <span style="font-weight:700">{L?'Analyse du jour':'Day analysis'}</span>
    </div>
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"
      style="transition:transform .2s;transform:rotate({summaryOpen?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
  </button>
  {#if summaryOpen}
  <div class="snd-summary">
    {#each summary as line}
      {#if line.type === 'header'}
      <div class="snd-section-hdr">{line.text}</div>
      {:else if line.type === 'verdict'}
      <div class="snd-verdict-row">
        <span class="snd-period">{line.period}</span>
        <span class="snd-verdict-text">{line.text}</span>
      </div>
      {:else if line.type === 'wind'}
      <div class="snd-data-row">
        <span class="snd-period">{line.period}</span>
        <span class="snd-val">{line.value}</span>
      </div>
      {:else if line.type === 'data'}
      <div class="snd-data-row">
        <span class="snd-lbl">{line.label}</span>
        <span class="snd-val">{line.value}</span>
      </div>
      {:else if line.type === 'warn'}
      <div class="snd-warn xs">{line.text}</div>
      {:else if line.type === 'note'}
      <div class="snd-note xs">{line.text}</div>
      {:else if line.type === 'body'}
      <div class="snd-body xs">{line.text}</div>
      {/if}
    {/each}
  </div>
  {/if}
  {/if}

  <div class="xs muted" style="margin-top:.1rem">
    <a href="https://open-meteo.com" target="_blank" style="color:var(--teal)">Open-Meteo GEM</a>
    · {L?'Profil à':'Profile at'} {HOURS.find(h=>h.hr===selected)?.label} · {new Date().toLocaleDateString(L?'fr-CA':'en-CA',{timeZone:'America/Toronto'})}
  </div>
  {/if}
</div>

<style>
  .snd-wrap{display:flex;flex-direction:column;gap:.4rem}
  .snd-hdr{font-family:var(--ff-head);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  .snd-title{font-family:var(--ff-head);font-size:.82rem;font-weight:700;color:var(--txt);flex:1;min-width:120px}
  .snd-legend{display:flex;gap:.5rem;align-items:center;flex-shrink:0}
  .leg-item{display:flex;align-items:center;gap:.2rem}
  .leg-line{width:16px;height:2px;display:block;border-radius:1px}
  .dalr-line{background:#f97316;opacity:.7}
  .snd-btn{background:none;border:1px solid var(--border);border-radius:5px;padding:.15rem .4rem;cursor:pointer;color:var(--txt-3);font-size:.88rem;line-height:1;flex-shrink:0}
  .snd-btn:disabled{opacity:.4}
  .time-chips{display:flex;gap:.3rem;flex-wrap:wrap}
  .time-chip{padding:.22rem .55rem;border-radius:16px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--txt-2);font-size:.73rem;font-weight:600;cursor:pointer;transition:all .15s}
  .time-chip.sel{border-color:var(--teal);background:rgba(0,184,122,.1);color:var(--teal)}
  .snd-state{display:flex;align-items:center;gap:.4rem;padding:.25rem 0}
  .snd-info{display:flex;gap:.875rem;flex-wrap:wrap;padding:.3rem 0}
  .snd-prom-btn{width:100%;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg, rgba(0,184,122,.10), rgba(0,184,122,.02));border:1px solid rgba(0,184,122,.35);border-radius:8px;padding:.6rem .75rem;cursor:pointer;color:var(--teal);font-size:.85rem;margin:.5rem 0;transition:all .15s}
  .snd-prom-btn:hover{background:linear-gradient(135deg, rgba(0,184,122,.18), rgba(0,184,122,.06));border-color:var(--teal)}
  .snd-prom-btn-left{display:flex;align-items:center;gap:.5rem}
  .snd-summary{background:var(--bg-2);border-radius:8px;padding:.6rem .75rem;display:flex;flex-direction:column;gap:.25rem}
  .snd-main-title{font-family:var(--ff-head);font-size:.8rem;font-weight:800;color:var(--txt);margin-bottom:.25rem;text-transform:uppercase;letter-spacing:.04em}
  .snd-section-hdr{font-family:var(--ff-head);font-size:.72rem;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.06em;margin-top:.4rem;padding-top:.35rem;border-top:1px solid var(--border)}
  .snd-section-hdr:first-of-type{font-family:var(--ff-head);border-top:none;margin-top:0;padding-top:0}
  .snd-data-row{display:flex;gap:.5rem;justify-content:space-between;align-items:flex-start;font-size:.74rem;line-height:1.4}
  .snd-period{color:var(--txt-2);font-weight:600;flex-shrink:0;min-width:140px}
  .snd-lbl{color:var(--txt-3);flex-shrink:0;min-width:140px}
  .snd-val{color:var(--txt);text-align:right}
  .snd-verdict-row{display:flex;gap:.5rem;align-items:flex-start;font-size:.74rem;line-height:1.4}
  .snd-verdict-text{color:var(--txt-2);flex:1}
  .snd-body{color:var(--txt-3);line-height:1.55;font-size:.74rem}
  .snd-note{color:var(--txt-2);line-height:1.5;font-size:.74rem;padding:.2rem .35rem;border-left:2px solid var(--teal);margin:.1rem 0}
  .snd-warn{color:#ef4444;line-height:1.5;font-size:.74rem;font-weight:600;padding:.2rem .35rem;background:rgba(239,68,68,.07);border-radius:5px}
  .xs{font-size:.75rem} .muted{color:var(--txt-3)}
  .spin{width:13px;height:13px;border:2px solid var(--border);border-top-color:var(--teal);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
