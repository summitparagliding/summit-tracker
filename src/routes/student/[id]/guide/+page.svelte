<script>
  import { lang } from '$lib/stores/lang.js';
  export let data;
  $: L = $lang === 'fr';

  const sections = [
    {
      fr: 'Connexion', en: 'Logging in',
      fr_body: `Entrez votre code PIN à 4 chiffres sur la page d'accueil. Votre instructeur vous a remis ce code lors de votre inscription. Si vous l'avez oublié, contactez votre instructeur.`,
      en_body: `Enter your 4-digit PIN on the home page. Your instructor gave you this code when you enrolled. If you've forgotten it, contact your instructor.`,
    },
    {
      fr: 'Tableau de bord (Accueil)', en: 'Dashboard (Home)',
      fr_body: `Le tableau de bord est votre point de départ. Il affiche vos alertes importantes en haut (débriefings non lus, journées planifiées à venir), votre solde de paiement, l'historique de vos commandes, et vos messages de l'instructeur. Appuyez sur chaque carte pour la développer ou la réduire.`,
      en_body: `The dashboard is your starting point. It shows your important alerts at the top (unread debriefings, upcoming planned days), your payment balance, order history, and instructor messages. Tap each card to expand or collapse it.`,
    },
    {
      fr: 'Débriefings', en: 'Debriefings',
      fr_body: `Lorsque votre instructeur écrit un débriefing après votre vol, une alerte apparaît en haut du tableau de bord. Appuyez dessus pour lire le débriefing sur la page du vol. Après lecture, appuyez sur "Compris" — votre instructeur sera notifié que vous avez bien reçu le message. L'alerte disparaîtra du tableau de bord.`,
      en_body: `When your instructor writes a debriefing after your flight, an alert appears at the top of the dashboard. Tap it to read the debriefing on the flight page. After reading, tap "Understood" — your instructor will be notified. The alert will disappear from the dashboard.`,
    },
    {
      fr: 'Carnet (Logbook)', en: 'Logbook',
      fr_body: `Le carnet contient votre profil personnel, votre progression dans le curriculum HPAC, et vos couleurs de signature. Remplissez votre profil (téléphone, date de naissance, contact d'urgence) dès que possible — votre instructeur en a besoin. Choisissez vos couleurs d'aile et de sellette pour créer votre signature visuelle dans le ciel.`,
      en_body: `The logbook contains your personal profile, your HPAC curriculum progress, and your colour signature. Fill in your profile (phone, date of birth, emergency contact) as soon as possible — your instructor needs this information. Choose your wing and harness colours to create your visual sky signature.`,
    },
    {
      fr: 'Signature dans le ciel', en: 'Sky signature',
      fr_body: `Choisissez la couleur principale de votre aile, la couleur du bord d'attaque, et la couleur de votre sellette. Ces trois couleurs forment votre "signature" — une icône de parapente personnalisée visible par l'instructeur sur la page En vol. Cela permet à l'instructeur de vous identifier rapidement en regardant la liste des pilotes en vol.`,
      en_body: `Choose your wing's main colour, leading edge colour, and harness colour. These three colours form your "signature" — a personalised paraglider icon visible to the instructor on the In-Flight page. This allows the instructor to quickly identify you when monitoring pilots in the air.`,
    },
    {
      fr: 'Vol actif (GPS)', en: 'Active flight (GPS)',
      fr_body: `Avant de décoller, appuyez sur "Démarrer un vol" et laissez l'application ouverte dans votre poche. Le GPS de votre téléphone détectera automatiquement votre décollage et votre atterrissage, et mettra à jour le tableau de bord de l'instructeur en temps réel. Ne fermez pas l'application pendant le vol. Après l'atterrissage, remplissez le formulaire de post-vol pour enregistrer votre vol dans votre carnet.`,
      en_body: `Before launching, tap "Start a flight" and leave the app open in your pocket. Your phone's GPS will automatically detect your takeoff and landing, and update the instructor's dashboard in real time. Do not close the app during the flight. After landing, fill out the post-flight form to log your flight in your logbook.`,
    },
    {
      fr: 'Météo (onglet Info)', en: 'Weather (Info tab)',
      fr_body: `L'onglet Info contient l'analyse météo complète pour Mont Yamaska: une grille horaire montrant la faisabilité de vol pour chaque décollage (NE CVLY, N Cogeco, O CVLY, S) de 0 à 100%, un sondage atmosphérique montrant le profil de température et de point de rosée à différentes altitudes, et une carte Windy interactive. Les couleurs signifient: vert = excellent, jaune = acceptable, orange = limite, rouge = non volable.`,
      en_body: `The Info tab contains the complete weather analysis for Mont Yamaska: an hourly grid showing flyability for each launch (NE CVLY, N Cogeco, O CVLY, S) from 0 to 100%, an atmospheric sounding showing the temperature and dewpoint profile at different altitudes, and an interactive Windy map. Colours mean: green = excellent, yellow = acceptable, orange = marginal, red = no-go.`,
    },
    {
      fr: 'Sondage atmosphérique', en: 'Atmospheric sounding',
      fr_body: `Le sondage montre deux courbes: la ligne rouge (température) et la ligne verte (point de rosée) à différentes altitudes. La ligne orange pointillée (DALR) indique le taux de refroidissement d'une particule d'air en montée. Quand la courbe rouge croise la DALR, les thermiques peuvent se déclencher (marqueur TH). Le marqueur LCL indique la base probable des nuages. Choisissez l'heure désirée avec les boutons 07h–17h.`,
      en_body: `The sounding shows two curves: the red line (temperature) and green line (dewpoint) at different altitudes. The orange dashed line (DALR) indicates the cooling rate of a rising air parcel. When the red curve crosses the DALR, thermals may trigger (TH marker). The LCL marker indicates the probable cloud base. Select the desired time using the 07h–17h buttons.`,
    },
    {
      fr: 'Étude et Quiz', en: 'Study and Quiz',
      fr_body: `L'onglet Étude contient le Manuel FFVL en version numérique (défilement continu, mode 2 pages, saut à une page précise) et le quiz de 174 questions classées par catégorie (météo, aérodynamique, matériel, réglementation, technique, sécurité, environnement). Le quiz n'affiche pas les réponses pendant la session — seulement les questions ratées à la fin, pour révision.`,
      en_body: `The Study tab contains the FFVL Manual in digital format (continuous scroll, 2-page mode, jump to a specific page) and a quiz of 174 questions organised by category (weather, aerodynamics, equipment, regulations, technique, safety, environment). The quiz does not show answers during the session — only missed questions at the end, for review.`,
    },
    {
      fr: 'Commandes', en: 'Orders',
      fr_body: `Utilisez le formulaire de commande pour demander du matériel (casque, sellette, vêtements, etc.) à votre instructeur. Votre commande apparaîtra comme "En attente" jusqu'à ce que l'instructeur réponde. Une fois confirmée, elle passe dans l'historique des commandes (section réduite sous les commandes en attente).`,
      en_body: `Use the order form to request equipment (helmet, harness, clothing, etc.) from your instructor. Your order will appear as "Pending" until the instructor responds. Once confirmed, it moves to the order history (collapsed section below pending orders).`,
    },
    {
      fr: 'Paiements', en: 'Payments',
      fr_body: `Lorsque vous effectuez un paiement, soumettez-le dans l'application avec le montant, la description, et une photo du reçu si disponible. L'instructeur confirmera le paiement. Votre solde (Total dû) se met à jour automatiquement. Appuyez sur la carte "Total dû" pour voir le détail.`,
      en_body: `When you make a payment, submit it in the app with the amount, description, and a photo of the receipt if available. The instructor will confirm the payment. Your balance (Total owing) updates automatically. Tap the "Total owing" card to see the breakdown.`,
    },
  ];

  let open = new Set();
  function toggle(i) {
    const s = new Set(open);
    s.has(i) ? s.delete(i) : s.add(i);
    open = s;
  }
</script>

<svelte:head><title>{L?'Guide':'Guide'} — Summit</title></svelte:head>

<h1 class="guide-title">{L?'Guide d\'utilisation':'User guide'}</h1>
<p class="xs muted" style="margin-bottom:.875rem">
  {L?'Tout ce que vous devez savoir pour utiliser l\'application Summit Paragliding.':'Everything you need to know to use the Summit Paragliding app.'}
</p>

<div class="guide-sections">
  {#each sections as s, i}
  <div class="guide-section">
    <button class="guide-hdr" on:click={() => toggle(i)}>
      <span class="guide-num xs">{i+1}</span>
      <span class="guide-label">{L ? s.fr : s.en}</span>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
        style="flex-shrink:0;transition:transform .2s;transform:rotate({open.has(i)?180:0}deg)">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
    {#if open.has(i)}
    <div class="guide-body xs">
      {L ? s.fr_body : s.en_body}
    </div>
    {/if}
  </div>
  {/each}
</div>

<style>
  .guide-title{font-size:1.1rem;font-weight:800;color:var(--txt);margin-bottom:.25rem}
  .guide-sections{display:flex;flex-direction:column;gap:.35rem}
  .guide-section{background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;overflow:hidden}
  .guide-hdr{display:flex;align-items:center;gap:.5rem;width:100%;background:none;border:none;cursor:pointer;padding:.625rem .875rem;text-align:left;color:var(--txt)}
  .guide-num{background:var(--teal);color:#fff;border-radius:4px;padding:.05rem .35rem;font-weight:700;flex-shrink:0}
  .guide-label{flex:1;font-size:.88rem;font-weight:600;color:var(--txt)}
  .guide-body{padding:.5rem .875rem .875rem;color:var(--txt-2);line-height:1.6;border-top:1px solid var(--border)}
  .xs{font-size:.75rem} .muted{color:var(--txt-3)}
</style>
