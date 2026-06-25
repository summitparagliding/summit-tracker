<script>
  import { enhance } from '$app/forms';
  import ConfidenceTrend from '$lib/components/ConfidenceTrend.svelte';
  import ConfidenceChart from '$lib/components/ConfidenceChart.svelte';
 import Icon from '$lib/components/Icon.svelte';
 import { lang } from '$lib/stores/lang.js';
 import ProgressMap from '$lib/components/ProgressMap.svelte';
  import ColourSignature from '$lib/components/ColourSignature.svelte';
 import { invalidateAll } from '$app/navigation';
 export let data;
  export let form;
 $: ({ student, dash, equipment, progressMap, bills, confidenceTrend, confidenceCompare } = data);
  $: ct = confidenceTrend || { trend:'neutral', baseline:null, recent:null, last:null, data:[] };
  $: cc = confidenceCompare || { data:[], avgPre:null, avgPost:null, delta:null };
  $: avatarUrl = student?.profile_picture_url || avatarOverride || null;
  let avatarOverride = null;
  let uploading = false;
  let avatarProgress = 0;
  let coloursSaved = false;
  let colOpen   = false; // couleurs card
  let equipOpen = false; // equipment card
  // Reactive colour state — drives live preview
  let mc  = '';
  let lec = '';
  let hc  = '';
  $: { mc  = equipment?.wing_color_1  || '#3b82f6'; }
  $: { lec = equipment?.wing_le_color || equipment?.wing_color_2 || '#ffffff'; }
  $: { hc  = equipment?.harness_color || '#1e293b'; }
  let profileOpen = false;

  import { uploadFile } from '$lib/upload.js';
  let uploadErr = '';
  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    uploading = true;
    uploadErr = '';
    try {
      // Crop to 400×400 JPEG using canvas
      const imgEl = new Image();
      const objectUrl = URL.createObjectURL(file);
      await new Promise((resolve, reject) => { imgEl.onload=resolve; imgEl.onerror=reject; imgEl.src=objectUrl; });
      URL.revokeObjectURL(objectUrl);
      const size = 400;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const side = Math.min(imgEl.width, imgEl.height);
      ctx.drawImage(imgEl, (imgEl.width-side)/2, (imgEl.height-side)/2, side, side, 0, 0, size, size);
      const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('canvas failed')), 'image/jpeg', 0.9));
      const avatarFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      const result = await uploadFile(avatarFile, {
        purpose: 'profile_picture',
        meta:    { student_id: student?.id },
        onProgress: p => { avatarProgress = p; },
      });
      if (result.ok) {
        avatarOverride = result.url;
        // Force layout to re-fetch student data so profile picture persists across navigation
        await invalidateAll();
      }
      else            { uploadErr = result.error || 'Upload failed'; }
    } catch(e) {
      uploadErr = e.message || 'Erreur';
      console.error('Avatar upload failed', e);
    } finally {
      uploading = false;
    }
  }
 $: ({ stats, flights } = dash);
 $: done = flights.filter(f => f.status === 'complete');

 let auwOpen = false; // collapsed by default
  // ── Weight calculator ──────────────────────────────────────
 let wClothes = 2.5, clothesOn = true;
 let wHelmet = 1.0, helmetOn = true;
 let wWater = 1.0, waterOn = true;
 let wBag = 1.0, bagOn = true;
 let wCamping = 3.0, campingOn = false;
 $: wPilot = equipment?.pilot_weight || 0;
 $: wWing = equipment?.glider_weight || 0;
 $: wHarness = equipment?.harness_weight || 0;
 $: wReserve = equipment?.reserve_weight || 0;
 $: wArea = equipment?.glider_flat_area || 0;
 $: wAreaProj= equipment?.glider_projected_area || 0;
 $: auw = Math.round((wPilot
 + (clothesOn ? wClothes : 0)
 + (helmetOn ? wHelmet : 0)
 + (waterOn ? wWater : 0)
 + (bagOn ? wBag : 0)
 + (campingOn ? wCamping : 0)
 + wWing + wHarness + wReserve)*10)/10;
 $: loading = wArea > 0 ? Math.round((auw/wArea)*10)/10 : 0;
 $: rwl = wAreaProj > 0 ? Math.round((auw/wAreaProj)*10)/10 : 0;
 $: nakedAuw = Math.round((wPilot+wWing+wHarness+wReserve)*10)/10;
 $: nakedLoad= wArea > 0 ? Math.round((nakedAuw/wArea)*10)/10 : 0;
 // Wing loading gauge - typical range 2.5-5.5 kg/m²
 function loadGauge(val) {
 if (!val) return { pct:0, color:'var(--txt-3)', label:'' };
 if (val < 3.0) return { pct: Math.round((val/5.5)*100), color:'var(--green)', label:'Light' };
 if (val < 3.8) return { pct: Math.round((val/5.5)*100), color:'var(--teal)', label:'Normal' };
 if (val < 4.5) return { pct: Math.round((val/5.5)*100), color:'var(--amber)', label:'Heavy' };
 return { pct: Math.round((val/5.5)*100), color:'var(--red)', label:'Max' };
 }
 $: gauge = loadGauge(loading);
 $: gaugeRwl = loadGauge(rwl);

 // ── Progress ───────────────────────────────────────────────
 $: flightPct = Math.min(Math.round((done.length/25)*100), 100);
 $: exPct = stats.exTotal ? Math.round((stats.exDone/stats.exTotal)*100) : 0;
 $: thPct = stats.theoryTotal ? Math.round((stats.theoryDone/stats.theoryTotal)*100) : 0;

 // SVG ring helper
 function ring(pct, r=28) {
 const c = 2 * Math.PI * r;
 return { dash: (pct/100)*c, gap: c };
 }
 $: rFlight = ring(flightPct);
 $: rEx = ring(exPct);
 $: rTh = ring(thPct);

 // Progress map
 // Progress map — passed to shared ProgressMap component
 $: pmEx    = progressMap?.exercises || [];
 $: pmExams = progressMap?.exams || [];

 function fmtDate(d) { return d ? new Date(d).toLocaleDateString($lang==='fr'?'fr-CA':'en-CA') : '—'; }
 function fmtAir(s) {
 if (!s) return '0h';
 const h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
 return h>0?`${h}h ${m}m`:`${m}m`;
 }

 // Stat labels
 $: L = {
 profile: $lang==='fr'?'Carnet d\'exercice et de vol':'Flight & Exercise Logbook',
 enrolled: $lang==='fr'?'Inscrit le':'Enrolled',
 flights: $lang==='fr'?'Vols':'Flights',
 airtime: $lang==='fr'?'Temps de vol':'Airtime',
 exercises: $lang==='fr'?'Exercices':'Exercises',
 theory: $lang==='fr'?'Théorie':'Theory',
 exams: $lang==='fr'?'Examens':'Exams',
 ground: $lang==='fr'?'Sol':'Ground',
 air: $lang==='fr'?'Vol':'Air',
 passed: $lang==='fr'?'Réussi':'Passed',
 pending: $lang==='fr'?'En attente':'Pending',
 untried: $lang==='fr'?'Non tenté':'Not tried',
 equipment: $lang==='fr'?'Équipement':'Equipment',
 auw: 'AUW',
 loading: $lang==='fr'?'Charge':'Loading',
 naked: $lang==='fr'?'Charge à nu':'Naked loading',
 pilot: $lang==='fr'?'Pilote (nu)':'Pilot (naked)',
 clothes: $lang==='fr'?'Vêtements':'Clothes',
 helmet: $lang==='fr'?'Casque + électronique':'Helmet + electronics',
 water: $lang==='fr'?'Eau':'Water',
 bag: $lang==='fr'?'Sac':'Bag',
 wing: $lang==='fr'?'Aile':'Wing',
 harness: $lang==='fr'?'Sellette':'Harness',
 reserve: $lang==='fr'?'Secours':'Reserve',
 };
</script>

<svelte:head><title>{$lang==='fr'?'Carnet d\'exercice et de vol':'Flight & Exercise Logbook'} — {student.name}</title></svelte:head>

<!-- ── Hero ──────────────────────────────────────────────── -->
<div class="hero-card card card-teal">
 <div class="hero-inner">
 <div class="hero-av">
   {#if avatarUrl}
     <img src={avatarUrl} alt={student.name} class="av-img" loading="lazy" />
   {:else}
     <div class="av-initial">{(student.name||'?')[0].toUpperCase()}</div>
   {/if}
   <!-- Camera button — tap to change photo -->
   <label class="av-upload-btn" class:uploading title={$lang==='fr'?'Changer la photo':'Change photo'}>
     {#if uploading}
       <div class="av-spinner"></div>
     {:else}
       <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
         <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
         <circle cx="12" cy="13" r="4"/>
       </svg>
     {/if}
     <input type="file" accept="image/*,.heic,.heif" style="display:none"
       disabled={uploading} on:change={handleAvatarUpload} />
   </label>
   {#if uploading && avatarProgress > 0}
     <div class="av-progress"><div class="av-progress-bar" style="width:{avatarProgress}%"></div></div>
   {/if}
   {#if uploadErr}<div class="av-err xs">{uploadErr}</div>{/if}
 </div>
 <div class="hero-info">
 
   {#if equipment?.wing_color_1}
   <div style="margin-bottom:.3rem">
     <ColourSignature
       mainColor={equipment?.wing_color_1||'#3b82f6'}
       leColor={equipment?.wing_le_color||equipment?.wing_color_2||'#ffffff'}
       harnessColor={equipment?.harness_color||'#1e293b'}
       size={40} name={student?.name} />
   </div>
   {/if}
   <h1 class="hero-name">{student.name}</h1>
 <p class="hero-enrolled dimmed xs">{L.enrolled} {fmtDate(student.enrollment_date)}</p>
 {#if done.length >= 25}
 <span class="badge badge-pass" style="margin-top:.4rem">P2 Ready</span>
 {:else}
 <span class="hero-progress dimmed xs">{done.length}/25 {L.flights.toLowerCase()}</span>
 {/if}
 </div>
 </div>
</div>

<!-- ── Download Logbook ──────────────────────────────────────── -->
<div class="dl-strip">
 <a href="/api/student/{student.id}/report?lang=fr" class="btn btn-ghost btn-xs dl-btn">
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
     <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
     <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
   </svg>
   PDF FR
 </a>
 <a href="/api/student/{student.id}/report?lang=en" class="btn btn-ghost btn-xs dl-btn">
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
     <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
     <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
   </svg>
   PDF EN
 </a>
</div>

<!-- ── Waivers / Décharges ───────────────────────────────────── -->
<a href="/student/{student.id}/waivers" class="wv-link">
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
  <span>{$lang==='fr'?'Mes décharges':'My waivers'}</span>
  <svg class="wv-link-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>
</a>

<!-- ── Progress Rings ─────────────────────────────────────── -->
<div class="rings-row">
 {#each [
 [rFlight, flightPct, done.length+'/25', L.flights, 'var(--teal)', '#0a1520'],
 [rEx, exPct, exPct+'%', L.exercises,'var(--green)', '#0a1520'],
 [rTh, thPct, thPct+'%', L.theory, 'var(--teal)', '#0a1520'],
 ] as [r, pct, label, name, col, bg]}
 <div class="ring-card card">
 <svg viewBox="0 0 72 72" class="ring-svg">
 <!-- Background track -->
 <circle cx="36" cy="36" r="28" fill="none" stroke="var(--border)" stroke-width="6" />
 <!-- Progress arc -->
 <circle cx="36" cy="36" r="28" fill="none" stroke={col} stroke-width="6"
 stroke-dasharray="{r.dash} {r.gap}"
 stroke-linecap="round"
 transform="rotate(-90 36 36)" />
 <!-- Center text -->
 <text x="36" y="38" text-anchor="middle" dominant-baseline="middle"
 fill={col} font-size="12" font-weight="700" font-family="monospace">{label}</text>
 </svg>
 <div class="ring-name dimmed xs">{name}</div>
 </div>
 {/each}
 <!-- Airtime card -->
 <div class="ring-card card">
 <div class="at-inner">
 <Icon name="timer" size={22} color="var(--teal)" />
 <div class="at-val mono">{fmtAir(stats.airtime)}</div>
 </div>
 <div class="ring-name dimmed xs">{L.airtime}</div>
 </div>
</div>

<!-- ── Stats Grid ─────────────────────────────────────────── -->
<div class="stats-grid">
 {#each [
 [done.length, L.flights, 'var(--teal)', 'flights'],
 [fmtAir(stats.airtime), L.airtime, 'var(--teal)', 'timer'],
 [stats.exDone, L.exercises+' ', 'var(--green)', 'checklist'],
 [stats.theoryDone, L.theory+' ', 'var(--txt-2)', 'book'],
 [stats.examsDone, L.exams+' ', 'var(--teal)', 'award'],
 ] as [val, lbl, col, ico]}
 <div class="sg-item card-xs card">
 <Icon name={ico} size={16} color={col} />
 <div class="sg-val" style="color:{col}">{val}</div>
 <div class="sg-lbl dimmed xs">{lbl}</div>
 </div>
 {/each}
</div>

<!-- ── Confidence: before vs after flights ───────────────── -->
<div class="card conf-trend-card">
  <div class="ct-hdr">
    <span class="xs" style="font-weight:700;color:var(--txt-2)">{$lang==='fr'?'Confiance — avant et après vol':'Confidence — before & after flights'}</span>
    {#if cc.data?.length}<span class="xs muted">{cc.data.length} vol{cc.data.length>1?'s':''}</span>{/if}
  </div>
  <ConfidenceChart compare={cc} lang={$lang} />
</div>

<!-- ── Progress Map ───────────────────────────────────────── -->
<div class="card pmap-card">
 <ProgressMap exercises={pmEx} exams={pmExams} lang={$lang} />
</div>

<!-- ── Personal Info (self-serve) ─────────────────────────── -->
<div class="card eq-profile-card" style="margin-bottom:.75rem;padding:0;overflow:hidden">
  <div class="prof-hdr" on:click={() => profileOpen=!profileOpen}
    role="button" tabindex="0" on:keydown={e=>e.key==='Enter'&&(profileOpen=!profileOpen)}>
    <span class="prof-hdr-title">{$lang==='fr'?'Mon profil':'My Profile'}</span>
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
      style="margin-left:auto;flex-shrink:0;transition:transform .2s;transform:rotate({profileOpen?180:0}deg)">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </div>
  {#if profileOpen}
  <div style="padding:.75rem">
  <form method="POST" action="?/updateProfile">
    <div class="prof-grid">
      <div class="fg"><label class="fg-lbl">{$lang==='fr'?'Téléphone':'Phone'}</label>
        <input name="phone" type="tel" class="prof-inp" value={student?.phone||''} placeholder="+1 (514) 555-0100" /></div>
      <div class="fg"><label class="fg-lbl">Email</label>
        <input name="email" type="email" class="prof-inp" value={student?.email||''} placeholder="email@example.com" /></div>
      <div class="fg"><label class="fg-lbl">{$lang==='fr'?'Date de naissance':'Date of birth'}</label>
        <input name="date_of_birth" type="date" class="prof-inp" value={student?.date_of_birth||''} /></div>
    </div>
    <div class="eq-profile-title" style="margin-top:.875rem">{$lang==='fr'?"Contact d'urgence":"Emergency contact"}</div>
    <div class="prof-grid">
      <div class="fg"><label class="fg-lbl">{$lang==='fr'?'Nom':'Name'}</label>
        <input name="emergency_contact_name" class="prof-inp" value={student?.emergency_contact_name||''} placeholder="Jane Doe" /></div>
      <div class="fg"><label class="fg-lbl">{$lang==='fr'?'Téléphone':'Phone'}</label>
        <input name="emergency_contact_phone" type="tel" class="prof-inp" value={student?.emergency_contact_phone||''} placeholder="+1 (514) 555-0100" /></div>
      <div class="fg"><label class="fg-lbl">{$lang==='fr'?'Relation':'Relationship'}</label>
        <input name="emergency_contact_relationship" class="prof-inp" value={student?.emergency_contact_relationship||''} placeholder="{$lang==='fr'?'Parent, ami…':'Parent, friend…'}" /></div>
    </div>
    <!-- Medical / important notes -->
    <div class="eq-profile-title" style="margin-top:.875rem">
      {$lang==='fr'?'Notes importantes / Médicales':'Medical / important notes'}
    </div>
    <p class="xs muted" style="margin-bottom:.35rem">
      {$lang==='fr'
        ? 'Allergies, médicaments, conditions médicales, limitations physiques...'
        : 'Allergies, medications, medical conditions, physical limitations...'}
    </p>
    <textarea name="medical_notes" rows="3" class="prof-inp" style="width:100%;resize:vertical;box-sizing:border-box;font-size:.83rem"
      value={student?.medical_notes||''}
      placeholder="{$lang==='fr'?'Ex: allergie aux abeilles, asthme léger…':'e.g. bee allergy, mild asthma…'}"
    ></textarea>

    <button type="submit" class="btn btn-primary btn-sm" style="margin-top:.75rem">
      {$lang==='fr'?'Sauvegarder le profil':'Save profile'}
    </button>
  </form>
  </div>
  {/if}
</div>

<!-- ── Signature dans le ciel — standalone card ─────────────── -->
<div class="card eq-profile-card" style="margin-bottom:.75rem">
  <button class="coll-hdr-btn" on:click={() => colOpen = !colOpen}
    style="width:100%;display:flex;align-items:center;justify-content:space-between;background:none;border:none;cursor:pointer;padding:.1rem 0;margin-bottom:{colOpen?.5:0}rem">
    <span class="eq-profile-title" style="margin:0">{$lang==='fr'?'Couleurs':'Colours'}</span>
    {#if !colOpen && (equipment?.wing_color_1)}
    <span style="display:flex;gap:.25rem;align-items:center">
      <span style="width:14px;height:14px;border-radius:50%;background:{equipment?.wing_color_1||'#3b82f6'};border:1px solid rgba(0,0,0,.2)"></span>
      <span style="width:14px;height:14px;border-radius:50%;background:{equipment?.wing_le_color||'#fff'};border:1px solid rgba(0,0,0,.2)"></span>
      <span style="width:14px;height:14px;border-radius:50%;background:{equipment?.harness_color||'#1e293b'};border:1px solid rgba(0,0,0,.2)"></span>
    </span>
    {/if}
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
      style="margin-left:.25rem;flex-shrink:0;transition:transform .2s;transform:rotate({colOpen?180:0}deg)">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </button>
  {#if colOpen}
  <p class="xs muted" style="margin:.15rem 0 .75rem">
    {$lang==='fr'
      ? "Ces couleurs vous identifient en vol sur le tableau de l'instructeur."
      : "These colours identify you in the air on the instructor's dashboard."}
  </p>

  {#if form?.coloursOk}
  <div class="colour-ok xs">✓ {$lang==='fr'?'Couleurs sauvegardées':'Colours saved'}</div>
  {/if}
  {#if form?.colourError}
  <div class="colour-err xs">{form.colourError}</div>
  {/if}

  <form method="POST" action="?/saveColours">
    <!-- Three colour swatches — tap to open native picker -->
    <div class="cp-row">
      <!-- Main colour -->
      <div class="cp-field">
        <span class="cp-lbl xs">{$lang==='fr'?'Principale':'Main'}</span>
        <label class="cp-swatch" style="background:{mc}">
          <span class="cp-hex">{mc}</span>
          <input type="color" name="wing_color_1" value={mc}
            on:change={e => { mc = e.currentTarget.value; }}
            class="cp-input" />
        </label>
      </div>
      <!-- Leading edge -->
      <div class="cp-field">
        <span class="cp-lbl xs">{$lang==='fr'?"Bord d'attaque":'Leading edge'}</span>
        <label class="cp-swatch" style="background:{lec}">
          <span class="cp-hex">{lec}</span>
          <input type="color" name="wing_le_color" value={lec}
            on:change={e => { lec = e.currentTarget.value; }}
            class="cp-input" />
        </label>
      </div>
      <!-- Harness -->
      <div class="cp-field">
        <span class="cp-lbl xs">{$lang==='fr'?'Sellette':'Harness'}</span>
        <label class="cp-swatch" style="background:{hc}">
          <span class="cp-hex">{hc}</span>
          <input type="color" name="harness_color" value={hc}
            on:change={e => { hc = e.currentTarget.value; }}
            class="cp-input" />
        </label>
      </div>
    </div>

    <!-- Live preview with paraglider icon -->
    <div class="cp-preview">
      <ColourSignature mainColor={mc} leColor={lec} harnessColor={hc} size={54} name={student?.name} />
      <div>
        <div class="xs" style="font-weight:700;color:var(--txt)">{student?.name || ''}</div>
        <div class="xs muted" style="font-family:monospace">{mc} · {lec} · {hc}</div>
        <div class="xs muted">{$lang==='fr'?'Appuyez sur une couleur pour modifier':'Tap a colour to edit'}</div>
      </div>
    </div>

    <button type="submit" class="cp-save-btn">
      {$lang==='fr'?'Sauvegarder les couleurs':'Save colours'}
    </button>
  </form>
  {/if}
</div>

<!-- ── Equipment & AUW ───────────────────────────────────── -->
<div class="card eq-profile-card">
 <button class="coll-hdr-btn" on:click={() => equipOpen = !equipOpen}
   style="width:100%;display:flex;align-items:center;justify-content:space-between;background:none;border:none;cursor:pointer;padding:.1rem 0">
   <span class="eq-profile-title" style="margin:0">{L.equipment}</span>
   <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
     style="margin-left:.25rem;flex-shrink:0;transition:transform .2s;transform:rotate({equipOpen?180:0}deg)">
     <polyline points="6 9 12 15 18 9"/>
   </svg>
 </button>

 {#if equipOpen}
   <!-- Equipment rows: each renders ONLY if its data exists -->
   <div class="eq-list">
     {#if equipment?.glider_make || equipment?.glider_model}
       <div class="eq-row">
         <svg class="eq-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
           <path d="M2 12 C6 6 10 4 12 4 C14 4 18 6 22 12"/>
           <path d="M2 12 C6 14 10 15 12 15 C14 15 18 14 22 12"/>
           <path d="M12 4 L12 15 M12 15 L11 20 M12 15 L13 20"/>
         </svg>
         <div class="eq-info">
           <span class="eq-name">{[equipment.glider_make,equipment.glider_model,equipment.glider_size].filter(Boolean).join(' ')}</span>
           {#if equipment.glider_flat_area}<span class="eq-sub">{equipment.glider_flat_area} m² flat</span>{/if}
         </div>
         {#if equipment.glider_weight}<span class="eq-wt mono xs">{equipment.glider_weight} kg</span>{/if}
       </div>
     {/if}
     {#if equipment?.harness}
       <div class="eq-row">
         <svg class="eq-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
           <path d="M12 3 L12 21 M8 6 C8 6 6 8 6 12 C6 16 8 18 8 18 M16 6 C16 6 18 8 18 12 C18 16 16 18 16 18 M8 12 L16 12 M9 18 L15 18"/>
         </svg>
         <div class="eq-info"><span class="eq-name">{equipment.harness}</span></div>
         {#if equipment.harness_weight}<span class="eq-wt mono xs">{equipment.harness_weight} kg</span>{/if}
       </div>
     {/if}
     {#if equipment?.reserve}
       <div class="eq-row">
         <svg class="eq-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
           <path d="M12 3 C7 3 3 7 3 12 M12 3 C17 3 21 7 21 12 M3 12 C5 10 8 9 12 9 C16 9 19 10 21 12 M12 9 L10 20 M12 9 L14 20 M9 20 L15 20"/>
         </svg>
         <div class="eq-info"><span class="eq-name">{equipment.reserve}</span><span class="eq-sub">{L.reserve}</span></div>
         {#if equipment.reserve_weight}<span class="eq-wt mono xs">{equipment.reserve_weight} kg</span>{/if}
       </div>
     {/if}
   </div>

 <!-- AUW Calculator -->
 {#if wPilot > 0}
 <div class="auw-card">
 <button class="auw-header auw-toggle" type="button" on:click={() => auwOpen=!auwOpen}>
   {L.auw} Calculator
   <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
     style="transition:transform .2s;transform:rotate({auwOpen?180:0}deg);flex-shrink:0;margin-left:auto">
     <polyline points="6 9 12 15 18 9"/>
   </svg>
 </button>
 {#if auwOpen}
 <div class="auw-sliders">
 {#if wPilot > 0}<div class="slider-row"><span class="sl-lbl xs">{L.pilot}</span><span class="sl-val mono xs">{wPilot} kg</span></div>{/if}

 <div class="slider-row adj" class:off={!clothesOn}>
 <span class="sl-lbl xs">{L.clothes}</span>
 <button type="button" class="sw-btn" class:sw-on={clothesOn} on:click={() => clothesOn=!clothesOn}><span class="sw-knob"></span></button>
 {#if clothesOn}
 <input type="range" min="0" max="10" step="0.1" bind:value={wClothes} class="wt-slider" />
 <input type="number" min="0" max="10" step="0.1" bind:value={wClothes} class="sl-num-inp" />
 {:else}<span class="sl-val mono xs dimmed">OFF</span>{/if}
 </div>

 <div class="slider-row adj" class:off={!helmetOn}>
 <span class="sl-lbl xs">{L.helmet}</span>
 <button type="button" class="sw-btn" class:sw-on={helmetOn} on:click={() => helmetOn=!helmetOn}><span class="sw-knob"></span></button>
 {#if helmetOn}
 <input type="range" min="0" max="6" step="0.1" bind:value={wHelmet} class="wt-slider" />
 <input type="number" min="0" max="6" step="0.1" bind:value={wHelmet} class="sl-num-inp" />
 {:else}<span class="sl-val mono xs dimmed">OFF</span>{/if}
 </div>

 <div class="slider-row adj" class:off={!waterOn}>
 <span class="sl-lbl xs">{L.water}</span>
 <button type="button" class="sw-btn" class:sw-on={waterOn} on:click={() => waterOn=!waterOn}><span class="sw-knob"></span></button>
 {#if waterOn}
 <input type="range" min="0" max="5" step="0.1" bind:value={wWater} class="wt-slider" />
 <input type="number" min="0" max="5" step="0.1" bind:value={wWater} class="sl-num-inp" />
 {:else}<span class="sl-val mono xs dimmed">OFF</span>{/if}
 </div>

 <div class="slider-row adj" class:off={!bagOn}>
 <span class="sl-lbl xs">{L.bag}</span>
 <button type="button" class="sw-btn" class:sw-on={bagOn} on:click={() => bagOn=!bagOn}><span class="sw-knob"></span></button>
 {#if bagOn}
 <input type="range" min="0" max="8" step="0.1" bind:value={wBag} class="wt-slider" />
 <input type="number" min="0" max="8" step="0.1" bind:value={wBag} class="sl-num-inp" />
 {:else}<span class="sl-val mono xs dimmed">OFF</span>{/if}
 </div>

 <div class="slider-row adj" class:off={!campingOn}>
 <span class="sl-lbl xs">{$lang==='fr'?'Camping':'Camping'}</span>
 <button type="button" class="sw-btn" class:sw-on={campingOn} on:click={() => campingOn=!campingOn}><span class="sw-knob"></span></button>
 {#if campingOn}
 <input type="range" min="0" max="15" step="0.1" bind:value={wCamping} class="wt-slider" />
 <input type="number" min="0" max="15" step="0.1" bind:value={wCamping} class="sl-num-inp" />
 {:else}<span class="sl-val mono xs dimmed">OFF</span>{/if}
 </div>

 {#if wWing > 0}<div class="slider-row"><span class="sl-lbl xs">{L.wing}</span><span class="sl-val mono xs">{wWing} kg</span></div>{/if}
 {#if wHarness > 0}<div class="slider-row"><span class="sl-lbl xs">{L.harness}</span><span class="sl-val mono xs">{wHarness} kg</span></div>{/if}
 {#if wReserve > 0}<div class="slider-row"><span class="sl-lbl xs">{L.reserve}</span><span class="sl-val mono xs">{wReserve} kg</span></div>{/if}
 </div>
 <!-- Result -->
 <div class="auw-result">
 <div class="auw-total-row">
 <span class="auw-total-lbl">{L.auw}</span>
 <span class="auw-total-val mono" style="color:var(--teal)">{auw} kg</span>
 </div>
 {#if loading > 0}
 <!-- Wing loading gauge -->
 <div class="gauge-block">
 <div class="gauge-hdr">
 <span class="xs dimmed">{$lang==='fr'?'Charge alaire (surface à plat)':'Wing Loading (flat area)'}</span>
 <span class="mono" style="color:{gauge.color};font-size:.9rem">{loading} kg/m²</span>
 <span class="xs" style="color:{gauge.color}">{gauge.label}</span>
 </div>
 <div class="gauge-track">
 {#each Array(20) as _, i}
 {@const segPct = (i+1)/20*100}
 <div class="gauge-seg" class:lit={gauge.pct >= segPct}
 style="background:{gauge.pct >= segPct ? gauge.color : 'var(--border)'}"></div>
 {/each}
 </div>
 </div>
 {/if}
 {#if rwl > 0}
 <div class="gauge-block">
 <div class="gauge-hdr">
 <span class="xs dimmed">{$lang==='fr'?'Vraie charge alaire / RWL (projetée)':'Real Wing Loading / RWL (projected)'}</span>
 <span class="mono" style="color:{gaugeRwl.color};font-size:.9rem">{rwl} kg/m²</span>
 <span class="xs" style="color:{gaugeRwl.color}">{gaugeRwl.label}</span>
 </div>
 <div class="gauge-track">
 {#each Array(20) as _, i}
 {@const segPct = (i+1)/20*100}
 <div class="gauge-seg" class:lit={gaugeRwl.pct >= segPct}
 style="background:{gaugeRwl.pct >= segPct ? gaugeRwl.color : 'var(--border)'}"></div>
 {/each}
 </div>
 </div>
 {/if}
 {#if nakedLoad > 0}
 <div class="auw-naked dimmed xs">{L.naked}: {nakedAuw} kg · {nakedLoad} kg/m²</div>
 {/if}
 </div>
 {/if}
 </div>
 {:else}
 <p class="dimmed xs" style="margin-top:.5rem">{$lang==='fr'?'Ajoutez le poids pilote dans les paramètres d\'équipement':'Add pilot weight in equipment settings'}</p>
 {/if}

   <!-- Edit/add equipment link — always present so the user can manage their gear -->
   <a href="/student/{student.id}" class="btn btn-secondary btn-sm" style="margin-top:.625rem;display:inline-block">
     {$lang==='fr'?'Modifier l\'équipement':'Edit equipment'}
   </a>
 {/if}
</div>

<!-- ── Recent flights mini strip ─────────────────────────── -->
{#if done.length}
 
{/if}


<style>
  .bills-title{font-family:var(--ff-head);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--txt-3);margin-bottom:.625rem}
  .bills-list{display:flex;flex-direction:column;gap:.35rem}
  .bill-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.4rem .5rem;background:var(--bg-2);border-radius:7px}
  .bill-name{font-size:.85rem;font-weight:600;color:var(--txt)}
 h1{font-size:1.4rem}

 /* Hero */
 .hero-card{margin-bottom:1rem}
 .hero-inner{display:flex;align-items:center;gap:1rem}
 .hero-av{position:relative;flex-shrink:0;width:64px;height:64px}
 .av-img{width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--teal-border);display:block}
 .av-initials{width:64px;height:64px;border-radius:50%;background:rgba(0,184,122,.15);border:2px solid var(--teal-border);color:var(--teal);font-family:var(--ff-head);font-weight:800;font-size:1.4rem;display:flex;align-items:center;justify-content:center}
 .av-upload-btn{position:absolute;bottom:0;right:0;width:24px;height:24px;border-radius:50%;background:var(--teal);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid var(--bg-card);transition:background .15s;z-index:2}
 .av-upload-btn:hover{background:var(--teal-hi)}
 .av-upload-btn.uploading{cursor:wait;opacity:.7}
 .av-spinner{width:10px;height:10px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
 .av-progress{margin-top:.25rem;height:3px;background:var(--bg-2);border-radius:2px;overflow:hidden}
  .av-progress-bar{height:100%;background:var(--teal);transition:width .2s}
  .av-err{position:absolute;top:calc(100% + 4px);left:50%;transform:translateX(-50%);white-space:nowrap;background:var(--red,#ef4444);color:#fff;padding:.15rem .4rem;border-radius:4px;z-index:3;font-size:.7rem}
 @keyframes spin{to{transform:rotate(360deg)}}
 .av-spinner{width:10px;height:10px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
 @keyframes spin{to{transform:rotate(360deg)}}
 .hero-name{font-family:var(--ff-head);font-size:1.35rem;line-height:1.2}
 .hero-enrolled{margin-top:.2rem}
 .hero-progress{margin-top:.3rem;display:block}

 /* Rings */
 .rings-row{display:grid;grid-template-columns:repeat(4,1fr);gap:.625rem;margin-bottom:.875rem}
 @media(max-width:400px){.rings-row{grid-template-columns:repeat(2,1fr)}}
 .ring-card{display:flex;flex-direction:column;align-items:center;gap:.35rem;padding:.75rem .5rem}
 .ring-svg{width:72px;height:72px}
 .ring-name{text-align:center}
 .at-inner{display:flex;flex-direction:column;align-items:center;gap:.35rem;padding:.5rem 0}
 .at-val{font-size:1rem;font-weight:500;color:var(--teal)}

 /* Stats grid */
 .stats-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:.5rem;margin-bottom:.875rem}
 @media(max-width:420px){.stats-grid{grid-template-columns:repeat(3,1fr)}}
 .sg-item{display:flex;flex-direction:column;align-items:center;gap:.25rem;padding:.625rem .4rem;text-align:center}
 .sg-val{font-family:var(--ff-head);font-size:.95rem;font-weight:500;line-height:1}
 .sg-lbl{line-height:1.2;text-align:center}

 /* Progress map */
 .pmap-card{margin-bottom:.875rem;padding:1rem 1.1rem}
 .pmap-title{font-family:var(--ff-head);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--txt-2);margin-bottom:.75rem}
 .pmap-section{margin-bottom:.75rem}
 .pmap-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem}
 .pmap-lbl{font-family:var(--ff-head);font-size:.72rem;font-weight:700;color:var(--txt-2);flex-shrink:0}
 .pmap-stat{color:var(--txt-3);flex-shrink:0}
 .pmap-dots{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:.5rem}
 .pmap-dot{width:11px;height:11px;border-radius:3px;flex-shrink:0}
 .pmap-p{background:var(--green)}
 .pmap-w{background:var(--amber);opacity:.8}
 .pmap-f{background:var(--red)}
 .pmap-n{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1)}
 .pmap-bar-track{height:5px;background:var(--border);border-radius:3px;overflow:hidden}
 .pmap-bar-fill{height:100%;border-radius:3px;transition:width .4s}
 .pmap-legend{display:flex;align-items:center;gap:.625rem;margin-top:.5rem;flex-wrap:wrap}

 /* Equipment */
 .eq-profile-card{margin-bottom:.875rem;padding:1rem 1.1rem}
 .eq-profile-title{font-family:var(--ff-head);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--txt-2);margin-bottom:.75rem;border-bottom:1px solid var(--border);padding-bottom:.4rem}
 .eq-list{display:flex;flex-direction:column;gap:.4rem;margin-bottom:.875rem}
 .eq-row{display:flex;align-items:center;gap:.625rem;padding:.4rem 0;border-bottom:1px solid var(--border)}
 .eq-row:last-child{border-bottom:none}
 .eq-ico{width:20px;height:20px;flex-shrink:0;color:var(--teal);opacity:.8}
 .eq-info{flex:1;display:flex;flex-direction:column;gap:.1rem}
 .eq-name{font-size:.875rem;font-weight:600;color:var(--txt)}
 .eq-sub{font-size:.7rem;color:var(--txt-3);font-family:var(--ff-head)}
 .eq-wt{color:var(--txt-2)}
 .no-eq{display:flex;flex-direction:column;align-items:center;gap:.35rem;padding:1.5rem 0;text-align:center}

 /* AUW */
 .auw-card{background:var(--bg-raised);border-radius:var(--r-md);padding:.875rem}
 .auw-toggle{display:flex;align-items:center;width:100%;background:none;border:none;cursor:pointer;text-align:left;padding:0;color:inherit;font:inherit;}
  .auw-header{font-family:var(--ff-head);font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--teal);margin-bottom:.625rem}
 .auw-sliders{display:flex;flex-direction:column;gap:.3rem;margin-bottom:.75rem}
 .slider-row{display:flex;align-items:center;gap:.5rem}
 .slider-row.adj{background:rgba(0,184,122,.05);border-radius:var(--r-xs);padding:.3rem .5rem}
 .slider-row.adj.off{background:rgba(255,255,255,.02);opacity:.7}
 .sl-lbl{flex:1;color:var(--txt-2)}
 .wt-slider{flex:1;max-width:100px;accent-color:var(--teal);height:4px;cursor:pointer}
 .sl-val{min-width:44px;text-align:right;color:var(--txt)}

 /* iOS-style toggle switch */
 .sw-btn{position:relative;width:36px;height:20px;border-radius:10px;background:var(--border);border:none;cursor:pointer;padding:0;transition:background .2s;flex-shrink:0}
 .sw-btn.sw-on{background:var(--teal)}
 .sw-knob{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .2s;display:block;box-shadow:0 1px 3px rgba(0,0,0,.3)}
 .sw-btn.sw-on .sw-knob{transform:translateX(16px)}
 .sl-val{min-width:44px;text-align:right;color:var(--txt)}
 .auw-result{border-top:1px solid var(--border);padding-top:.625rem}
 .auw-total-row{display:flex;align-items:baseline;gap:.625rem;flex-wrap:wrap}
 .auw-total-lbl{font-family:var(--ff-head);font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--txt-3)}
 .auw-total-val{font-size:1.25rem;font-weight:400}
 .auw-sep{color:var(--txt-3)}
 .auw-load{font-size:1.1rem}
 .auw-naked{margin-top:.3rem}

 /* Recent flights */
 .recent-flights-card{padding:1rem 1.1rem}
 .rf-row{display:flex;align-items:center;gap:.5rem;padding:.45rem 0;border-bottom:1px solid var(--border)}
 .rf-row:last-child{border-bottom:none}
 .rf-num{width:22px;flex-shrink:0}
 .rf-site{flex:1;font-weight:500;color:var(--txt)}
 .rf-dur{flex-shrink:0}
 .toggle-btn-unused{display:none}
 .gauge-block{margin:.5rem 0}
 .gauge-hdr{display:flex;align-items:baseline;gap:.5rem;margin-bottom:.35rem;flex-wrap:wrap}
 .gauge-track{display:flex;gap:2px;height:10px}
 .gauge-seg{flex:1;border-radius:2px;transition:background .2s}
 .dl-row{display:flex;gap:.625rem;margin-bottom:1rem;flex-wrap:wrap}
 .dl-strip{display:flex;gap:.625rem;margin-bottom:1.25rem;flex-wrap:wrap}
 .dl-btn{flex:1;justify-content:center;min-width:140px;display:flex;align-items:center;gap:.45rem;font-size:.82rem}
  .conf-trend-card{background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:.75rem .875rem;margin:.5rem 0 .875rem;position:relative}
  .wv-link{display:flex;align-items:center;gap:.6rem;width:100%;margin:.25rem 0 .875rem;padding:.7rem .875rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;color:var(--txt);text-decoration:none;font-family:var(--ff-head);font-weight:700;font-size:.85rem}
  .wv-link svg{color:var(--teal);flex-shrink:0}
  .wv-link span{flex:1}
  .wv-link-arrow{color:var(--txt-3)!important}
  .wv-link:active{opacity:.7}
  .ct-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}
  .prof-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.5rem}
  .fg{display:flex;flex-direction:column;gap:.2rem}
  .fg-lbl{font-family:var(--ff-head);font-size:.68rem;font-weight:600;color:var(--txt-3);text-transform:uppercase;letter-spacing:.04em}
  .prof-inp{background:var(--bg-2);border:1px solid var(--border);border-radius:7px;padding:.32rem .55rem;color:var(--txt);font-size:.85rem;width:100%;box-sizing:border-box}
  .colour-row{display:flex;gap:.75rem;flex-wrap:wrap;margin:.35rem 0}
  .colour-field{display:flex;flex-direction:column;gap:.2rem;align-items:center}
  .colour-lbl{color:var(--txt-3);font-size:.68rem;text-align:center}
  .colour-picker{width:48px;height:36px;border:1.5px solid var(--border);border-radius:7px;padding:2px;cursor:pointer;background:none}
  .prof-hdr{display:flex;align-items:center;gap:.5rem;cursor:pointer;padding:.75rem;color:var(--txt)}
  .prof-hdr-title{font-family:var(--ff-head);font-size:.85rem;font-weight:700;color:var(--txt)}
  /* Colour picker (Item 4 rebuild) */
  .cp-row{display:flex;gap:.875rem;margin-bottom:.625rem;flex-wrap:wrap}
  .cp-field{display:flex;flex-direction:column;align-items:center;gap:.3rem}
  .cp-lbl{color:var(--txt-3);font-size:.68rem;text-align:center}
  .cp-swatch{display:flex;align-items:center;justify-content:center;width:68px;height:68px;border-radius:14px;cursor:pointer;position:relative;border:2px solid rgba(255,255,255,.15);box-shadow:0 3px 12px rgba(0,0,0,.4);overflow:hidden;transition:transform .15s,box-shadow .15s}
  .cp-swatch:hover{transform:scale(1.06);box-shadow:0 5px 18px rgba(0,0,0,.5)}
  .cp-swatch:active{transform:scale(.97)}
  .cp-hex{font-size:.55rem;color:rgba(255,255,255,.92);font-family:monospace;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,.9);pointer-events:none;z-index:1;letter-spacing:.04em}
  .cp-input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;border:none;padding:0}
  .cp-preview{display:flex;align-items:center;gap:.875rem;background:var(--bg-2);border-radius:10px;padding:.625rem;margin:.5rem 0}
  .cp-save-btn{width:100%;padding:.65rem;background:var(--teal,#00e8c6);color:#003C4E;border:none;border-radius:8px;font-weight:800;font-size:.88rem;cursor:pointer}
  .cp-save-btn:hover{opacity:.9}
  .colour-ok{color:var(--teal);font-weight:700;background:rgba(0,232,198,.1);border-radius:6px;padding:.3rem .5rem;margin-bottom:.4rem}
  .colour-err{color:#ef4444;background:rgba(239,68,68,.08);border-radius:6px;padding:.3rem .5rem;margin-bottom:.4rem}
  .sl-num-inp{width:52px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.2rem .35rem;color:var(--txt);font-size:.78rem;font-family:monospace;text-align:center}
  .sl-num-inp::-webkit-inner-spin-button{opacity:1}
  .sl-num-inp{width:52px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.2rem .35rem;color:var(--txt);font-size:.78rem;font-family:monospace;text-align:center}
  .sl-num-inp::-webkit-inner-spin-button{opacity:1;margin-left:2px}
</style>
