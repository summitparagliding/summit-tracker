<script>
  import WeatherBriefing from '$lib/components/WeatherBriefing.svelte';
  import AtmosphericSounding from '$lib/components/AtmosphericSounding.svelte';

  let guideOpen = false;
  let gOpen = new Set();
  function toggleG(i) { const s=new Set(gOpen); s.has(i)?s.delete(i):s.add(i); gOpen=s; }

  const guideSections = [
    { fr:'Inscription et connexion', en:'Registration & login',
      fr_body:'Faites votre demande depuis la page d\'accueil (lien « Pas encore inscrit ? »). Remplissez votre nom et numéro de téléphone — votre instructeur crée votre compte et vous attribue un code PIN. Connectez-vous ensuite avec ce PIN.',
      en_body:'Submit a request from the home page (link "Not registered yet?"). Fill in your name and phone — your instructor creates your account and assigns a PIN. Then log in with that PIN.' },
    { fr:'Tableau de bord', en:'Dashboard',
      fr_body:'Votre tableau de bord regroupe : alertes (débriefings, journées planifiées), parcours de formation (où vous en êtes), factures, commandes, paiements, météo express, et vos 3 derniers vols. Chaque carte se plie/déplie d\'un appui.',
      en_body:'Your dashboard shows: alerts (debriefings, planned days), training roadmap (your current stage), invoices, orders, payments, quick weather, and your 3 most recent flights. Each card folds/unfolds with a tap.' },
    { fr:'Débriefings', en:'Debriefings',
      fr_body:'Quand votre instructeur écrit un débriefing, une alerte apparaît. Lisez-le sur la page du vol puis appuyez "Compris" — votre instructeur sera notifié.',
      en_body:'When your instructor writes a debriefing, an alert appears. Read it on the flight page then tap "Understood" — your instructor will be notified.' },
    { fr:'Carnet (Logbook)', en:'Logbook',
      fr_body:'Remplissez votre profil (téléphone, date de naissance, contact d\'urgence) dès que possible. Choisissez vos couleurs d\'aile et de sellette pour créer votre signature visuelle.',
      en_body:'Fill in your profile (phone, date of birth, emergency contact) as soon as possible. Choose your wing and harness colours to create your visual sky signature.' },
    { fr:'Vol actif (GPS)', en:'Active flight (GPS)',
      fr_body:'Avant de décoller, appuyez "Démarrer un vol" et laissez l\'app ouverte en poche. Le GPS détecte automatiquement décollage et atterrissage, et met à jour le tableau de l\'instructeur en temps réel.',
      en_body:'Before launching, tap "Start a flight" and leave the app open in your pocket. GPS automatically detects takeoff and landing, updating the instructor dashboard in real time.' },
    { fr:'Météo', en:'Weather',
      fr_body:'L\'onglet Info contient l\'analyse météo pour Mont Yamaska: grille horaire de volabilité pour chaque décollage (0–100%), sondage atmosphérique, et carte Windy. Vert = excellent, rouge = non volable.',
      en_body:'The Info tab contains weather analysis for Mont Yamaska: hourly flyability grid per launch (0–100%), atmospheric sounding, and Windy map. Green = excellent, red = no-go.' },
    { fr:'Sondage atmosphérique', en:'Atmospheric sounding',
      fr_body:'Courbe rouge = température, courbe verte = point de rosée. DALR (orange pointillé) = taux de refroidissement. TH = déclenchement thermique. LCL = base des nuages. Choisissez l\'heure avec les boutons.',
      en_body:'Red curve = temperature, green curve = dewpoint. DALR (orange dashed) = cooling rate. TH = thermal trigger. LCL = cloud base. Select time with the buttons.' },
    { fr:'Étude et Quiz', en:'Study and Quiz',
      fr_body:'L\'onglet Étude contient le Manuel FFVL (défilement continu, mode 2 pages, saut de page) et un quiz de 233 questions classées par catégorie.',
      en_body:'The Study tab contains the FFVL Manual (continuous scroll, 2-page mode, page jump) and a 233-question quiz organised by category.' },
    { fr:'Commandes', en:'Orders',
      fr_body:'Utilisez le formulaire de commande pour demander du matériel. Votre commande reste "En attente" jusqu\'à confirmation de l\'instructeur.',
      en_body:'Use the order form to request equipment. Your order stays "Pending" until the instructor confirms.' },
    { fr:'Paiements', en:'Payments',
      fr_body:'Soumettez vos paiements avec montant et description. L\'instructeur confirme. Le solde se met à jour dans la carte "Total dû" (appuyez pour développer).',
      en_body:'Submit payments with amount and description. The instructor confirms. Balance updates in the "Total owing" card (tap to expand).' },
  ];
  import WindguruWidget from '$lib/components/WindguruWidget.svelte';
  import WindyWidget from '$lib/components/WindyWidget.svelte';
  import { lang } from '$lib/stores/lang.js';
  import { onMount } from 'svelte';
  let mounted = false;
  onMount(() => { mounted = true; });
  import WeatherWidget from '$lib/components/WeatherWidget.svelte';
  export let data;
  $: L = $lang === 'fr';
  $: sitePhotos = data.sitePhotos || [];

  function sitePhoto(key, type) {
    return sitePhotos.find(p => p.site_key === key && p.site_type === type)?.url || null;
  }

  // Collapsible sections
  let open = { guide: false, weather: true, activity: false, launches: false, landings: false, timeline: false, emergency: true };
  let lightbox = null; // { url, label }

  const launches = [
    { key:'NE CVLY', color:'#00b87a', idealDir:22,  dirTol:45, minSpd:0, maxSpd:20,
      name_fr:'NE CVLY', name_en:'NE CVLY', wind_fr:'NNE à NNW · 0–20 km/h', wind_en:'NNE to NNW · 0–20 km/h',
      alt_fr:'410 m · Orientation nord-est', alt_en:'410 m · Northeast facing',
      desc_fr:'Décollage principal. Terrain dégagé, bon couloir. Idéal 0–20 km/h. Accès par le sentier principal.', desc_en:'Main launch. Open terrain, good approach. Ideal 0–20 km/h. Access via main trail.' },
    { key:'N Cogeco', color:'#00e8c6', idealDir:337, dirTol:45, minSpd:0, maxSpd:20,
      name_fr:'N Cogeco', name_en:'N Cogeco', wind_fr:'N à WNW · 0–20 km/h', wind_en:'N to WNW · 0–20 km/h',
      alt_fr:'400 m · Orientation nord', alt_en:'400 m · North facing',
      desc_fr:'Décollage nord. Bon pour vents tournant vers l\'ouest. Surveiller les rotors.', desc_en:'North launch. Good for westerly shifts. Watch for rotors in strong wind.' },
    { key:'O CVLY',  color:'#f59e0b', idealDir:270, dirTol:45, minSpd:0, maxSpd:20,
      name_fr:'O CVLY',  name_en:'O CVLY', wind_fr:'WNW à WSW · 0–20 km/h', wind_en:'WNW to WSW · 0–20 km/h',
      alt_fr:'395 m · Orientation ouest', alt_en:'395 m · West facing',
      desc_fr:'Décollage ouest, thermiques l\'après-midi. Vérifier activité avant de s\'installer.', desc_en:'West launch, afternoon thermals. Check activity before setup.' },
    { key:'S',       color:'#8b5cf6', idealDir:180, dirTol:45, minSpd:0, maxSpd:20,
      name_fr:'S', name_en:'S', wind_fr:'SSW à SSE · 0–20 km/h', wind_en:'SSW to SSE · 0–20 km/h',
      alt_fr:'390 m · Orientation sud', alt_en:'390 m · South facing',
      desc_fr:'Décollage sud, moins fréquent. Toujours avec l\'instructeur pour P1.', desc_en:'South launch, less frequent. Always with instructor for P1 students.' },
  ];

  const lands = [
    { key:'main',  name_fr:'Atterrissage principal NE', name_en:'Main Landing NE', desc_fr:'Grand champ au pied côté nord-est. Approche en vent arrière. Zone préférée étudiants.', desc_en:'Large field at the base, northeast side. Downwind approach. Preferred for students.' },
    { key:'west',  name_fr:'Atterrissage O — Jardin Ouest', name_en:'West Landing — Jardin Ouest', desc_fr:'Champ alternatif côté ouest. Légèrement en pente. Attention lignes électriques au sud.', desc_en:'Alternate west field. Slightly sloped. Beware power lines to the south.' },
    { key:'scott', name_fr:'Atterrissage O — M. Scott Ouest', name_en:'West Landing — Mr. Scott', desc_fr:'Champ ouest chez M. Scott. Accès à confirmer avec l\'instructeur.', desc_en:'West field at Mr. Scott\'s. Confirm access with instructor.' },
  ];

  const activities = [
    { label_fr:'Vol',                    label_en:'Flight',               range:'0–20 km/h',  minSpd:0,  maxSpd:20, dir_fr:'Selon site',          dir_en:'Per site',         color:'#22c55e' },
    { label_fr:'1er vol',                label_en:'1st flight',           range:'0–10 km/h',  minSpd:0,  maxSpd:10, dir_fr:'Pas de thermiques',   dir_en:'No thermals',      color:'#16a34a' },
    { label_fr:'Gonflage dos voile',     label_en:'Forward inflation',    range:'0–10 km/h',  minSpd:0,  maxSpd:10, dir_fr:'Toute direction',     dir_en:'Any direction',    color:'#84cc16' },
    { label_fr:'Gonflage face voile',    label_en:'Reverse inflation',    range:'5–25 km/h',  minSpd:5,  maxSpd:25, dir_fr:'Toute direction',     dir_en:'Any direction',    color:'#eab308' },
    { label_fr:'Gonflage vent fort',     label_en:'Strong wind inflation',range:'20–25 km/h', minSpd:20, maxSpd:25, dir_fr:'Selon site',          dir_en:'Per site',         color:'#f97316' },
    { label_fr:'Théorie et autre',       label_en:'Theory and other',     range:'∞',           minSpd:0,  maxSpd:999,dir_fr:'Toute météo',         dir_en:'Any weather',      color:'#6b8da8' },
  ];

  const progressionSteps = [
    { phase:'P1', step:1, fr:'Théorie P1',            en:'P1 Theory',           desc_fr:'Blocs théoriques obligatoires. Aérodynamique, météo de base, réglementation, procédures de sécurité. Complétés dans l\'application avant les exercices sol.', desc_en:'Mandatory theory blocks. Aerodynamics, basic weather, regulations, safety procedures. Completed in the app before ground exercises.' },
    { phase:'P1', step:2, fr:'Exercices sol P1',       en:'P1 Ground Exercises', desc_fr:'Gonflage dos voile (forward), face voile (croisé/reverse), zigzag, contrôle de l\'aile au sol. Maîtrise complète avant le premier vol.', desc_en:'Forward and reverse inflations, zigzag, canopy control on the ground. Full mastery required before first flight.' },
    { phase:'P1', step:3, fr:'Examens pratiques P1',   en:'P1 Practical Exams',  desc_fr:'10 décollages forward + 10 décollages reverse consécutifs et contrôlés. Évalué par l\'instructeur. Résultats enregistrés dans l\'application.', desc_en:'10 consecutive forward + 10 reverse launches, controlled. Assessed by instructor. Results logged in the app.' },
    { phase:'P1', step:4, fr:'Examen théorique P1',    en:'P1 Theory Exam',      desc_fr:'Examen écrit en présence de l\'instructeur. Score enregistré dans l\'application.', desc_en:'Written exam in instructor\'s presence. Score recorded in the app.' },
    { phase:'P1', step:5, fr:'Premiers vols P1',       en:'First P1 Flights',    desc_fr:'Premier vol depuis le grand décollage après validation complète des étapes 1–4. Moment marquant du parcours.', desc_en:'First flight from the main launch after full validation of steps 1–4. A milestone moment.' },
    { phase:'P2', step:6, fr:'Théorie P2',             en:'P2 Theory',           desc_fr:'Météo avancée, aérologie, thermique, gestion des urgences, vol de campagne. Maîtrise des phénomènes atmosphériques.', desc_en:'Advanced weather, aerology, thermals, emergency management, cross-country flying.' },
    { phase:'P2', step:7, fr:'Exercices sol P2',       en:'P2 Ground Exercises', desc_fr:'Cobra, nose-down, gonflages dans des conditions variées, techniques avancées.', desc_en:'Cobra, nose-down, inflations in varied conditions, advanced techniques.' },
    { phase:'P2', step:8, fr:'Vols P2',                en:'P2 Flights',          desc_fr:'Vols avec techniques avancées, thermiques, navigation. Renforcement de l\'autonomie progressive.', desc_en:'Flights with advanced techniques, thermals, navigation. Building progressive autonomy.' },
    { phase:'P2', step:9, fr:'Certification P2',       en:'P2 Certification',    desc_fr:'Examen théorique P2 et validation finale instructeur. Certification HPAC/ACVL complète.', desc_en:'P2 theory exam and final instructor validation. Full HPAC/ACVL certification.' },
  ];

  function toggle(key) { open = { ...open, [key]: !open[key] }; }
</script>

<!-- Lightbox -->
{#if lightbox}
<div class="lightbox" on:click={() => lightbox = null} role="button" tabindex="0" on:keydown={e=>e.key==='Escape'&&(lightbox=null)}>
  <div class="lb-inner" on:click|stopPropagation>
    <img src={lightbox.url} alt={lightbox.label} class="lb-img" />
    {#if lightbox.label}<div class="lb-label">{lightbox.label}</div>{/if}
    <button class="lb-close" on:click={() => lightbox=null}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>
</div>
{/if}

<div class="info-page" class:info-loaded={mounted}>


  <!-- WEATHER -->
  <section class="collapsible">
    <button class="coll-hdr" on:click={() => toggle('weather')}>
      <span>{L ? 'Météo — Mont Yamaska' : 'Weather — Mont Yamaska'}</span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform .2s;transform:rotate({open.weather?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    {#if open.weather}
    <div class="coll-body">
      <!-- Pat's order: 1) analysis + now  2) day analysis (collapsed)  3) hourly checker
           4) sounding  5) 3 & 7 day forecasts  6) Windguru + Ventusky maps -->

      <!-- 1. WEATHER ANALYSIS + CONDITIONS NOW -->
      <WeatherWidget lang={$lang} showNow={true} show12h={true} showForecast={false} />

      <!-- 2. HOURLY CHECKER -->
      <div style="margin-top:1rem">
        <WeatherBriefing lang={$lang} lat={45.472332} lon={-72.882132} {launches} {activities} />
      </div>

      <!-- 3. ATMOSPHERIC SOUNDING — full: chart + day analysis + per-period verdicts -->
      <div style="margin-top:1rem">
        <AtmosphericSounding lat={45.472332} lon={-72.882132} lang={$lang} />
      </div>

      <!-- 4. 3 & 7 DAY FORECASTS -->
      <div style="margin-top:1rem">
        <WeatherWidget lang={$lang} showNow={false} show12h={false} showForecast={true} />
      </div>

      <!-- 6. WIND MAPS — Windguru + Ventusky at the bottom -->
      <div style="margin-top:1.5rem;padding-top:.75rem;border-top:1px solid var(--border)">
        <div class="section-label xs muted" style="margin-bottom:.5rem;letter-spacing:.06em;text-transform:uppercase;font-weight:700">
          {L ? 'Cartes des vents' : 'Wind maps'}
        </div>
        <WindguruWidget lat={45.472332} lon={-72.882132} lang={$lang} embedUrl={data?.windguruUrl||''} />
        <div style="margin-top:1rem">
          <WindyWidget lat={45.472332} lon={-72.882132} lang={$lang} />
        </div>
      </div>
    </div>
    {/if}
  </section>

  <!-- ACTIVITY WINDOWS -->
  <section class="collapsible">
    <button class="coll-hdr" on:click={() => toggle('activity')}>
      <span>{L ? "Fenêtres d'activité" : 'Activity Windows'}</span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform .2s;transform:rotate({open.activity?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    {#if open.activity}
    <div class="coll-body">
      <div class="act-table">
        <div class="at-head xs"><span>{L?'Activité':'Activity'}</span><span>{L?'Vent':'Wind'}</span><span>{L?'Direction':'Direction'}</span></div>
        {#each activities as a}
        <div class="at-row">
          <span class="at-lbl" style="color:{a.color}">{L ? a.label_fr : a.label_en}</span>
          <span class="at-range mono xs">{a.range}</span>
          <span class="at-dir xs muted">{L ? a.dir_fr : a.dir_en}</span>
        </div>
        {/each}
      </div>

      <p class="info-note xs">{L ? '0–5 km/h : toujours volable. 5–10 km/h : rafales max 75% du vent moyen. Au-delà : rafales max 50%.' : '0–5 km/h: always flyable. 5–10 km/h: max gusts 75% of avg wind. Above: max gusts 50%.'}</p>
    </div>
    {/if}
  </section>

  <!-- LAUNCHES -->
  <section class="collapsible">
    <button class="coll-hdr" on:click={() => toggle('launches')}>
      <span>{L ? 'Sites de décollage' : 'Launch Sites'}</span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform .2s;transform:rotate({open.launches?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    {#if open.launches}
    <div class="coll-body">
      <div class="launch-grid">
        {#each launches as lch}
        <div class="launch-card" style="border-top:3px solid {lch.color}">
          <div class="lc-header">
            <span class="lc-badge" style="background:{lch.color}20;color:{lch.color};border:1px solid {lch.color}40">{lch.key}</span>
          </div>
          {#if sitePhoto(lch.key, 'launch')}
            <button class="lc-photo-btn" on:click={() => lightbox={url:sitePhoto(lch.key,'launch'),label:lch.key}}>
              <img src={sitePhoto(lch.key, 'launch')} alt={lch.key} class="lc-photo" />
              <div class="lc-photo-overlay xs">{L?'Agrandir':'Enlarge'}</div>
            </button>
          {:else}
            <div class="lc-photo-placeholder xs muted">{L?'Photo à venir':'Photo coming soon'}</div>
          {/if}
          <div class="lc-wind xs muted">{L ? lch.wind_fr : lch.wind_en}</div>
          <div class="lc-alt xs muted">{L ? lch.alt_fr : lch.alt_en}</div>
          <p class="lc-desc xs">{L ? lch.desc_fr : lch.desc_en}</p>
        </div>
        {/each}
      </div>
    </div>
    {/if}
  </section>

  <!-- LANDINGS -->
  <section class="collapsible">
    <button class="coll-hdr" on:click={() => toggle('landings')}>
      <span>{L ? "Zones d'atterrissage" : 'Landing Zones'}</span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform .2s;transform:rotate({open.landings?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    {#if open.landings}
    <div class="coll-body">
      <div class="land-list">
        {#each lands as lnd}
        <div class="land-card">
          {#if sitePhoto(lnd.key, 'landing')}
            <button class="lc-photo-btn" on:click={() => lightbox={url:sitePhoto(lnd.key,'landing'),label:L?lnd.name_fr:lnd.name_en}}>
              <img src={sitePhoto(lnd.key, 'landing')} alt={lnd.key} class="land-photo" />
              <div class="lc-photo-overlay xs">{L?'Agrandir':'Enlarge'}</div>
            </button>
          {:else}
            <div class="land-photo-placeholder xs muted">{L?'Photo à venir':'Photo coming soon'}</div>
          {/if}
          <div class="land-name">{L ? lnd.name_fr : lnd.name_en}</div>
          <p class="land-desc xs">{L ? lnd.desc_fr : lnd.desc_en}</p>
        </div>
        {/each}
      </div>
    </div>
    {/if}
  </section>

  <!-- COURSE TIMELINE -->
  <section class="collapsible">
    <button class="coll-hdr" on:click={() => toggle('timeline')}>
      <span>{L ? 'Parcours de la formation' : 'Training Path'}</span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform .2s;transform:rotate({open.timeline?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    {#if open.timeline}
    <div class="coll-body">
      <div class="timeline">
        {#each progressionSteps as s, i}
          {@const isP2   = s.phase==='P2'}
          {@const isLast = i===progressionSteps.length-1}
          <div class="tl-step">
            {#if !isLast}<div class="tl-line" class:p2-line={isP2}></div>{/if}
            <div class="tl-node" class:p2-node={isP2}><span class="tl-num">{s.step}</span></div>
            <div class="tl-content" class:p2-content={isP2}>
              <div class="tl-phase-tag" class:p2-tag={isP2}>{s.phase}</div>
              <div class="tl-label">{L ? s.fr : s.en}</div>
              <div class="tl-desc xs">{L ? s.desc_fr : s.desc_en}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
    {/if}
  </section>

  <!-- EMERGENCY -->
  <section class="collapsible">
    <button class="coll-hdr" on:click={() => toggle('emergency')}>
      <span>{L ? 'Urgences' : 'Emergency'}</span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform .2s;transform:rotate({open.emergency?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    {#if open.emergency}
    <div class="coll-body">
      <div class="em-grid">
        <div class="em-card em-red">
          <div class="em-title">{L?'Urgence médicale':'Medical Emergency'}</div>
          <div class="em-line"><strong>911</strong></div>
          <div class="em-line">1350 Ch. des Sommets, Granby QC</div>
          <div class="em-line">{L?'Hôpital:':'Hospital:'} <strong>Hôpital de Granby — 205 Boul. Leclerc O</strong></div>
        </div>
        <div class="em-card em-amber">
          <div class="em-title">{L?'Contact instructeur':'Instructor'}</div>
          <div class="em-line">SummitParagliding.com</div>
          <div class="em-line">+1 438 763 1350</div>
        </div>
        <div class="em-card">
          <div class="em-title">{L?'Procédures':'Procedures'}</div>
          {#each (L?['Sécuriser la zone','Appeler 911 si blessure','Contacter l\'instructeur','Ne pas déplacer un blessé','Rester sur place']:['Secure the area','Call 911 if injury','Contact instructor','Do not move injured','Stay on site']) as step, i}
          <div class="em-line xs">{i+1}. {step}</div>
          {/each}
        </div>
      </div>
    </div>
    {/if}
  </section>

</div>

  <!-- ── Guide d'utilisation ─────────────────────────────────────────── -->
  <div class="info-section" style="margin-top:1.25rem">
    <button class="section-hdr" on:click={() => guideOpen=!guideOpen}>
      <span class="section-label">{L?'Guide d\'utilisation':'User guide'}</span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"
        style="flex-shrink:0;transition:transform .2s;transform:rotate({guideOpen?180:0}deg)">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
    {#if guideOpen}
    <div class="guide-inner">
      {#each guideSections as s, i}
      <div class="g-sec">
        <button class="g-sec-hdr" on:click={() => toggleG(i)}>
          <span class="g-num xs">{i+1}</span>
          <span class="g-lbl xs">{L ? s.fr : s.en}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"
            style="flex-shrink:0;transform:rotate({gOpen.has(i)?180:0}deg);transition:transform .15s">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {#if gOpen.has(i)}
        <div class="g-body xs">{L ? s.fr_body : s.en_body}</div>
        {/if}
      </div>
      {/each}
    </div>
    {/if}
  </div>
<style>
  .info-page{padding:.75rem;display:flex;flex-direction:column;gap:.5rem;max-width:800px;margin:0 auto}

  /* Collapsible */
  .collapsible{background:var(--bg-raised);border-radius:10px;overflow:hidden}
  .coll-hdr{display:flex;align-items:center;justify-content:space-between;width:100%;padding:.75rem .875rem;background:none;border:none;cursor:pointer;font-family:var(--ff-head);font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--txt-2);text-align:left;gap:.5rem}
  .coll-hdr:hover{color:var(--teal)}
  .coll-body{padding:.5rem .875rem .875rem;border-top:1px solid var(--border)}

  /* Lightbox */
  .lightbox{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer}
  .lb-inner{position:relative;max-width:95vw;max-height:92vh;cursor:default}
  .lb-img{max-width:95vw;max-height:85vh;object-fit:contain;border-radius:8px;display:block}
  .lb-label{color:rgba(255,255,255,.8);font-size:.8rem;text-align:center;margin-top:.5rem}
  .lb-close{position:absolute;top:-10px;right:-10px;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.7);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff}

  /* Guide */
  .guide-intro{font-size:.84rem;color:var(--txt-2);line-height:1.6;background:rgba(0,184,122,.07);border-left:3px solid var(--teal);border-radius:0 8px 8px 0;padding:.625rem .875rem;margin-bottom:.75rem}
  .guide-sections{display:flex;flex-direction:column;gap:.4rem}
  .guide-block{background:var(--bg-2);border-radius:8px;padding:.5rem .75rem}
  .guide-badge{font-size:.72rem;font-weight:700;padding:.2rem .5rem;border-radius:5px;display:inline-block;margin-bottom:.3rem}
  .guide-block p{margin:0;color:var(--txt-2);line-height:1.5}
  .guide-tips{margin:0;padding-left:1rem;display:flex;flex-direction:column;gap:.2rem}
  .guide-tips li{color:var(--txt-2);line-height:1.4}

  /* Activity table */
  .act-table{display:flex;flex-direction:column;gap:2px;border-radius:7px;overflow:hidden;margin-bottom:.5rem}
  .at-head{display:grid;grid-template-columns:2fr 1fr 1fr;padding:.3rem .5rem;background:var(--bg-2);font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--txt-3)}
  .at-row{display:grid;grid-template-columns:2fr 1fr 1fr;padding:.4rem .5rem;background:var(--bg-raised);font-size:.82rem;align-items:center}
  .at-row:nth-child(odd){background:var(--bg-2)}
  .at-lbl{font-weight:500}
  .info-note{background:rgba(0,184,122,.07);border-radius:6px;padding:.4rem .6rem;color:var(--teal);margin:0}

  /* Launch grid */
  .launch-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.625rem}
  @media(max-width:400px){.launch-grid{grid-template-columns:1fr}}
  .launch-card{background:var(--bg-2);border-radius:10px;padding:.75rem;display:flex;flex-direction:column;gap:.35rem}
  .lc-header{display:flex;align-items:center;gap:.5rem}
  .lc-badge{font-size:.72rem;font-weight:700;padding:.15rem .45rem;border-radius:6px}
  .lc-photo-btn{background:none;border:none;cursor:zoom-in;padding:0;position:relative;display:block;width:100%}
  .lc-photo{width:100%;height:110px;object-fit:cover;border-radius:7px;display:block}
  .lc-photo-overlay{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.4);color:#fff;text-align:center;padding:.25rem;border-radius:0 0 7px 7px;opacity:0;transition:opacity .15s}
  .lc-photo-btn:hover .lc-photo-overlay{opacity:1}
  .lc-photo-placeholder{border:2px dashed var(--border);border-radius:7px;height:80px;display:flex;align-items:center;justify-content:center}
  .lc-wind,.lc-alt{color:var(--txt-2)}
  .lc-desc{color:var(--txt-3);line-height:1.4;margin:0}

  /* Landing */
  .land-list{display:flex;flex-direction:column;gap:.5rem}
  .land-card{background:var(--bg-2);border-radius:10px;padding:.75rem}
  .land-photo{width:100%;height:90px;object-fit:cover;border-radius:7px;display:block}
  .land-photo-placeholder{border:2px dashed var(--border);border-radius:7px;height:70px;display:flex;align-items:center;justify-content:center;margin-bottom:.4rem}
  .land-name{font-weight:700;font-size:.88rem;color:var(--txt);margin-bottom:.2rem}
  .land-desc{color:var(--txt-3);line-height:1.4;margin:0}

  /* Timeline */
  .timeline{display:flex;flex-direction:column;position:relative;padding-left:2.5rem}
  .tl-step{position:relative;padding-bottom:1.25rem;display:flex;flex-direction:column}
  .tl-line{position:absolute;left:-.95rem;top:1.4rem;bottom:0;width:2px;background:var(--teal);opacity:.3}
  .p2-line{background:var(--aqua)}
  .tl-node{position:absolute;left:-1.55rem;top:.1rem;width:1.2rem;height:1.2rem;border-radius:50%;background:var(--teal);display:flex;align-items:center;justify-content:center;z-index:1}
  .p2-node{background:var(--aqua)}
  .tl-num{font-size:.65rem;font-weight:800;color:#fff;line-height:1}
  .tl-content{background:var(--bg-2);border-radius:9px;padding:.625rem .75rem;border-left:3px solid var(--teal)}
  .p2-content{border-left-color:var(--aqua)}
  .tl-phase-tag{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--teal);margin-bottom:.15rem}
  .p2-tag{color:var(--aqua)}
  .tl-label{font-weight:700;font-size:.88rem;color:var(--txt);margin-bottom:.2rem}
  .tl-desc{color:var(--txt-2);line-height:1.5}

  /* Emergency */
  .em-grid{display:flex;flex-direction:column;gap:.5rem}
  .em-card{background:var(--bg-2);border-radius:9px;padding:.625rem .75rem}
  .em-red{border:1px solid rgba(220,38,38,.25);background:rgba(220,38,38,.05)}
  .em-amber{border:1px solid rgba(245,158,11,.25);background:rgba(245,158,11,.05)}
  .em-title{font-weight:700;font-size:.85rem;color:var(--txt);margin-bottom:.2rem}
  .em-line{font-size:.82rem;color:var(--txt-2)}

  .xs{font-size:.75rem}
  .muted{color:var(--txt-3)}
  .mono{font-family:var(--ff-mono)}
  .wind-scale{display:flex;flex-direction:column;gap:.3rem;margin:.75rem 0 .5rem}
  .wind-zone{display:flex;align-items:center;gap:.5rem;padding:.25rem .5rem;border-radius:0 6px 6px 0;background:var(--bg-raised)}
  .section-hdr{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;padding:.5rem .625rem;color:var(--txt);border-radius:8px;background:var(--bg-raised);border:1px solid var(--border)}
  .section-label{font-size:.85rem;font-weight:700;color:var(--txt-2)}
  .guide-inner{display:flex;flex-direction:column;gap:.3rem;margin-top:.4rem}
  .g-sec{background:var(--bg-raised);border:1px solid var(--border);border-radius:8px;overflow:hidden}
  .g-sec-hdr{display:flex;align-items:center;gap:.4rem;width:100%;background:none;border:none;cursor:pointer;padding:.5rem .625rem;text-align:left}
  .g-num{background:var(--teal);color:#fff;border-radius:3px;padding:.05rem .3rem;font-weight:700;flex-shrink:0}
  .g-lbl{flex:1;font-weight:600;color:var(--txt)}
  .g-body{padding:.4rem .625rem .625rem;color:var(--txt-2);line-height:1.6;border-top:1px solid var(--border)}
  .info-page{opacity:0;transition:opacity .25s ease}
  .info-page.info-loaded{opacity:1}
  .weather-placeholder{min-height:80px}
  /* Windy iframe container min-height to prevent jump */
  :global(.wg-iframe-wrap){min-height:350px}
  :global(.wb){min-height:60px}
  :global(.snd-wrap){min-height:60px}
</style>
