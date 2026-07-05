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

import type { PdfFormField } from "../types";

const SECTION_IDENTITE = "identite";
const SECTION_ADRESSE = "adresse";
const SECTION_EMPLOYEUR = "employeur";
const SECTION_ACTIVITES = "mes-activites";
const SECTION_REVENUS = "mes-revenus";
const SECTION_AFFIRMATIONS = "affirmations";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";
/// Réutilise la section partagée "divers" (section-labels.ts) pour les 2
/// champs non rattachés avec certitude à une question (cf. A VALIDER
/// Oraliks en fin de fichier).
const SECTION_DIVERS_INCONNU = "divers";

/// Section dédiée à la partie "aide à un indépendant" (Q1-Q11) — distincte
/// de "mes-activites" (réutilisée pour Q12-Q23, qui décrit une activité
/// accessoire propre au déclarant, pas une aide à un tiers).
const SECTION_AIDE_INDEPENDANT = "aide-independant";

const YN = [
  { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
  { value: "non", label: { fr: "Non", nl: "", de: "" } },
];

/// Grille horaire répétée 2 fois sur le PDF (Q4 "quand aiderez-vous
/// l'indépendant" et Q18 "quand exercerez-vous cette activité"). Structure
/// identique : lundi à vendredi (chacun x avant 7h / entre 7h et 18h /
/// après 18h), puis samedi et dimanche (sans horaire), puis un choix parmi
/// "toute l'année" / "pendant les périodes suivantes" (texte libre
/// multi-lignes) / "irrégulièrement, à savoir" (texte libre).
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
  // Fournis dans l'ordre d'apparition sur le PDF (pdfFieldName exacts).
  periodesTextFields: string[];
  irregulierementTextFields: string[];
}): PdfFormField[] {
  const { suffixes } = opts;
  const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"] as const;
  const fields: PdfFormField[] = [];

  jours.forEach((jour, i) => {
    fields.push({
      id: `${opts.idPrefix}${jour}`,
      pdfFieldName: suffixes[jour],
      type: "checkbox",
      required: false,
      label: { fr: jour.charAt(0).toUpperCase() + jour.slice(1), nl: "", de: "" },
      visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
      section: opts.section,
      order: opts.order + i * 10,
    });
    fields.push({
      id: `${opts.idPrefix}${jour}Avant7h`,
      pdfFieldName: suffixes.avant7h[i],
      type: "checkbox",
      required: false,
      label: { fr: "Avant 7 h", nl: "", de: "" },
      visibleIf: { fieldId: `${opts.idPrefix}${jour}`, op: "equals", value: true },
      section: opts.section,
      order: opts.order + i * 10 + 1,
    });
    fields.push({
      id: `${opts.idPrefix}${jour}Entre7h18h`,
      pdfFieldName: suffixes.entre7h18h[i],
      type: "checkbox",
      required: false,
      label: { fr: "Entre 7 h et 18 h", nl: "", de: "" },
      visibleIf: { fieldId: `${opts.idPrefix}${jour}`, op: "equals", value: true },
      section: opts.section,
      order: opts.order + i * 10 + 2,
    });
    fields.push({
      id: `${opts.idPrefix}${jour}Apres18h`,
      pdfFieldName: suffixes.apres18h[i],
      type: "checkbox",
      required: false,
      label: { fr: "Après 18 h", nl: "", de: "" },
      visibleIf: { fieldId: `${opts.idPrefix}${jour}`, op: "equals", value: true },
      section: opts.section,
      order: opts.order + i * 10 + 3,
    });
  });

  fields.push({
    id: `${opts.idPrefix}samedi`,
    pdfFieldName: suffixes.samedi,
    type: "checkbox",
    required: false,
    label: { fr: "Samedi", nl: "", de: "" },
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: opts.order + 60,
  });
  fields.push({
    id: `${opts.idPrefix}dimanche`,
    pdfFieldName: suffixes.dimanche,
    type: "checkbox",
    required: false,
    label: { fr: "Dimanche", nl: "", de: "" },
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: opts.order + 61,
  });

  fields.push({
    id: `${opts.idPrefix}periode`,
    pdfFieldName: `${suffixes.touteLannee}|${suffixes.pendantPeriodes}|${suffixes.irregulierement}`,
    type: "radio",
    required: false,
    label: { fr: opts.questionLabel, nl: "", de: "" },
    help: {
      fr: "Choisis la fréquence qui correspond le mieux : toute l'année, seulement certaines périodes (précise-les), ou de façon irrégulière (précise aussi).",
      nl: "", de: "",
    },
    options: [
      { value: "toute-annee", label: { fr: "Toute l'année", nl: "", de: "" } },
      { value: "periodes", label: { fr: "Pendant les périodes suivantes de l'année", nl: "", de: "" } },
      { value: "irregulier", label: { fr: "Irrégulièrement, à savoir", nl: "", de: "" } },
    ],
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: opts.order + 62,
  });

  opts.periodesTextFields.forEach((pdfFieldName, i) => {
    fields.push({
      id: `${opts.idPrefix}periodesTexte${i + 1}`,
      pdfFieldName,
      type: "text",
      required: false,
      label: { fr: `Période ${i + 1}`, nl: "", de: "" },
      visibleIf: { fieldId: `${opts.idPrefix}periode`, op: "equals", value: "periodes" },
      section: opts.section,
      order: opts.order + 63 + i,
    });
  });

  opts.irregulierementTextFields.forEach((pdfFieldName, i) => {
    fields.push({
      id: `${opts.idPrefix}irregulierementTexte${i + 1}`,
      pdfFieldName,
      type: "text",
      required: false,
      label: { fr: i === 0 ? "Précise à quel rythme" : `Précision ${i + 1}`, nl: "", de: "" },
      visibleIf: { fieldId: `${opts.idPrefix}periode`, op: "equals", value: "irregulier" },
      section: opts.section,
      order: opts.order + 70 + i,
    });
  });

  return fields;
}

export const C1A_FIELDS: PdfFormField[] = [
  // ====================================================================
  // IDENTITÉ DU DÉCLARANT (le chômeur qui remplit le formulaire)
  // ====================================================================
  {
    id: "nomEtPrenom",
    pdfFieldName: "Nom et prénom",
    type: "text",
    required: true,
    label: { fr: "Nom et prénom", nl: "", de: "" },
    prefillFrom: "profile.lastName",
    section: SECTION_IDENTITE,
    order: -100,
  },
  {
    id: "niss",
    pdfFieldName: "NISS",
    type: "niss",
    required: true,
    label: { fr: "Numéro NISS (registre national)", nl: "", de: "" },
    help: {
      fr: "11 chiffres au dos de ta carte d'identité (eID), au-dessus du code-barres. Le formulaire le rappelle : « voir coin supérieur droit de ta carte SIS ».",
      nl: "", de: "",
    },
    placeholder: { fr: "00.00.00-000.00", nl: "", de: "" },
    prefillFrom: "profile.niss",
    section: SECTION_IDENTITE,
    order: -99,
  },
  {
    id: "rue",
    pdfFieldName: "Rue",
    type: "text",
    required: true,
    label: { fr: "Rue et numéro (ton adresse)", nl: "", de: "" },
    prefillFrom: "profile.street",
    section: SECTION_IDENTITE,
    order: -98,
  },
  {
    id: "codePostalEtCommune",
    pdfFieldName: "Code postal et commune",
    type: "postal_be",
    required: true,
    label: { fr: "Code postal et commune (ton adresse)", nl: "", de: "" },
    prefillFrom: "profile.postalCode",
    section: SECTION_IDENTITE,
    order: -97,
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
      nl: "", de: "",
    },
    help: {
      fr: "⚠ Si tu aides plus d'un indépendant, remplis un formulaire C1A séparé pour chaque indépendant.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_AIDE_INDEPENDANT,
    order: 0,
  },

  // ====================================================================
  // Q2 — DONNÉES DE L'INDÉPENDANT AIDÉ
  // ====================================================================
  {
    id: "independantNom",
    pdfFieldName: "Nom",
    type: "text",
    required: false,
    label: { fr: "2. Nom de l'indépendant que tu aides", nl: "", de: "" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 1,
  },
  // Le PDF imprime un champ "numéro d'entreprise" à côté du nom (voir texte,
  // ligne "numéro d'entreprise :"), mais aucun widget dédié ne lui correspond
  // dans le dump AcroForm fourni.
  // A VALIDER Oraliks : le numéro d'entreprise de l'indépendant aidé (Q2)
  // n'a pas de widget PDF identifiable dans le dump — champ volontairement
  // omis du côté "stampable" pour l'instant (pas de pdfFieldName connu).
  {
    id: "adresseActiviteIndependanteLabel",
    pdfFieldName: "Adresse de lactivité indépendante",
    type: "text",
    required: false,
    label: { fr: "Adresse de l'activité indépendante — rue et numéro", nl: "", de: "" },
    help: { fr: "Rue et numéro où l'indépendant exerce son activité.", nl: "", de: "" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 2,
  },
  {
    id: "independantAdresseRue",
    pdfFieldName: "rue_2",
    type: "text",
    required: false,
    label: { fr: "Rue et numéro (suite, si besoin)", nl: "", de: "" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 3,
  },
  {
    id: "natureActiviteIndependant1",
    pdfFieldName: "mentionnez les toutes 1",
    type: "text",
    required: false,
    label: { fr: "Nature de l'activité de l'indépendant [1]", nl: "", de: "" },
    help: {
      fr: "Si l'indépendant exerce plusieurs activités, mentionne-les toutes (une par ligne).",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 4,
  },
  {
    id: "natureActiviteIndependant2",
    pdfFieldName: "mentionnez les toutes 2",
    type: "text",
    required: false,
    label: { fr: "Nature de l'activité de l'indépendant [2]", nl: "", de: "" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 5,
  },
  {
    id: "natureActiviteIndependant3",
    pdfFieldName: "mentionnez les toutes 3",
    type: "text",
    required: false,
    label: { fr: "Nature de l'activité de l'indépendant [3]", nl: "", de: "" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 6,
  },
  {
    id: "natureActiviteIndependant4",
    pdfFieldName: "mentionnez les toutes 4",
    type: "text",
    required: false,
    label: { fr: "Nature de l'activité de l'indépendant [4]", nl: "", de: "" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 7,
  },
  {
    id: "natureActiviteIndependant5",
    pdfFieldName: "mentionnez les toutes 5",
    type: "text",
    required: false,
    label: { fr: "Nature de l'activité de l'indépendant [5]", nl: "", de: "" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 8,
  },

  // ====================================================================
  // Q3 — AIDERAS-TU CET INDÉPENDANT PENDANT TON CHÔMAGE ?
  // ====================================================================
  {
    id: "aideraPendantChomage",
    pdfFieldName: "oui_2|non_2",
    type: "radio",
    required: false,
    label: { fr: "3. Aiderez-vous cet indépendant pendant votre chômage ?", nl: "", de: "" },
    help: {
      fr: "Réponds aussi « oui » si tu aides cet indépendant seulement durant des périodes de chômage temporaire (à partir du premier jour de chômage du mois concerné jusqu'à la fin du mois).",
      nl: "", de: "",
    },
    options: YN,
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 9,
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
    // 9 lignes de texte libre trouvées entre la grille Q4 et "Décrivez
    // l'aide" (ordre 36-44 du dump : "1","2","3","4","undefined","1_2",
    // "2_2","3_2","4_2"). Répartition entre "périodes" et "irrégulièrement"
    // non déductible avec certitude du texte (le PDF ne numérote pas ces
    // lignes différemment) — on répartit 5 lignes / 4 lignes dans l'ordre
    // d'apparition.
    // A VALIDER Oraliks : vérifier sur le PDF réel si la coupure entre les
    // lignes "pendant les périodes" et "irrégulièrement" tombe bien après
    // la 5e ligne ("undefined") plutôt qu'ailleurs.
    periodesTextFields: ["1", "2", "3", "4", "undefined"],
    irregulierementTextFields: ["1_2", "2_2", "3_2", "4_2"],
  }),

  // ====================================================================
  // Q5 — DÉCRIVEZ L'AIDE QUE VOUS APPORTEREZ
  // ====================================================================
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
    id: `descriptionAide${n}`,
    pdfFieldName: `Décrivez laide que vous apporterez ${n}`,
    type: "text" as const,
    required: n === 1,
    label: { fr: n === 1 ? "5. Décrivez l'aide que vous apporterez" : `Description de l'aide (suite) [${n}]`, nl: "", de: "" },
    visibleIf: { fieldId: "aideIndependant", op: "equals" as const, value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 45 + n,
  })),

  // ====================================================================
  // Q6 — COMBIEN GAGNEZ-VOUS POUR VOTRE AIDE ?
  // ====================================================================
  {
    id: "montantAide",
    pdfFieldName: "Montant",
    type: "text",
    required: false,
    label: { fr: "6. Combien gagnez-vous pour votre aide, ou à combien s'élève la valeur de votre aide ?", nl: "", de: "" },
    help: {
      fr: "Indique le montant par mois (2 chiffres après la virgule) ou par an. → Joins une copie de la plus récente note de calcul de l'administration des contributions directes.",
      nl: "", de: "",
    },
    placeholder: { fr: "Ex. 150,00 par mois", nl: "", de: "" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 55,
  },
  // A VALIDER Oraliks : le texte imprimé montre 2 cases distinctes ("par
  // mois EUR" et "par an EUR") mais un seul widget "Montant" est présent
  // dans le dump AcroForm — à vérifier sur le PDF réel s'il manque
  // effectivement une 2e case ou si une seule case sert aux deux usages.

  // ====================================================================
  // Q7 — AIDIEZ-VOUS DÉJÀ CET INDÉPENDANT DANS LE PASSÉ ?
  // ====================================================================
  {
    id: "aidaitDejaIndependant",
    pdfFieldName: "oui_3|non_3",
    type: "radio",
    required: false,
    label: { fr: "7. Aidiez-vous déjà cet indépendant dans le passé ?", nl: "", de: "" },
    options: YN,
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 56,
  },

  // ====================================================================
  // Q8 — À PARTIR DE QUELLE DATE ?
  // ====================================================================
  {
    id: "dateDebutAide",
    pdfFieldName: "Date41_af_date",
    type: "date",
    required: false,
    label: { fr: "8. À partir de quelle date aidiez-vous déjà cet indépendant ?", nl: "", de: "" },
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
      nl: "", de: "",
    },
    help: {
      fr: "Si tu es conseiller communal, conseiller provincial, membre d'un C.P.A.S., juge social, juge consulaire ou conseiller social, réponds « non » (ce cas ne demande pas de suite ici).",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 58,
  },

  // ====================================================================
  // Q10/Q11 — MANDAT/FONCTION + REVENU ANNUEL NET IMPOSABLE
  // ====================================================================
  {
    id: "mandatDescription",
    pdfFieldName: "",
    type: "text",
    required: false,
    label: { fr: "10. Quel mandat ou quelle fonction exercez-vous ?", nl: "", de: "" },
    help: {
      fr: "Si tu exerces plus d'un mandat ou plus d'une fonction, mentionne-les tous.",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "mandatPolitiqueOuJuge", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 59,
  },
  // A VALIDER Oraliks : le widget texte "1_3" est ambigu entre Q10 (mandat/
  // fonction, colonne gauche page 2) et la 1re ligne "pendant les périodes"
  // de Q18 (colonne droite page 2, grille horaire). On l'a affecté à Q18
  // ci-dessous (cohérent avec la suite "2_3","3_3","4_3" qui, elle, est sans
  // ambiguïté) et laissé `mandatDescription` (Q10) virtuel plutôt que de
  // risquer d'écraser la mauvaise question au remplissage — à trancher sur
  // le PDF réel.
  {
    id: "revenuAnnuelMandat",
    pdfFieldName: "",
    type: "number",
    required: false,
    label: { fr: "11. Quel est le revenu annuel net imposable de ce mandat ou de cette fonction ? (EUR)", nl: "", de: "" },
    help: {
      fr: "→ Joins une copie de la plus récente note de calcul de l'administration des contributions directes.",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "mandatPolitiqueOuJuge", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 60,
  },
  // A VALIDER Oraliks : le texte imprimé montre 2 cases "EUR" (colonne
  // gauche/droite) pour le revenu annuel net imposable du mandat (Q11), mais
  // aucun widget PDF correspondant n'a été identifié dans le dump — champ
  // laissé virtuel (pdfFieldName vide) en attendant clarification.

  // ====================================================================
  // Q12 — EXERCEZ-VOUS UNE AUTRE ACTIVITÉ À TITRE ACCESSOIRE ?
  // ====================================================================
  {
    id: "autreActiviteAccessoire",
    pdfFieldName: "oui_5|non_5",
    type: "radio",
    required: true,
    label: { fr: "12. Exercez-vous une autre activité à titre accessoire ?", nl: "", de: "" },
    help: {
      fr: "Réponds toujours « oui » si tu es inscrit comme indépendant à titre accessoire ou si tu es administrateur de société. Si tu exerces plusieurs activités accessoires, remplis un formulaire C1A pour chacune.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 61,
  },

  // ====================================================================
  // Q13 — EXERCEZ-VOUS CETTE ACTIVITÉ COMME SALARIÉ ?
  // ====================================================================
  {
    id: "activiteCommeSalarie",
    pdfFieldName: "oui_6|non_6",
    type: "radio",
    required: false,
    label: { fr: "13. Exercez-vous cette activité comme salarié ?", nl: "", de: "" },
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 62,
  },

  // ====================================================================
  // Q14 — DONNÉES CONCERNANT VOTRE EMPLOYEUR
  // ====================================================================
  {
    id: "employeurNom",
    pdfFieldName: "Nom employeur",
    type: "text",
    required: false,
    label: { fr: "14. Nom de votre employeur", nl: "", de: "" },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_EMPLOYEUR,
    order: 63,
  },
  // Le widget "14 Données concernant votre employeur" (ordre 62 du dump) est
  // un intitulé de zone/groupe (juste avant le triplet oui/non Q12/Q13 et le
  // vrai champ de saisie "Nom employeur", ordre 122, pré-tagué
  // section:"identite" dans le dump) — pas un champ de saisie. Volontairement
  // non référencé pour ne pas écraser le mauvais widget au remplissage.
  {
    id: "employeurAdresse",
    pdfFieldName: "rue_3",
    type: "text",
    required: false,
    label: { fr: "Adresse de votre employeur", nl: "", de: "" },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_EMPLOYEUR,
    order: 64,
  },

  // ====================================================================
  // Q15 — À QUELLE ADRESSE EXERCEZ-VOUS CETTE ACTIVITÉ ?
  // ====================================================================
  {
    id: "adresseActivite",
    pdfFieldName: "A quelle adresse exercezvous cette activité",
    type: "text",
    required: false,
    label: { fr: "15. À quelle adresse exercez-vous cette activité ? — rue et numéro", nl: "", de: "" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 65,
  },
  {
    id: "adresseActiviteNumero",
    pdfFieldName: "undefined_2",
    type: "text",
    required: false,
    label: { fr: "Code postal et commune (activité accessoire)", nl: "", de: "" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 66,
  },

  // ====================================================================
  // Q16 — J'EXERCE L'ACTIVITÉ COMME... + NUMÉRO D'ENTREPRISE
  // ====================================================================
  {
    id: "formeActivite",
    pdfFieldName: "personne phys|mandataire administrateur ou gestionnaire",
    type: "radio",
    required: false,
    label: { fr: "16. J'exerce l'activité comme :", nl: "", de: "" },
    options: [
      { value: "personne-physique", label: { fr: "Personne physique", nl: "", de: "" } },
      { value: "mandataire", label: { fr: "Mandataire, administrateur ou gestionnaire", nl: "", de: "" } },
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
    label: { fr: "Je dispose d'un numéro d'entreprise :", nl: "", de: "" },
    options: YN,
    visibleIf: { fieldId: "formeActivite", op: "equals", value: "mandataire" },
    section: SECTION_ACTIVITES,
    order: 68,
  },
  {
    id: "numeroEntreprise",
    pdfFieldName: "TVA",
    type: "bce",
    required: false,
    label: { fr: "Numéro d'entreprise (BCE)", nl: "", de: "" },
    visibleIf: { fieldId: "disposeNumeroEntreprise", op: "equals", value: "oui" },
    section: SECTION_EMPLOYEUR,
    order: 69,
  },
  {
    id: "descriptionActivite1",
    pdfFieldName: "Je décris mon activité 1",
    type: "text",
    required: false,
    label: { fr: "Je décris mon activité", nl: "", de: "" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 70,
  },
  {
    id: "descriptionActivite2",
    pdfFieldName: "Je décris mon activité 2",
    type: "text",
    required: false,
    label: { fr: "Je décris mon activité (suite)", nl: "", de: "" },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 71,
  },

  // ====================================================================
  // Q17 — EXERCEREZ-VOUS CETTE ACTIVITÉ PENDANT VOTRE CHÔMAGE ?
  // ====================================================================
  {
    id: "exerceraPendantChomage",
    pdfFieldName: "oui_7|non_8",
    type: "radio",
    required: false,
    label: { fr: "17. Exercerez-vous cette activité pendant votre chômage ?", nl: "", de: "" },
    help: {
      fr: "Réponds aussi « oui » si tu exerces cette activité seulement pendant des périodes de chômage temporaire auprès de ton employeur (à partir du premier jour de chômage du mois concerné jusqu'à la fin du mois).",
      nl: "", de: "",
    },
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 72,
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
    // ("1_3", ordre 130) que l'inférence automatique a rattachée à tort loin
    // de sa vraie position — logiquement la 1re ligne de "pendant les
    // périodes" de Q18 (numérotation [1] manquante dans le groupe 98-103,
    // qui commence directement à [2]).
    periodesTextFields: ["1_3", "2_3", "3_3", "4_3"],
    irregulierementTextFields: ["1_4", "2_4", "3_4"],
  }),

  // ====================================================================
  // Q19 — QUEL EST LE REVENU NET DE VOTRE ACTIVITÉ ?
  // ====================================================================
  {
    id: "revenuNetSalarieParMois",
    pdfFieldName: "",
    type: "number",
    required: false,
    label: { fr: "19. Revenu net comme salarié — par mois (EUR)", nl: "", de: "" },
    help: {
      fr: "= montant brut diminué des cotisations de sécurité sociale et du précompte professionnel retenus à la source par l'employeur (rémunération mensuelle normale, mais aussi pécule de vacances, 13e mois et avantages en nature éventuels). Jusqu'à 2 chiffres après la virgule.",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 140,
  },
  {
    id: "revenuNetSalarieParHeure",
    pdfFieldName: "",
    type: "number",
    required: false,
    label: { fr: "Revenu net comme salarié — par heure (EUR)", nl: "", de: "" },
    help: { fr: "Jusqu'à 4 chiffres après la virgule.", nl: "", de: "" },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 141,
  },
  {
    id: "revenuNetIndependantParAn",
    pdfFieldName: "",
    type: "number",
    required: false,
    label: { fr: "Revenu net comme indépendant — par an (EUR)", nl: "", de: "" },
    help: {
      fr: "= revenu imposable indiqué sur l'avertissement-extrait de rôle et la note de calcul (recettes diminuées des charges, dépenses et pertes professionnelles). → Joins une copie de la plus récente note de calcul de l'administration des contributions directes.",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 142,
  },
  // A VALIDER Oraliks : aucun widget PDF identifiable dans le dump pour les
  // 3 montants de Q19 (par mois / par heure / par an) — les 3 champs
  // ci-dessus sont laissés virtuels (pdfFieldName vide). À vérifier sur le
  // PDF réel : il est possible que ces cases existent mais que le nommage
  // AcroForm les confonde avec un des champs génériques déjà rattachés à
  // Q4/Q18 (auquel cas il faudra les redistribuer).

  // ====================================================================
  // Q20 — EXERCIEZ-VOUS DÉJÀ CETTE ACTIVITÉ DANS LE PASSÉ ?
  // ====================================================================
  {
    id: "exerceDejaActivite",
    pdfFieldName: "oui_8|non_9",
    type: "radio",
    required: false,
    label: { fr: "20. Exerciez-vous déjà cette activité dans le passé ?", nl: "", de: "" },
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 150,
  },

  // ====================================================================
  // Q21 — DEPUIS QUAND ?
  // ====================================================================
  {
    id: "dateDebutActivite",
    pdfFieldName: "Date43_af_date",
    type: "date",
    required: false,
    label: { fr: "21. Depuis quand exercez-vous cette activité ?", nl: "", de: "" },
    visibleIf: { fieldId: "exerceDejaActivite", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 151,
  },

  // ====================================================================
  // Q22 — JOURS HABITUELLEMENT OCCUPÉ CHEZ L'EMPLOYEUR (CHÔMEUR TEMPORAIRE)
  // ====================================================================
  {
    id: "joursOccupeLundi",
    pdfFieldName: "lu",
    type: "checkbox",
    required: false,
    label: { fr: "Lundi", nl: "", de: "" },
    section: SECTION_ACTIVITES,
    order: 160,
  },
  {
    id: "joursOccupeMardi",
    pdfFieldName: "ma",
    type: "checkbox",
    required: false,
    label: { fr: "Mardi", nl: "", de: "" },
    section: SECTION_ACTIVITES,
    order: 161,
  },
  {
    id: "joursOccupeMercredi",
    pdfFieldName: "me",
    type: "checkbox",
    required: false,
    label: { fr: "Mercredi", nl: "", de: "" },
    section: SECTION_ACTIVITES,
    order: 162,
  },
  {
    id: "joursOccupeJeudi",
    pdfFieldName: "je",
    type: "checkbox",
    required: false,
    label: { fr: "Jeudi", nl: "", de: "" },
    section: SECTION_ACTIVITES,
    order: 163,
  },
  {
    id: "joursOccupeVendredi",
    pdfFieldName: "ve",
    type: "checkbox",
    required: false,
    label: { fr: "Vendredi", nl: "", de: "" },
    section: SECTION_ACTIVITES,
    order: 164,
  },
  {
    id: "joursOccupeSamedi",
    pdfFieldName: "sa",
    type: "checkbox",
    required: false,
    label: { fr: "Samedi", nl: "", de: "" },
    section: SECTION_ACTIVITES,
    order: 165,
  },
  {
    id: "joursOccupeDimanche",
    pdfFieldName: "di",
    type: "checkbox",
    required: false,
    label: { fr: "Dimanche", nl: "", de: "" },
    help: {
      fr: "22. À compléter uniquement si tu es chômeur temporaire : coche les jours où tu es habituellement occupé chez ton employeur.",
      nl: "", de: "",
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
    label: { fr: "23. Je suis indépendant à titre principal :", nl: "", de: "" },
    help: {
      fr: "⚠ À compléter toujours. Si tu es indépendant à titre principal, tu n'as pas droit aux allocations de chômage.",
      nl: "", de: "",
    },
    options: [
      { value: "oui", label: { fr: "Oui, et je sais que je n'ai pas droit aux allocations", nl: "", de: "" } },
      { value: "non", label: { fr: "Non", nl: "", de: "" } },
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
      nl: "", de: "",
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
    id: "nombreAnnexesJointes",
    pdfFieldName: "",
    type: "number",
    required: false,
    label: { fr: "Nombre d'annexes jointes", nl: "", de: "" },
    help: { fr: "« Je joins … annexe(s). »", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 190,
  },
  {
    id: "dateSignature",
    pdfFieldName: "AUJOURD'HUI",
    type: "date",
    required: true,
    label: { fr: "Date de signature", nl: "", de: "" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour.", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 200,
  },
  {
    id: "signature",
    pdfFieldName: "Signature42",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique", nl: "", de: "" },
    help: {
      fr: "Signature « façon Adobe » : ton nom + prénom + horodatage seront appliqués à la position de la signature.",
      nl: "", de: "",
    },
    section: SECTION_SIGNATURE,
    order: 201,
  },

  // ====================================================================
  // CHAMPS NON RATTACHÉS AVEC CERTITUDE
  // ====================================================================
  // A VALIDER Oraliks : "Liste déroulante44" (type select, sans options
  // connues) n'a pas pu être associé à une question précise du texte
  // imprimé — masqué en attendant clarification sur le PDF réel.
  {
    id: "listeDeroulante44",
    pdfFieldName: "Liste déroulante44",
    type: "select",
    required: false,
    label: { fr: "(champ non identifié — voir A VALIDER)", nl: "", de: "" },
    options: [],
    hidden: true,
    section: SECTION_DIVERS_INCONNU,
    order: 900,
  },
  // A VALIDER Oraliks : "voir 19" est un widget texte isolé — probablement
  // un artefact de tooltip capturé comme champ à part entière plutôt qu'un
  // vrai widget de saisie (le texte imprimé "voir 19" est un renvoi de
  // lecture pour Q12, pas une question). Masqué par précaution.
  {
    id: "voir19Artefact",
    pdfFieldName: "voir 19",
    type: "text",
    required: false,
    label: { fr: "(renvoi de lecture — pas un vrai champ, voir A VALIDER)", nl: "", de: "" },
    hidden: true,
    section: SECTION_DIVERS_INCONNU,
    order: 901,
  },
];

/// Set des `pdfFieldName` (radio pipe-séparés compris) couverts par les
/// nouveaux champs. Sert à retirer les entrées auto-inférées (checkboxes
/// individuels, champs génériques "1", "2"…) que le parser AcroForm avait
/// produites avant l'enrichissement.
function coveredPdfFieldNames(): Set<string> {
  const set = new Set<string>();
  for (const f of C1A_FIELDS) {
    if (!f.pdfFieldName) continue;
    for (const name of f.pdfFieldName.split("|")) {
      const trimmed = name.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return set;
}

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id` ET les `pdfFieldName`
/// désormais couverts).
export function applyC1AImprovements(fields: PdfFormField[]): PdfFormField[] {
  const covered = coveredPdfFieldNames();
  const newIds = new Set(C1A_FIELDS.map((f) => f.id));

  const preserved = fields.filter((f) => {
    if (covered.has(f.pdfFieldName)) return false;
    if (newIds.has(f.id)) return false;
    return true;
  });

  return [...preserved, ...C1A_FIELDS];
}
