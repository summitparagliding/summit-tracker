<script>
  import { lang } from '$lib/stores/lang.js';
  export let data;
  $: L = $lang === 'fr';

  const CATS = [
    { id:'start', fr:'Démarrer',                en:'Getting started' },
    { id:'track', fr:'Tableau de bord & suivi', en:'Dashboard & tracking' },
    { id:'equip', fr:'Équipement',              en:'Equipment' },
    { id:'fly',   fr:'Voler',                   en:'Flying' },
    { id:'learn', fr:'Météo & apprentissage',   en:'Weather & learning' },
    { id:'admin', fr:'Commandes & paiements',   en:'Orders & payments' },
    { id:'help',  fr:'Aide',                    en:'Help' },
  ];

  const sections = [
    // ── Getting started ───────────────────────────────────────
    { cat:'start', fr:'Connexion et code PIN', en:'Logging in and your PIN',
      fr_body:`Ouvrez l'application et entrez votre code PIN à 4 chiffres. À votre toute première connexion, votre PIN est les 4 derniers chiffres de votre numéro de téléphone (un rappel s'affiche sous le champ). Votre instructeur peut le réinitialiser en tout temps depuis son tableau de bord si vous l'oubliez. Le PIN garde votre dossier privé : ne le partagez pas.`,
      en_body:`Open the app and enter your 4-digit PIN. On your very first login your PIN is the last 4 digits of your phone number (a reminder shows under the field). Your instructor can reset it at any time from their dashboard if you forget it. The PIN keeps your file private, so don't share it.` },
    { cat:'start', fr:'Décharges — obligatoires et optionnelle', en:'Waivers — required and optional',
      fr_body:`À votre première connexion, vous devez lire et signer les décharges obligatoires avant d'accéder au reste de l'application. Pour chacune : lisez le PDF affiché, écrivez votre nom légal complet, signez avec le doigt dans la case, cochez la case d'acceptation, puis appuyez sur Signer. Une copie signée est automatiquement envoyée par courriel à l'école (et au club pour la décharge concernée). Une décharge optionnelle existe aussi, pour l'équipement acheté hors de la boutique Summit : elle ne bloque pas l'accès et peut être signée plus tard. Vous retrouvez toutes vos décharges via « Mes décharges » dans le Carnet. Si l'instructeur met à jour une décharge, on vous demandera de signer la nouvelle version.`,
      en_body:`On your first login you must read and sign the required waivers before you can use the rest of the app. For each one: read the PDF shown, type your full legal name, draw your signature with your finger, tick the agreement box, then tap Sign. A signed copy is automatically emailed to the school (and to the club for the relevant waiver). There is also one optional waiver, for equipment bought outside the Summit boutique: it does not block access and can be signed later. You can find all your waivers under "My waivers" in the Logbook. If the instructor updates a waiver, you'll be asked to sign the new version.` },
    { cat:'start', fr:'Langue et thème (clair / sombre)', en:'Language and theme (light / dark)',
      fr_body:`En haut du menu, deux boutons EN / FR changent la langue de toute l'application, instantanément. À côté, l'icône de thème ouvre un curseur de luminosité qui va du sombre au clair : faites-le glisser à n'importe quel niveau, le texte reste toujours lisible et le contraste s'ajuste automatiquement. Vos choix de langue et de thème sont mémorisés sur votre appareil pour vos prochaines visites.`,
      en_body:`At the top of the menu, two buttons EN / FR switch the whole app's language instantly. Next to them, the theme icon opens a brightness slider from dark to light: drag it to any level and the text always stays readable, with contrast adjusting automatically. Your language and theme choices are remembered on your device for next time.` },
    { cat:'start', fr:'Comment naviguer dans l\'application', en:'How to get around the app',
      fr_body:`La barre du bas donne accès aux sections principales : Accueil (tableau de bord), Théorie, Exercices, Vols, Carnet, Info (météo) et Étude. Beaucoup de cartes se plient et se déplient d'un simple appui sur leur titre, pour garder l'écran épuré. Le bouton vert « Démarrer un vol » est toujours accessible en haut.`,
      en_body:`The bottom bar gives you the main sections: Home (dashboard), Theory, Exercises, Flights, Logbook, Info (weather) and Study. Many cards collapse and expand with a single tap on their title to keep the screen tidy. The green "Start a flight" button is always available at the top.` },

    // ── Dashboard & tracking ──────────────────────────────────
    { cat:'track', fr:'Le tableau de bord (Accueil)', en:'The dashboard (Home)',
      fr_body:`Le tableau de bord rassemble tout ce qui vous concerne. De haut en bas : les alertes importantes (débriefings non lus, journées planifiées), votre parcours de formation, votre équipement et son calcul de charge, vos commandes, vos paiements, vos factures et reçus, et vos derniers vols. Une alerte colorée en haut signale ce qui demande votre attention. Appuyez sur n'importe quelle carte pour la développer ou la réduire.`,
      en_body:`The dashboard pulls together everything about you. Top to bottom: important alerts (unread debriefings, planned days), your training path, your equipment and its weight calculation, your orders, payments, bills and receipts, and your latest flights. A coloured alert at the top flags anything needing attention. Tap any card to expand or collapse it.` },
    { cat:'track', fr:'Le parcours de formation', en:'The training path',
      fr_body:`Le « Parcours de formation » montre votre progression complète, de débutant à pilote licencié, sous forme de chronologie. Phase 1 (Novice) : théorie P1, exercices au sol, examens pratiques au sol, examen théorique P1, premiers vols. Phase 2 (Récréatif) : théorie P2, exercices au sol P2, vols P2, et la licence finale. Appuyez sur la carte pour la déplier, puis sur une étape pour voir le détail de chaque exercice avec son statut (réussi, en attente, à faire), votre progression et la prochaine action. Le pourcentage en haut est votre avancement global. La même chronologie, avec descriptions détaillées, se trouve aussi dans l'onglet Info.`,
      en_body:`The "Training path" shows your full progression, from beginner to licensed pilot, as a timeline. Phase 1 (Novice): P1 theory, ground exercises, ground practical exams, P1 theory exam, first flights. Phase 2 (Recreational): P2 theory, P2 ground handling, P2 flights, and the final licence. Tap the card to expand it, then tap a step to see every exercise inside it with its status (passed, pending, to do), your progress and the next action. The percentage at the top is your overall progress. The same timeline, with detailed descriptions, is also in the Info tab.` },
    { cat:'track', fr:'Théorie et exercices', en:'Theory and exercises',
      fr_body:`L'onglet Théorie liste tous les blocs théoriques de votre niveau ; cochez-les à mesure que vous les complétez. L'onglet Exercices liste les exercices au sol et en vol du programme HPAC/ACVL, chacun avec son statut. Les deux onglets affichent une carte de progression visuelle, dans le même style, pour voir d'un coup d'œil ce qui est fait et ce qui reste. Votre instructeur valide (signe) les exercices et examens depuis son côté.`,
      en_body:`The Theory tab lists all the theory blocks for your level; check them off as you complete them. The Exercises tab lists the ground and in-flight exercises of the HPAC/ACVL syllabus, each with its status. Both tabs show a visual progress map, in the same style, so you can see at a glance what's done and what's left. Your instructor validates (signs off) exercises and exams from their side.` },
    { cat:'track', fr:'Carnet et profil', en:'Logbook and profile',
      fr_body:`Le Carnet contient votre profil, votre progression, vos anneaux de statistiques, votre graphique de confiance, votre carte de progression et vos décharges. Remplissez votre profil dès que possible : téléphone, date de naissance et surtout contact d'urgence. Votre instructeur en a besoin pour votre dossier et votre sécurité. Vous pouvez aussi télécharger votre carnet de vol en PDF (FR ou EN) depuis cette page.`,
      en_body:`The Logbook holds your profile, your progression, your stat rings, your confidence chart, your progress map and your waivers. Fill in your profile as soon as possible: phone, date of birth and especially your emergency contact. Your instructor needs it for your file and your safety. You can also download your flight logbook as a PDF (FR or EN) from this page.` },
    { cat:'track', fr:'Graphique de confiance (avant / après vol)', en:'Confidence chart (before / after flights)',
      fr_body:`Dans le Carnet, le graphique de confiance compare, pour chaque vol, votre ressenti AVANT le vol (votre état d'esprit noté au formulaire pré-vol) et votre confiance APRÈS le vol (notée au formulaire post-vol). Deux courbes se superposent : bleu = avant, vert = après. Les statistiques montrent vos moyennes et l'écart entre les deux, avec une phrase qui résume si vos vols renforcent, stabilisent ou ébranlent votre confiance. C'est un bon point de discussion avec votre instructeur.`,
      en_body:`In the Logbook, the confidence chart compares, for each flight, how you felt BEFORE the flight (your mindset noted in the pre-flight form) and your confidence AFTER the flight (noted in the post-flight form). Two lines overlay: blue = before, green = after. The stats show your averages and the gap between them, with a sentence summarising whether your flights build, steady or shake your confidence. It's a good talking point with your instructor.` },
    { cat:'track', fr:'Signature dans le ciel', en:'Sky signature',
      fr_body:`Dans le Carnet, choisissez la couleur principale de votre aile, la couleur du bord d'attaque et celle de votre sellette. Ces trois couleurs forment une petite icône de parapente personnalisée que l'instructeur voit sur la page En vol, ce qui lui permet de vous repérer rapidement dans les airs pendant un vol actif.`,
      en_body:`In the Logbook, choose your wing's main colour, the leading-edge colour and your harness colour. These three colours form a small personalised paraglider icon that the instructor sees on the In-Flight page, letting them spot you quickly in the air during an active flight.` },
    { cat:'track', fr:'Notifications et alertes', en:'Notifications and alerts',
      fr_body:`Quand quelque chose demande votre attention — un débriefing écrit par l'instructeur, une réponse à une commande, un rappel de paiement — une alerte apparaît en haut du tableau de bord. Appuyez dessus pour aller directement au bon endroit. Les alertes disparaissent une fois l'action faite (par exemple après avoir lu et confirmé un débriefing).`,
      en_body:`When something needs your attention — a debriefing written by the instructor, a reply to an order, a payment reminder — an alert appears at the top of the dashboard. Tap it to go straight to the right place. Alerts clear once the action is done (for example after you read and confirm a debriefing).` },

    // ── Equipment ─────────────────────────────────────────────
    { cat:'equip', fr:'Mon équipement et le calcul de charge', en:'My equipment and weight calculation',
      fr_body:`Dans la section Mon équipement, enregistrez votre aile (avec sa surface en m²), votre sellette et votre parachute de secours, chacun avec son poids. L'application calcule alors votre AUW (poids total en vol, all-up weight) et votre charge alaire en kg/m². Une charge alaire idéale se situe autour de 3,4 à 3,9 kg/m² pour la formation. Le RWL (charge alaire de référence) vous aide à situer votre aile. Appuyez sur Modifier pour ajuster vos valeurs ; tout se met à jour automatiquement.`,
      en_body:`In the My Equipment section, record your wing (with its area in m²), your harness and your reserve parachute, each with its weight. The app then calculates your AUW (all-up weight in flight) and your wing loading in kg/m². An ideal wing loading for training sits around 3.4 to 3.9 kg/m². The RWL (reference wing loading) helps you place your wing. Tap Edit to adjust your values; everything updates automatically.` },
    { cat:'equip', fr:'Décharge pour équipement externe', en:'Waiver for outside equipment',
      fr_body:`Si vous utilisez de l'équipement acheté ailleurs que la boutique Summit, une décharge optionnelle s'applique. Elle n'est pas obligatoire pour utiliser l'application, mais votre instructeur peut vous demander de la signer pour ce matériel. Vous la trouvez dans « Mes décharges » (dans le Carnet) ; elle est clairement marquée comme optionnelle.`,
      en_body:`If you use equipment bought somewhere other than the Summit boutique, an optional waiver applies. It is not required to use the app, but your instructor may ask you to sign it for that gear. You'll find it under "My waivers" (in the Logbook); it is clearly marked as optional.` },

    // ── Flying ────────────────────────────────────────────────
    { cat:'fly', fr:'Démarrer un vol (suivi GPS)', en:'Start a flight (GPS tracking)',
      fr_body:`Avant de décoller, appuyez sur le bouton vert « Démarrer un vol » et laissez l'application ouverte dans votre poche. Le GPS détecte automatiquement le décollage et l'atterrissage et met à jour le tableau de bord de l'instructeur en temps réel ; il voit votre position et votre icône personnalisée. Ne fermez pas l'application pendant le vol. Après l'atterrissage, remplissez le formulaire post-vol.`,
      en_body:`Before launching, tap the green "Start a flight" button and leave the app open in your pocket. GPS automatically detects takeoff and landing and updates the instructor's dashboard in real time; they see your position and your personalised icon. Don't close the app during the flight. After landing, fill out the post-flight form.` },
    { cat:'fly', fr:'Le formulaire pré-vol', en:'The pre-flight form',
      fr_body:`Avant un vol, le formulaire pré-vol vous demande votre état d'esprit du jour (comment vous vous sentez avant de voler). Cette valeur sert de point de comparaison « avant » dans votre graphique de confiance. Répondez honnêtement : c'est un outil pour suivre votre progression mentale, pas un jugement.`,
      en_body:`Before a flight, the pre-flight form asks for your mindset of the day (how you feel before flying). This value becomes the "before" point in your confidence chart. Answer honestly: it's a tool to track your mental progress, not a judgement.` },
    { cat:'fly', fr:'Le formulaire post-vol', en:'The post-flight form',
      fr_body:`Après le vol, notez : comment vous vous sentez après le vol (cinq niveaux, de Très incertain à Très confiant, avec Neutre au centre) ; ce qui s'est bien passé ; ce qui est à améliorer ; et vos objectifs pour le prochain vol. Pour les objectifs, l'application vous propose vos prochains exercices dans l'ordre du programme — touchez une suggestion pour l'ajouter. Vous pouvez aussi ajouter des notes personnelles libres. Tout cela nourrit votre carnet et aide l'instructeur à préparer le prochain vol.`,
      en_body:`After the flight, note: how you feel after the flight (five levels, from Very uncertain to Very confident, with Neutral in the middle); what went well; what to improve; and your goals for the next flight. For goals, the app suggests your upcoming exercises in curriculum order — tap a suggestion to add it. You can also add free personal notes. All of this feeds your logbook and helps the instructor prepare the next flight.` },
    { cat:'fly', fr:'Mes vols, rejeu et GPX', en:'My flights, replay and GPX',
      fr_body:`L'onglet Vols liste vos vols enregistrés. Ouvrez un vol pour revoir la trace GPS en rejeu animé, consulter les détails (durée, altitude), et télécharger le fichier GPX pour l'ouvrir dans d'autres outils. Si un vol a été enregistré par erreur, vous pouvez demander sa suppression à l'instructeur depuis la page du vol ; il l'approuve ou la refuse de son côté.`,
      en_body:`The Flights tab lists your logged flights. Open a flight to replay the GPS track as an animation, see the details (duration, altitude), and download the GPX file to open in other tools. If a flight was logged by mistake, you can request its removal from the instructor on the flight page; they approve or deny it from their side.` },
    { cat:'fly', fr:'Demander un débriefing', en:'Request a debriefing',
      fr_body:`Depuis un vol, appuyez sur « Demander un débriefing ». Choisissez les phases concernées — Décollage : Gonflage, Contrôle, Course ; En vol : Exercices ; Atterrissage : Approche, Finale, Arrondi. Surtout, écrivez une note : décrivez ce qui s'est passé, ce qui vous a surpris, ce que vous avez ressenti et ce sur quoi vous voulez des conseils. L'instructeur reçoit votre note avec la demande et vous répond par écrit.`,
      en_body:`From a flight, tap "Request debriefing". Pick the phases involved — Launch: Inflation, Control, Run; In-flight: Exercises; Landing: Approach, Final, Flare. Most importantly, write a note: describe what happened, what surprised you, how it felt, and what you want advice on. The instructor receives your note with the request and replies to you in writing.` },
    { cat:'fly', fr:'Lire un débriefing', en:'Reading a debriefing',
      fr_body:`Quand l'instructeur écrit un débriefing, une alerte apparaît en haut du tableau de bord. Appuyez dessus pour le lire sur la page du vol, puis sur « Compris » : l'instructeur est notifié que vous l'avez bien reçu et l'alerte disparaît. Relisez vos débriefings avant le prochain vol pour garder vos points de travail en tête.`,
      en_body:`When the instructor writes a debriefing, an alert appears at the top of the dashboard. Tap it to read it on the flight page, then tap "Understood": the instructor is notified you received it and the alert clears. Re-read your debriefings before the next flight to keep your focus points in mind.` },

    // ── Weather & learning ────────────────────────────────────
    { cat:'learn', fr:'La page météo (onglet Info)', en:'The weather page (Info tab)',
      fr_body:`L'onglet Info donne l'analyse météo complète pour Mont Yamaska. Vous y trouvez : les conditions actuelles, le vérificateur horaire (de 8 h à 21 h) avec la volabilité de chaque décollage et la précipitation par heure, les prévisions sur 12 h, sur 3 jours et sur 7 jours, un sondage atmosphérique, et une carte Windy. La page se met à jour fréquemment.`,
      en_body:`The Info tab gives the full weather analysis for Mont Yamaska. You'll find: current conditions, the hourly checker (from 8 a.m. to 9 p.m.) with each launch's flyability and the precipitation per hour, the 12-hour, 3-day and 7-day forecasts, an atmospheric sounding, and a Windy map. The page refreshes frequently.` },
    { cat:'learn', fr:'Comment la volabilité est calculée', en:'How flyability is calculated',
      fr_body:`Tous les créneaux de la page météo — vérificateur horaire, 12 h, 3 jours, 7 jours — utilisent exactement la même méthode : la note tient compte de la vitesse du vent, de sa direction par rapport à chaque décollage, des rafales et de la probabilité de précipitations. Pour les jours à venir, l'application retient la meilleure heure volable de la journée (entre 8 h et 21 h), et affiche cette fenêtre. Les couleurs : vert = excellent, jaune = acceptable, orange = limite, rouge = non volable. La pluie fait baisser la note : voile alourdie, aire de décollage glissante et vitesse de décrochage plus élevée.`,
      en_body:`Every period on the weather page — hourly checker, 12h, 3-day, 7-day — uses the exact same method: the score accounts for wind speed, its direction relative to each launch, gusts and precipitation probability. For upcoming days, the app keeps the best flyable hour of the day (between 8 a.m. and 9 p.m.) and shows that window. Colours: green = excellent, yellow = acceptable, orange = marginal, red = no-go. Rain lowers the score: a heavier wing, a slippery launch area and a higher stall speed.` },
    { cat:'learn', fr:'Le sondage atmosphérique', en:'The atmospheric sounding',
      fr_body:`Le sondage montre la température (rouge) et le point de rosée (vert) selon l'altitude. La ligne pointillée orange (DALR) représente le refroidissement d'une particule d'air en montée ; là où la courbe rouge la croise, les thermiques peuvent se déclencher (marqueur TH). Le marqueur LCL indique la base probable des nuages. Choisissez l'heure avec les boutons de 7 h à 17 h pour voir l'évolution de la journée.`,
      en_body:`The sounding shows temperature (red) and dewpoint (green) by altitude. The orange dashed line (DALR) is the cooling of a rising air parcel; where the red curve crosses it, thermals may trigger (TH marker). The LCL marker shows the probable cloud base. Pick the time with the 7 a.m. to 5 p.m. buttons to see how the day evolves.` },
    { cat:'learn', fr:'Documents d\'étude et lecteur PDF', en:'Study documents and PDF reader',
      fr_body:`L'onglet Étude contient vos documents (Manuel FFVL, Pilot's Handbook, etc.). Ils s'ouvrent dans un lecteur PDF natif : qualité d'origine complète, toutes les images visibles, et un bouton plein écran pour lire confortablement. Vous pouvez aussi télécharger le PDF pour le consulter hors ligne. C'est ici que vous étudiez la théorie entre les séances.`,
      en_body:`The Study tab holds your documents (FFVL Manual, Pilot's Handbook, etc.). They open in a native PDF viewer: full original quality, all images visible, and a full-screen button for comfortable reading. You can also download the PDF to read offline. This is where you study the theory between sessions.` },
    { cat:'learn', fr:'Le quiz', en:'The quiz',
      fr_body:`Le quiz contient 233 questions (banques FFVL et HPAC réunies) classées en catégories : météo, aérodynamique, matériel, réglementation, technique, sécurité, environnement. Choisissez « tout » ou une catégorie précise. Les réponses ne s'affichent pas pendant la session : à la fin, vous voyez votre score et la liste des questions ratées, pour cibler vos révisions. Refaites le quiz autant de fois que vous voulez.`,
      en_body:`The quiz has 233 questions (FFVL and HPAC banks combined) sorted into categories: weather, aerodynamics, equipment, regulations, technique, safety, environment. Choose "all" or a specific category. Answers are not shown during the session: at the end you see your score and the list of missed questions, to focus your review. Retake the quiz as many times as you like.` },

    // ── Orders & payments ─────────────────────────────────────
    { cat:'admin', fr:'Commandes et messagerie', en:'Orders and messaging',
      fr_body:`Utilisez le formulaire de commande pour demander du matériel ou poser une question (casque, sellette, vêtements, etc.). Chaque commande ouvre un fil de discussion : vous et l'instructeur échangez des messages (taille, couleur, options…) jusqu'à ce que tout soit clair. L'instructeur appuie ensuite sur Confirmer et la commande passe dans votre historique. Vous êtes notifié de chaque réponse.`,
      en_body:`Use the order form to request gear or ask a question (helmet, harness, clothing, etc.). Each order opens a message thread: you and the instructor exchange messages (size, colour, options…) until everything is clear. The instructor then taps Confirm and the order moves to your history. You're notified of every reply.` },
    { cat:'admin', fr:'Paiements', en:'Payments',
      fr_body:`Soumettez un paiement avec le montant, une description et, si possible, une photo du reçu. L'instructeur le confirme (parfois directement depuis son tableau de bord) et votre solde — la carte Total dû — se met à jour automatiquement. Appuyez sur la carte Total dû pour voir le détail de ce qui a été payé et ce qui reste.`,
      en_body:`Submit a payment with the amount, a description and, if possible, a photo of the receipt. The instructor confirms it (sometimes straight from their dashboard) and your balance — the Total owing card — updates automatically. Tap the Total owing card to see the breakdown of what's been paid and what's left.` },
    { cat:'admin', fr:'Factures et reçus', en:'Bills and receipts',
      fr_body:`La section Factures & reçus regroupe les documents financiers liés à votre formation. Vous pouvez téléverser une facture ou un reçu ; l'instructeur en est notifié sur son tableau de bord. C'est utile pour garder une trace claire de vos achats et paiements au même endroit.`,
      en_body:`The Bills & receipts section gathers the financial documents tied to your training. You can upload a bill or receipt; the instructor is notified on their dashboard. It's useful for keeping a clear record of your purchases and payments in one place.` },

    // ── Help ──────────────────────────────────────────────────
    { cat:'help', fr:'Besoin d\'aide ?', en:'Need help?',
      fr_body:`Pour toute question sur votre formation, votre matériel, vos paiements, vos décharges ou l'application elle-même, contactez directement votre instructeur. Pour un PIN oublié ou un problème de compte, l'instructeur peut tout réinitialiser depuis son tableau de bord. Ce guide se trouve toujours dans le menu, et la barre de recherche ci-dessus vous aide à trouver une réponse rapidement.`,
      en_body:`For any question about your training, equipment, payments, waivers or the app itself, contact your instructor directly. For a forgotten PIN or an account issue, the instructor can reset everything from their dashboard. This guide is always in the menu, and the search bar above helps you find an answer quickly.` },
  ];

  let query = '';
  let open = new Set();
  function toggle(key) {
    const s = new Set(open);
    s.has(key) ? s.delete(key) : s.add(key);
    open = s;
  }
  $: q = query.trim().toLowerCase();
  $: filtered = sections
    .map((s, i) => ({ ...s, i }))
    .filter(s => !q ||
      (L ? s.fr : s.en).toLowerCase().includes(q) ||
      (L ? s.fr_body : s.en_body).toLowerCase().includes(q));
</script>

<svelte:head><title>{L?'Guide':'Guide'} — Summit</title></svelte:head>

<h1 class="guide-title">{L?'Guide d\'utilisation':'User guide'}</h1>
<p class="guide-intro">
  {L?'Tout ce qu\'il faut savoir pour utiliser l\'application Summit Paragliding, en détail. Cherchez un mot-clé ou parcourez les sections.':'Everything you need to know to use the Summit Paragliding app, in detail. Search a keyword or browse the sections.'}
</p>

<div class="guide-search">
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  <input bind:value={query} placeholder={L?'Rechercher dans le guide…':'Search the guide…'} />
  {#if query}<button class="guide-clear" on:click={()=>query=''}>✕</button>{/if}
</div>

{#if !filtered.length}
  <p class="guide-empty">{L?'Aucun résultat. Essayez un autre mot-clé.':'No results. Try another keyword.'}</p>
{/if}

{#each CATS as c}
  {@const items = filtered.filter(s => s.cat === c.id)}
  {#if items.length}
  <div class="guide-cat">{L ? c.fr : c.en}</div>
  <div class="guide-sections">
    {#each items as s (s.i)}
    <div class="guide-section">
      <button class="guide-hdr" on:click={() => toggle(s.i)}>
        <span class="guide-label">{L ? s.fr : s.en}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
          class="guide-chev" style="transform:rotate({open.has(s.i)||q?180:0}deg)"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {#if open.has(s.i) || q}
      <div class="guide-body">{L ? s.fr_body : s.en_body}</div>
      {/if}
    </div>
    {/each}
  </div>
  {/if}
{/each}

<style>
  .guide-title{font-family:var(--ff-head);font-size:1.25rem;font-weight:800;color:var(--txt);margin-bottom:.25rem}
  .guide-intro{font-family:var(--ff-body);font-size:.78rem;color:var(--txt-3);line-height:1.55;margin-bottom:.9rem}
  .guide-search{display:flex;align-items:center;gap:.5rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:.5rem .7rem;margin-bottom:1rem}
  .guide-search svg{color:var(--txt-3);flex-shrink:0}
  .guide-search input{flex:1;background:none;border:none;color:var(--txt);font-family:var(--ff-body);font-size:.85rem;padding:0;outline:none}
  .guide-clear{background:none;border:none;color:var(--txt-3);cursor:pointer;font-size:.9rem;padding:0 .2rem}
  .guide-empty{font-family:var(--ff-body);font-size:.8rem;color:var(--txt-3);text-align:center;padding:1.5rem 0}
  .guide-cat{font-family:var(--ff-head);font-size:.68rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--teal);margin:1.1rem 0 .45rem;padding-bottom:.3rem;border-bottom:1px solid var(--border)}
  .guide-sections{display:flex;flex-direction:column;gap:.4rem}
  .guide-section{background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;overflow:hidden}
  .guide-hdr{font-family:var(--ff-head);display:flex;align-items:center;gap:.5rem;width:100%;background:none;border:none;cursor:pointer;padding:.7rem .9rem;text-align:left;color:var(--txt)}
  .guide-label{flex:1;font-family:var(--ff-head);font-size:.88rem;font-weight:700;color:var(--txt)}
  .guide-chev{flex-shrink:0;color:var(--txt-3);transition:transform .2s}
  .guide-body{padding:.1rem .9rem .85rem;color:var(--txt-2);font-family:var(--ff-body);line-height:1.7;font-size:.8rem;border-top:1px solid var(--border)}
</style>
