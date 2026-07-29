// Schéma enrichi du formulaire C1A — "Déclaration d'aide à un travailleur
// indépendant / déclaration d'une activité accessoire" (mandat politique
// inclus). Formulaire compagnon du C1, déclenché par plusieurs questions du
// C1 (activiteAccessoireOuAide, administrateurSociete,
// independantAccessoireOuPrincipal, mandatPolitique) — cf. C1_TRIGGERS dans
// c1-fields-improvements.ts.
//
// Mapping AcroForm vérifié sur le dump JSON fourni (132 widgets, 2 pages).
// Référence métier : texte imprimé du formulaire officiel ONEM C1A
// (version 01.11.2013/830.10.002).
//
// ⚠ Le PDF a une mise en page à 2 COLONNES par page (gauche = questions
// impaires, droite = questions paires globalement) mais l'ORDRE DES WIDGETS
// AcroForm (utilisé comme `order` dans le dump) suit l'ordre de création du
// formulaire, PAS la position visuelle — comme déjà documenté pour le C1
// principal. On se fie donc au TEXTE + à la déduction logique des groupes de
// widgets consécutifs pour rattacher chaque champ à sa question, en croisant
// avec les numéros "voir N" imprimés.
//
// Structure logique (numéros de question du PDF officiel) :
//   Q1  Aidez-vous un indépendant ?                          oui/non
//   Q2  Données de l'indépendant aidé (nom, n° entreprise,     texte
//       adresse activité, nature de l'activité x5)
//   Q3  Aiderez-vous cet indépendant PENDANT votre chômage ?  oui/non
//   Q4  Quand aiderez-vous cet indépendant ? (grille horaire)  checkboxes
//   Q5  Décrivez l'aide que vous apporterez (x9 lignes)        texte
//   Q6  Combien gagnez-vous pour votre aide ?                  montant
//   Q7  Aidiez-vous déjà cet indépendant dans le passé ?       oui/non
//   Q8  À partir de quelle date ?                               date
//   Q9  Exercez-vous un mandat politique ou une fonction        oui/non
//       de juge/conseiller ?
//   Q10 Quel mandat ou fonction ?                               texte
//   Q11 Quel en est le revenu annuel net imposable ?            2 montants
//   Q12 Exercez-vous une autre activité à titre accessoire ?   oui/non
//   Q13 Exercez-vous cette activité comme salarié ?             oui/non
//   Q14 Données concernant votre employeur                     texte
//   Q15 À quelle adresse exercez-vous cette activité ?          adresse
//   Q16 J'exerce l'activité comme : personne physique /         radio + toggle
//       mandataire·administrateur·gestionnaire + n° entreprise + description
//   Q17 Exercerez-vous cette activité PENDANT votre chômage ?   oui/non
//   Q18 Quand exercerez-vous cette activité ? (grille horaire)  checkboxes
//   Q19 Quel est le revenu net de votre activité ?               montants
//   Q20 Exerciez-vous déjà cette activité dans le passé ?       oui/non
//   Q21 Depuis quand ?                                           date
//   Q22 Quels jours occupé chez l'employeur (chômeur temp.)     checkboxes
//   Q23 Indépendant à titre principal ?                         radio spécial
//   Q24 Affirmation finale + annexes + signature
//
// ----- Zone d'ambiguïté documentée -----
// Les 4 paires oui_3/non_3, oui_4/non_4, oui_5/non_5, oui_6/non_6 (ordre
// 54-61 du dump) précèdent immédiatement le widget "14 Données concernant
// votre employeur" (ordre 62 = Q14). En comptant les questions oui/non
// restant à placer avant Q14 (Q7, Q9, Q12, Q13, dans cet ordre de lecture du
// texte), on les rattache dans l'ordre : oui_3/non_3→Q7, oui_4/non_4→Q9,
// oui_5/non_5→Q12, oui_6/non_6→Q13. Cohérent avec la suite (oui_7/non_8→Q17,
// oui_8/non_9→Q20, oui_et_je_sais.../non_10→Q23) où la numérotation des
// widgets ne saute JAMAIS un numéro sans une raison identifiable (non_7 est
// "consommé" par le toggle numéro d'entreprise de Q16).

import type { PdfFormField, VisibleIf } from "../types";
import { compilerRoutage } from "../routing";
import { mergeEnrichedFields } from "./_merge";
import { C1A_DEPART, C1A_ROUTAGE } from "./c1a-routing";

const SECTION_IDENTITE = "identite";
const SECTION_ADRESSE = "adresse";
const SECTION_EMPLOYEUR = "employeur";
const SECTION_ACTIVITES = "mes-activites";
const SECTION_REVENUS = "mes-revenus";
const SECTION_AFFIRMATIONS = "affirmations";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";
/// Réutilise la section partagée "divers" (section-labels.ts) pour le champ
/// non rattaché avec certitude à une question (cf. A VALIDER Oraliks en fin
/// de fichier).
const SECTION_DIVERS_INCONNU = "divers";

/// Section dédiée à la partie "aide à un indépendant" (Q1-Q11) — distincte
/// de "mes-activites" (réutilisée pour Q12-Q23, qui décrit une activité
/// accessoire propre au déclarant, pas une aide à un tiers).
const SECTION_AIDE_INDEPENDANT = "aide-independant";

const YN = [
  { value: "oui", label: { fr: "Oui" } },
  { value: "non", label: { fr: "Non" } },
];

/// Grille horaire répétée 2 fois sur le PDF (Q4 "quand aiderez-vous
/// l'indépendant" et Q18 "quand exercerez-vous cette activité"). Structure
/// identique : lundi à vendredi (chacun x avant 7h / entre 7h et 18h /
/// après 18h), puis samedi et dimanche (sans horaire), puis un choix parmi
/// "toute l'année" / "pendant les périodes suivantes" (texte libre
/// multi-lignes) / "irrégulièrement, à savoir" (texte libre).
//
// La grille reproduit celle du formulaire papier : les sept jours et leurs
// créneaux sont visibles d'emblée, sans dévoilement progressif (décision
// Oraliks 2026-07-28). Les créneaux gardent en revanche la condition de branche
// posée par `appliquerRoutage` sur leur question d'entrée — Q3 ou Q17.
function grilleHoraire(opts: {
  idPrefix: string;
  questionLabel: string;
  parentId: string;
  parentValue: string;
  section: string;
  order: number;
  // Suffixes exacts des pdfFieldName pour cette occurrence de la grille.
  suffixes: {
    lundi: string; mardi: string; mercredi: string; jeudi: string; vendredi: string;
    samedi: string; dimanche: string;
    avant7h: string[]; // 5 valeurs, lundi→vendredi
    entre7h18h: string[]; // 5 valeurs, lundi→vendredi
    apres18h: string[]; // 5 valeurs, lundi→vendredi
    touteLannee: string;
    pendantPeriodes: string;
    irregulierement: string;
  };
  // Champs texte libres pour "pendant les périodes" et "irrégulièrement".
  // Fournis dans l'ordre d'apparition sur le PDF (pdfFieldName exacts). Un
  // élément peut aussi être un objet `{ pdfFieldName: "", drawAt }` quand la
  // case AcroForm ne peut pas être revendiquée (widget partagé avec une autre
  // case du PDF) — cf. Q18 ci-dessous, seul appelant à en avoir besoin ; Q4
  // continue de fournir de simples chaînes, la fabrique n'est pas dénaturée.
  periodesTextFields: Array<string | { pdfFieldName: string; drawAt?: PdfFormField["drawAt"] }>;
  irregulierementTextFields: string[];
}): PdfFormField[] {
  const { suffixes } = opts;
  const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"] as const;
  const fields: PdfFormField[] = [];

  // Numérotation DENSE. La grille est une seule rubrique du document : elle
  // doit occuper un bloc d'`order` contigu, sinon les questions voisines
  // s'intercalent entre ses lignes. Avec des sauts de 10, Q4 (base 10)
  // s'étalait sur 10→93 et encastrait les neuf lignes de description de Q5
  // (46→54) au milieu de la semaine — le citoyen voyait lundi à jeudi, la
  // description, vendredi, puis samedi vingt champs plus loin.
  //
  // Le compteur suit l'ordre de poussée, qui est déjà celui du document.
  let rang = 0;
  const ordre = () => opts.order + rang++;

  jours.forEach((jour, i) => {
    fields.push({
      id: `${opts.idPrefix}${jour}`,
      // `required` reste `false` (Commit 3, décision Oraliks) : aucun jour
      // précis du calendrier n'a de raison objective d'être obligatoire — un
      // citoyen peut légitimement n'aider/travailler que le mercredi. La
      // « donnée principale » exigible de cette rubrique est posée sur
      // `${idPrefix}periode` (toute l'année / périodes / irrégulier)
      // ci-dessous, pas sur un jour précis. `requiredGroup` ("au moins un
      // jour coché") est explicitement écarté : il bascule le rendu de la
      // section entière sur `MotifSituationPicker`, qui remplacerait le
      // calendrier par une liste de chips (cf. pdf-form-runner.tsx).
      pdfFieldName: suffixes[jour],
      type: "checkbox",
      required: false,
      label: { fr: jour.charAt(0).toUpperCase() + jour.slice(1) },
      visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
      section: opts.section,
      order: ordre(),
    });
    fields.push({
      id: `${opts.idPrefix}${jour}Avant7h`,
      pdfFieldName: suffixes.avant7h[i],
      type: "checkbox",
      required: false,
      label: { fr: "Avant 7 h" },
      section: opts.section,
      order: ordre(),
    });
    fields.push({
      id: `${opts.idPrefix}${jour}Entre7h18h`,
      pdfFieldName: suffixes.entre7h18h[i],
      type: "checkbox",
      required: false,
      label: { fr: "Entre 7 h et 18 h" },
      section: opts.section,
      order: ordre(),
    });
    fields.push({
      id: `${opts.idPrefix}${jour}Apres18h`,
      pdfFieldName: suffixes.apres18h[i],
      type: "checkbox",
      required: false,
      label: { fr: "Après 18 h" },
      section: opts.section,
      order: ordre(),
    });
  });

  fields.push({
    id: `${opts.idPrefix}samedi`,
    pdfFieldName: suffixes.samedi,
    type: "checkbox",
    required: false,
    label: { fr: "Samedi" },
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: ordre(),
  });
  fields.push({
    id: `${opts.idPrefix}dimanche`,
    pdfFieldName: suffixes.dimanche,
    type: "checkbox",
    required: false,
    label: { fr: "Dimanche" },
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: ordre(),
  });

  fields.push({
    id: `${opts.idPrefix}periode`,
    pdfFieldName: `${suffixes.touteLannee}|${suffixes.pendantPeriodes}|${suffixes.irregulierement}`,
    type: "radio",
    // Required (Commit 3) : c'est la « donnée principale » de la rubrique
    // grille horaire, posée ICI plutôt que sur l'ancre C1A_ROUTAGE
    // (`${idPrefix}lundi`) — cocher une case précise du calendrier (lundi,
    // mardi…) n'a jamais de raison objective d'être obligatoire (un citoyen
    // peut légitimement n'aider que le mercredi). La fréquence globale
    // (toute l'année / périodes / irrégulier), elle, est bien LA question
    // que Q4/Q18 posent sur le papier.
    required: true,
    label: { fr: opts.questionLabel },
    help: {
      fr: "Choisis la fréquence qui correspond le mieux : toute l'année, seulement certaines périodes (précise-les), ou de façon irrégulière (précise aussi).",
    },
    options: [
      { value: "toute-annee", label: { fr: "Toute l'année" } },
      { value: "periodes", label: { fr: "Pendant les périodes suivantes de l'année" } },
      { value: "irregulier", label: { fr: "Irrégulièrement, à savoir" } },
    ],
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: ordre(),
  });

  opts.periodesTextFields.forEach((entree, i) => {
    const { pdfFieldName, drawAt } =
      typeof entree === "string" ? { pdfFieldName: entree, drawAt: undefined } : entree;
    fields.push({
      id: `${opts.idPrefix}periodesTexte${i + 1}`,
      pdfFieldName,
      ...(drawAt ? { drawAt } : {}),
      type: "text",
      required: false,
      label: { fr: `Période ${i + 1}` },
      visibleIf: { fieldId: `${opts.idPrefix}periode`, op: "equals", value: "periodes" },
      section: opts.section,
      order: ordre(),
    });
  });

  opts.irregulierementTextFields.forEach((pdfFieldName, i) => {
    fields.push({
      id: `${opts.idPrefix}irregulierementTexte${i + 1}`,
      pdfFieldName,
      type: "text",
      required: false,
      label: { fr: i === 0 ? "Précise à quel rythme" : `Précision ${i + 1}` },
      visibleIf: { fieldId: `${opts.idPrefix}periode`, op: "equals", value: "irregulier" },
      section: opts.section,
      order: ordre(),
    });
  });

  return fields;
}

export const C1A_FIELDS: PdfFormField[] = [
  // ====================================================================
  // IDENTITÉ DU DÉCLARANT (le chômeur qui remplit le formulaire)
  // ====================================================================
  {
    // `fullname` plutôt que `text` (2026-07-26) : deux cases à l'écran
    // (prénom / nom), une seule chaîne sur le PDF, assemblée par le filler
    // dans l'ordre imposé par le libellé imprimé (« Nom et prénom »).
    //
    // C'est ce qui rend la reprise depuis le C1 AUTOMATIQUE : `extract.ts`
    // remplit tout champ `fullname` à partir de `identity.prenom` +
    // `identity.nom`, sans qu'il ait besoin de porter une clé canonique.
    // Avant, le champ était un simple texte préremplí par `profile.lastName` :
    // il recevait le NOM SEUL et paraissait rempli — le prénom disparaissait
    // sans que rien ne le signale.
    id: "nomEtPrenom",
    pdfFieldName: "Nom et prénom",
    type: "fullname",
    nameOrder: "last-first",
    required: true,
    label: { fr: "Nom et prénom" },
    section: SECTION_IDENTITE,
    order: -99,
  },
  {
    id: "niss",
    pdfFieldName: "NISS",
    type: "niss",
    required: true,
    label: { fr: "Numéro NISS (registre national)" },
    help: {
      fr: "11 chiffres au dos de ta carte d'identité (eID), au-dessus du code-barres. Le formulaire le rappelle : « voir coin supérieur droit de ta carte SIS ».",
    },
    placeholder: { fr: "00.00.00-000.00" },
    prefillFrom: "profile.niss",
    canonicalKey: "identity.niss",
    section: SECTION_IDENTITE,
    // -100 et non -99 : sur la page 1, la case NISS (y=573) est imprimée
    // AU-DESSUS de la case Nom et prénom (y=534). L'ordre suit celui du
    // document, où le NISS précède le nom.
    order: -100,
  },
  // ADRESSE — deux widgets du PDF fusionnent chacun DEUX informations
  // (« rue + numéro », « code postal + commune »). On saisit donc les quatre
  // valeurs séparément, chacune avec sa clé canonique, et deux règles serveur
  // recomposent les widgets (`bindings/per-form/c1a.ts`). C'est le pattern
  // déjà utilisé par le C1 pour son widget « CodePostal et Commune ».
  //
  // Sans cette séparation (état avant le 2026-07-26), un `prefillFrom` sur le
  // champ fusionné ne pouvait ramener QU'UNE des deux valeurs : la rue sans le
  // numéro, le code postal sans la commune. Le champ paraissait rempli et
  // partait incomplet à l'ONEM.
  {
    id: "rue",
    pdfFieldName: "",
    type: "text",
    required: true,
    label: { fr: "Rue" },
    prefillFrom: "profile.street",
    canonicalKey: "adresse.rue",
    section: SECTION_IDENTITE,
    order: -98,
  },
  {
    id: "numero",
    pdfFieldName: "",
    type: "text",
    required: true,
    label: { fr: "Numéro" },
    canonicalKey: "adresse.numero",
    section: SECTION_IDENTITE,
    order: -97.5,
  },
  {
    id: "codePostal",
    pdfFieldName: "",
    type: "postal_be",
    required: true,
    label: { fr: "Code postal" },
    prefillFrom: "profile.postalCode",
    canonicalKey: "adresse.codePostal",
    section: SECTION_IDENTITE,
    order: -97,
  },
  {
    id: "commune",
    pdfFieldName: "",
    type: "text",
    required: true,
    label: { fr: "Commune" },
    prefillFrom: "profile.city",
    canonicalKey: "adresse.commune",
    section: SECTION_IDENTITE,
    order: -96.5,
  },

  // ====================================================================
  // Q1 — AIDEZ-VOUS UN INDÉPENDANT ?
  // ====================================================================
  {
    id: "aideIndependant",
    pdfFieldName: "oui|non",
    type: "radio",
    required: true,
    label: {
      fr: "1. Aidez-vous un indépendant (par ex. dans son activité même, administration, comptabilité, permanence téléphonique…) ?",
    },
    labelShort: { fr: "Aidez-vous un indépendant ?" },
    help: {
      fr: "Par exemple dans son activité même, l'administration, la comptabilité, une permanence téléphonique… Si tu aides plus d'un indépendant, complète un formulaire C1A pour chacun.",
    },
    options: YN,
    section: SECTION_AIDE_INDEPENDANT,
    order: 0,
  },

  // ====================================================================
  // Q2 — DONNÉES DE L'INDÉPENDANT AIDÉ
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, donnée principale de Q2 — chemin
    // unique (aideIndependant=oui), pas de branche alternative à discriminer.
    id: "independantNom",
    pdfFieldName: "Nom",
    type: "text",
    required: true,
    label: { fr: "2. Nom de l'indépendant que tu aides" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 1,
  },
  {
    // Le n° d'entreprise de l'indépendant aidé n'avait aucun champ : la case
    // (p1, y=342, sous son nom) est le premier widget de `TVA`, capté par Q16.
    // `TVA` couvrant les DEUX cases avec une seule valeur, écriture
    // positionnelle ici aussi — cf. le commentaire de `numeroEntreprise`.
    id: "independantNumeroEntreprise",
    pdfFieldName: "",
    drawAt: { page: 0, x: 115, y: 338, size: 9, maxWidth: 134 },
    type: "bce",
    required: false,
    label: { fr: "Numéro d'entreprise de l'indépendant que tu aides" },
    help: {
      fr: "Numéro à la Banque-Carrefour des Entreprises, au format 0123.456.789.",
    },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 2,
  },
  {
    // `Adresse de lactivité indépendante` est posé sur la ligne « rue numéro »
    // (widget y=308, ligne y=315) : c'est une case de saisie, pas un libellé —
    // d'où le renommage de l'identifiant. Ancien id : `adresseActiviteIndependanteLabel`
    // (cf. LEGACY_C1A_FIELD_IDS, même widget).
    id: "independantAdresseRueNumero",
    pdfFieldName: "Adresse de lactivité indépendante",
    type: "text",
    required: false,
    label: { fr: "Adresse de l'activité indépendante — rue et numéro" },
    help: { fr: "Rue et numéro où l'indépendant exerce son activité." },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 3,
  },
  {
    // `rue_2` est la ligne SUIVANTE (y=284), celle du code postal et de la
    // commune — pas une suite de la rue. Ancien id : `independantAdresseRue`
    // (cf. LEGACY_C1A_FIELD_IDS, même widget).
    id: "independantAdresseCodePostalCommune",
    pdfFieldName: "rue_2",
    type: "text",
    required: false,
    label: { fr: "Code postal et commune de l'activité indépendante" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 4,
  },
  {
    // Consolidé en UN champ répétable (Commit 2, retour Oraliks 2026-07-29 :
    // « mets une seule nature, description, et ajoute un + explicite pour
    // ajouter d'autres natures »). Les 5 lignes fixes affichées d'un coup
    // étaient presque toujours vides à l'écran. Le PDF n'offre que 5 lignes
    // imprimées ("mentionnez les toutes 1" à "5", cf. `pdfFieldNameTemplate`
    // ci-dessous) : `maxRows` empêche d'en saisir une 6e qui ne
    // s'imprimerait nulle part.
    id: "natureActiviteIndependant",
    pdfFieldName: "",
    type: "array",
    required: false,
    label: { fr: "Nature de l'activité de l'indépendant" },
    help: {
      fr: "Si l'indépendant exerce plusieurs activités, ajoute une ligne par activité.",
    },
    addRowLabel: { fr: "Ajouter une autre nature d'activité" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 5,
    maxRows: 5,
    itemFields: [
      {
        id: "nature",
        pdfFieldName: "",
        type: "text",
        required: true,
        label: { fr: "Nature de l'activité" },
        pdfFieldNameTemplate: "mentionnez les toutes {index}",
        order: 1,
      },
    ],
  },

  // ====================================================================
  // Q3 — AIDERAS-TU CET INDÉPENDANT PENDANT TON CHÔMAGE ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (aideIndependant=oui) —
    // tranche si la grille horaire Q4 et la suite de la rubrique s'appliquent.
    id: "aideraPendantChomage",
    pdfFieldName: "oui_2|non_2",
    type: "radio",
    required: true,
    label: { fr: "3. Aiderez-vous cet indépendant pendant votre chômage ?" },
    labelShort: { fr: "Pendant votre chômage ?" },
    help: {
      fr: "Réponds également « oui » si, durant des périodes de chômage temporaire, tu aides cet indépendant (à partir du premier jour de chômage du mois concerné jusqu'à la fin du mois). Tu es chômeur temporaire si tu es toujours au service de ton employeur mais que temporairement tu ne travailles pas, par exemple en raison d'un manque de travail ou d'intempéries.",
    },
    options: YN,
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    // 9.5 : reste strictement entre le bloc Q2 (jusqu'à l'order 5, le champ
    // array `natureActiviteIndependant` depuis le Commit 2) et la grille Q4
    // (order 10). Fractionnaire pour ne pas renuméroter toute la suite du
    // fichier (même convention que `numero`/`commune` en tête de fichier).
    order: 9.5,
  },

  // ====================================================================
  // Q4 — QUAND AIDERAS-TU CET INDÉPENDANT ? (grille horaire n°1)
  // ====================================================================
  ...grilleHoraire({
    idPrefix: "q4",
    questionLabel: "4. Quand aiderez-vous cet indépendant ?",
    parentId: "aideraPendantChomage",
    parentValue: "oui",
    section: SECTION_AIDE_INDEPENDANT,
    order: 10,
    suffixes: {
      lundi: "lundi", mardi: "mardi", mercredi: "mercredi", jeudi: "jeudi", vendredi: "vendredi",
      samedi: "samedi", dimanche: "dimanche",
      avant7h: ["avant 7 h", "avant 7 h_2", "avant 7 h_3", "avant 7 h_4", "avant 7 h_5"],
      entre7h18h: ["entre 7 h et 18 h", "entre 7 h et 18 h_2", "entre 7 h et 18 h_3", "entre 7 h et 18 h_4", "entre 7 h et 18 h_5"],
      apres18h: ["après 18 h", "après 18 h_2", "après 18 h_3", "après 18 h_4", "après 18 h_5"],
      touteLannee: "toute lannée",
      pendantPeriodes: "pendant les périodes suivantes de lannée",
      irregulierement: "irrégulièrement à savoir",
    },
    // Géométrie réelle mesurée sur private/pdfs/C1A_FR.pdf (page 1, colonne
    // de droite, widgets bruts) :
    //   y=633 case "pendant les périodes suivantes de l'année"
    //   y=621 "1"   y=607 "2"   y=594 "3"   y=581 "4"        (4 lignes)
    //   y=568 case "irrégulièrement à savoir"   y=568 "undefined" (x=432)
    //   y=555 "1_2" y=542 "2_2" y=529 "3_2" y=516 "4_2"      (4 lignes)
    // Le widget "undefined" est à la MÊME hauteur que la case
    // "irrégulièrement" : c'est la fin de la ligne imprimée
    // « irrégulièrement, à savoir : ...... », pas une 5e ligne de
    // "périodes". L'ancienne répartition (5 lignes périodes / 4 lignes
    // irrégulier) décalait donc tout le bloc "irrégulier" d'une ligne :
    // qui cochait "irrégulièrement" et décrivait son rythme voyait la ligne
    // imprimée partir blanche, et qui remplissait les 5 lignes "périodes"
    // déclarait un rythme irrégulier jamais coché — une déclaration ONEM
    // fausse dans les deux cas.
    periodesTextFields: ["1", "2", "3", "4"],
    irregulierementTextFields: ["undefined", "1_2", "2_2", "3_2", "4_2"],
  }),

  // ====================================================================
  // Q5 — DÉCRIVEZ L'AIDE QUE VOUS APPORTEREZ
  // ====================================================================
  {
    // Consolidé en UN champ répétable (Commit 2, même retour Oraliks que Q2
    // ci-dessus — traitement identique explicitement demandé). Neuf lignes
    // vides affichées d'un coup devenaient huit champs presque toujours
    // vides. `maxRows: 9` : le PDF n'offre que 9 lignes imprimées
    // ("Décrivez laide que vous apporterez 1" à "9").
    //
    // id conservé à `descriptionAide1` : c'est l'ANCRE de Q5 dans
    // C1A_ROUTAGE (cf. c1a-routing.ts), sa condition est remplacée par
    // `appliquerRoutage` plus bas — même convention que
    // `revenuNetSalarieParMois`, ancre de Q19.
    //
    // `required` reste `false` ici malgré la règle du Commit 3 (toutes les
    // clés de C1A_ROUTAGE deviennent `required`) : `buildValidator` neutre
    // délibérément `required` pour `type: "array"` (lib/pdf-forms/validation.ts,
    // "un tableau vide ne doit pas bloquer"), et le compteur du stepper
    // (`isFieldComplete`) ne sait pas non plus lire une valeur `array` — un
    // champ array `required` afficherait donc l'étape bloquée sur
    // « 1 restant » EN PERMANENCE, même rempli. Le poser à `true` serait
    // cosmétique et trompeur sans toucher à validation.ts (hors périmètre :
    // un autre agent y travaille). Signalé au rapport du lot.
    id: "descriptionAide1",
    pdfFieldName: "",
    type: "array",
    required: false,
    label: { fr: "5. Décrivez l'aide que vous apporterez" },
    addRowLabel: { fr: "Ajouter une autre ligne de description" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 46,
    maxRows: 9,
    itemFields: [
      {
        id: "description",
        pdfFieldName: "",
        type: "text",
        required: true,
        label: { fr: "Description de l'aide" },
        pdfFieldNameTemplate: "Décrivez laide que vous apporterez {index}",
        order: 1,
      },
    ],
  },

  // ====================================================================
  // Q6 — COMBIEN GAGNEZ-VOUS POUR VOTRE AIDE ?
  // ====================================================================
  {
    // Q6 attend un montant « par mois » OU « par an » sur une même ligne
    // pointillée. Le widget `Montant` couvre cette ligne ET les deux montants
    // de Q11 en page 2, avec une seule valeur partagée — donc inexploitable.
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (aideraPendantChomage=oui)
    // — le choix mois/an est LA question de Q6. Le montant lui-même
    // (montantAide/montantAideAnnuel) reste facultatif : rattachement, pas
    // une clé de l'arbre, et une aide peut être non chiffrée au moment de la
    // déclaration.
    id: "montantAidePeriodicite",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "6. Ce montant est :" },
    options: [
      { value: "mois", label: { fr: "Par mois" } },
      { value: "an", label: { fr: "Par an" } },
    ],
    visibleIf: { fieldId: "aideraPendantChomage", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 54.5,
  },
  {
    id: "montantAide",
    pdfFieldName: "",
    // Moitié gauche de la ligne pointillée (y=315), au-dessus de « par mois ».
    drawAt: { page: 0, x: 322, y: 311, size: 9, maxWidth: 110 },
    type: "number",
    required: false,
    label: { fr: "Combien gagnes-tu pour ton aide ? (EUR)" },
    help: {
      fr: "Ou à combien s'élève la valeur de ton aide. Joins une copie de la plus récente note de calcul de l'administration des contributions directes.",
    },
    visibleIf: { fieldId: "montantAidePeriodicite", op: "equals", value: "mois" },
    section: SECTION_REVENUS,
    order: 55,
  },
  {
    id: "montantAideAnnuel",
    pdfFieldName: "",
    // Moitié droite de la même ligne, avant la légende « par an » (x=503).
    drawAt: { page: 0, x: 440, y: 311, size: 9, maxWidth: 58 },
    type: "number",
    required: false,
    label: { fr: "Combien gagnes-tu pour ton aide ? (EUR)" },
    help: {
      fr: "Ou à combien s'élève la valeur de ton aide. Joins une copie de la plus récente note de calcul de l'administration des contributions directes.",
    },
    visibleIf: { fieldId: "montantAidePeriodicite", op: "equals", value: "an" },
    section: SECTION_REVENUS,
    order: 55.5,
  },

  // ====================================================================
  // Q7 — AIDIEZ-VOUS DÉJÀ CET INDÉPENDANT DANS LE PASSÉ ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (aideIndependant=oui).
    id: "aidaitDejaIndependant",
    pdfFieldName: "oui_3|non_3",
    type: "radio",
    required: true,
    label: { fr: "7. Aidiez-vous déjà cet indépendant dans le passé ?" },
    options: YN,
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 56,
  },

  // ====================================================================
  // Q8 — À PARTIR DE QUELLE DATE ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, donnée principale de Q8, visible
    // seulement si Q7 (aidaitDejaIndependant) = oui.
    id: "dateDebutAide",
    pdfFieldName: "Date41_af_date",
    type: "date",
    required: true,
    label: { fr: "8. À partir de quelle date aidiez-vous déjà cet indépendant ?" },
    visibleIf: { fieldId: "aidaitDejaIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 57,
  },

  // ====================================================================
  // Q9 — MANDAT POLITIQUE OU FONCTION DE JUGE/CONSEILLER
  // ====================================================================
  {
    id: "mandatPolitiqueOuJuge",
    pdfFieldName: "oui_4|non_4",
    type: "radio",
    required: true,
    label: {
      fr: "9. Exercez-vous un mandat politique ou une fonction de juge ou de conseiller ?",
    },
    labelShort: { fr: "Mandat politique ou fonction de juge ?" },
    help: {
      fr: "Si tu es conseiller communal, conseiller provincial, membre d'un C.P.A.S., juge social, juge consulaire ou conseiller social, réponds « non ».",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 58,
  },

  // ====================================================================
  // Q10/Q11 — MANDAT/FONCTION + REVENU ANNUEL NET IMPOSABLE
  // ====================================================================
  {
    // Q10 et Q11 n'ont AUCUN widget AcroForm (vérifié : rien en page 2, colonne
    // de gauche, entre y=690 et y=800). Écriture positionnelle sur les lignes
    // imprimées : Q10 occupe trois lignes entre y=779 et y=743, Q11 deux lignes
    // « EUR … EUR » à y=714 et y=702.
    id: "mandatDescription",
    pdfFieldName: "",
    drawAt: { page: 1, x: 50, y: 766, size: 9, maxWidth: 236 },
    type: "text",
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (mandatPolitiqueOuJuge=oui).
    required: true,
    label: { fr: "10. Quel mandat ou quelle fonction ?" },
    help: {
      fr: "Si tu exerces plus d'un mandat ou as plus d'une fonction, mentionne-les tous.",
    },
    visibleIf: { fieldId: "mandatPolitiqueOuJuge", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 59,
  },
  {
    // Q11 imprime deux lignes de montant, matérialisées par les 2ᵉ et 3ᵉ
    // widgets du champ `Montant` — dont le 1ᵉʳ est le montant de Q6, en page 1.
    // Une seule valeur pour les trois : écriture positionnelle obligatoire.
    id: "revenuAnnuelMandat",
    pdfFieldName: "",
    drawAt: { page: 1, x: 69, y: 703, size: 9, maxWidth: 62 },
    type: "number",
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (mandatPolitiqueOuJuge=oui) —
    // 1er montant de Q11. Le second (revenuAnnuelMandat2, cas d'un 2e mandat)
    // reste facultatif : rattachement, pas une clé de l'arbre.
    required: true,
    label: { fr: "11. Revenu annuel net imposable de ce mandat (EUR)" },
    help: {
      fr: "Joins une copie de la plus récente note de calcul de l'administration des contributions directes.",
    },
    visibleIf: { fieldId: "mandatPolitiqueOuJuge", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 60,
  },
  {
    // A VALIDER Oraliks : la seconde ligne de Q11. Le formulaire prévoit deux
    // montants sans préciser à l'impression ce qui les distingue — un second
    // mandat, ou une seconde composante du même revenu.
    id: "revenuAnnuelMandat2",
    pdfFieldName: "",
    drawAt: { page: 1, x: 69, y: 691, size: 9, maxWidth: 62 },
    type: "number",
    required: false,
    label: { fr: "Second montant, si tu exerces plus d'un mandat (EUR)" },
    visibleIf: { fieldId: "mandatPolitiqueOuJuge", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 60.5,
  },

  // ====================================================================
  // Q12 — EXERCEZ-VOUS UNE AUTRE ACTIVITÉ À TITRE ACCESSOIRE ?
  // ====================================================================
  {
    id: "autreActiviteAccessoire",
    pdfFieldName: "oui_5|non_5",
    type: "radio",
    required: true,
    label: { fr: "12. Exercez-vous une autre activité à titre accessoire ?" },
    labelShort: { fr: "Autre activité accessoire ?" },
    help: {
      fr: "Réponds toujours « oui » si tu es inscrit comme indépendant à titre accessoire ou si tu es administrateur de société. Complète un formulaire C1A pour chaque activité que tu exerces.",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 61,
  },

  // ====================================================================
  // Q13 — EXERCEZ-VOUS CETTE ACTIVITÉ COMME SALARIÉ ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (autreActiviteAccessoire=oui).
    id: "activiteCommeSalarie",
    pdfFieldName: "oui_6|non_6",
    type: "radio",
    required: true,
    label: { fr: "13. Exercez-vous cette activité comme salarié ?" },
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 62,
  },

  // ====================================================================
  // Q14 — DONNÉES CONCERNANT VOTRE EMPLOYEUR
  // ====================================================================
  {
    // Le widget porte le nom du TITRE imprimé au-dessus de lui ("14. Données
    // concernant votre employeur"), mais il est posé sur la 1ʳᵉ ligne de
    // saisie — celle légendée « nom » juste en dessous (widget y=500, ligne
    // imprimée y=507, légende y=498). C'est bien la case du NOM.
    //
    // Un commentaire antérieur le tenait pour un intitulé de zone et le
    // laissait non référencé : la ligne du nom partait donc vide à l'ONEM.
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (activiteCommeSalarie=oui),
    // donnée principale de Q14. L'adresse employeur (employeurAdresse) reste
    // facultative : rattachement, pas une clé de l'arbre.
    id: "employeurNom",
    pdfFieldName: "14 Données concernant votre employeur",
    type: "text",
    required: true,
    label: { fr: "14. Nom de votre employeur" },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_EMPLOYEUR,
    order: 63,
  },
  {
    // Même décalage : le widget nommé « Nom employeur » est posé sur la 2ᵉ
    // ligne, légendée « adresse » (widget y=477, ligne imprimée y=484).
    id: "employeurAdresse",
    pdfFieldName: "Nom employeur",
    type: "text",
    required: false,
    label: { fr: "Adresse de votre employeur" },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_EMPLOYEUR,
    order: 64,
  },

  // ====================================================================
  // Q15 — À QUELLE ADRESSE EXERCEZ-VOUS CETTE ACTIVITÉ ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (autreActiviteAccessoire=oui,
    // atteint que Q13 réponde oui ou non), donnée principale de Q15.
    id: "adresseActivite",
    pdfFieldName: "A quelle adresse exercezvous cette activité",
    type: "text",
    required: true,
    label: { fr: "15. À quelle adresse exercez-vous cette activité ? — rue et numéro" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 65,
  },
  {
    // `rue_3` est la 2ᵉ ligne de Q15, légendée « code postal commune »
    // (widget y=398, ligne imprimée y=405). Elle était affectée à l'adresse de
    // l'employeur (Q14), et ce champ-ci écrivait dans `undefined_2`, qui est en
    // réalité la 1ʳᵉ ligne de description d'activité de Q16. Ancien id :
    // `adresseActiviteNumero` (cf. LEGACY_C1A_FIELD_IDS, widget aussi corrigé).
    id: "adresseActiviteCodePostalCommune",
    pdfFieldName: "rue_3",
    type: "text",
    required: false,
    label: { fr: "Code postal et commune (activité accessoire)" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 66,
  },

  // ====================================================================
  // Q16 — J'EXERCE L'ACTIVITÉ COMME... + NUMÉRO D'ENTREPRISE
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (autreActiviteAccessoire=oui).
    id: "formeActivite",
    pdfFieldName: "personne phys|mandataire administrateur ou gestionnaire",
    type: "radio",
    required: true,
    label: { fr: "16. J'exerce l'activité comme :" },
    options: [
      { value: "personne-physique", label: { fr: "Personne physique" } },
      { value: "mandataire", label: { fr: "Mandataire, administrateur ou gestionnaire" } },
    ],
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 67,
  },
  {
    id: "disposeNumeroEntreprise",
    pdfFieldName: "toggle_8|non_7",
    type: "radio",
    required: false,
    label: { fr: "Je dispose d'un numéro d'entreprise :" },
    options: YN,
    visibleIf: { fieldId: "formeActivite", op: "equals", value: "mandataire" },
    section: SECTION_ACTIVITES,
    order: 68,
  },
  {
    // Le champ `TVA` porte DEUX widgets : la case n° d'entreprise de Q2 (p1,
    // y=342, celle de l'indépendant aidé) et celle de Q16 (p2, y=302, celle de
    // l'activité). Ils partagent une seule valeur — écrire dans l'un remplit
    // l'autre. Ce champ écrivait donc le n° de l'activité DANS LES DEUX cases,
    // y compris celle de l'indépendant qu'on aide.
    //
    // Aucune réattribution ne peut résoudre ça : les deux questions passent en
    // écriture positionnelle et `TVA` reste non revendiqué.
    id: "numeroEntreprise",
    pdfFieldName: "",
    drawAt: { page: 1, x: 119, y: 298, size: 9, maxWidth: 155 },
    type: "bce",
    required: false,
    label: { fr: "Numéro d'entreprise (BCE)" },
    visibleIf: { fieldId: "disposeNumeroEntreprise", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 69,
  },
  {
    // « Je décris mon activité » compte TROIS lignes. La première est le widget
    // `undefined_2` (y=287), posé sur la ligne qui prolonge le libellé ; les
    // deux suivantes sont `Je décris mon activité 1` et `2`. Les descriptions
    // étaient décalées d'un cran et la 1ʳᵉ ligne servait au code postal de Q15.
    id: "descriptionActivite1",
    pdfFieldName: "undefined_2",
    type: "text",
    required: false,
    label: { fr: "Je décris mon activité" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 70,
  },
  {
    id: "descriptionActivite2",
    pdfFieldName: "Je décris mon activité 1",
    type: "text",
    required: false,
    label: { fr: "Je décris mon activité (suite)" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 71,
  },
  {
    id: "descriptionActivite3",
    pdfFieldName: "Je décris mon activité 2",
    type: "text",
    required: false,
    label: { fr: "Je décris mon activité (fin)" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 72,
  },

  // ====================================================================
  // Q17 — EXERCEREZ-VOUS CETTE ACTIVITÉ PENDANT VOTRE CHÔMAGE ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (autreActiviteAccessoire=oui)
    // — tranche si la grille horaire Q18 et Q19-Q21 s'appliquent.
    id: "exerceraPendantChomage",
    pdfFieldName: "oui_7|non_8",
    type: "radio",
    required: true,
    label: { fr: "17. Exercerez-vous cette activité pendant votre chômage ?" },
    labelShort: { fr: "Pendant votre chômage ?" },
    help: {
      fr: "Réponds également « oui » si tu exerceras cette activité pendant des périodes de chômage temporaire auprès de ton employeur (à partir du premier jour de chômage du mois concerné jusqu'à la fin du mois). Tu es chômeur temporaire si tu es toujours au service de ton employeur mais que temporairement tu ne travailles pas, par exemple en raison d'un manque de travail ou d'intempéries.",
    },
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    // 72.5 et non 72 : le bloc Q16 ci-dessus a gagné un champ
    // (descriptionActivite3), ce qui pousse sa dernière ligne à order 72.
    // Fractionnaire pour rester strictement après elle sans renuméroter toute
    // la grille horaire Q18 qui suit (base 73, cf. plus bas).
    order: 72.5,
  },

  // ====================================================================
  // Q18 — QUAND EXERCEREZ-VOUS CETTE ACTIVITÉ ? (grille horaire n°2)
  // ====================================================================
  ...grilleHoraire({
    idPrefix: "q18",
    questionLabel: "18. Quand exercerez-vous cette activité ?",
    parentId: "exerceraPendantChomage",
    parentValue: "oui",
    section: SECTION_ACTIVITES,
    order: 73,
    suffixes: {
      lundi: "lundi_2", mardi: "mardi_2", mercredi: "mercredi_2", jeudi: "jeudi_2", vendredi: "vendredi_2",
      samedi: "samedi_2", dimanche: "dimanche_2",
      avant7h: ["avant 7 h_6", "avant 7 h_7", "avant 7 h_8", "avant 7 h_9", "avant 7 h_10"],
      entre7h18h: ["entre 7 h et 18 h_6", "entre 7 h et 18 h_7", "entre 7 h et 18 h_8", "entre 7 h et 18 h_9", "entre 7 h et 18 h_10"],
      apres18h: ["après 18 h_6", "après 18 h_7", "après 18 h_8", "après 18 h_9", "après 18 h_10"],
      touteLannee: "toute lannée_3",
      pendantPeriodes: "pendant les périodes suivantes de lannée_2",
      irregulierement: "irrégulièrement à savoir_2",
    },
    // 6 lignes de texte libre identifiées après la grille Q18 (ordre 98-103 :
    // "2_3","3_3","4_3","1_4","2_4","3_4") + 1 ligne isolée en fin de dump
    // ("1_3", ordre 130), logiquement la 1re ligne de "pendant les périodes"
    // de Q18 (numérotation [1] manquante dans le groupe 98-103, qui commence
    // directement à [2]).
    //
    // "1_3" est en réalité un widget PARTAGÉ (confirmé via pypdf/`/Kids`,
    // audit du 2026-07-29) : le même champ AcroForm couvre AUSSI les deux
    // cases d'en-tête de la page 2 — nom et NISS (rects [293,799,560,809] et
    // [109,799,265,812]). Écrire dans cette ligne imprimait donc le texte
    // saisi ici dans la case du numéro de registre national du citoyen : une
    // déclaration officielle faussée. Même famille de défaut que
    // `TVA`/`Montant`/`voir 19` ci-dessus : écriture positionnelle, "1_3"
    // reste non revendiqué par qui que ce soit (et les deux cases d'en-tête
    // restent blanches comme aujourd'hui — les y écrire est une décision
    // séparée, hors de ce correctif).
    //
    // Calage mesuré sur le rect réel du widget "1_3" ([335,753,557,764], soit
    // 222 pt de large) selon la MÊME convention que les `drawAt` déjà en
    // place sur cette page pour des lignes de même gabarit — vérifiée à
    // l'identique (x = arrondi(rect.x0) + 2, y = arrondi(rect.y0) − 4) sur
    // `independantNumeroEntreprise`/`numeroEntreprise` (TVA) et sur
    // `revenuAnnuelMandat`/`revenuAnnuelMandat2` (Montant, mêmes lignes
    // pointillées « EUR » de la page 2) : le texte s'imprime ainsi ~2 pt sous
    // les pointillés imprimés, pas au-dessus.
    //
    // Vérification du défaut du Commit 1 ci-dessus (décalage périodes /
    // irrégulier d'une ligne sur Q4) : Q18 n'a PAS le même défaut. Géométrie
    // mesurée (page 2, colonne de droite) : case "pendant les périodes..."
    // à y=766, puis 1_3/2_3/3_3/4_3 à y=753/740/727/714 (4 lignes) ; case
    // "irrégulièrement à savoir_2" à y=699 SEULE sur sa ligne — aucun widget
    // texte n'y est superposé (contrairement au "undefined" de Q4 à côté de
    // sa case) — puis 1_4/2_4/3_4 à y=686/673/660 (3 lignes) ; le widget
    // suivant est "voir 19" (y=647), déjà rattaché à Q19 plus bas. Le PDF ne
    // fournit donc ici aucune ligne partagée à réattribuer : la répartition
    // 4 lignes périodes / 3 lignes irrégulier ci-dessous est déjà correcte.
    periodesTextFields: [
      { pdfFieldName: "", drawAt: { page: 1, x: 337, y: 749, size: 9, maxWidth: 218 } },
      "2_3", "3_3", "4_3",
    ],
    irregulierementTextFields: ["1_4", "2_4", "3_4"],
  }),

  // ====================================================================
  // Q19 — QUEL EST LE REVENU NET DE VOTRE ACTIVITÉ ?
  // ====================================================================
  {
    // Les trois cases de revenu de Q19 appartiennent au champ AcroForm
    // « voir 19 », qui porte QUATRE widgets partageant une seule valeur — donc
    // inutilisable pour trois montants distincts. Écriture positionnelle.
    // Coordonnées mesurées : ligne « par mois : … EUR / par heure : … EUR »
    // imprimée à y=567, ligne « par an : … » à y=497.
    //
    // `required` reste `false` (Commit 3, décision volontaire) bien que ce
    // soit une clé C1A_ROUTAGE : sa condition compilée est
    // "exerceraPendantChomage=oui AND autreActiviteAccessoire=oui" SEULE — la
    // Task 13 (2026-07-28) a délibérément retiré le garde-fou
    // `activiteCommeSalarie` pour garder « par mois »/« par heure » sur la
    // même ligne imprimée. Résultat : ce champ (et ses frères parHeure/
    // parAn) sont visibles pour TOUT citoyen ayant une activité accessoire
    // pendant son chômage, salarié OU indépendant. Le rendre `required`
    // forcerait donc un indépendant pur à renseigner un revenu « salarié »
    // qui ne le concerne pas — une case remplie hors de propos plutôt que
    // vide, le même risque qu'un remplissage au mauvais endroit. Le
    // mécanisme qui poserait « au moins un des 3 montants » proprement
    // (`requiredGroup`) est explicitement écarté pour le C1A (cf. plus haut).
    id: "revenuNetSalarieParMois",
    pdfFieldName: "",
    drawAt: { page: 1, x: 360, y: 563, size: 9, maxWidth: 62 },
    type: "number",
    required: false,
    label: { fr: "Revenu net comme salarié — par mois (EUR)" },
    help: {
      fr: "Montant brut diminué des cotisations de sécurité sociale et du précompte professionnel retenus à la source par l'employeur (rémunération mensuelle normale, mais aussi pécule de vacances, 13ᵉ mois et avantages en nature éventuels). Indique jusqu'à 2 chiffres après la virgule.",
    },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 140,
  },
  {
    // Pas de visibleIf propre (2026-07-28, correctif) : « par mois » et
    // « par heure » sont la MÊME ligne imprimée. `revenuNetSalarieParMois` est
    // l'ancre de Q19 dans l'arbre de routage — sa condition écrite ci-dessus
    // sur ce champ-frère serait de toute façon remplacée par celle de la
    // branche (Q17 ET Q12), donc sans garde-fou `activiteCommeSalarie`. Garder
    // ce garde-fou UNIQUEMENT ici cassait la ligne en deux : un indépendant
    // voyait « par mois » sans « par heure ». Cohérent avec la Task 13 : la
    // grille reproduit le papier, où rien ne disparaît selon Q13.
    id: "revenuNetSalarieParHeure",
    pdfFieldName: "",
    drawAt: { page: 1, x: 487, y: 563, size: 9, maxWidth: 46 },
    type: "number",
    required: false,
    label: { fr: "Revenu net comme salarié — par heure (EUR)" },
    help: { fr: "Indique jusqu'à 4 chiffres après la virgule." },
    section: SECTION_REVENUS,
    order: 141,
  },
  {
    id: "revenuNetIndependantParAn",
    pdfFieldName: "",
    drawAt: { page: 1, x: 350, y: 493, size: 9, maxWidth: 185 },
    type: "number",
    required: false,
    label: { fr: "Revenu net comme indépendant — par an (EUR)" },
    help: {
      fr: "Revenu imposable indiqué sur l'avertissement-extrait de rôle et la note de calcul (recettes diminuées des charges, dépenses et pertes professionnelles). Joins une copie de la plus récente note de calcul de l'administration des contributions directes.",
    },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 142,
  },

  // ====================================================================
  // Q20 — EXERCIEZ-VOUS DÉJÀ CETTE ACTIVITÉ DANS LE PASSÉ ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (autreActiviteAccessoire=oui).
    id: "exerceDejaActivite",
    pdfFieldName: "oui_8|non_9",
    type: "radio",
    required: true,
    label: { fr: "20. Exerciez-vous déjà cette activité dans le passé ?" },
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 150,
  },

  // ====================================================================
  // Q21 — DEPUIS QUAND ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, donnée principale de Q21, visible
    // seulement si Q20 (exerceDejaActivite) = oui.
    id: "dateDebutActivite",
    pdfFieldName: "Date43_af_date",
    type: "date",
    required: true,
    label: { fr: "21. Depuis quand exercez-vous cette activité ?" },
    visibleIf: { fieldId: "exerceDejaActivite", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 151,
  },

  // ====================================================================
  // Q22 — JOURS HABITUELLEMENT OCCUPÉ CHEZ L'EMPLOYEUR (CHÔMEUR TEMPORAIRE)
  // ====================================================================
  {
    // Q22 imprime « À COMPLÉTER UNIQUEMENT SI VOUS ÊTES CHÔMEUR TEMPORAIRE »
    // sans qu'aucune question n'établisse le statut : les sept cases
    // s'affichaient à tout le monde. Cette question n'existe pas sur le papier
    // (d'où l'absence de widget) — elle matérialise la consigne imprimée.
    //
    // La définition affichée est celle imprimée DEUX FOIS sur le formulaire,
    // sous Q3 et sous Q17.
    //
    // `order` 159 et non 100 comme prévu au plan : la numérotation a été refaite
    // en ordre de lecture, et 100 tombe désormais au milieu de la grille horaire
    // de Q18 (73→102). 159 la place juste avant `joursOccupeLundi` (160).
    id: "estChomeurTemporaire",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "Es-tu chômeur temporaire ?" },
    labelShort: { fr: "Chômeur temporaire ?" },
    help: {
      fr: "Tu es chômeur temporaire si tu es toujours au service de ton employeur mais que temporairement tu ne travailles pas, par exemple en raison d'un manque de travail ou d'intempéries.",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 159,
  },
  {
    // `required` reste `false` (Commit 3, même décision que les grilles
    // horaires Q4/Q18 ci-dessus) : aucun jour précis n'a de raison objective
    // d'être obligatoire, et Q22 n'a pas d'équivalent au radio "période" (pas
    // de résumé de fréquence à côté des 7 cases) sur lequel reporter une
    // exigence. `requiredGroup` reste écarté pour la même raison qu'ailleurs
    // sur ce formulaire.
    id: "joursOccupeLundi",
    pdfFieldName: "lu",
    type: "checkbox",
    required: false,
    label: { fr: "Lundi" },
    section: SECTION_ACTIVITES,
    order: 160,
  },
  {
    id: "joursOccupeMardi",
    pdfFieldName: "ma",
    type: "checkbox",
    required: false,
    label: { fr: "Mardi" },
    section: SECTION_ACTIVITES,
    order: 161,
  },
  {
    id: "joursOccupeMercredi",
    pdfFieldName: "me",
    type: "checkbox",
    required: false,
    label: { fr: "Mercredi" },
    section: SECTION_ACTIVITES,
    order: 162,
  },
  {
    id: "joursOccupeJeudi",
    pdfFieldName: "je",
    type: "checkbox",
    required: false,
    label: { fr: "Jeudi" },
    section: SECTION_ACTIVITES,
    order: 163,
  },
  {
    id: "joursOccupeVendredi",
    pdfFieldName: "ve",
    type: "checkbox",
    required: false,
    label: { fr: "Vendredi" },
    section: SECTION_ACTIVITES,
    order: 164,
  },
  {
    id: "joursOccupeSamedi",
    pdfFieldName: "sa",
    type: "checkbox",
    required: false,
    label: { fr: "Samedi" },
    section: SECTION_ACTIVITES,
    order: 165,
  },
  {
    id: "joursOccupeDimanche",
    pdfFieldName: "di",
    type: "checkbox",
    required: false,
    label: { fr: "Dimanche" },
    help: {
      fr: "22. À compléter uniquement si tu es chômeur temporaire : coche les jours où tu es habituellement occupé chez ton employeur.",
    },
    section: SECTION_ACTIVITES,
    order: 166,
  },

  // ====================================================================
  // Q23 — INDÉPENDANT À TITRE PRINCIPAL ?
  // ====================================================================
  {
    id: "independantTitrePrincipal",
    pdfFieldName: "oui et je sais que je nai pas droit aux allocations|non_10",
    type: "radio",
    required: true,
    label: { fr: "23. Je suis indépendant à titre principal :" },
    help: {
      fr: "⚠ À compléter toujours. Si tu es indépendant à titre principal, tu n'as pas droit aux allocations de chômage.",
    },
    options: [
      { value: "oui", label: { fr: "Oui, et je sais que je n'ai pas droit aux allocations" } },
      { value: "non", label: { fr: "Non" } },
    ],
    section: SECTION_AFFIRMATIONS,
    order: 170,
  },

  // ====================================================================
  // Q24 — AFFIRMATION FINALE + ANNEXES + SIGNATURE
  // ====================================================================
  {
    id: "affirmationSincerite",
    pdfFieldName: "",
    type: "checkbox",
    required: true,
    label: {
      fr: "24. J'affirme sur l'honneur que la présente déclaration est sincère et complète et je m'engage à communiquer toute modification à mon organisme de paiement.",
    },
    section: SECTION_AFFIRMATIONS,
    order: 180,
  },
  // A VALIDER Oraliks : aucun widget checkbox dédié identifié dans le dump
  // pour cette affirmation (contrairement au C1 principal qui a un widget
  // par affirmation) — laissé virtuel. Le texte n'est peut-être qu'une
  // mention imprimée sans case à cocher sur ce formulaire ; à confirmer sur
  // le PDF réel.
  {
    // La case « Je joins …… annexe(s) » de Q24 a bien un widget :
    // `Liste déroulante44`, à (350, 171), juste au-dessus de la ligne imprimée
    // (y=179). Le schéma l'avait classée « champ non identifié » et masquée,
    // et ce champ-ci restait virtuel — le nombre ne s'imprimait jamais.
    //
    // Facultatif (décision Oraliks), mais la case doit exister à l'écran.
    id: "nombreAnnexesJointes",
    pdfFieldName: "Liste déroulante44",
    type: "number",
    required: false,
    label: { fr: "Nombre d'annexes jointes" },
    help: {
      fr: "Par exemple la copie de la plus récente note de calcul de l'administration des contributions directes, demandée aux questions 6, 11 et 19.",
    },
    section: SECTION_ANNEXES,
    order: 190,
  },
  {
    id: "dateSignature",
    pdfFieldName: "AUJOURD'HUI",
    type: "date",
    required: true,
    label: { fr: "Date de signature" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour." },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 200,
  },
  {
    id: "signature",
    pdfFieldName: "Signature42",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique" },
    help: {
      fr: "Signature « façon Adobe » : ton nom + prénom + horodatage seront appliqués à la position de la signature.",
    },
    section: SECTION_SIGNATURE,
    order: 201,
  },

  // ====================================================================
  // CHAMPS NON RATTACHÉS AVEC CERTITUDE
  // ====================================================================
  {
    // Troisième exemplaire d'un « toute l'année », isolé en bas de page 2
    // (x=156, y=43), alors que les deux grilles horaires sont déjà câblées sur
    // `toute lannée` (Q4) et `toute lannée_3` (Q18). Aucune donnée perdue.
    id: "touteLanneeOrpheline",
    pdfFieldName: "toute lannée_2",
    type: "checkbox",
    required: false,
    label: { fr: "(case orpheline — voir A VALIDER)" },
    hidden: true,
    section: SECTION_DIVERS_INCONNU,
    order: 902,
  },
];

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id` ET les `pdfFieldName`
/// désormais couverts).
/// Champs d'une version antérieure du schéma qui n'existent plus et dont le
/// widget est désormais écrit par une RÈGLE serveur. L'overlay ne peut pas les
/// détecter tout seul : leur `pdfFieldName` n'est plus « couvert » par aucun
/// champ, donc le filtre `covered` les laisserait survivre en base — ils se
/// battraient alors avec la règle pour le même widget.
const LEGACY_C1A_FIELD_IDS = new Set<string>([
  // Scindé en `codePostal` + `commune` (2026-07-26) ; le widget fusionné
  // « Code postal et commune » est recomposé par `bindings/per-form/c1a.ts`.
  "codePostalEtCommune",
  // Même widget, mais l'`id` produit par l'INFÉRENCE à l'import — distinct du
  // camelCase ci-dessus, donc jamais attrapé par cette liste. Il survivait, et
  // avec un libellé faux : l'inférence déduit le sien de l'infobulle du widget,
  // qui dit ici « rue ». Le citoyen se voyait donc poser une seconde question
  // « rue » qui attendait en réalité un code postal.
  "code_postal_et_commune",
  // Réalignement géométrique de Q2/Q15 (2026-07-28) : trois champs renommés
  // pour que l'id reflète enfin la vraie case (cf. commentaires sur les
  // nouveaux champs). La couverture par pdfFieldName suffirait déjà à les
  // écarter dans le cas nominal, mais les lister ici les écarte aussi si leur
  // pdfFieldName stocké en base venait à différer (état antérieur imprévu).
  "adresseActiviteIndependanteLabel", // -> independantAdresseRueNumero (même widget)
  "independantAdresseRue", // -> independantAdresseCodePostalCommune (même widget)
  "adresseActiviteNumero", // -> adresseActiviteCodePostalCommune (widget aussi corrigé : undefined_2 -> rue_3)
  // Q19 (2026-07-28) : les trois revenus passent en écriture positionnelle
  // (drawAt), le widget "voir 19" reste non revendiqué. Sans cette entrée,
  // un ancien champ `voir19Artefact` déjà en base survivrait au merge : ni
  // `newIds` ni `covered` (pdfFieldName) ne le voient plus.
  "voir19Artefact",
  // Q24 (2026-07-28) : "Liste déroulante44" est désormais revendiqué par
  // `nombreAnnexesJointes`. L'ancien `listeDeroulante44` (masqué à tort comme
  // "champ non identifié") doit être purgé s'il est déjà en base, sinon il
  // survivrait à côté du nouveau champ qui porte le même pdfFieldName.
  "listeDeroulante44",
  // Q4 (2026-07-29) : correctif de la coupure périodes/irrégulier — le
  // widget "undefined" appartient désormais à `q4irregulierementTexte1` (il
  // reste couvert, donc la couverture par pdfFieldName suffirait déjà à
  // écarter l'ancien id), mais `q4periodesTexte5` disparaît du seed
  // (périodesTextFields n'a plus que 4 entrées) : listé ici par prudence,
  // même raison que les trois entrées Q2/Q15 ci-dessus — sans cette entrée,
  // un brouillon déjà en base garderait une 5e case "Période 5" fantôme,
  // qui n'écrirait plus rien de cohérent nulle part.
  "q4periodesTexte5",
  // Q2/Q5 (Commit 2, 2026-07-29) : natureActiviteIndependant1..5 et
  // descriptionAide2..9 consolidés en deux champs `array`
  // (natureActiviteIndependant, descriptionAide1). Ici la couverture par
  // `pdfFieldName` NE SUFFIT PAS : les widgets "mentionnez les toutes N" et
  // "Décrivez laide que vous apporterez N" ne sont plus référencés que via
  // `pdfFieldNameTemplate` sur un sous-champ d'`itemFields`, invisible à
  // `coveredWidgetNames` (qui ne lit que `field.pdfFieldName` au premier
  // niveau). Sans ces entrées, un brouillon déjà en base garderait les 14
  // anciens champs ligne-par-ligne À CÔTÉ du nouveau tableau — doublon
  // silencieux, pas une case fantôme qui se voit tout de suite.
  "natureActiviteIndependant1",
  "natureActiviteIndependant2",
  "natureActiviteIndependant3",
  "natureActiviteIndependant4",
  "natureActiviteIndependant5",
  "descriptionAide2",
  "descriptionAide3",
  "descriptionAide4",
  "descriptionAide5",
  "descriptionAide6",
  "descriptionAide7",
  "descriptionAide8",
  "descriptionAide9",
]);

/// Champs qui suivent la même condition que la question qui les porte : les
/// lignes d'une même rubrique du PDF s'affichent ou disparaissent ensemble.
/// Clé = identifiant de la question dans `C1A_ROUTAGE`.
const RATTACHEMENTS: Record<string, string[]> = {
  independantNom: [
    "independantNumeroEntreprise",
    "independantAdresseRueNumero",
    "independantAdresseCodePostalCommune",
    // natureActiviteIndependant1..5 consolidés (Commit 2) en un seul champ
    // `array` : plus besoin de les rattacher un par un.
    "natureActiviteIndependant",
  ],
  // descriptionAide2..9 ont disparu (Commit 2) : consolidés dans le champ
  // `array` descriptionAide1 ci-dessus, qui reste lui-même la clé
  // C1A_ROUTAGE de Q5 — plus rien à rattacher séparément.
  montantAidePeriodicite: ["montantAide", "montantAideAnnuel"],
  mandatDescription: [],
  // Q11 imprime DEUX lignes de montant : la seconde suit la première, sinon
  // elle serait le seul champ de sa rubrique à échapper à l'arbre.
  revenuAnnuelMandat: ["revenuAnnuelMandat2"],
  employeurNom: ["employeurAdresse"],
  adresseActivite: ["adresseActiviteCodePostalCommune"],
  formeActivite: [
    "disposeNumeroEntreprise", "numeroEntreprise",
    "descriptionActivite1", "descriptionActivite2", "descriptionActivite3",
  ],
  revenuNetSalarieParMois: ["revenuNetSalarieParHeure", "revenuNetIndependantParAn"],
  joursOccupeLundi: [
    "joursOccupeMardi", "joursOccupeMercredi", "joursOccupeJeudi",
    "joursOccupeVendredi", "joursOccupeSamedi", "joursOccupeDimanche",
  ],
  affirmationSincerite: ["nombreAnnexesJointes"],
};

/// Rubriques dont TOUS les champs se reconnaissent à un préfixe d'identifiant :
/// les deux grilles horaires, soixante champs à elles deux. Les énumérer à la
/// main serait une liste à retomber en panne au premier créneau ajouté — et un
/// créneau oublié ici est un créneau qui échappe à l'arbre. Les créneaux ne
/// tiennent aujourd'hui que par leur condition interne (« le jour est coché »),
/// qui n'a pas vocation à rester : la grille doit reproduire la disposition du
/// papier, tout visible d'emblée.
const RATTACHEMENTS_PAR_PREFIXE: Array<{ prefixe: string; question: string }> = [
  { prefixe: "q4", question: "q4lundi" },
  { prefixe: "q18", question: "q18lundi" },
];

/// Une condition, aplatie : la principale et ses `and` sur le même plan.
type Clause = Pick<VisibleIf, "fieldId" | "op" | "value">;

function aplatir(condition: VisibleIf): Clause[] {
  return [
    { fieldId: condition.fieldId, op: condition.op, value: condition.value },
    ...(condition.and ?? []).map((a) => ({ fieldId: a.fieldId, op: a.op, value: a.value })),
  ];
}

/// Première clause en tête, le reste en `and` — et pas de `and: []` parasite,
/// qui ferait échouer toute comparaison structurelle avec une condition simple.
function assembler(clauses: Clause[]): VisibleIf {
  const [tete, ...reste] = clauses;
  return { ...tete, ...(reste.length ? { and: reste } : {}) };
}

/// Empile la condition de branche SOUS la condition existante, sans la
/// remplacer. Dédoublonnage sur la paire (champ, valeur) : une condition déjà
/// juste reste identique à elle-même.
function empiler(existante: VisibleIf | undefined, branche: VisibleIf): VisibleIf {
  const cle = (c: Clause) => `${c.fieldId}=${JSON.stringify(c.value)}`;
  const base = existante ? aplatir(existante) : [];
  const deja = new Set(base.map(cle));
  return assembler([...base, ...aplatir(branche).filter((c) => !deja.has(cle(c)))]);
}

/// Pose sur chaque champ la condition dérivée de l'arbre imprimé.
///
/// Deux populations, deux traitements :
///   • un champ qui EST une question de l'arbre voit sa condition REMPLACÉE —
///     c'est l'arbre qui fait foi, et les conditions écrites à la main sont
///     précisément ce qu'on répare (Q4 à Q8 étaient accrochées à Q1 en oubliant
///     Q3) ;
///   • un champ rattaché à une question garde SA condition en tête et reçoit
///     les clauses de branche en `and`. Écraser détruirait des conditions
///     intra-question légitimes : les deux montants de Q6 ne se distinguent que
///     par leur périodicité et s'afficheraient ensemble, sous le même libellé ;
///     le numéro d'entreprise de Q16 serait demandé à qui vient de déclarer ne
///     pas en avoir.
///
/// Une question posée sur tous les chemins (condition compilée `undefined`)
/// n'ajoute rien : le champ garde ce qu'il porte.
function appliquerRoutage(fields: PdfFormField[]): PdfFormField[] {
  const conditions = compilerRoutage(C1A_ROUTAGE, C1A_DEPART);
  const questions = new Set(Object.keys(C1A_ROUTAGE));

  const porteuse = new Map<string, string>();
  for (const [question, rattaches] of Object.entries(RATTACHEMENTS)) {
    if (!questions.has(question)) {
      throw new Error(`RATTACHEMENTS : « ${question} » n'est pas une question de C1A_ROUTAGE`);
    }
    for (const id of rattaches) porteuse.set(id, question);
  }
  for (const { question } of RATTACHEMENTS_PAR_PREFIXE) {
    if (!questions.has(question)) {
      throw new Error(`RATTACHEMENTS_PAR_PREFIXE : « ${question} » n'est pas une question de C1A_ROUTAGE`);
    }
  }

  return fields.map((f) => {
    if (questions.has(f.id)) {
      const condition = conditions[f.id];
      if (!condition) {
        // Question posée sur tous les chemins : toujours visible.
        const toujoursVisible = { ...f };
        delete toujoursVisible.visibleIf;
        return toujoursVisible;
      }
      return { ...f, visibleIf: assembler(aplatir(condition)) };
    }

    const question =
      porteuse.get(f.id) ??
      RATTACHEMENTS_PAR_PREFIXE.find((r) => f.id.startsWith(r.prefixe))?.question;
    if (!question) return f;

    const branche = conditions[question];
    if (!branche) return f;
    return { ...f, visibleIf: empiler(f.visibleIf, branche) };
  });
}

/// Macro-étape de chaque champ, dérivée de sa section. L'ordre des étapes est
/// déclaré dans `form-presentation.ts`.
const GROUPE_PAR_SECTION: Record<string, string> = {
  [SECTION_IDENTITE]: "identite",
  [SECTION_AIDE_INDEPENDANT]: "aide-independant",
  [SECTION_ADRESSE]: "aide-independant",
  [SECTION_EMPLOYEUR]: "activite",
  [SECTION_ACTIVITES]: "activite",
  [SECTION_REVENUS]: "activite",
  [SECTION_AFFIRMATIONS]: "final",
  [SECTION_ANNEXES]: "final",
  [SECTION_SIGNATURE]: "final",
};

/// Champs dont la macro-étape ne se déduit pas de leur section : les questions
/// de mandat vivent dans les sections « activités » et « revenus » mais forment
/// leur propre étape — y compris `revenuAnnuelMandat2` (2e montant de Q11,
/// ajouté après l'écriture du plan initial, absent de sa liste d'origine).
/// `adresseActivite` et `adresseActiviteCodePostalCommune` (Q15, adresse de
/// L'ACTIVITÉ accessoire) partagent SECTION_ADRESSE avec l'adresse de
/// l'indépendant aidé de Q2 (qui, elle, appartient bien à l'étape
/// « aide-independant » via GROUPE_PAR_SECTION) : la section seule ne peut pas
/// les distinguer, d'où leur présence ici.
const GROUPE_PAR_CHAMP: Record<string, string> = {
  mandatPolitiqueOuJuge: "mandat",
  mandatDescription: "mandat",
  revenuAnnuelMandat: "mandat",
  revenuAnnuelMandat2: "mandat",
  aideIndependant: "aide-independant",
  aideraPendantChomage: "aide-independant",
  aidaitDejaIndependant: "aide-independant",
  dateDebutAide: "aide-independant",
  montantAidePeriodicite: "aide-independant",
  montantAide: "aide-independant",
  montantAideAnnuel: "aide-independant",
  estChomeurTemporaire: "final",
  independantTitrePrincipal: "final",
  adresseActivite: "activite",
  adresseActiviteCodePostalCommune: "activite",
};

function appliquerGroupes(fields: PdfFormField[]): PdfFormField[] {
  return fields.map((f) => {
    const groupe =
      GROUPE_PAR_CHAMP[f.id] ??
      (f.id.startsWith("q4") || f.id.startsWith("descriptionAide")
        ? "aide-independant"
        : f.id.startsWith("joursOccupe")
          ? "final"
          : f.section
            ? GROUPE_PAR_SECTION[f.section]
            : undefined);
    return groupe ? { ...f, stepGroup: groupe } : f;
  });
}

export function applyC1AImprovements(fields: PdfFormField[]): PdfFormField[] {
  return appliquerGroupes(
    appliquerRoutage(mergeEnrichedFields(fields, C1A_FIELDS, LEGACY_C1A_FIELD_IDS)),
  );
}
