// Schéma enrichi du formulaire "C1C - Déclaration d'une activité accessoire"
// (mesure « Tremplin-indépendants », art. 48 §1bis AR 25.11.1991).
//
// Formulaire compagnon (2 pages, 33 champs AcroForm / 36 widgets) déclenché
// depuis le C1 quand le citoyen répond "oui" à la question "J'exerce une
// activité accessoire comme indépendant et je bénéficie (ou souhaite
// bénéficier) de la mesure « Tremplin-indépendants »" (cf. C1_TRIGGERS dans
// c1-fields-improvements.ts, requiresFormSlug: "c1c").
//
// Version imprimée : 06.11.2025 / FORMULAIRE C1C.
//
// ---------------------------------------------------------------------------
// RÉALIGNEMENT 2026-07-30 — géométrie relevée sur le PDF réel
// ---------------------------------------------------------------------------
// La première version de ce schéma associait les champs aux widgets par
// RESSEMBLANCE DE LIBELLÉ, méthode que PDF_FORMS_RULES.md décrit comme la
// cause n°1 de décalage silencieux : dans les AcroForms de l'ONEM, un widget
// porte le nom du texte imprimé AU-DESSUS de lui, pas celui de la donnée qu'il
// reçoit. Quatre commentaires « A VALIDER Oraliks » signalaient d'ailleurs le
// doute. Tout a été confronté au PDF (pypdf pour les rectangles et les
// `/Kids`, pdfplumber pour le texte imprimé et son ordonnée) ; les quatre
// doutes sont tranchés, et trois défauts de plus ont été trouvés :
//
//   1. TROIS radios inversées. Le filler apparie POSITIONNELLEMENT
//      `options[i]` ↔ `pdfFieldName.split("|")[i]` (filler.ts,
//      `stampPipeRadio`). Avec des options `[oui, non]` sur un widget
//      `"non|oui www"`, répondre « oui » cochait « non ». Trois déclarations
//      officielles étaient concernées, dont « une partie de mon activité est
//      exercée par des tiers » — dont le texte imprimé dit que la demande ne
//      peut PAS être acceptée si la réponse est oui. Corrigé en rangeant les
//      options dans l'ordre des cases imprimées (non, puis oui).
//   2. `fill_10` n'est PAS un n° BCE (y=193.6, ligne « Autre : …… »), et le
//      widget nommé « Je dispose des compétences professionnelles… » n'est ni
//      le champ « Autre » ni la question compétences : il est à y=148.6, sur
//      la ligne « ☐ non ☐ oui : …… » de la question TIERS — c'est sa
//      précision. Les deux champs pointaient l'un sur la case de l'autre.
//   3. `Nom de lentreprise` porte TROIS widgets (`/Kids`), donc une seule
//      valeur pour trois emplacements : la ligne du nom (y=233.5), le guide
//      BCE « personne physique » (y=265.4) et le guide BCE « de l'entreprise »
//      (y=216.3). Saisir le nom de la société l'imprimait aussi par-dessus les
//      deux guides BCE. Les trois passent en écriture positionnelle.
//   4. L'affirmation sur l'honneur n'a AUCUNE case à cocher sur le papier
//      (texte imprimé seul, p.2 y=192/181) ; le widget qui portait son nom est
//      la 1re ligne « Je joins en annexe(s) : …… » (y=168.6, décalé à x=314
//      parce que le libellé occupe la gauche). L'affirmation devient virtuelle
//      (comme `affirmationSincerite` du C1A) et les annexes récupèrent leurs
//      TROIS lignes.
//
// Le n° NISS, lui, est un multi-widgets BÉNÉFIQUE — voir son commentaire.
//
// Coordonnées `drawAt` MESURÉES (pdfplumber), jamais approchées à l'œil : ce
// sont des déclarations officielles. Calage vertical calibré sur les n° BCE du
// C1A, déjà validés : `drawAt.y` = ordonnée basse des tirets SymbolMT du guide
// + 4,4 pt (sur le C1A : 338,603 → 343). Le glyphe « ⎯ » dessine sa barre au
// milieu de sa boîte, pas sur la ligne de base — d'où l'écart.

import type { PdfFormField } from "../types";
import { mergeEnrichedFields } from "./_merge";

const SECTION_IDENTITE = "identite";
const SECTION_ACTIVITES = "mes-activites";
const SECTION_REVENUS = "mes-revenus";
const SECTION_ACTIVITES_ANTERIEURES = "activites-anterieures";
const SECTION_AFFIRMATIONS = "affirmations";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";

/// Ordre des cases IMPRIMÉES sur le C1C : « ☐ non » précède « ☐ oui » sur les
/// trois questions binaires du formulaire. Cet ordre n'est pas cosmétique — le
/// filler apparie `options[i]` au i-ème widget de `pdfFieldName`, donc les
/// options doivent suivre les cases du papier, pas l'habitude « oui/non ».
const NON_OUI = [
  { value: "non", label: { fr: "Non" } },
  { value: "oui", label: { fr: "Oui" } },
];

/// Guide BCE imprimé : dix cases groupées 4-3-3, en tirets SymbolMT de 9 pt.
/// Pas relevé sur le PDF : 12,99 pt entre deux tirets d'un même groupe.
/// `groupExtra` diffère de 0,12 pt entre les deux guides (mesure, pas
/// arrondi) — l'écart est conservé tel quel plutôt que moyenné.
const BCE_COMB: Pick<NonNullable<PdfFormField["printAsComb"]>, "groups" | "slotWidth"> = {
  groups: [4, 3, 3],
  slotWidth: 12.99,
};

export const C1C_FIELDS: PdfFormField[] = [
  // ==========================================================================
  // Votre identité
  // ==========================================================================
  {
    // PAS de `prefillFrom` (retiré le 2026-07-26). Un champ `fullname` porte
    // un composite `{ first, last }` ; `prefillFrom` ne sait transporter
    // qu'une chaîne, et le runner relit une chaîne comme un NOM. Avec
    // `profile.firstName`, le PRÉNOM du citoyen atterrissait donc dans la case
    // « Nom » et son nom disparaissait. Les deux voies qui savent remplir ce
    // type composite s'en chargent : `canonicalToPrefill` (héritage depuis un
    // autre document du dossier) et `buildProfilePrefill` (profil du compte).
    id: "pr_nom_et_nom",
    pdfFieldName: "Prénom et nom",
    type: "fullname",
    required: true,
    label: { fr: "Prénom et nom" },
    // Dans un dossier, le C1 a déjà donné le nom : `applyDossierInheritance`
    // rend ce champ `autoAnswered` à l'ouverture, l'étape d'identité perd son
    // dernier champ visible et disparaît (cf. `buildMacroSteps`). Sur l'URL
    // publique `/document/onem/c1c`, où il n'y a aucun C1 dont hériter, le
    // champ reste à l'écran et obligatoire — un `autoAnswered` posé en dur y
    // produirait une déclaration officielle sans nom.
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: 0,
  },
  {
    // MULTI-WIDGETS ASSUMÉ, et même souhaité : le champ AcroForm `NISS` porte
    // deux widgets (`/Kids`), page 1 y=634,3 et page 2 y=793,0. Les deux
    // reçoivent donc la même valeur — c'est exactement ce que demande le
    // papier, dont l'en-tête de page 2 rappelle « Numéro de registre national
    // (NISS) __ __ … ». Contrairement aux multi-widgets du C1A (`TVA`,
    // `Montant`, `1_3`), aucune écriture positionnelle n'est nécessaire ici :
    // ne pas « réparer » ce cas, il n'est pas cassé.
    id: "niss",
    pdfFieldName: "NISS",
    type: "niss",
    required: true,
    label: { fr: "Numéro registre national (NISS)" },
    help: {
      fr: "Votre numéro NISS se trouve au dos de votre carte d'identité (eID), au-dessus du code-barres.",
    },
    placeholder: { fr: "00.00.00-000.00" },
    prefillFrom: "profile.niss",
    canonicalKey: "identity.niss",
    // Hérité du C1 dans un dossier, comme le nom ci-dessus.
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: 1,
  },
  // NOTE canonique : `pr_nom_et_nom` n'a PAS besoin de `canonicalKey`. Sa
  // sémantique (composite prénom+nom) suffit : `canonicalToPrefill` remplit
  // tout champ `type: "fullname"` à partir de `identity.prenom` +
  // `identity.nom`, et `buildProfilePrefill` fait de même depuis le profil.

  // ==========================================================================
  // Votre déclaration (intro) — date de début de l'activité accessoire.
  // ==========================================================================
  {
    id: "dateDebutActivite",
    pdfFieldName: "Date53_af_date",
    type: "date",
    required: true,
    label: { fr: "Je souhaite exercer cette activité accessoire à partir du" },
    help: {
      fr: "L'avantage « Tremplin-indépendants » dure 12 mois maximum, et en tout cas jamais plus longtemps que votre droit aux allocations. Pendant cette période, vous ne devez ni mentionner cette activité sur votre carte de contrôle, ni introduire de formulaire de déclaration remplaçant la carte de contrôle en cas de dispense.",
    },
    section: SECTION_IDENTITE,
    order: 2,
  },

  // ==========================================================================
  // 1. Description de mon activité
  // ==========================================================================
  {
    // UN SEUL textarea pour les TROIS lignes pointillées imprimées (y=432,
    // 414, 396) : le papier ne pose qu'une question, « Je décris ci-dessous
    // l'activité accessoire exercée ». Les trois champs précédents
    // (« Description », « (suite) », « (suite) ») numérotaient des lignes, pas
    // des questions — même correction que Q16 du C1A. `filler.ts` replie le
    // texte par mots sur les trois cibles et réduit la police sur la dernière
    // en cas de débordement : jamais de perte silencieuse.
    //
    // `id` conservé (celui de l'ex-1re ligne) pour ne pas perdre les
    // brouillons déjà en base ; les deux autres sont purgés par
    // LEGACY_C1C_FIELD_IDS.
    id: "descriptionActivite1",
    pdfFieldName: "",
    lineTargets: [
      "Je décris cidessous lactivité accessoire exercée 1",
      "Je décris cidessous lactivité accessoire exercée 2",
      "Je décris cidessous lactivité accessoire exercée 3",
    ].map((pdfFieldName) => ({ pdfFieldName })),
    type: "textarea",
    required: true,
    label: { fr: "Je décris ci-dessous l'activité accessoire exercée" },
    help: { fr: "Décrivez concrètement en quoi consiste votre activité indépendante." },
    section: SECTION_ACTIVITES,
    order: 10,
  },
  {
    // Cases imprimées : « ☐ non   ☐ oui: www …… » (page 1, y=369). L'ordre des
    // options SUIT les cases — cf. NON_OUI.
    id: "possedeSiteInternet",
    pdfFieldName: "non|oui www",
    type: "radio",
    required: true,
    label: { fr: "Je dispose d'un site internet pour mon activité" },
    options: NON_OUI,
    section: SECTION_ACTIVITES,
    order: 13,
  },
  {
    // La case est écrite par une RÈGLE serveur, pas par ce mapping — d'où le
    // `pdfFieldName` vide (cf. `bindings/per-form/c1c.ts`). Le papier imprime
    // déjà « ☐ oui: www …… » : la règle retire le schéma et le `www.` de tête
    // avant de stamper, sinon la ligne se lirait « www https://www.exemple.be ».
    //
    // Revendiquer la case ICI *en plus* de la règle serait une erreur de
    // publication, et à juste titre : deux sources écriraient la même case et
    // le filler garderait la dernière, en silence (cf. `mapping-report.ts`).
    id: "siteInternetUrl",
    pdfFieldName: "",
    type: "text",
    required: false,
    label: { fr: "Adresse du site internet" },
    // Sans `www.` : c'est ce que le formulaire attend, et le placeholder est
    // le seul endroit qui le montre avant la saisie. Une adresse collée avec
    // son `https://www.` reste acceptée — elle est nettoyée au stamping.
    placeholder: { fr: "exemple.be" },
    visibleIf: { fieldId: "possedeSiteInternet", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 14,
  },
  {
    id: "lieuExerciceActivite",
    pdfFieldName: "à ladresse de mon domicile|à une autre adresse",
    type: "radio",
    required: true,
    label: { fr: "J'exerce mon activité" },
    options: [
      { value: "domicile", label: { fr: "À l'adresse de mon domicile" } },
      { value: "autre", label: { fr: "À une autre adresse" } },
    ],
    section: SECTION_ACTIVITES,
    order: 15,
  },
  {
    // Les widgets `undefined` / `undefined_2` (noms trompeurs : ce ne sont PAS
    // des champs non résolus, c'est le nom que le PDF leur donne) sont les
    // DEUX lignes pointillées de « à une autre adresse …… » : la 1re prolonge
    // le libellé (page 1, y=327,7, x=316 — la case à cocher occupe la gauche),
    // la 2de est pleine largeur en dessous (y=309,7, x=216,7).
    //
    // Un seul champ pour les deux lignes : le papier ne demande qu'UNE adresse.
    // La version précédente inventait un découpage « rue et numéro » / « code
    // postal et commune » qui ne figure nulle part sur le formulaire.
    id: "adresseActiviteLigne1",
    pdfFieldName: "",
    lineTargets: ["undefined", "undefined_2"].map((pdfFieldName) => ({ pdfFieldName })),
    type: "textarea",
    required: false,
    label: { fr: "Adresse où j'exerce mon activité" },
    visibleIf: { fieldId: "lieuExerciceActivite", op: "equals", value: "autre" },
    section: SECTION_ACTIVITES,
    order: 16,
  },

  // ==========================================================================
  // 2. Exercice de mon activité
  // ==========================================================================
  {
    id: "formeExerciceActivite",
    pdfFieldName: "toggle_5|société mandataire administrateur gérant ou associé actif",
    type: "radio",
    required: true,
    label: { fr: "Je souhaite exercer cette activité en tant que" },
    options: [
      { value: "personne-physique", label: { fr: "Personne physique" } },
      {
        value: "societe",
        label: { fr: "Société (mandataire, administrateur, gérant ou associé actif)" },
      },
    ],
    section: SECTION_ACTIVITES,
    order: 20,
  },
  {
    // Guide BCE de la ligne « personne physique » (page 1, y=265,4). C'est le
    // 2e widget du champ AcroForm `Nom de lentreprise` : inutilisable par son
    // nom (il partagerait sa valeur avec les deux autres), donc écriture
    // positionnelle. 1er tiret mesuré à x=398,47 ; dix tirets jusqu'à
    // x=536,38, d'où maxWidth=138.
    id: "numeroBcePersonnePhysique",
    pdfFieldName: "",
    drawAt: { page: 0, x: 398.47, y: 265, size: 9, maxWidth: 138 },
    printAsComb: { ...BCE_COMB, groupExtra: 6.0 },
    type: "bce",
    required: false,
    label: { fr: "Numéro BCE" },
    help: { fr: "Indiquez le numéro BCE, si vous en disposez déjà." },
    placeholder: { fr: "0123.456.789" },
    visibleIf: {
      fieldId: "formeExerciceActivite",
      op: "equals",
      value: "personne-physique",
    },
    section: SECTION_ACTIVITES,
    order: 21,
  },
  {
    // 1er widget du même champ AcroForm à trois widgets → positionnel lui
    // aussi. `drawAt.y` = ligne de base du libellé imprimé « Nom de
    // l'entreprise : » (boîte de police mesurée à 231,65 + 1,91 pt de
    // descendante Arial 9 pt), qui coïncide avec le bord bas du rectangle du
    // widget (233,5). Largeur du rectangle : 319,3 → 551,2.
    id: "nomEntreprise",
    pdfFieldName: "",
    drawAt: { page: 0, x: 319.3, y: 233.5, size: 9, maxWidth: 232 },
    type: "text",
    required: false,
    label: { fr: "Nom de l'entreprise" },
    visibleIf: { fieldId: "formeExerciceActivite", op: "equals", value: "societe" },
    section: SECTION_ACTIVITES,
    order: 22,
  },
  {
    // 3e widget du même champ AcroForm : guide BCE « de l'entreprise »
    // (page 1, y=216,3). 1er tiret mesuré à x=354,31 ; dix tirets jusqu'à
    // x=492,46, d'où maxWidth=138.
    id: "numeroBceEntreprise",
    pdfFieldName: "",
    drawAt: { page: 0, x: 354.31, y: 217, size: 9, maxWidth: 138 },
    printAsComb: { ...BCE_COMB, groupExtra: 6.12 },
    type: "bce",
    required: false,
    label: { fr: "Numéro BCE de l'entreprise" },
    help: { fr: "Indiquez le numéro BCE, si vous en disposez déjà." },
    placeholder: { fr: "0123.456.789" },
    visibleIf: { fieldId: "formeExerciceActivite", op: "equals", value: "societe" },
    section: SECTION_ACTIVITES,
    order: 23,
  },
  {
    // Ligne « Autre : …… » (page 1, y=192 imprimé, widget `fill_10` à
    // y=193,6). Ce champ pointait auparavant sur le widget de la question
    // TIERS, et `numeroBce` pointait ici.
    id: "formeExerciceAutre",
    pdfFieldName: "fill_10",
    type: "text",
    required: false,
    label: { fr: "Autre" },
    help: { fr: "Indiquez ici si, p.ex., vous n'avez pas encore débuté l'activité." },
    section: SECTION_ACTIVITES,
    order: 24,
  },
  {
    // Cases imprimées : « ☐ non   ☐ oui : …… » (page 1, y=147).
    id: "activiteExerceeParTiers",
    pdfFieldName: "non_2|oui",
    type: "radio",
    required: true,
    label: {
      fr: "Une partie de mon activité est exercée par des tiers (travailleurs, sous-traitants, apprentis)",
    },
    help: {
      fr: "Attention : votre demande ne peut pas être acceptée si une partie de votre activité est exercée par des tiers. Si, en cours d'activité, une partie de celle-ci est exercée par des tiers, vous devez le déclarer et l'avantage vous sera retiré.",
    },
    options: NON_OUI,
    section: SECTION_ACTIVITES,
    order: 25,
  },
  {
    // Le widget porte le nom de la question SUIVANTE (« Je dispose des
    // compétences professionnelles spécifiques… », imprimée juste en dessous à
    // y=133) alors qu'il est posé sur la ligne « ☐ oui : …… » de la question
    // TIERS, à la même ordonnée que `non_2` et `oui` (y=148,6). Cas d'école du
    // piège décrit dans PDF_FORMS_RULES.md.
    id: "tiersPrecision",
    pdfFieldName: "Je dispose des compétences professionnelles spécifiques pour exercer mon activité",
    type: "text",
    required: false,
    label: { fr: "Précisez" },
    visibleIf: { fieldId: "activiteExerceeParTiers", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 26,
  },
  {
    id: "competencesProfessionnellesSpecifiques",
    pdfFieldName: "oui_2|non jai besoin dun tiers conjoint aidantfamilial mandataire pour me",
    type: "radio",
    required: true,
    label: { fr: "Je dispose des compétences professionnelles spécifiques pour exercer mon activité" },
    help: {
      fr: "Cochez « oui » si aucune compétence professionnelle spécifique n'est demandée pour votre activité.",
    },
    options: [
      { value: "oui", label: { fr: "Oui" } },
      {
        value: "non",
        label: {
          fr: "Non, j'ai besoin d'un tiers (conjoint, aidant-familial, mandataire,…) pour me permettre d'exercer mon activité",
        },
      },
    ],
    section: SECTION_ACTIVITES,
    order: 27,
  },

  // ==========================================================================
  // Revenus de l'activité indépendante (page 2, avant la section 3)
  // « Les revenus, éventuellement estimés, de mon activité indépendante
  //   s'élèvent à : »
  // ==========================================================================
  {
    id: "revenuBrutAnnuel",
    pdfFieldName: "Texte55",
    type: "number",
    numberFormat: "money",
    required: true,
    label: { fr: "Revenu brut total de l'activité (EUR/an)" },
    help: {
      fr: "Il s'agit du montant total du bénéfice brut, sans déduction des charges, dépenses et pertes professionnelles. Si vous êtes mandataire ou gérant, mentionnez le revenu brut total de l'entreprise. Le montant des revenus doit permettre de calculer le montant provisoire de vos allocations de chômage.",
    },
    section: SECTION_REVENUS,
    order: 30,
  },
  {
    id: "revenuNetImposableAnnuel",
    pdfFieldName: "Texte56",
    type: "number",
    numberFormat: "money",
    required: true,
    label: { fr: "Revenu net imposable de l'indépendant (EUR/an)" },
    help: {
      fr: "Il s'agit du revenu imposable qui sera indiqué sur l'avertissement-extrait de rôle (recettes diminuées des charges, dépenses et pertes professionnelles). Après réception de l'avertissement-extrait de rôle, un calcul définitif sera effectué : celui-ci peut mener à un paiement supplémentaire, à une récupération d'allocations de chômage, ou n'aura pas d'incidence.",
    },
    section: SECTION_REVENUS,
    order: 31,
  },

  // ==========================================================================
  // 3. Informations sur vos éventuelles activités antérieures
  // ==========================================================================
  {
    // Cases imprimées : « ☐ non » (y=481,2) puis « ☐ oui : » (y=467,2).
    id: "activiteIndependanteAnterieure",
    pdfFieldName: "non_3|oui_3",
    type: "radio",
    required: true,
    label: {
      fr: "J'ai exercé une activité indépendante à titre principal au cours des 6 dernières années, calculées de date à date, précédant la date de début de la nouvelle activité",
    },
    options: NON_OUI,
    section: SECTION_ACTIVITES_ANTERIEURES,
    order: 40,
  },
  {
    // Deux lignes pointillées imprimées, une seule question — même traitement
    // que la description d'activité ci-dessus.
    id: "descriptionActivitesAnterieures1",
    pdfFieldName: "",
    lineTargets: [
      "Je décris précisément cidessous chaque activité exercée 1",
      "Je décris précisément cidessous chaque activité exercée 2",
    ].map((pdfFieldName) => ({ pdfFieldName })),
    type: "textarea",
    required: false,
    label: { fr: "Je décris précisément ci-dessous chaque activité exercée" },
    visibleIf: { fieldId: "activiteIndependanteAnterieure", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES_ANTERIEURES,
    order: 41,
  },

  // ==========================================================================
  // Affirmation sur l'honneur (page 2, cadre « Signature »)
  // ==========================================================================
  {
    // VIRTUELLE : le papier n'imprime aucune case à cocher ici, seulement le
    // texte « J'affirme sur l'honneur que la présente déclaration est sincère
    // et complète et je communiquerai toute modification à mon organisme de
    // paiement. » (page 2, y=192 et 181) — c'est la signature qui l'engage.
    // Le widget qui portait ce nom est la 1re ligne des annexes (voir plus
    // bas). Même parti que `affirmationSincerite` du C1A.
    //
    // Les cinq puces « Je déclare que : … » qui précèdent sont reprises en
    // aide : elles sont imprimées sur le formulaire, donc lues et signées.
    id: "affirmationSincereEtComplete",
    pdfFieldName: "",
    type: "checkbox",
    required: true,
    label: {
      fr: "J'affirme sur l'honneur que la présente déclaration est sincère et complète et je communiquerai toute modification à mon organisme de paiement",
    },
    help: {
      fr: "En cochant, vous confirmez aussi les déclarations imprimées sur le formulaire : votre chômage ne trouve pas son origine dans l'arrêt ou la réduction d'un travail comme salarié en vue d'entamer une activité comme indépendant ; vous n'avez pas exercé cette activité accessoire en profession principale durant les 6 dernières années, calculées de date à date ; vous êtes informé que, pendant la période durant laquelle vous bénéficiez de l'avantage, le montant journalier de votre allocation de chômage sera réduit en fonction des revenus de votre activité accessoire ; que vous devez rester inscrit comme demandeur d'emploi et disponible pour le marché de l'emploi ; et que l'avantage peut vous être retiré si votre activité ne présente plus le caractère d'une profession accessoire vu le nombre d'heures ou le montant des revenus.",
    },
    section: SECTION_AFFIRMATIONS,
    order: 100,
  },

  // ==========================================================================
  // Annexes (optionnelles) — TROIS lignes imprimées
  // ==========================================================================
  {
    // 1re ligne = le widget `je communiquerai toute modification à mon
    // organisme de paiement` (page 2, y=168,6, x=314,3 : le libellé « Je joins
    // en annexe(s) : » occupe la gauche de la ligne). Il porte le nom du texte
    // imprimé AU-DESSUS de lui — l'affirmation sur l'honneur —, d'où la
    // confusion de la version précédente. Puis les deux lignes pleine largeur
    // `Je joins en annexes 1` (y=150,6) et `2` (y=132,6).
    id: "annexes",
    pdfFieldName: "",
    lineTargets: [
      "je communiquerai toute modification à mon organisme de paiement",
      "Je joins en annexes 1",
      "Je joins en annexes 2",
    ].map((pdfFieldName) => ({ pdfFieldName })),
    type: "textarea",
    required: false,
    label: { fr: "Je joins en annexe(s)" },
    help: { fr: "Décrivez les documents que vous joignez à cette déclaration, s'il y en a." },
    section: SECTION_ANNEXES,
    order: 200,
  },

  // ==========================================================================
  // Date et signature
  // ==========================================================================
  {
    id: "dateSignature",
    pdfFieldName: "Date57_af_date",
    type: "date",
    required: true,
    label: { fr: "Date de signature" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour." },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 210,
  },
  {
    id: "signature",
    pdfFieldName: "Signature58",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique" },
    help: {
      fr: "Signature « façon Adobe » : vos nom et prénom ainsi que l'horodatage seront appliqués à la position de la signature.",
    },
    section: SECTION_SIGNATURE,
    order: 211,
  },
];

/// Champs d'une version antérieure du schéma qui ont disparu SANS que leur
/// widget soit repris sous le même `id`. `mergeEnrichedFields` écarte déjà un
/// champ en base dont le `pdfFieldName` est couvert par le seed, mais il ne
/// peut pas deviner ceux dont le widget est désormais atteint par
/// `lineTargets` ou par une écriture positionnelle : sans cette liste, ils
/// survivraient à côté des nouveaux et se battraient pour la même case.
const LEGACY_C1C_FIELD_IDS = new Set<string>([
  // Lignes 2 et 3 de « Je décris ci-dessous l'activité accessoire exercée »,
  // désormais des `lineTargets` de `descriptionActivite1`.
  "descriptionActivite2",
  "descriptionActivite3",
  // 2e ligne de « à une autre adresse », désormais `lineTarget` de
  // `adresseActiviteLigne1`.
  "adresseActiviteLigne2",
  // 2e ligne de « Je décris précisément ci-dessous chaque activité exercée ».
  "descriptionActivitesAnterieures2",
  // 2e ligne des annexes (l'ancien `annexesSuite` visait `Je joins en annexes
  // 2`), désormais `lineTarget` de `annexes`.
  "annexesSuite",
  // Ancien champ BCE unique, qui pointait en réalité sur la ligne « Autre »
  // (`fill_10`, repris par `formeExerciceAutre`). Remplacé par les deux vrais
  // n° BCE, en écriture positionnelle.
  "numeroBce",
]);

// ===========================================================================
// PARCOURS À L'ÉCRAN — une question = une étape (patron du C1A)
// ===========================================================================
//
// Le C1C n'a pas d'arbre de renvois imprimé (contrairement au C1A) : il n'y a
// donc pas de `TableRoutage` d'où dériver les groupes. Le rattachement est
// écrit à la main ci-dessous — c'est tenable pour un document de dix
// questions, et ça reste la MÊME grammaire à l'arrivée (`stepGroup` posé sur
// chaque champ, consommé par `buildMacroSteps`).
//
// Découpage par SECTION (le repli par défaut) donnait sept étapes dont une
// « Mes activités » de douze champs : une page interminable, exactement ce que
// PDF_FORMS_RULES déconseille. Une question par étape rend au contraire les
// branches gratuites — `visibleIf` non satisfait ⟹ aucun champ visible ⟹
// aucune étape (cf. `buildMacroSteps`).

/// Étape de l'en-tête d'identité — la seule qui ne soit pas une question.
/// Déclarée ici pour que ce fichier (qui la pose) et `form-presentation.ts`
/// (qui la place en tête) désignent la même chose.
export const C1C_GROUPE_IDENTITE = "identite";

/// Les questions du document, DANS L'ORDRE IMPRIMÉ. Chacune devient une étape
/// et porte l'identifiant du champ qui la pose : ce champ est alors l'ANCRE de
/// son étape (cf. `stepAnchorField`), et c'est sa question qui titre l'étape —
/// aucune clé i18n à écrire, aucun libellé à recopier.
export const C1C_QUESTIONS: readonly string[] = [
  "dateDebutActivite",
  "descriptionActivite1",
  "possedeSiteInternet",
  "lieuExerciceActivite",
  "formeExerciceActivite",
  "activiteExerceeParTiers",
  "competencesProfessionnellesSpecifiques",
  "revenuBrutAnnuel",
  "activiteIndependanteAnterieure",
  "affirmationSincereEtComplete",
];

/// Champs RATTACHÉS à une question : précisions conditionnelles, second
/// montant, annexes et signature. Ils suivent leur question d'étape et ne
/// fabriquent pas d'étape à eux seuls.
const RATTACHEMENTS: Readonly<Record<string, readonly string[]>> = {
  possedeSiteInternet: ["siteInternetUrl"],
  lieuExerciceActivite: ["adresseActiviteLigne1"],
  formeExerciceActivite: [
    "numeroBcePersonnePhysique",
    "nomEntreprise",
    "numeroBceEntreprise",
    "formeExerciceAutre",
  ],
  activiteExerceeParTiers: ["tiersPrecision"],
  // Le papier pose UNE question (« Les revenus … s'élèvent à : ») et ouvre
  // deux lignes. Les deux montants restent donc sur la même étape.
  revenuBrutAnnuel: ["revenuNetImposableAnnuel"],
  activiteIndependanteAnterieure: ["descriptionActivitesAnterieures1"],
  // Dernière étape : on affirme, on liste ses annexes, on date et on signe —
  // le bas du formulaire papier, d'un seul tenant.
  affirmationSincereEtComplete: ["annexes", "dateSignature", "signature"],
};

/// Question à laquelle appartient chaque champ, dérivée des deux tables
/// ci-dessus. Une seule source : ajouter une question sans la rattacher la
/// laisse simplement sans champs — jamais deux listes à tenir d'accord.
function questionParChamp(): Map<string, string> {
  const par = new Map<string, string>();
  for (const question of C1C_QUESTIONS) par.set(question, question);
  for (const [question, rattaches] of Object.entries(RATTACHEMENTS)) {
    for (const id of rattaches) par.set(id, question);
  }
  return par;
}

/// Pose `stepGroup` sur chaque champ. Les champs d'identité tombent dans le
/// groupe d'en-tête ; un champ inconnu des deux tables reste sans groupe et
/// atterrit dans « Autres informations » de la dernière étape — repli visible,
/// jamais une perte.
function appliquerGroupes(fields: PdfFormField[]): PdfFormField[] {
  const parChamp = questionParChamp();
  return fields.map((f) => {
    const groupe =
      parChamp.get(f.id) ?? (f.section === SECTION_IDENTITE ? C1C_GROUPE_IDENTITE : undefined);
    return groupe ? { ...f, stepGroup: groupe } : f;
  });
}

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id`).
///
/// Retire aussi les anciens champs checkbox individuels désormais couverts
/// par les nouveaux champs `radio` fusionnés (paires oui/non), en comparant
/// leur `pdfFieldName` d'origine.
export function applyC1CImprovements(fields: PdfFormField[]): PdfFormField[] {
  return appliquerGroupes(mergeEnrichedFields(fields, C1C_FIELDS, LEGACY_C1C_FIELD_IDS));
}
