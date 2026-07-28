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
import { mergeEnrichedFields } from "./_merge";

const SECTION_IDENTITE = "identite";
const SECTION_ADRESSE = "adresse";
const SECTION_EMPLOYEUR = "employeur";
const SECTION_ACTIVITES = "mes-activites";
const SECTION_REVENUS = "mes-revenus";
const SECTION_AFFIRMATIONS = "affirmations";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";

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
      visibleIf: { fieldId: `${opts.idPrefix}${jour}`, op: "equals", value: true },
      section: opts.section,
      order: ordre(),
    });
    fields.push({
      id: `${opts.idPrefix}${jour}Entre7h18h`,
      pdfFieldName: suffixes.entre7h18h[i],
      type: "checkbox",
      required: false,
      label: { fr: "Entre 7 h et 18 h" },
      visibleIf: { fieldId: `${opts.idPrefix}${jour}`, op: "equals", value: true },
      section: opts.section,
      order: ordre(),
    });
    fields.push({
      id: `${opts.idPrefix}${jour}Apres18h`,
      pdfFieldName: suffixes.apres18h[i],
      type: "checkbox",
      required: false,
      label: { fr: "Après 18 h" },
      visibleIf: { fieldId: `${opts.idPrefix}${jour}`, op: "equals", value: true },
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
    required: false,
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

  opts.periodesTextFields.forEach((pdfFieldName, i) => {
    fields.push({
      id: `${opts.idPrefix}periodesTexte${i + 1}`,
      pdfFieldName,
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
    help: {
      fr: "⚠ Si tu aides plus d'un indépendant, remplis un formulaire C1A séparé pour chaque indépendant.",
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
    id: "natureActiviteIndependant1",
    pdfFieldName: "mentionnez les toutes 1",
    type: "text",
    required: false,
    label: { fr: "Nature de l'activité de l'indépendant [1]" },
    help: {
      fr: "Si l'indépendant exerce plusieurs activités, mentionne-les toutes (une par ligne).",
    },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 5,
  },
  {
    id: "natureActiviteIndependant2",
    pdfFieldName: "mentionnez les toutes 2",
    type: "text",
    required: false,
    label: { fr: "Nature de l'activité de l'indépendant [2]" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 6,
  },
  {
    id: "natureActiviteIndependant3",
    pdfFieldName: "mentionnez les toutes 3",
    type: "text",
    required: false,
    label: { fr: "Nature de l'activité de l'indépendant [3]" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 7,
  },
  {
    id: "natureActiviteIndependant4",
    pdfFieldName: "mentionnez les toutes 4",
    type: "text",
    required: false,
    label: { fr: "Nature de l'activité de l'indépendant [4]" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 8,
  },
  {
    id: "natureActiviteIndependant5",
    pdfFieldName: "mentionnez les toutes 5",
    type: "text",
    required: false,
    label: { fr: "Nature de l'activité de l'indépendant [5]" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 9,
  },

  // ====================================================================
  // Q3 — AIDERAS-TU CET INDÉPENDANT PENDANT TON CHÔMAGE ?
  // ====================================================================
  {
    id: "aideraPendantChomage",
    pdfFieldName: "oui_2|non_2",
    type: "radio",
    required: false,
    label: { fr: "3. Aiderez-vous cet indépendant pendant votre chômage ?" },
    help: {
      fr: "Réponds aussi « oui » si tu aides cet indépendant seulement durant des périodes de chômage temporaire (à partir du premier jour de chômage du mois concerné jusqu'à la fin du mois).",
    },
    options: YN,
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    // 9.5 et non 9 : le bloc Q2 ci-dessus a gagné un champ (independantNumeroEntreprise),
    // ce qui pousse natureActiviteIndependant5 à order 9. Fractionnaire pour
    // rester strictement après lui sans renuméroter toute la suite du fichier
    // (même convention que `numero`/`commune` en tête de fichier).
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
    label: { fr: n === 1 ? "5. Décrivez l'aide que vous apporterez" : `Description de l'aide (suite) [${n}]` },
    visibleIf: { fieldId: "aideIndependant", op: "equals" as const, value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 45 + n,
  })),

  // ====================================================================
  // Q6 — COMBIEN GAGNEZ-VOUS POUR VOTRE AIDE ?
  // ====================================================================
  {
    // Q6 attend un montant « par mois » OU « par an » sur une même ligne
    // pointillée. Le widget `Montant` couvre cette ligne ET les deux montants
    // de Q11 en page 2, avec une seule valeur partagée — donc inexploitable.
    id: "montantAidePeriodicite",
    pdfFieldName: "",
    type: "radio",
    required: false,
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
    id: "aidaitDejaIndependant",
    pdfFieldName: "oui_3|non_3",
    type: "radio",
    required: false,
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
    id: "dateDebutAide",
    pdfFieldName: "Date41_af_date",
    type: "date",
    required: false,
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
    help: {
      fr: "Si tu es conseiller communal, conseiller provincial, membre d'un C.P.A.S., juge social, juge consulaire ou conseiller social, réponds « non » (ce cas ne demande pas de suite ici).",
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
    required: false,
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
    required: false,
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
    help: {
      fr: "Réponds toujours « oui » si tu es inscrit comme indépendant à titre accessoire ou si tu es administrateur de société. Si tu exerces plusieurs activités accessoires, remplis un formulaire C1A pour chacune.",
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
    id: "employeurNom",
    pdfFieldName: "14 Données concernant votre employeur",
    type: "text",
    required: false,
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
    id: "adresseActivite",
    pdfFieldName: "A quelle adresse exercezvous cette activité",
    type: "text",
    required: false,
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
    id: "formeActivite",
    pdfFieldName: "personne phys|mandataire administrateur ou gestionnaire",
    type: "radio",
    required: false,
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
    id: "exerceraPendantChomage",
    pdfFieldName: "oui_7|non_8",
    type: "radio",
    required: false,
    label: { fr: "17. Exercerez-vous cette activité pendant votre chômage ?" },
    help: {
      fr: "Réponds aussi « oui » si tu exerces cette activité seulement pendant des périodes de chômage temporaire auprès de ton employeur (à partir du premier jour de chômage du mois concerné jusqu'à la fin du mois).",
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
    // Les trois cases de revenu de Q19 appartiennent au champ AcroForm
    // « voir 19 », qui porte QUATRE widgets partageant une seule valeur — donc
    // inutilisable pour trois montants distincts. Écriture positionnelle.
    // Coordonnées mesurées : ligne « par mois : … EUR / par heure : … EUR »
    // imprimée à y=567, ligne « par an : … » à y=497.
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
    id: "revenuNetSalarieParHeure",
    pdfFieldName: "",
    drawAt: { page: 1, x: 487, y: 563, size: 9, maxWidth: 46 },
    type: "number",
    required: false,
    label: { fr: "Revenu net comme salarié — par heure (EUR)" },
    help: { fr: "Indique jusqu'à 4 chiffres après la virgule." },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
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
    id: "exerceDejaActivite",
    pdfFieldName: "oui_8|non_9",
    type: "radio",
    required: false,
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
    id: "dateDebutActivite",
    pdfFieldName: "Date43_af_date",
    type: "date",
    required: false,
    label: { fr: "21. Depuis quand exercez-vous cette activité ?" },
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
]);

export function applyC1AImprovements(fields: PdfFormField[]): PdfFormField[] {
  return mergeEnrichedFields(fields, C1A_FIELDS, LEGACY_C1A_FIELD_IDS);
}
