<script>
  import { lang } from '$lib/stores/lang.js';
  export let data;
  $: L = $lang === 'fr';

  // Categories
  const CATS = [
    { id:'start', fr:'Démarrer',            en:'Getting started' },
    { id:'track', fr:'Tableau de bord & suivi', en:'Dashboard & tracking' },
    { id:'fly',   fr:'Voler',               en:'Flying' },
    { id:'learn', fr:'Apprendre',           en:'Learning' },
    { id:'admin', fr:'Commandes & paiements', en:'Orders & payments' },
    { id:'help',  fr:'Aide',                en:'Help' },
  ];

  const sections = [
    // ── Getting started ───────────────────────────────────────
    { cat:'start', fr:'Connexion', en:'Logging in',
      fr_body:`Entrez votre code PIN à 4 chiffres sur la page d'accueil. Votre instructeur vous remet ce code lors de l'inscription. Si vous l'oubliez, contactez votre instructeur, qui peut le réinitialiser.`,
      en_body:`Enter your 4-digit PIN on the home page. Your instructor gives you this code when you enrol. If you forget it, contact your instructor, who can reset it.` },
    { cat:'start', fr:'Décharges obligatoires', en:'Required waivers',
      fr_body:`À votre première connexion, vous devez lire et signer toutes les décharges avant d'accéder au reste de l'application. Pour chacune : lisez le document PDF affiché, écrivez votre nom légal complet, signez avec le doigt dans la case, cochez la case d'acceptation, puis appuyez sur Signer. Une copie signée est automatiquement envoyée à l'école (et au club pour la décharge concernée). Si votre instructeur met à jour une décharge plus tard, on vous demandera de signer la nouvelle version avant de continuer.`,
      en_body:`On your first login you must read and sign all waivers before you can use the rest of the app. For each one: read the PDF shown, type your full legal name, draw your signature with your finger, tick the agreement box, then tap Sign. A signed copy is automatically emailed to the school (and to the club for the relevant waiver). If your instructor later updates a waiver, you'll be asked to sign the new version before continuing.` },
    { cat:'start', fr:'Langue et thème (clair / sombre)', en:'Language and theme (light / dark)',
      fr_body:`En bas du menu, deux boutons EN / FR changent la langue de toute l'application. Juste à côté, un curseur règle la luminosité, du sombre au clair : faites-le glisser à n'importe quel niveau, le texte reste lisible partout. Vos choix sont mémorisés sur votre appareil.`,
      en_body:`At the bottom of the menu, two buttons EN / FR switch the whole app's language. Next to them, a slider sets brightness from dark to light: drag it to any level and the text stays readable throughout. Your choices are remembered on your device.` },

    // ── Dashboard & tracking ──────────────────────────────────
    { cat:'track', fr:'Tableau de bord (Accueil)', en:'Dashboard (Home)',
      fr_body:`Le tableau de bord est votre point de départ. Il affiche en haut vos alertes importantes (débriefings non lus, journées planifiées), votre solde de paiement, vos commandes et les messages de l'instructeur. Appuyez sur une carte pour la développer ou la réduire.`,
      en_body:`The dashboard is your starting point. At the top it shows your important alerts (unread debriefings, planned days), your payment balance, your orders and instructor messages. Tap a card to expand or collapse it.` },
    { cat:'track', fr:'Parcours de formation', en:'Training path',
      fr_body:`Sur le tableau de bord, le « Parcours de formation » montre votre progression complète sous forme de chronologie. Phase 1 (Novice) : théorie P1, exercices au sol, examens pratiques au sol, examen théorique P1. Phase 2 (Récréatif) : vols de formation, exercices en vol, exercices P2, théorie P2, examen P2. Appuyez sur la carte pour la déplier, puis sur une étape pour voir ce qu'elle comprend, votre progression et la prochaine action. Le pourcentage en haut est votre avancement global pondéré.`,
      en_body:`On the dashboard, the "Training path" shows your full progress as a timeline. Phase 1 (Novice): P1 theory, ground exercises, ground practical exams, P1 theory exam. Phase 2 (Recreational): training flights, in-flight exercises, P2 exercises, P2 theory, P2 exam. Tap the card to expand it, then tap a step to see what it involves, your progress and the next action. The percentage at the top is your overall weighted progress.` },
    { cat:'track', fr:'Carnet et profil', en:'Logbook and profile',
      fr_body:`Le carnet contient votre profil, votre progression et vos couleurs de signature. Remplissez votre profil (téléphone, date de naissance, contact d'urgence) dès que possible : votre instructeur en a besoin pour votre dossier et votre sécurité.`,
      en_body:`The logbook holds your profile, your progress and your signature colours. Fill in your profile (phone, date of birth, emergency contact) as soon as possible: your instructor needs it for your file and your safety.` },
    { cat:'track', fr:'Signature dans le ciel', en:'Sky signature',
      fr_body:`Choisissez la couleur principale de votre aile, la couleur du bord d'attaque et celle de votre sellette. Ces trois couleurs forment une icône de parapente personnalisée que l'instructeur voit sur la page En vol, ce qui lui permet de vous identifier rapidement dans les airs.`,
      en_body:`Choose your wing's main colour, the leading-edge colour and your harness colour. These three colours form a personalised paraglider icon the instructor sees on the In-Flight page, letting them identify you quickly in the air.` },

    // ── Flying ────────────────────────────────────────────────
    { cat:'fly', fr:'Vol actif (GPS)', en:'Active flight (GPS)',
      fr_body:`Avant de décoller, appuyez sur « Démarrer un vol » et laissez l'application ouverte dans votre poche. Le GPS détecte automatiquement le décollage et l'atterrissage et met à jour le tableau de bord de l'instructeur en temps réel. Ne fermez pas l'application pendant le vol. Après l'atterrissage, remplissez le formulaire de post-vol.`,
      en_body:`Before launching, tap "Start a flight" and leave the app open in your pocket. GPS automatically detects takeoff and landing and updates the instructor's dashboard in real time. Don't close the app during the flight. After landing, fill out the post-flight form.` },
    { cat:'fly', fr:'Formulaire de post-vol', en:'Post-flight form',
      fr_body:`Après le vol, notez votre confiance du jour (quatre niveaux, de Très incertain à Très confiant — il n'y a pas de choix « neutre », pour vous encourager à vous situer), ce qui s'est bien passé, ce qui est à améliorer, et vos objectifs pour le prochain vol. Pour les objectifs, l'application vous propose vos prochains exercices dans l'ordre du programme : touchez une suggestion pour l'ajouter.`,
      en_body:`After the flight, rate your confidence for the day (four levels, from Very uncertain to Very confident — there is no "neutral" option, to encourage you to take a position), what went well, what to improve, and your goals for the next flight. For goals, the app suggests your upcoming exercises in curriculum order: tap a suggestion to add it.` },
    { cat:'fly', fr:'Mes vols', en:'My flights',
      fr_body:`L'onglet Vols liste vos vols enregistrés. Ouvrez un vol pour revoir la trace GPS (rejeu), télécharger le fichier GPX, et voir les détails. Si un vol a été enregistré par erreur, vous pouvez demander sa suppression à l'instructeur depuis la page du vol.`,
      en_body:`The Flights tab lists your logged flights. Open a flight to replay the GPS track, download the GPX file, and see the details. If a flight was logged by mistake, you can request its removal from the instructor on the flight page.` },
    { cat:'fly', fr:'Demander un débriefing', en:'Request a debriefing',
      fr_body:`Depuis un vol, appuyez sur « Demander un débriefing ». Choisissez les phases concernées — Décollage : Gonflage, Contrôle, Course ; En vol : Exercices ; Atterrissage : Approche, Finale, Arrondi. Surtout, écrivez une note : décrivez ce qui s'est passé, ce qui vous a surpris, ce que vous avez ressenti et ce sur quoi vous voulez des conseils. L'instructeur reçoit votre note avec la demande et y répond.`,
      en_body:`From a flight, tap "Request debriefing". Pick the phases involved — Launch: Inflation, Control, Run; In-flight: Exercises; Landing: Approach, Final, Flare. Most importantly, write a note: describe what happened, what surprised you, how it felt, and what you want advice on. The instructor receives your note with the request and responds to it.` },
    { cat:'fly', fr:'Lire un débriefing', en:'Reading a debriefing',
      fr_body:`Quand l'instructeur écrit un débriefing, une alerte apparaît en haut du tableau de bord. Appuyez dessus pour le lire sur la page du vol, puis sur « Compris » : l'instructeur est notifié que vous l'avez reçu et l'alerte disparaît.`,
      en_body:`When the instructor writes a debriefing, an alert appears at the top of the dashboard. Tap it to read it on the flight page, then tap "Understood": the instructor is notified you received it and the alert disappears.` },

    // ── Learning ──────────────────────────────────────────────
    { cat:'learn', fr:'Météo (onglet Info)', en:'Weather (Info tab)',
      fr_body:`L'onglet Info donne l'analyse météo complète pour Mont Yamaska : une grille horaire montrant la volabilité de chaque décollage (NE, N, O, S) de 0 à 100 %, avec une ligne de précipitations pour chaque heure (en bleu quand le risque dépasse 40 %, pour voir d'un coup d'œil pourquoi un créneau n'est pas volable), un sondage atmosphérique, et une carte Windy. Couleurs : vert = excellent, jaune = acceptable, orange = limite, rouge = non volable. Le verdict explique aussi les effets de la pluie : voile alourdie, aire de décollage glissante et vitesse de décrochage plus élevée en vol.`,
      en_body:`The Info tab gives the full weather analysis for Mont Yamaska: an hourly grid showing each launch's flyability (NE, N, W, S) from 0 to 100%, with a precipitation line for every hour (blue when the risk is over 40%, so you can see at a glance why a slot isn't flyable), an atmospheric sounding, and a Windy map. Colours: green = excellent, yellow = acceptable, orange = marginal, red = no-go. The verdict also explains rain's effects: a heavier wing, a slippery launch area and a higher stall speed in the air.` },
    { cat:'learn', fr:'Sondage atmosphérique', en:'Atmospheric sounding',
      fr_body:`Le sondage montre la température (rouge) et le point de rosée (vert) selon l'altitude. La ligne pointillée orange (DALR) est le refroidissement d'une particule d'air en montée ; là où la courbe rouge la croise, les thermiques peuvent se déclencher (marqueur TH). Le marqueur LCL indique la base probable des nuages. Choisissez l'heure avec les boutons 07h–17h.`,
      en_body:`The sounding shows temperature (red) and dewpoint (green) by altitude. The orange dashed line (DALR) is the cooling of a rising air parcel; where the red curve crosses it, thermals may trigger (TH marker). The LCL marker shows the probable cloud base. Pick the time with the 07h–17h buttons.` },
    { cat:'learn', fr:'Documents d\'étude', en:'Study documents',
      fr_body:`L'onglet Étude contient vos documents (Manuel FFVL, Pilot's Handbook, etc.). Ils s'affichent dans un lecteur PDF natif : qualité d'origine complète, toutes les images visibles, et un bouton « Plein écran » pour lire confortablement. Vous pouvez aussi télécharger le PDF pour le consulter hors ligne.`,
      en_body:`The Study tab holds your documents (FFVL Manual, Pilot's Handbook, etc.). They open in a native PDF viewer: full original quality, all images visible, and a "Full screen" button for comfortable reading. You can also download the PDF to read offline.` },
    { cat:'learn', fr:'Quiz', en:'Quiz',
      fr_body:`Le quiz contient 233 questions (banque FFVL et HPAC réunies) classées en 7 catégories : météo, aérodynamique, matériel, réglementation, technique, sécurité, environnement. Choisissez « tout » ou une catégorie. Les réponses ne s'affichent pas pendant la session : à la fin, vous voyez votre score et la liste des questions ratées pour réviser.`,
      en_body:`The quiz has 233 questions (FFVL and HPAC banks combined) in 7 categories: weather, aerodynamics, equipment, regulations, technique, safety, environment. Choose "all" or a category. Answers are not shown during the session: at the end you see your score and the list of missed questions to review.` },

    // ── Orders & payments ─────────────────────────────────────
    { cat:'admin', fr:'Commandes et messagerie', en:'Orders and messaging',
      fr_body:`Utilisez le formulaire de commande pour demander du matériel (casque, sellette, vêtements, etc.). Chaque commande ouvre un fil de discussion : vous et l'instructeur pouvez échanger des messages (taille, couleur, options…) jusqu'à ce que tout soit clair. L'instructeur appuie ensuite sur Confirmer ; la commande passe alors dans l'historique.`,
      en_body:`Use the order form to request gear (helmet, harness, clothing, etc.). Each order opens a message thread: you and the instructor can exchange messages (size, colour, options…) until everything is clear. The instructor then taps Confirm and the order moves to your history.` },
    { cat:'admin', fr:'Paiements', en:'Payments',
      fr_body:`Soumettez un paiement avec le montant, une description et, si possible, une photo du reçu. L'instructeur le confirme et votre solde (Total dû) se met à jour automatiquement. Appuyez sur la carte « Total dû » pour voir le détail.`,
      en_body:`Submit a payment with the amount, a description and, if possible, a photo of the receipt. The instructor confirms it and your balance (Total owing) updates automatically. Tap the "Total owing" card to see the breakdown.` },

    // ── Help ──────────────────────────────────────────────────
    { cat:'help', fr:'Besoin d\'aide ?', en:'Need help?',
      fr_body:`Pour toute question sur votre formation, votre matériel, vos paiements ou l'application, contactez directement votre instructeur. Pour un PIN oublié ou un problème de compte, l'instructeur peut tout réinitialiser depuis son tableau de bord.`,
      en_body:`For any question about your training, equipment, payments or the app, contact your instructor directly. For a forgotten PIN or an account issue, the instructor can reset everything from their dashboard.` },
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
  {L?'Tout ce que vous devez savoir pour utiliser l\'application Summit Paragliding. Cherchez un mot-clé ou parcourez les sections.':'Everything you need to know to use the Summit Paragliding app. Search a keyword or browse the sections.'}
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
  .guide-title{font-family:var(--ff-head,inherit);font-size:1.25rem;font-weight:800;color:var(--txt);margin-bottom:.25rem}
  .guide-intro{font-size:.78rem;color:var(--txt-3);line-height:1.5;margin-bottom:.9rem}
  .guide-search{display:flex;align-items:center;gap:.5rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:.5rem .7rem;margin-bottom:1rem}
  .guide-search svg{color:var(--txt-3);flex-shrink:0}
  .guide-search input{flex:1;background:none;border:none;color:var(--txt);font-size:.85rem;padding:0;outline:none}
  .guide-clear{background:none;border:none;color:var(--txt-3);cursor:pointer;font-size:.9rem;padding:0 .2rem}
  .guide-empty{font-size:.8rem;color:var(--txt-3);text-align:center;padding:1.5rem 0}
  .guide-cat{font-family:var(--ff-head,inherit);font-size:.68rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--teal);margin:1.1rem 0 .45rem;padding-bottom:.3rem;border-bottom:1px solid var(--border)}
  .guide-sections{display:flex;flex-direction:column;gap:.4rem}
  .guide-section{background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;overflow:hidden}
  .guide-hdr{display:flex;align-items:center;gap:.5rem;width:100%;background:none;border:none;cursor:pointer;padding:.7rem .9rem;text-align:left;color:var(--txt)}
  .guide-label{flex:1;font-size:.88rem;font-weight:700;color:var(--txt)}
  .guide-chev{flex-shrink:0;color:var(--txt-3);transition:transform .2s}
  .guide-body{padding:.1rem .9rem .85rem;color:var(--txt-2);line-height:1.7;font-size:.8rem;border-top:1px solid var(--border)}
</style>
