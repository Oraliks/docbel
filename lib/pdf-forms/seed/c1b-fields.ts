// Schéma enrichi du formulaire "C1B - Déclaration de revenus (pension de
// retraite ou de survie)" (2 pages, 51 widgets AcroForm).
//
// Formulaire compagnon déclenché depuis le C1 quand le citoyen répond "oui" à
// la question "Je perçois une pension de retraite ou de survie" (cf.
// C1_TRIGGERS dans c1-fields-improvements.ts, requiresFormSlug: "c1b").
//
// Principe (texte imprimé sur le PDF) : le chômeur qui bénéficie d'un revenu
// (ici une pension, ou certaines indemnités assimilées) doit le déclarer. Le
// bureau du chômage vérifie ensuite si ce revenu est cumulable entièrement,
// partiellement, ou pas du tout avec les allocations de chômage.
//
// Mapping AcroForm vérifié sur private/pdfs/C1B_FR.pdf (positions x/y des
// widgets extraites via pdf-lib — cf. script d'inspection ponctuel, non
// conservé dans le repo). Les deux pages du C1B sont imprimées en 2 colonnes ;
// l'ordre de progression des questions (1 → 15) alterne colonne gauche puis
// colonne droite sur la page 1, uniquement colonne gauche/droite sur la
// page 2 — l'ordre `order` ci-dessous suit la numérotation imprimée, pas
// l'ordre brut des widgets dans le PDF.
// Référence : FORMULAIRE C1B, version imprimée 15.09.2023/830.10.003.

import type { PdfFormField } from "../types";
import { mergeEnrichedFields } from "./_merge";

const SECTION_IDENTITE = "identite";
const SECTION_REVENUS = "mes-revenus";
const SECTION_DIVERS = "divers";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";

const YN = [
  { value: "oui", label: { fr: "Oui" } },
  { value: "non", label: { fr: "Non" } },
];

/// Q15 — « COMPLETEZ TOUJOURS CETTE RUBRIQUE » : les cinq cases d'annexes
/// partagent cette clé, ce qui les rend obligatoires ENSEMBLE — au moins une
/// cochée (`requiredGroup`, cf. `buildValidator`). Aucune ne l'est
/// individuellement : rien ne dit qu'un dossier comporte une décision belge
/// PLUTÔT qu'étrangère, et la charte du projet interdit de rendre obligatoire
/// une case plutôt que sa voisine — c'est le CHOIX qui commande la rubrique
/// qui l'est.
///
/// Le titre imprimé ne laisse pas le choix : la rubrique se remplit quel que
/// soit le chemin suivi dans les quatorze questions précédentes. Sans cette
/// clé, on pouvait signer un C1B en déclarant zéro annexe, alors que chaque
/// branche « oui » du formulaire réclame une pièce (décision d'octroi, copie
/// de paiement, modèle 74…).
const GROUPE_ANNEXES = "c1bAnnexes";

// ===========================================================================
// LES QUATRE DATES DE `Date46_af_date` — un champ, quatre cases, une valeur
// ===========================================================================
//
// Vérifié à pypdf (`/Kids`) puis sur le papier : le champ AcroForm
// `Date46_af_date` porte QUATRE widgets, sur quatre questions différentes de la
// page 1 :
//
//   y=696,6  Q4  « À partir de quelle date avez-vous droit à cette pension ? »
//   y=447,9  Q7  « A partir du » (prise d'effet de la pension de survie belge)
//   y=209,7  Q7  « oui, du »  (début de la période de cumul antérieur)
//   y=194,4  Q7  « au »       (fin de la MÊME période)
//
// Une seule valeur pour quatre cases : remplir l'une remplissait les quatre —
// le « du » et le « au » d'une même période sortaient identiques. Le seed
// précédent ne mappait que la première et déclarait les trois autres en champs
// VIRTUELS (`pdfFieldName: ""`, sans `drawAt`), avec la mention « aucun widget
// AcroForm dédié n'apparaît à cet endroit dans le dump » : leurs valeurs
// étaient donc saisies par le citoyen puis **jamais imprimées**. Les widgets
// existent, ils étaient simplement groupés sous un seul nom.
//
// Sortie : écriture positionnelle des quatre cases (cf. PDF_FORMS_RULES.md).
//
// Les quatre guides sont le MÊME peigne imprimé (8 tirets SymbolMT, groupés
// 2-2-4, pas de 12,0 pt, +5,04 aux barres obliques) — seules changent les
// coordonnées. Mesuré à pdfplumber, position verticale de l'encre relevée par
// rastérisation à 800 dpi.
const DATE_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [2, 2, 4],
  slotWidth: 12.0,
  groupExtra: 5.04,
};

/// Une des quatre cases de `Date46_af_date`, en positionnel. `x` = abscisse du
/// premier tiret + le centrage d'un chiffre de 9 pt dans une case de 9 pt ;
/// `y` = ligne de base du guide.
function dateEnPeigne(x: number, y: number): Pick<PdfFormField, "pdfFieldName" | "drawAt" | "printAsComb" | "fontSize"> {
  return {
    pdfFieldName: "",
    drawAt: { page: 0, x, y, size: 9 },
    printAsComb: DATE_COMB,
    fontSize: 9,
  };
}

export const C1B_FIELDS: PdfFormField[] = [
  // ==========================================================================
  // IDENTITÉ (bloc intercalé au milieu de la page 1 sur le PDF officiel,
  // entre la question 6 et la question 7 — regroupé ici en tête par cohérence
  // d'affichage côté citoyen).
  // ==========================================================================
  {
    id: "niss",
    pdfFieldName: "NISS",
    type: "niss",
    required: true,
    label: { fr: "Numéro NISS (registre national)" },
    help: {
      fr: "11 chiffres au dos de votre carte d'identité (eID), au-dessus du code-barres.",
    },
    placeholder: { fr: "00.00.00-000.00" },
    prefillFrom: "profile.niss",
    canonicalKey: "identity.niss",
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: -100,
  },
  {
    id: "nom",
    pdfFieldName: "nom",
    type: "text",
    required: true,
    label: { fr: "Nom" },
    prefillFrom: "profile.lastName",
    canonicalKey: "identity.nom",
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: -99,
  },
  {
    id: "pr_nom",
    pdfFieldName: "prénom",
    type: "text",
    required: true,
    label: { fr: "Prénom" },
    prefillFrom: "profile.firstName",
    canonicalKey: "identity.prenom",
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: -98,
  },
  {
    id: "rue",
    pdfFieldName: "rue",
    type: "text",
    required: true,
    label: { fr: "Rue" },
    prefillFrom: "profile.street",
    canonicalKey: "adresse.rue",
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: -97,
  },
  {
    id: "num_ro",
    pdfFieldName: "numéro",
    type: "text",
    required: true,
    label: { fr: "Numéro" },
    canonicalKey: "adresse.numero",
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: -96,
  },
  {
    id: "code_postal",
    pdfFieldName: "code postal",
    type: "postal_be",
    required: true,
    label: { fr: "Code postal" },
    placeholder: { fr: "1000" },
    prefillFrom: "profile.postalCode",
    canonicalKey: "adresse.codePostal",
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: -95,
  },
  {
    id: "commune",
    pdfFieldName: "commune",
    type: "text",
    required: true,
    label: { fr: "Commune" },
    // Seul champ d'adresse du C1B sans clé canonique jusqu'au 2026-07-26 : le
    // citoyen retapait sa commune alors que tout le reste de son adresse
    // arrivait tout seul.
    prefillFrom: "profile.city",
    canonicalKey: "adresse.commune",
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: -94,
  },
  // En-tête de la page 2 (« Suite C1B — NISS … Nom … ») : c'est un DOUBLON du
  // nom saisi page 1. Il n'est plus un champ du schéma (2026-07-26) mais un
  // widget écrit par la règle serveur `bind:Nom` (bindings/per-form/c1b.ts),
  // qui le recopie depuis le champ `nom` au moment de générer le PDF.
  //
  // En tant que champ, il était `readOnly` + `prefillFrom: profile.lastName` :
  // il ne se remplissait qu'au montage et depuis le PROFIL. Un citoyen qui
  // saisissait son nom directement dans le C1B laissait donc l'en-tête de la
  // page 2 VIDE, sans pouvoir y remédier puisque le champ était verrouillé.

  // ==========================================================================
  // Q1-Q4 — Droit à une pension de retraite complète (colonne gauche, p.1)
  // ==========================================================================
  {
    id: "droitPensionRetraiteComplete",
    pdfFieldName: "oui_2|non_2",
    type: "radio",
    required: true,
    label: {
      fr: "Avez-vous, vu votre âge et votre carrière professionnelle, droit à une pension de retraite complète (même si vous n'en bénéficiez pas) ?",
    },
    options: YN,
    section: SECTION_REVENUS,
    order: 1,
  },
  {
    id: "typePensionRetraiteComplete",
    pdfFieldName: "une pens_5|une pens_6",
    type: "radio",
    required: false,
    label: { fr: "Cette pension de retraite complète est…" },
    options: [
      { value: "belge", label: { fr: "Une pension de retraite belge" } },
      { value: "etrangere", label: { fr: "Une pension de retraite étrangère" } },
    ],
    visibleIf: { fieldId: "droitPensionRetraiteComplete", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 2,
  },
  {
    // UN champ pour les TROIS lignes pointillées imprimées : le papier ne pose
    // qu'une question (« Quelle est la dénomination exacte de la pension de
    // retraite complète à laquelle vous avez droit ? »), les trois lignes ne
    // numérotent que des lignes. Le doute d'origine (« 3 champs distincts ou
    // 3 lignes de la même réponse ? ») est tranché par le papier : c'est bien
    // une seule réponse. Même correction que la description d'activité du C1C.
    //
    // `id` conservé (celui de l'ex-1re ligne) pour ne pas perdre les brouillons
    // déjà en base ; les deux autres sont purgés par LEGACY_C1B_FIELD_IDS.
    id: "denominationPensionRetraiteComplete",
    pdfFieldName: "",
    lineTargets: [
      { pdfFieldName: "undefined" },
      { pdfFieldName: "undefined_2" },
      { pdfFieldName: "undefined_3" },
    ],
    type: "textarea",
    required: false,
    label: { fr: "Dénomination exacte de la pension de retraite complète" },
    help: {
      fr: "Exemples : pension de retraite secteur public, pension de retraite secteur privé, pension de retraite d'indépendant.",
    },
    visibleIf: { fieldId: "droitPensionRetraiteComplete", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 3,
  },
  {
    id: "datePensionRetraiteComplete",
    // 1re des quatre cases de `Date46_af_date` (cf. le bloc en tête du fichier).
    ...dateEnPeigne(323.12, 697.4),
    type: "date",
    required: false,
    label: { fr: "À partir de quelle date avez-vous droit à cette pension ?" },
    visibleIf: { fieldId: "droitPensionRetraiteComplete", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 6,
  },

  // ==========================================================================
  // Q5-Q6 — Perception effective d'une pension (colonne droite, p.1)
  // ==========================================================================
  {
    id: "percoitPension",
    pdfFieldName: "oui|non",
    type: "radio",
    required: true,
    label: { fr: "Percevez-vous une pension ?" },
    options: YN,
    section: SECTION_REVENUS,
    order: 10,
  },
  {
    id: "typePensionPercue",
    pdfFieldName: "une pens|une pens_2|une pens_3|une pens_4",
    type: "radio",
    required: false,
    label: { fr: "Je perçois…" },
    help: {
      fr: "⚠ Pour une pension de retraite (belge ou étrangère) ou de survie étrangère, joignez une copie de la décision d'octroi de la pension (décision provisoire ou définitive) et une copie du paiement le plus récent.",
    },
    options: [
      { value: "retraite-belge", label: { fr: "Une pension de retraite belge" } },
      { value: "retraite-etrangere", label: { fr: "Une pension de retraite étrangère" } },
      { value: "survie-etrangere", label: { fr: "Une pension de survie étrangère" } },
      { value: "survie-belge", label: { fr: "Une pension de survie belge" } },
    ],
    visibleIf: { fieldId: "percoitPension", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 11,
  },

  // ==========================================================================
  // Q7 — Pension de survie belge : date d'effet + cumul avec allocations de
  // chômage + cumul antérieur avec maladie/invalidité/chômage/prépension
  // (visible seulement si Q6 = pension de survie belge).
  // ==========================================================================
  {
    // 2e case de `Date46_af_date` (y=447,9). Le doute d'origine (« aucun widget
    // AcroForm dédié n'apparaît à cet endroit ») est levé : le widget existe,
    // il était groupé sous le nom du premier. Sans ce `drawAt`, la date était
    // saisie par le citoyen et jamais imprimée.
    id: "dateEffetPensionSurvieBelge",
    ...dateEnPeigne(348.57, 448.5),
    type: "date",
    required: false,
    label: { fr: "Pension de survie belge — à partir du" },
    visibleIf: { fieldId: "typePensionPercue", op: "equals", value: "survie-belge" },
    section: SECTION_REVENUS,
    order: 20,
  },
  {
    id: "cumulPensionSurvieChomage",
    pdfFieldName: "non_3|oui Joignez",
    type: "radio",
    required: false,
    label: { fr: "Désirez-vous cumuler vos allocations de chômage avec votre pension de survie ?" },
    help: {
      fr: "⚠ Si oui, joignez : une copie de la décision d'octroi de la pension (décision provisoire ou définitive) ET une copie d'un modèle 74 ou 74bis PSS ou d'une Déclaration Pension, activité professionnelle et revenu de remplacement du Service fédéral des Pensions.",
    },
    options: [
      { value: "non", label: { fr: "Non" } },
      { value: "oui", label: { fr: "Oui" } },
    ],
    visibleIf: { fieldId: "typePensionPercue", op: "equals", value: "survie-belge" },
    section: SECTION_REVENUS,
    order: 21,
  },
  {
    id: "cumulAnterieurMaladieChomagePrepension",
    pdfFieldName: "non_4|toggle_14",
    type: "radio",
    required: false,
    label: {
      fr: "Avez-vous déjà bénéficié de cette pension de survie lors de périodes durant lesquelles vous perceviez également des allocations pour maladie ou invalidité, chômage, prépension conventionnelle, chômage avec complément d'entreprise, interruption de carrière ou crédit-temps ?",
    },
    options: [
      { value: "non", label: { fr: "Non" } },
      { value: "oui", label: { fr: "Oui, du…" } },
    ],
    visibleIf: { fieldId: "typePensionPercue", op: "equals", value: "survie-belge" },
    section: SECTION_REVENUS,
    order: 22,
  },
  // Les 3e et 4e cases de `Date46_af_date` : le « du » et le « au » d'une MÊME
  // période. C'est le cas le plus visible du défaut — avec un champ partagé,
  // les deux bornes sortaient identiques ; en virtuel, aucune ne sortait.
  {
    id: "cumulAnterieurDateDebut",
    ...dateEnPeigne(385.65, 209.95),
    type: "date",
    required: false,
    label: { fr: "Période de cumul antérieur — du" },
    visibleIf: { fieldId: "cumulAnterieurMaladieChomagePrepension", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 23,
  },
  {
    id: "cumulAnterieurDateFin",
    ...dateEnPeigne(388.15, 194.95),
    type: "date",
    required: false,
    label: { fr: "Période de cumul antérieur — au" },
    visibleIf: { fieldId: "cumulAnterieurMaladieChomagePrepension", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 24,
  },

  // ==========================================================================
  // Q8-Q9 — Indemnité de maladie-invalidité à charge d'une institution
  // étrangère (fin page 1 / début page 2).
  // ==========================================================================
  {
    id: "indemniteMaladieInvaliditeEtrangere",
    pdfFieldName: "oui_3|non_5",
    type: "radio",
    required: true,
    label: { fr: "Percevez-vous une indemnité de maladie-invalidité à charge d'une institution étrangère ?" },
    options: YN,
    section: SECTION_REVENUS,
    order: 30,
  },
  {
    id: "montantIndemniteMaladieInvalidite",
    pdfFieldName: "Texte48",
    type: "number",
    required: false,
    label: { fr: "Montant mensuel net de votre indemnité (EUR)" },
    help: {
      fr: "Net = montant brut diminué des cotisations de sécurité sociale et du précompte professionnel. → Joignez une copie de la décision d'octroi de cette allocation ET une copie de paiement le plus récent.",
    },
    visibleIf: { fieldId: "indemniteMaladieInvaliditeEtrangere", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 31,
  },

  // ==========================================================================
  // Q10-Q12 — Indemnité d'accident du travail ou maladie professionnelle
  // (colonne gauche, page 2).
  // ==========================================================================
  {
    id: "indemniteAccidentTravailBelge",
    pdfFieldName: "oui_5|non_7",
    type: "radio",
    required: true,
    label: { fr: "Percevez-vous une indemnité belge d'accident du travail ou de maladie professionnelle ?" },
    options: YN,
    section: SECTION_REVENUS,
    order: 40,
  },
  {
    id: "natureIndemniteAccidentTravail",
    pdfFieldName: "i|i_2|i_3",
    type: "radio",
    required: false,
    label: { fr: "Cette indemnité est un dédommagement pour…" },
    help: {
      fr: "→ Joignez une attestation de l'organisme assureur mentionnant le degré d'incapacité permanente de travail et la date de consolidation.",
    },
    options: [
      { value: "totale-temporaire", label: { fr: "Incapacité temporaire totale de travail" } },
      { value: "partielle-temporaire", label: { fr: "Incapacité temporaire partielle de travail" } },
      { value: "permanente", label: { fr: "Incapacité permanente de travail" } },
    ],
    visibleIf: { fieldId: "indemniteAccidentTravailBelge", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 41,
  },
  {
    id: "indemniteAccidentTravailEtrangere",
    pdfFieldName: "oui_6|non_8",
    type: "radio",
    required: true,
    label: { fr: "Percevez-vous une indemnité d'accident du travail ou de maladie professionnelle à charge d'une institution étrangère ?" },
    help: { fr: "→ Si oui, joignez la décision d'octroi de cette allocation." },
    options: YN,
    section: SECTION_REVENUS,
    order: 42,
  },

  // ==========================================================================
  // Q13-Q14 — Congé sans solde (colonne droite, page 2).
  // ==========================================================================
  {
    id: "congeSansSolde",
    pdfFieldName: "oui_4|non_6",
    type: "radio",
    required: true,
    label: { fr: "Vous trouvez-vous dans une période de congé sans solde ?" },
    options: YN,
    section: SECTION_DIVERS,
    order: 50,
  },
  {
    id: "congeSansSoldeNomEmployeur",
    pdfFieldName: "nom employeur",
    type: "text",
    required: false,
    label: { fr: "Congé sans solde — nom de l'employeur" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 51,
  },
  {
    id: "congeSansSoldeAdresseEmployeur",
    pdfFieldName: "adresse employeur",
    type: "text",
    required: false,
    label: { fr: "Congé sans solde — adresse de l'employeur" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 52,
  },
  // SECOND champ AcroForm à widgets multiples : `Date50_af_date` porte les DEUX
  // bornes de « Période de congé sans solde : du …… au …… » (page 2, y=585,8 et
  // y=584,5, côte à côte sur la même ligne imprimée). Une seule valeur pour les
  // deux : le début et la fin sortaient identiques. Écriture positionnelle,
  // comme les quatre dates de `Date46_af_date`.
  //
  // Ici le guide imprimé est une ligne POINTILLÉE, pas un peigne : pas de
  // `printAsComb`, la date s'écrit d'un bloc sur le trait (ligne de base
  // mesurée à 585,09 pour les deux bornes).
  {
    id: "congeSansSoldeDateDebut",
    pdfFieldName: "",
    drawAt: { page: 1, x: 435, y: 585.09, size: 9, maxWidth: 56 },
    type: "date",
    required: false,
    label: { fr: "Période de congé sans solde — du" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 53,
  },
  {
    id: "congeSansSoldeDateFin",
    pdfFieldName: "",
    drawAt: { page: 1, x: 506.5, y: 585.09, size: 9, maxWidth: 52 },
    type: "date",
    required: false,
    label: { fr: "Période de congé sans solde — au" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 54,
  },

  // ==========================================================================
  // Q15 — Rubrique à toujours compléter : affirmation finale + annexes.
  // Le texte imprimé ("J'affirme sur l'honneur que la présente déclaration
  // est sincère et complète et je m'engage à communiquer, dans les 7 jours,
  // toute modification à mon organisme de paiement") n'a PAS de case à cocher
  // dédiée sur ce PDF (contrairement au C1 principal) — c'est un engagement
  // imprimé, affiché ici comme rappel informatif non stocké. Les 4 widgets
  // checkbox disponibles ("déc", "déc_2", "copies de paiement", "une copie du
  // modèle 74…") correspondent 1-pour-1 aux 4 annexes listées juste après
  // dans le texte, dans le même ordre.
  // ==========================================================================
  {
    // « Je joins .............. annexe(s): » — le widget `Liste déroulante49`
    // est posé sur ce pointillé (page 2, y=469), et non sur le « au » de la
    // période de congé sans solde comme le supposait le schéma précédent (qui y
    // écrivait donc une DATE, et laissait le compte d'annexes vide).
    //
    // Le widget est un dropdown SANS options (`/Opt` vide) : le filler ajoute
    // la valeur aux options avant de la sélectionner, ce qui rend un champ de
    // saisie libre. Le doute consigné à ce sujet est levé — il ne s'agissait
    // pas d'une liste fermée dont il aurait fallu deviner les valeurs.
    id: "nombreAnnexes",
    pdfFieldName: "Liste déroulante49",
    type: "number",
    // Obligatoire, et au moins 1 : la rubrique impose de joindre quelque chose
    // (cf. `GROUPE_ANNEXES`), donc « 0 annexe » se contredirait avec la case
    // qu'on vient de cocher juste en dessous. Laisser le compte facultatif
    // imprimait « Je joins ......... annexe(s) : ☒ copie(s) de paiement ».
    required: true,
    min: 1,
    label: { fr: "Nombre d'annexes jointes" },
    help: { fr: "Comptez les documents que vous joignez à ce formulaire." },
    section: SECTION_ANNEXES,
    order: 59,
  },
  {
    id: "annexeDecisionsBelges",
    pdfFieldName: "déc",
    type: "checkbox",
    required: false,
    label: { fr: "Je joins : décision(s) d'octroi d'institutions belges" },
    // ANCRE du groupe : `buildValidator` attache l'erreur au premier champ
    // visible qui porte la clé, et c'est donc ce libellé-ci qui la reçoit. Le
    // message par défaut (« Sélectionnez au moins une option ci-dessus ») dirait
    // le contraire de ce qu'on voit : les cases sont EN DESSOUS, l'erreur étant
    // rendue sous la première d'entre elles.
    errorMsg: {
      fr: "Cette rubrique est toujours à compléter : cochez au moins un document joint ci-dessous.",
    },
    requiredGroup: GROUPE_ANNEXES,
    section: SECTION_ANNEXES,
    order: 60,
  },
  {
    id: "annexeDecisionsEtrangeres",
    pdfFieldName: "déc_2",
    type: "checkbox",
    required: false,
    label: { fr: "Je joins : décision(s) d'octroi d'institutions étrangères" },
    requiredGroup: GROUPE_ANNEXES,
    section: SECTION_ANNEXES,
    order: 61,
  },
  {
    id: "annexeCopiesPaiement",
    pdfFieldName: "copies de paiement",
    type: "checkbox",
    required: false,
    label: { fr: "Je joins : copie(s) de paiement" },
    requiredGroup: GROUPE_ANNEXES,
    section: SECTION_ANNEXES,
    order: 62,
  },
  {
    id: "annexeModele74",
    pdfFieldName: "une copie du modèle 74 ou 74bis PSS ou de la Déc",
    type: "checkbox",
    required: false,
    label: { fr: "Je joins : une copie du modèle 74 ou 74bis PSS ou de la Déclaration Pension, activité professionnelle et revenu de remplacement du Service fédéral des Pensions" },
    requiredGroup: GROUPE_ANNEXES,
    section: SECTION_ANNEXES,
    order: 63,
  },
  {
    id: "annexeAutre",
    pdfFieldName: "autre à savoir",
    type: "checkbox",
    required: false,
    label: { fr: "Je joins : autre document, à savoir…" },
    requiredGroup: GROUPE_ANNEXES,
    section: SECTION_ANNEXES,
    order: 64,
  },
  {
    // UN seul champ pour les DEUX lignes pointillées imprimées : le papier ne
    // pose qu'une question (« autre, à savoir : »), les deux lignes ne
    // numérotent que des lignes. Même correction que la description d'activité
    // du C1C et les annexes du C46 — `filler.ts` replie le texte par mots sur
    // les deux cibles et réduit la police sur la dernière en cas de
    // débordement, jamais de perte silencieuse.
    //
    // `id` conservé (celui de l'ex-1re ligne) pour ne pas perdre les brouillons
    // déjà en base ; la seconde est purgée par LEGACY_C1B_FIELD_IDS.
    id: "annexeAutreDescription",
    pdfFieldName: "",
    lineTargets: [{ pdfFieldName: "undefined_4" }, { pdfFieldName: "undefined_5" }],
    type: "textarea",
    // Obligatoire SUR CETTE BRANCHE seulement : `buildValidator` saute les
    // champs invisibles, l'exigence ne pèse donc que si « autre » est coché.
    // Le papier demande « autre, à savoir : … » — la case seule ne dit rien, et
    // c'est la seule des cinq qui puisse satisfaire le groupe sans nommer
    // aucune pièce.
    required: true,
    label: { fr: "Description du document joint" },
    visibleIf: { fieldId: "annexeAutre", op: "equals", value: true },
    section: SECTION_ANNEXES,
    order: 65,
  },

  // ==========================================================================
  // Date et signature
  // ==========================================================================
  {
    id: "dateSignature",
    // Le nom de widget « AUJOURD'HUI » surprend pour une date de signature,
    // mais il est bon : le widget est en page 2 à (341, 299), juste au-dessus
    // du « date signature du travailleur » imprimé (y=296,3) et à gauche du
    // widget de signature. Vérifié sur le PDF, doute levé.
    pdfFieldName: "AUJOURD'HUI",
    type: "date",
    required: true,
    label: { fr: "Date de signature" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour." },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 67,
  },
  {
    id: "signature",
    pdfFieldName: "Signature51",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique" },
    help: {
      fr: "Signature « façon Adobe » : votre nom + prénom + horodatage seront appliqués à la position de la signature.",
    },
    section: SECTION_SIGNATURE,
    order: 68,
  },
];

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id`).
///
/// Retire tout ancien champ auto-inféré dont le `pdfFieldName` (widget PDF
/// réel) est repris par un des nouveaux champs — que ce soit via une paire
/// fusionnée ("oui_2|non_2") ou un champ simple redéfini sous un nouvel `id`
/// (ex. l'ancien champ auto-inféré `undefined` devient
/// `denominationPensionRetraiteComplete`). Sans ça, l'ancien champ au libellé
/// auto-généré ("undefined", "Liste DéRoulante49"…) resterait en doublon à
/// côté de sa version enrichie.
/// Champs d'une version antérieure du schéma dont le widget est désormais
/// écrit par une RÈGLE serveur. L'overlay ne peut pas les repérer seul : leur
/// `pdfFieldName` n'est plus couvert par aucun champ, donc le filtre `covered`
/// les laisserait survivre en base et se battre avec la règle.
const LEGACY_C1B_FIELD_IDS = new Set<string>([
  // En-tête page 2 → règle `bind:Nom` (bindings/per-form/c1b.ts).
  "nomPage2",
  // Même widget « Nom » (en-tête page 2, y=793), mais l'`id` produit par
  // l'INFÉRENCE à l'import — distinct du camelCase ci-dessus, donc jamais
  // attrapé. Il posait une seconde question « Nom » au citoyen, à côté du champ
  // `nom` du seed qui vise, lui, le widget « nom » de la PAGE 1 (y=499) : le
  // PDF distingue les deux par la casse.
  "nom_1",
  // Seconde ligne de « autre, à savoir : », repliée dans le textarea
  // `annexeAutreDescription` via `lineTargets` (2026-07-31).
  "annexeAutreDescriptionSuite",
  // Lignes 2 et 3 de la dénomination (question 3), repliées dans le textarea
  // `denominationPensionRetraiteComplete` via `lineTargets` (2026-07-31).
  "denominationPensionRetraiteComplete2",
  "denominationPensionRetraiteComplete3",
]);

// ===========================================================================
// PARCOURS À L'ÉCRAN — une question = une étape (patron du C1A / C1C / C47)
// ===========================================================================
//
// Le repli par défaut découpait par SECTION : cinq étapes, dont une
// « Mes revenus » de vingt champs couvrant les questions 1 à 12 du papier. Une
// question par étape rend les branches gratuites — `visibleIf` non satisfait ⟹
// aucun champ visible ⟹ aucune étape — et le C1B est le formulaire de la
// famille qui en compte le plus : un citoyen qui répond « non » partout ne voit
// que huit écrans au lieu d'une page interminable.

/// Étape de l'en-tête d'identité — la seule qui ne soit pas une question. Sur
/// le papier elle est intercalée au milieu de la page 1 ; à l'écran elle passe
/// en tête, et disparaît dans un dossier (cf. `inheritedFromDossier`).
export const C1B_GROUPE_IDENTITE = "identite";

/// Les questions du document, DANS L'ORDRE IMPRIMÉ (numérotation 1 → 15 du
/// formulaire). Chacune devient une étape et porte l'identifiant du champ qui
/// la pose : ce champ est alors l'ANCRE de son étape (cf. `stepAnchorField`) et
/// sa question titre l'étape — aucune clé i18n à écrire.
///
/// La question 7 en fournit trois (date d'effet, cumul, cumul antérieur) : le
/// papier les imprime sous un même numéro, mais ce sont trois questions
/// distinctes, dont deux à réponse oui/non.
export const C1B_QUESTIONS: readonly string[] = [
  "droitPensionRetraiteComplete", // 1
  "typePensionRetraiteComplete", // 2
  "denominationPensionRetraiteComplete", // 3
  "datePensionRetraiteComplete", // 4
  "percoitPension", // 5
  "typePensionPercue", // 6
  "dateEffetPensionSurvieBelge", // 7a
  "cumulPensionSurvieChomage", // 7b
  "cumulAnterieurMaladieChomagePrepension", // 7c
  "indemniteMaladieInvaliditeEtrangere", // 8
  "montantIndemniteMaladieInvalidite", // 9
  "indemniteAccidentTravailBelge", // 10
  "natureIndemniteAccidentTravail", // 11
  "indemniteAccidentTravailEtrangere", // 12
  "congeSansSolde", // 13
  "congeSansSoldeNomEmployeur", // 14
  "nombreAnnexes", // 15
  "signature",
];

/// Champs RATTACHÉS à une question : précisions, lignes de suite, bornes de
/// période. Ils suivent leur question et ne fabriquent pas d'étape.
const RATTACHEMENTS: Readonly<Record<string, readonly string[]>> = {
  // « du » et « au » d'une même période : jamais sur deux écrans.
  cumulAnterieurMaladieChomagePrepension: ["cumulAnterieurDateDebut", "cumulAnterieurDateFin"],
  // Q14 : les données du congé sans solde tiennent d'un bloc.
  congeSansSoldeNomEmployeur: [
    "congeSansSoldeAdresseEmployeur",
    "congeSansSoldeDateDebut",
    "congeSansSoldeDateFin",
  ],
  // Q15 : le compte d'annexes et la liste de ce qu'on joint.
  nombreAnnexes: [
    "annexeDecisionsBelges",
    "annexeDecisionsEtrangeres",
    "annexeCopiesPaiement",
    "annexeModele74",
    "annexeAutre",
    "annexeAutreDescription",
  ],
  signature: ["dateSignature"],
};

/// Pose `stepGroup` sur chaque champ. Les champs d'identité tombent dans le
/// groupe d'en-tête ; un champ inconnu des deux tables reste sans groupe et
/// atterrit dans « Autres informations » de la dernière étape — repli visible,
/// jamais une perte.
function appliquerGroupes(fields: PdfFormField[]): PdfFormField[] {
  const parChamp = new Map<string, string>();
  for (const question of C1B_QUESTIONS) parChamp.set(question, question);
  for (const [question, rattaches] of Object.entries(RATTACHEMENTS)) {
    for (const id of rattaches) parChamp.set(id, question);
  }
  return fields.map((f) => {
    const groupe =
      parChamp.get(f.id) ?? (f.section === SECTION_IDENTITE ? C1B_GROUPE_IDENTITE : undefined);
    return groupe ? { ...f, stepGroup: groupe } : f;
  });
}

export function applyC1BImprovements(fields: PdfFormField[]): PdfFormField[] {
  return appliquerGroupes(mergeEnrichedFields(fields, C1B_FIELDS, LEGACY_C1B_FIELD_IDS));
}
