// Améliorations du schéma C1 — sections "MES ACTIVITÉS" + "MES REVENUS".
//
// Le PDF C1 officiel ONEM rend chaque question oui/non par DEUX checkboxes
// séparées (oui_N et non_N) plutôt qu'un PDFRadioGroup. Pour une UX claire,
// on regroupe chaque paire en un champ `radio` avec options [oui, non] et
// `pdfFieldName: "oui_N|non_N"` — le filler coche la bonne case selon la
// réponse (cf. lib/pdf-forms/filler.ts).
//
// Pour les questions qui déclenchent un sous-formulaire ONEM (C1A, C1B, C1C),
// on ajoute une question follow-up "déjà déclaré ?" virtuelle (sans widget
// PDF associé) qui s'affiche conditionnellement. Si la réponse est "non",
// le sous-formulaire sera ajouté au parcours par la logique du dossier
// (à wirer plus tard côté CT — pour l'instant on capture la donnée).
//
// Référence : feuille d'information C1 (version 01.01.2024/831.10.000).
// Mapping AcroForm vérifié sur private/pdfs/C1_FR.pdf (page 2).

import type { PdfFormField, PdfFormTrigger } from "../types";

const SECTION_ACTIVITES = "mes-activites";
const SECTION_REVENUS = "mes-revenus";

/// Options communes oui/non. Premier élément = mappé à la case "oui_N",
/// second élément = mappé à la case "non_N".
const YN = [
  { value: "oui", label: { fr: "Oui", nl: "Ja", de: "Ja" } },
  { value: "non", label: { fr: "Non", nl: "Nee", de: "Nein" } },
];

/// Options du follow-up "déjà déclaré à l'organisme de paiement ?".
const YN_DECLARE = [
  { value: "oui", label: { fr: "Oui, déjà déclaré à l'organisme de paiement", nl: "", de: "" } },
  { value: "non", label: { fr: "Non, à compléter maintenant", nl: "", de: "" } },
];

/// Construit un champ radio "déjà déclaré ?" virtuel (pas de widget PDF
/// correspondant). Le payload capture la réponse pour la logique de dossier.
function dejaDeclare(opts: {
  id: string;
  parentId: string;
  helpText: string;
  section: string;
  order: number;
}): PdfFormField {
  return {
    id: opts.id,
    pdfFieldName: "", // virtuel : pas stampé sur le PDF
    type: "radio",
    required: false,
    label: { fr: "Avais-tu déjà déclaré cette situation à ton organisme de paiement ?", nl: "", de: "" },
    help: { fr: opts.helpText, nl: "", de: "" },
    options: YN_DECLARE,
    visibleIf: { fieldId: opts.parentId, op: "equals", value: "oui" },
    section: opts.section,
    order: opts.order,
  };
}

/// Schéma enrichi pour les 15 questions oui/non + 5 follow-ups
/// "déjà déclaré ?". Chaque question est typée `radio` avec options [oui, non]
/// et pointe vers la paire de checkboxes correspondante sur le PDF.
///
/// Note : seules ces questions sont définies ici. Les autres champs du C1
/// (identité, adresse, mode de paiement, situation familiale…) conservent
/// leur définition existante — voir applyC1Improvements() pour l'overlay.
export const C1_QUESTIONS: PdfFormField[] = [
  // ---------- MES ACTIVITÉS (10 questions, page 2) ----------
  {
    id: "etudesPleinExercice",
    pdfFieldName: "oui_2|non_2",
    type: "radio",
    required: true,
    label: { fr: "Je suis des études de plein exercice (cours du jour)", nl: "", de: "" },
    help: {
      fr: "⚠ Si oui, perte du droit aux allocations sauf dispense FOREM / ACTIRIS / VDAB / ARBEITSAMT DG.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 10,
  },
  {
    id: "apprentissageAlternance",
    pdfFieldName: "oui_3|non_3",
    type: "radio",
    required: true,
    label: { fr: "Je suis un apprentissage ou une formation en alternance", nl: "", de: "" },
    help: {
      fr: "⚠ Idem études — perte du droit sauf dispense. Si chômage temporaire pendant la formation, complète aussi la section « Situation familiale ».",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 20,
  },
  {
    id: "formationStageSyntra",
    pdfFieldName: "oui_4|non_4",
    type: "radio",
    required: true,
    label: { fr: "Je suis une formation avec convention de stage (SYNTRA / IFAPME / EFEPME / IAWM)", nl: "", de: "" },
    help: { fr: "⚠ Idem études — perte du droit sauf dispense.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 30,
  },
  {
    id: "mandatArtistique",
    pdfFieldName: "oui_5|non_5",
    type: "radio",
    required: true,
    label: {
      fr: "J'exerce un mandat rémunéré dans un organe consultatif du secteur culturel ou de la Commission du travail des arts",
      nl: "", de: "",
    },
    help: { fr: "À déclarer. Prends contact avec ton organisme de paiement pour les formalités.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 40,
  },
  {
    id: "mandatPolitique",
    pdfFieldName: "oui_6|non_6",
    type: "radio",
    required: true,
    label: { fr: "J'exerce un mandat politique", nl: "", de: "" },
    help: {
      fr: "→ Joindre un FORMULAIRE C1A. Exception : si tu es conseiller communal ou membre du Conseil de l'action sociale, réponds « non » (pas de C1A à joindre).",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 50,
  },
  {
    id: "chapitreXIIArts",
    pdfFieldName: "oui_7|non_7",
    type: "radio",
    required: true,
    label: {
      fr: "Je bénéficie (ou souhaite bénéficier) du Chapitre XII sur la base de l'attestation du travail des arts",
      nl: "", de: "",
    },
    help: { fr: "Demande des explications à ton organisme de paiement.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 60,
  },
  {
    id: "tremplinIndependants",
    pdfFieldName: "oui_8|non_8",
    type: "radio",
    required: true,
    label: {
      fr: "J'exerce une activité accessoire comme indépendant et je bénéficie (ou souhaite bénéficier) de la mesure « Tremplin-indépendants »",
      nl: "", de: "",
    },
    help: { fr: "→ Joindre un FORMULAIRE C1C si pas encore déclaré.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 70,
  },
  dejaDeclare({
    id: "tremplinIndependantsDejaDeclare",
    parentId: "tremplinIndependants",
    helpText:
      "Si non, tu devras compléter le FORMULAIRE C1C — il sera ajouté à ton parcours.",
    section: SECTION_ACTIVITES,
    order: 71,
  }),
  {
    id: "activiteAccessoireOuAide",
    pdfFieldName: "oui_9|non_9",
    type: "radio",
    required: true,
    label: { fr: "J'exerce une activité accessoire ou j'aide un travailleur indépendant", nl: "", de: "" },
    help: { fr: "→ Joindre un FORMULAIRE C1A si pas encore déclaré.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 80,
  },
  dejaDeclare({
    id: "activiteAccessoireDejaDeclare",
    parentId: "activiteAccessoireOuAide",
    helpText: "Si non, tu devras compléter le FORMULAIRE C1A — il sera ajouté à ton parcours.",
    section: SECTION_ACTIVITES,
    order: 81,
  }),
  {
    id: "administrateurSociete",
    pdfFieldName: "oui_10|non_10",
    type: "radio",
    required: true,
    label: { fr: "Je suis administrateur de société", nl: "", de: "" },
    help: { fr: "→ Joindre un FORMULAIRE C1A si pas encore déclaré.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 90,
  },
  dejaDeclare({
    id: "administrateurSocieteDejaDeclare",
    parentId: "administrateurSociete",
    helpText: "Si non, tu devras compléter le FORMULAIRE C1A — il sera ajouté à ton parcours.",
    section: SECTION_ACTIVITES,
    order: 91,
  }),
  {
    id: "independantAccessoireOuPrincipal",
    pdfFieldName: "oui_11|non_11",
    type: "radio",
    required: true,
    label: { fr: "Je suis inscrit comme indépendant à titre accessoire ou principal", nl: "", de: "" },
    help: {
      fr: "⚠ Si à titre principal, pas de droit aux allocations de chômage. Si accessoire, joindre un FORMULAIRE C1A si pas encore déclaré.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 100,
  },
  dejaDeclare({
    id: "independantAccessoireDejaDeclare",
    parentId: "independantAccessoireOuPrincipal",
    helpText:
      "Pour une activité accessoire : si non déclarée, tu devras compléter le FORMULAIRE C1A.",
    section: SECTION_ACTIVITES,
    order: 101,
  }),

  // ---------- MES REVENUS (5 questions, page 2) ----------
  {
    id: "pensionCategorieParticuliere",
    pdfFieldName: "oui_12|non_12",
    type: "radio",
    required: true,
    label: {
      fr: "J'appartiens à une catégorie professionnelle particulière (mineur, pilote, marin…) et j'ai droit à une pension complète",
      nl: "", de: "",
    },
    help: {
      fr: "⚠ Si tu remplis les conditions d'âge et d'ancienneté pour la pension spécifique, pas de droit aux allocations.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_REVENUS,
    order: 110,
  },
  {
    id: "pensionRetraiteSurvie",
    pdfFieldName: "oui_13|non_13",
    type: "radio",
    required: true,
    label: { fr: "Je perçois une pension de retraite ou de survie", nl: "", de: "" },
    help: {
      fr: "→ Joindre un FORMULAIRE C1B si pas encore déclaré. Exception : une « allocation de transition » (limitée dans le temps) se déclare « non » — cumulable sans limite.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_REVENUS,
    order: 120,
  },
  dejaDeclare({
    id: "pensionRetraiteDejaDeclare",
    parentId: "pensionRetraiteSurvie",
    helpText: "Si non, tu devras compléter le FORMULAIRE C1B — il sera ajouté à ton parcours.",
    section: SECTION_REVENUS,
    order: 121,
  }),
  {
    id: "indemniteMaladieInvalidite",
    pdfFieldName: "oui_14|non_14",
    type: "radio",
    required: true,
    label: { fr: "Je perçois une indemnité de maladie ou d'invalidité", nl: "", de: "" },
    help: { fr: "À déclarer. Demande des explications à ton organisme de paiement.", nl: "", de: "" },
    options: YN,
    section: SECTION_REVENUS,
    order: 130,
  },
  {
    id: "indemniteAccidentTravail",
    pdfFieldName: "oui_15|non_15",
    type: "radio",
    required: true,
    label: { fr: "Je perçois une indemnité pour accident du travail ou maladie professionnelle", nl: "", de: "" },
    help: { fr: "À déclarer.", nl: "", de: "" },
    options: YN,
    section: SECTION_REVENUS,
    order: 140,
  },
  {
    id: "avantageFinancierFormation",
    pdfFieldName: "oui_16|non_16",
    type: "radio",
    required: true,
    label: {
      fr: "Je perçois un avantage financier dans le cadre ou à la suite d'une formation, d'études, d'un apprentissage, d'un stage ou d'une activité dans une coopérative d'activités",
      nl: "", de: "",
    },
    help: {
      fr: "⚠ Entraîne la perte du droit aux allocations sauf dispense ou autorisation du service régional de l'emploi.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_REVENUS,
    order: 150,
  },
];

/// Déclencheurs de sous-formulaires portés par le C1. Quand l'utilisateur
/// répond « oui » à une question sans avoir « déjà déclaré » la situation,
/// le sous-formulaire correspondant est ajouté au parcours.
///
/// Référence : feuille d'information C1 (version 01.01.2024/831.10.000).
export const C1_TRIGGERS: PdfFormTrigger[] = [
  {
    whenFieldId: "tremplinIndependants",
    whenValue: "oui",
    unlessFieldId: "tremplinIndependantsDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1c",
    reason: { fr: "Tremplin-indépendants à déclarer", nl: "", de: "" },
  },
  {
    whenFieldId: "activiteAccessoireOuAide",
    whenValue: "oui",
    unlessFieldId: "activiteAccessoireDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1a",
    reason: { fr: "Activité accessoire ou aide à un indépendant à déclarer", nl: "", de: "" },
  },
  {
    whenFieldId: "administrateurSociete",
    whenValue: "oui",
    unlessFieldId: "administrateurSocieteDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1a",
    reason: { fr: "Mandat d'administrateur de société à déclarer", nl: "", de: "" },
  },
  {
    whenFieldId: "independantAccessoireOuPrincipal",
    whenValue: "oui",
    unlessFieldId: "independantAccessoireDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1a",
    reason: { fr: "Inscription indépendant à déclarer", nl: "", de: "" },
  },
  {
    whenFieldId: "pensionRetraiteSurvie",
    whenValue: "oui",
    unlessFieldId: "pensionRetraiteDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1b",
    reason: { fr: "Pension de retraite ou de survie à déclarer", nl: "", de: "" },
  },
];

/// Set des `pdfFieldName` (côté positif ET côté négatif) couverts par les
/// nouveaux champs radio. Sert à supprimer les anciens champs checkboxes
/// individuels (oui_2, non_2, …) que le parser AcroForm avait inférés.
function coveredCheckboxNames(): Set<string> {
  const set = new Set<string>();
  for (const q of C1_QUESTIONS) {
    if (!q.pdfFieldName.includes("|")) continue;
    for (const name of q.pdfFieldName.split("|")) set.add(name.trim());
  }
  return set;
}

/// Applique les améliorations du schéma C1 sur la liste de champs existante
/// (typiquement issue de l'inférence automatique au moment de l'import).
///
/// Comportement :
/// 1. Retire tous les champs inférés correspondant aux 15 paires oui_N/non_N
///    (les nouveaux champs `radio` les couvrent).
/// 2. Append les 15 questions enrichies + 5 follow-ups virtuels.
/// 3. Tous les autres champs (identité, adresse, mode de paiement, situation
///    familiale…) sont préservés tels quels.
///
/// Idempotent : ré-exécutable sans dupliquer (compare les `id`).
export function applyC1Improvements(fields: PdfFormField[]): PdfFormField[] {
  const covered = coveredCheckboxNames();
  const newIds = new Set(C1_QUESTIONS.map((q) => q.id));

  const preserved = fields.filter((f) => {
    // Retire les anciens checkboxes individuels désormais couverts par radio.
    if (covered.has(f.pdfFieldName)) return false;
    // Retire aussi un éventuel ancien champ portant un id qu'on redéfinit.
    if (newIds.has(f.id)) return false;
    return true;
  });

  return [...preserved, ...C1_QUESTIONS];
}
