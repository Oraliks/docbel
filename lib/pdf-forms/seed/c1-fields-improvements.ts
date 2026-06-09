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

const SECTION_DEMANDE = "demande";
const SECTION_SITUATION_FAMILIALE = "situation-familiale";
const SECTION_ACTIVITES = "mes-activites";
const SECTION_REVENUS = "mes-revenus";
const SECTION_PAIEMENT = "mode-paiement";
const SECTION_COTISATION = "cotisation-syndicale";
const SECTION_NON_EEE = "non-eee";
const SECTION_DIVERS = "divers";
const SECTION_AFFIRMATIONS = "affirmations";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";

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
  // ====================================================================
  // SECTION 1 — DEMANDE (motifs d'introduction)
  // Tous virtuels pour l'instant (pdfFieldName vide) — à mapper sur les
  // widgets réels du C1 page 1 dans une 2e passe.
  // ====================================================================
  {
    id: "dateDemande",
    pdfFieldName: "",
    type: "date",
    required: true,
    label: { fr: "Je demande des allocations à partir du", nl: "", de: "" },
    help: { fr: "Date du premier jour pour lequel tu demandes des allocations.", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_DEMANDE,
    order: 1,
  },
  {
    id: "chomeurTemporaireAlternance",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: {
      fr: "… comme chômeur temporaire suivant une formation en alternance",
      nl: "", de: "",
    },
    help: {
      fr: "Cas rare — coche « non » sauf si tu suis une formation en alternance et que tu es en chômage temporaire pendant cette formation.",
      nl: "", de: "",
    },
    options: YN,
    defaultValue: "non",
    section: SECTION_DEMANDE,
    order: 2,
  },
  {
    id: "motifIntroduction",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "Motif d'introduction de cette demande", nl: "", de: "" },
    help: {
      fr: "« Première fois » = premier dossier de ce type, nouvelle admissibilité (souvent quand il n'y a pas eu d'allocation depuis plus d'un an), ou tout premier dossier. « Interruption » = reprise après une période de non-versement.",
      nl: "", de: "",
    },
    options: [
      { value: "premiere", label: { fr: "Pour la première fois", nl: "", de: "" } },
      { value: "interruption", label: { fr: "Après une interruption de mes allocations", nl: "", de: "" } },
      { value: "modification", label: { fr: "Je déclare une modification", nl: "", de: "" } },
      { value: "changement-op", label: { fr: "Je change d'organisme de paiement", nl: "", de: "" } },
    ],
    section: SECTION_DEMANDE,
    order: 3,
  },
  {
    id: "dateChangementOrganisme",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    help: { fr: "Date de prise d'effet du changement d'organisme de paiement.", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "changement-op" },
    section: SECTION_DEMANDE,
    order: 4,
  },
  // Si « modification », l'utilisateur peut cocher plusieurs natures.
  {
    id: "modificationAdresse",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "Modification d'adresse", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 5,
  },
  {
    id: "modificationCompte",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "Modification du compte bancaire", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 6,
  },
  {
    id: "modificationSituationFamiliale",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "Modification de situation familiale", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 7,
  },
  {
    id: "modificationPermisSejour",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "Modification du permis de séjour", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 8,
  },
  {
    id: "modificationCotisationSyndicale",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "Modification de la cotisation syndicale", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 9,
  },

  // ====================================================================
  // SECTION 2 — SITUATION FAMILIALE (simplifié pour cette 1ʳᵉ passe)
  // La grille cohabitants structurée + upload de jugement (pension
  // alimentaire) sont reportés à un commit dédié (nouveau type `array`
  // nécessaire). Ici on capture l'essentiel : isolé vs cohabite, et la
  // déclaration de pension alimentaire avec rappel des pièces requises.
  // ====================================================================
  {
    id: "statutFamilial",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "Ma situation familiale", nl: "", de: "" },
    help: { fr: "Choix unique : tu vis seul ou tu cohabites avec au moins une personne.", nl: "", de: "" },
    options: [
      { value: "isole", label: { fr: "Je vis seul (isolé)", nl: "", de: "" } },
      { value: "cohabite", label: { fr: "Je cohabite avec au moins une personne", nl: "", de: "" } },
    ],
    section: SECTION_SITUATION_FAMILIALE,
    order: 100,
  },
  {
    id: "pensionAlimentaire",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Je paie une pension alimentaire (jugement, acte notarié, garde alternée)", nl: "", de: "" },
    help: {
      fr: "⚠ Si oui, joindre obligatoirement une copie du JUGEMENT ou de l'ACTE NOTARIÉ. Les preuves de paiement (virements, reçus) ne suffisent pas. Vaut aussi pour la garde alternée.",
      nl: "", de: "",
    },
    options: YN,
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "isole" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101,
  },
  {
    id: "pensionAlimentaireDejaDeclare",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Le jugement / acte notarié a-t-il déjà été transmis dans un dossier précédent ?", nl: "", de: "" },
    help: {
      fr: "S'il s'agit du premier dossier, réponds « non » — le document doit être joint maintenant.",
      nl: "", de: "",
    },
    options: YN_DECLARE,
    visibleIf: { fieldId: "pensionAlimentaire", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 102,
  },
  {
    id: "remarqueSituationFamiliale",
    pdfFieldName: "",
    type: "textarea",
    required: false,
    label: { fr: "Remarque (situation familiale)", nl: "", de: "" },
    help: { fr: "Précisions utiles : emprisonnement, internement, situation ambiguë, etc.", nl: "", de: "" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 103,
  },
  // Grille cohabitants — visible seulement si l'utilisateur a indiqué
  // cohabiter. Pour chaque ligne : identité, lien familial, date naissance,
  // allocations familiales perçues (auto-non si > 35 ans), type & montant
  // de revenu professionnel (Indépendant → 999999.99 par défaut), revenus
  // de remplacement, remarque, et statut C1-PARTENAIRE si FAC.
  {
    id: "cohabitants",
    pdfFieldName: "",
    type: "array",
    required: false,
    label: { fr: "Personnes avec qui je cohabite", nl: "", de: "" },
    help: {
      fr: "Ajoute toutes les personnes qui font partie de ton ménage, même si elles sont domiciliées ailleurs. Une personne emprisonnée ou en institution psychiatrique compte toujours.",
      nl: "", de: "",
    },
    addRowLabel: { fr: "Ajouter un cohabitant", nl: "", de: "" },
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "cohabite" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 110,
    itemFields: [
      {
        id: "prenom",
        pdfFieldName: "",
        type: "text",
        required: true,
        label: { fr: "Prénom", nl: "", de: "" },
        order: 1,
      },
      {
        id: "nom",
        pdfFieldName: "",
        type: "text",
        required: true,
        label: { fr: "Nom", nl: "", de: "" },
        order: 2,
      },
      {
        id: "lien",
        pdfFieldName: "",
        type: "select",
        required: true,
        label: { fr: "Lien familial", nl: "", de: "" },
        help: { fr: "FAC = financièrement à charge. NFAC = non financièrement à charge.", nl: "", de: "" },
        options: [
          { value: "epoux", label: { fr: "Époux/se", nl: "", de: "" } },
          { value: "partenaire", label: { fr: "Partenaire", nl: "", de: "" } },
          { value: "FAC", label: { fr: "Financièrement à charge (FAC)", nl: "", de: "" } },
          { value: "NFAC", label: { fr: "Non financièrement à charge (NFAC)", nl: "", de: "" } },
          { value: "enfant", label: { fr: "Enfant", nl: "", de: "" } },
          { value: "pere", label: { fr: "Père", nl: "", de: "" } },
          { value: "mere", label: { fr: "Mère", nl: "", de: "" } },
          { value: "frere", label: { fr: "Frère", nl: "", de: "" } },
          { value: "soeur", label: { fr: "Sœur", nl: "", de: "" } },
          { value: "neveu", label: { fr: "Neveu", nl: "", de: "" } },
          { value: "niece", label: { fr: "Nièce", nl: "", de: "" } },
          { value: "oncle", label: { fr: "Oncle", nl: "", de: "" } },
          { value: "tante", label: { fr: "Tante", nl: "", de: "" } },
          { value: "cousin", label: { fr: "Cousin", nl: "", de: "" } },
          { value: "cousine", label: { fr: "Cousine", nl: "", de: "" } },
          { value: "aucun-lien", label: { fr: "Aucun lien de parenté", nl: "", de: "" } },
        ],
        order: 3,
      },
      {
        id: "dateNaissance",
        pdfFieldName: "",
        type: "date",
        required: true,
        label: { fr: "Date de naissance", nl: "", de: "" },
        order: 4,
      },
      {
        id: "allocationsFamiliales",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Je perçois des allocations familiales pour cette personne", nl: "", de: "" },
        help: {
          fr: "Au-delà de 35 ans, la réponse est automatiquement « non ». Tu peux la rectifier si besoin.",
          nl: "", de: "",
        },
        options: YN,
        order: 5,
      },
      {
        id: "typeRevenuPro",
        pdfFieldName: "",
        type: "select",
        required: false,
        label: { fr: "Type de revenu professionnel", nl: "", de: "" },
        options: [
          { value: "aucun", label: { fr: "Aucun", nl: "", de: "" } },
          { value: "salarie-employe", label: { fr: "Employé", nl: "", de: "" } },
          { value: "salarie-ouvrier", label: { fr: "Ouvrier", nl: "", de: "" } },
          { value: "independant", label: { fr: "Indépendant", nl: "", de: "" } },
        ],
        order: 6,
      },
      {
        id: "montantRevenuPro",
        pdfFieldName: "",
        type: "number",
        required: false,
        label: { fr: "Montant brut mensuel (€)", nl: "", de: "" },
        help: {
          fr: "Pour un indépendant, valeur par défaut 999999,99 € — le statut indépendant rend la personne « cohabitante » sans plafond de revenu pour conjoint/partenaire.",
          nl: "", de: "",
        },
        visibleIf: { fieldId: "typeRevenuPro", op: "notEquals", value: "aucun" },
        order: 7,
      },
      {
        id: "revenuRemplacement",
        pdfFieldName: "",
        type: "select",
        required: false,
        label: { fr: "Revenu de remplacement", nl: "", de: "" },
        help: { fr: "Mutuelle (maladie-invalidité), CPAS, pension, allocations chômage, etc.", nl: "", de: "" },
        options: [
          { value: "aucun", label: { fr: "Aucun", nl: "", de: "" } },
          { value: "mutuelle", label: { fr: "Mutuelle (maladie-invalidité)", nl: "", de: "" } },
          { value: "cpas", label: { fr: "CPAS (revenu d'intégration)", nl: "", de: "" } },
          { value: "pension", label: { fr: "Pension", nl: "", de: "" } },
          { value: "chomage", label: { fr: "Allocations de chômage", nl: "", de: "" } },
          { value: "autre", label: { fr: "Autre", nl: "", de: "" } },
        ],
        order: 8,
      },
      {
        id: "montantRevenuRemplacement",
        pdfFieldName: "",
        type: "number",
        required: false,
        label: { fr: "Montant brut mensuel du revenu de remplacement (€)", nl: "", de: "" },
        visibleIf: { fieldId: "revenuRemplacement", op: "notEquals", value: "aucun" },
        order: 9,
      },
      {
        id: "remarque",
        pdfFieldName: "",
        type: "textarea",
        required: false,
        label: { fr: "Remarque", nl: "", de: "" },
        order: 10,
      },
      // Statut C1-PARTENAIRE : visible uniquement si lien = FAC. Choix
      // mutuellement exclusif entre « 1ʳᵉ fois / modification » et
      // « déjà déclaré ». La logique de trigger pour ajouter le formulaire
      // C1-PARTENAIRE lit la valeur « premiere-fois » sur n'importe quelle
      // ligne FAC.
      {
        id: "c1PartenaireStatus",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Déclaration C1-PARTENAIRE", nl: "", de: "" },
        help: {
          fr: "Auto-pré-sélectionné sur « 1ʳᵉ fois / modification » dès que le lien devient FAC — tu peux changer si la situation a déjà été déclarée.",
          nl: "", de: "",
        },
        options: [
          {
            value: "premiere-fois",
            label: { fr: "Première fois (ou modification) — joindre un FORMULAIRE C1-PARTENAIRE", nl: "", de: "" },
          },
          {
            value: "deja-declare",
            label: { fr: "Ma déclaration C1-PARTENAIRE précédente reste inchangée", nl: "", de: "" },
          },
        ],
        visibleIf: { fieldId: "lien", op: "equals", value: "FAC" },
        order: 11,
      },
    ],
  },

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
    order: 200,
  },
  {
    id: "etudesPleinExerciceDate",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    visibleIf: { fieldId: "etudesPleinExercice", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 201,
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
    order: 210,
  },
  {
    id: "apprentissageAlternanceDate",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    visibleIf: { fieldId: "apprentissageAlternance", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 211,
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
    order: 220,
  },
  {
    id: "formationStageSyntraDate",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    visibleIf: { fieldId: "formationStageSyntra", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 221,
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
    help: { fr: "→ Joindre un FORMULAIRE C46 si pas encore déclaré.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 230,
  },
  dejaDeclare({
    id: "mandatArtistiqueDejaDeclare",
    parentId: "mandatArtistique",
    helpText: "Si non, tu devras compléter le FORMULAIRE C46 — il sera ajouté à ton parcours.",
    section: SECTION_ACTIVITES,
    order: 231,
  }),
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
    order: 240,
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
    order: 250,
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
    order: 270,
  },
  dejaDeclare({
    id: "tremplinIndependantsDejaDeclare",
    parentId: "tremplinIndependants",
    helpText:
      "Si non, tu devras compléter le FORMULAIRE C1C — il sera ajouté à ton parcours.",
    section: SECTION_ACTIVITES,
    order: 271,
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
    order: 280,
  },
  dejaDeclare({
    id: "activiteAccessoireDejaDeclare",
    parentId: "activiteAccessoireOuAide",
    helpText: "Si non, tu devras compléter le FORMULAIRE C1A — il sera ajouté à ton parcours.",
    section: SECTION_ACTIVITES,
    order: 281,
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
    order: 290,
  },
  dejaDeclare({
    id: "administrateurSocieteDejaDeclare",
    parentId: "administrateurSociete",
    helpText: "Si non, tu devras compléter le FORMULAIRE C1A — il sera ajouté à ton parcours.",
    section: SECTION_ACTIVITES,
    order: 291,
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
    order: 500,
  },
  dejaDeclare({
    id: "independantAccessoireDejaDeclare",
    parentId: "independantAccessoireOuPrincipal",
    helpText:
      "Pour une activité accessoire : si non déclarée, tu devras compléter le FORMULAIRE C1A.",
    section: SECTION_ACTIVITES,
    order: 501,
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
    order: 510,
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
    order: 520,
  },
  dejaDeclare({
    id: "pensionRetraiteDejaDeclare",
    parentId: "pensionRetraiteSurvie",
    helpText: "Si non, tu devras compléter le FORMULAIRE C1B — il sera ajouté à ton parcours.",
    section: SECTION_REVENUS,
    order: 521,
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
    order: 530,
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
    order: 540,
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
    order: 550,
  },

  // ====================================================================
  // SECTION — MODE DE PAIEMENT
  // ====================================================================
  {
    id: "modePaiement",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "Comment souhaites-tu recevoir tes allocations ?", nl: "", de: "" },
    help: { fr: "Le virement bancaire est le mode standard. Le chèque circulaire est exceptionnel.", nl: "", de: "" },
    options: [
      { value: "virement", label: { fr: "Par virement bancaire", nl: "", de: "" } },
      { value: "cheque", label: { fr: "Par chèque circulaire envoyé à mon adresse", nl: "", de: "" } },
    ],
    defaultValue: "virement",
    section: SECTION_PAIEMENT,
    order: 600,
  },
  {
    id: "modePaiementChequeWarning",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: {
      fr: "Je confirme avoir compris : le chèque circulaire est rare, plus lent et envoyé à l'adresse de la rubrique « MON IDENTITÉ ».",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "cheque" },
    section: SECTION_PAIEMENT,
    order: 601,
  },
  {
    id: "titulaireCompte",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Le compte est…", nl: "", de: "" },
    options: [
      { value: "mon-nom", label: { fr: "À mon nom", nl: "", de: "" } },
      { value: "autre-nom", label: { fr: "Au nom d'une autre personne", nl: "", de: "" } },
    ],
    defaultValue: "mon-nom",
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "virement" },
    section: SECTION_PAIEMENT,
    order: 602,
  },
  {
    id: "iban",
    pdfFieldName: "",
    type: "iban",
    required: false,
    label: { fr: "IBAN (compte belge SEPA)", nl: "", de: "" },
    placeholder: { fr: "BE00 0000 0000 0000", nl: "", de: "" },
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "virement" },
    section: SECTION_PAIEMENT,
    order: 603,
  },
  {
    id: "titulaireCompteNom",
    pdfFieldName: "",
    type: "text",
    required: false,
    label: { fr: "Nom du titulaire du compte", nl: "", de: "" },
    placeholder: { fr: "Nom et prénom de la personne", nl: "", de: "" },
    visibleIf: { fieldId: "titulaireCompte", op: "equals", value: "autre-nom" },
    section: SECTION_PAIEMENT,
    order: 604,
  },

  // ====================================================================
  // SECTION — COTISATION SYNDICALE
  // Les deux cases doivent rester DÉCOCHÉES par défaut et ne pas être
  // cochables côté UX standard — la gestion est externe (organisme de
  // paiement). readOnly empêche la saisie utilisateur.
  // ====================================================================
  {
    id: "autoriseCotisationSyndicale",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "J'autorise la retenue de la cotisation syndicale sur mes allocations", nl: "", de: "" },
    help: {
      fr: "Cette case est gérée directement par ton organisme de paiement — ne la coche pas ici.",
      nl: "", de: "",
    },
    readOnly: true,
    section: SECTION_COTISATION,
    order: 700,
  },
  {
    id: "retireCotisationSyndicale",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "Je n'autorise plus la retenue de la cotisation syndicale", nl: "", de: "" },
    help: { fr: "Gérée par l'organisme de paiement — ne pas cocher ici.", nl: "", de: "" },
    readOnly: true,
    section: SECTION_COTISATION,
    order: 701,
  },

  // ====================================================================
  // SECTION — TRAVAILLEUR NON-EEE / SUISSE
  // À masquer automatiquement si la nationalité saisie est belge ou
  // appartient à l'EEE / Suisse. Pour l'instant : 1 question d'orientation
  // qui rend les sous-questions conditionnelles.
  // ====================================================================
  {
    id: "nationaliteHorsEEE",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: {
      fr: "Es-tu ressortissant d'un pays HORS EEE et HORS Suisse ?",
      nl: "", de: "",
    },
    help: {
      fr: "L'EEE = UE + Islande + Liechtenstein + Norvège. Si tu es belge, français, néerlandais, etc., réponds « non ». Cette section devient inutile pour les chômeurs temporaires.",
      nl: "", de: "",
    },
    options: YN,
    defaultValue: "non",
    section: SECTION_NON_EEE,
    order: 800,
  },
  {
    id: "accesMarcheTravail",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Mention au verso de mon permis de séjour quant à l'accès au marché du travail", nl: "", de: "" },
    help: {
      fr: "« Illimité » : tu peux travailler pour tout employeur. « Limité » : restrictions précisées sur l'autorisation régionale. « Non » : aucun emploi possible (pas de droit aux allocations).",
      nl: "", de: "",
    },
    options: [
      { value: "illimite", label: { fr: "Illimité", nl: "", de: "" } },
      { value: "limite", label: { fr: "Limité", nl: "", de: "" } },
      { value: "non", label: { fr: "Non", nl: "", de: "" } },
    ],
    visibleIf: { fieldId: "nationaliteHorsEEE", op: "equals", value: "oui" },
    section: SECTION_NON_EEE,
    order: 801,
  },

  // ====================================================================
  // SECTION — DIVERS
  // ====================================================================
  {
    id: "congeSansSolde",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "Je suis actuellement dans une période de congé sans solde", nl: "", de: "" },
    options: YN,
    defaultValue: "non",
    section: SECTION_DIVERS,
    order: 900,
  },
  {
    id: "congeSansSoldeDate",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 901,
  },
  {
    id: "incapacite33",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: {
      fr: "Je présente une incapacité de travail permanente d'au moins 33 %",
      nl: "", de: "",
    },
    help: {
      fr: "→ Si oui, joindre un FORMULAIRE C47-DEMANDE pour fixer le montant des allocations (pas de dégressivité).",
      nl: "", de: "",
    },
    options: YN,
    defaultValue: "non",
    section: SECTION_DIVERS,
    order: 910,
  },
  // TODO : trigger vers c47 — PDF C47_FR.pdf pas encore fourni.
  // À ajouter dans C1_TRIGGERS quand le PDF sera là.

  // ====================================================================
  // SECTION — AFFIRMATIONS OBLIGATOIRES
  // Les 3 cases doivent être cochées pour valider la déclaration —
  // required=true + helper qui explique la portée.
  // ====================================================================
  {
    id: "affirmationSincerite",
    pdfFieldName: "",
    type: "checkbox",
    required: true,
    label: {
      fr: "J'affirme sur l'honneur que la présente déclaration est sincère et complète",
      nl: "", de: "",
    },
    section: SECTION_AFFIRMATIONS,
    order: 1000,
  },
  {
    id: "affirmationLectureNotice",
    pdfFieldName: "",
    type: "checkbox",
    required: true,
    label: { fr: "J'ai lu la feuille d'informations C1", nl: "", de: "" },
    section: SECTION_AFFIRMATIONS,
    order: 1001,
  },
  {
    id: "affirmationModifications",
    pdfFieldName: "",
    type: "checkbox",
    required: true,
    label: {
      fr: "Je sais que je dois communiquer toute modification à mon organisme de paiement et que je peux être sanctionné(e) si je ne le fais pas",
      nl: "", de: "",
    },
    section: SECTION_AFFIRMATIONS,
    order: 1002,
  },

  // ====================================================================
  // SECTION — ANNEXES (optionnelles)
  // ====================================================================
  {
    id: "annexeHandicap",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "J'ai joint une attestation de la DG Personnes handicapées du SPF Sécurité sociale", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 1100,
  },
  {
    id: "annexeExtraitPension",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "J'ai joint une copie de l'extrait de la pension", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 1101,
  },
  {
    id: "annexeC1Regis",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "J'ai joint un FORMULAIRE C1 ANNEXE REGIS", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 1102,
  },
  {
    id: "annexePermisSejour",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "J'ai joint une copie du permis de séjour et/ou du permis de travail", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 1103,
  },
  {
    id: "annexeAutre",
    pdfFieldName: "",
    type: "textarea",
    required: false,
    label: { fr: "Autres pièces jointes (préciser)", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 1104,
  },

  // ====================================================================
  // SECTION — DATE + SIGNATURE
  // ====================================================================
  {
    id: "dateSignature",
    pdfFieldName: "",
    type: "date",
    required: true,
    label: { fr: "Date de signature", nl: "", de: "" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour.", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 1200,
  },
  {
    id: "signature",
    pdfFieldName: "",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique", nl: "", de: "" },
    help: { fr: "Signature « façon Adobe » : ton nom + prénom + horodatage seront appliqués à la position de la signature.", nl: "", de: "" },
    section: SECTION_SIGNATURE,
    order: 1201,
  },
];

/// Déclencheurs de sous-formulaires portés par le C1. Quand l'utilisateur
/// répond « oui » à une question sans avoir « déjà déclaré » la situation,
/// le sous-formulaire correspondant est ajouté au parcours.
///
/// Référence : feuille d'information C1 (version 01.01.2024/831.10.000).
export const C1_TRIGGERS: PdfFormTrigger[] = [
  {
    // Au moins une personne FAC déclarée « 1ʳᵉ fois » dans la grille des
    // cohabitants → joindre un C1-PARTENAIRE. Notation tableau [*] —
    // cf. lib/pdf-forms/triggers.ts#evaluateTrigger.
    whenFieldId: "cohabitants[*].c1PartenaireStatus",
    whenValue: "premiere-fois",
    requiresFormSlug: "c1-partenaire",
    reason: { fr: "Personne financièrement à charge à déclarer", nl: "", de: "" },
  },
  {
    whenFieldId: "mandatArtistique",
    whenValue: "oui",
    unlessFieldId: "mandatArtistiqueDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c46",
    reason: { fr: "Mandat dans un organe consultatif culturel à déclarer", nl: "", de: "" },
  },
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
