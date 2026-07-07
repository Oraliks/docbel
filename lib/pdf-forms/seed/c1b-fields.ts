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

const SECTION_IDENTITE = "identite";
const SECTION_REVENUS = "mes-revenus";
const SECTION_DIVERS = "divers";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";

const YN = [
  { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
  { value: "non", label: { fr: "Non", nl: "", de: "" } },
];

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
    label: { fr: "Numéro NISS (registre national)", nl: "", de: "" },
    help: {
      fr: "11 chiffres au dos de ta carte d'identité (eID), au-dessus du code-barres.",
      nl: "", de: "",
    },
    placeholder: { fr: "00.00.00-000.00", nl: "", de: "" },
    prefillFrom: "profile.niss",
    canonicalKey: "identity.niss",
    section: SECTION_IDENTITE,
    order: -100,
  },
  {
    id: "nom",
    pdfFieldName: "nom",
    type: "text",
    required: true,
    label: { fr: "Nom", nl: "", de: "" },
    prefillFrom: "profile.lastName",
    canonicalKey: "identity.nom",
    section: SECTION_IDENTITE,
    order: -99,
  },
  {
    id: "pr_nom",
    pdfFieldName: "prénom",
    type: "text",
    required: true,
    label: { fr: "Prénom", nl: "", de: "" },
    prefillFrom: "profile.firstName",
    canonicalKey: "identity.prenom",
    section: SECTION_IDENTITE,
    order: -98,
  },
  {
    id: "rue",
    pdfFieldName: "rue",
    type: "text",
    required: true,
    label: { fr: "Rue", nl: "", de: "" },
    prefillFrom: "profile.street",
    canonicalKey: "adresse.rue",
    section: SECTION_IDENTITE,
    order: -97,
  },
  {
    id: "num_ro",
    pdfFieldName: "numéro",
    type: "text",
    required: true,
    label: { fr: "Numéro", nl: "", de: "" },
    canonicalKey: "adresse.numero",
    section: SECTION_IDENTITE,
    order: -96,
  },
  {
    id: "code_postal",
    pdfFieldName: "code postal",
    type: "postal_be",
    required: true,
    label: { fr: "Code postal", nl: "", de: "" },
    placeholder: { fr: "1000", nl: "", de: "" },
    prefillFrom: "profile.postalCode",
    canonicalKey: "adresse.codePostal",
    section: SECTION_IDENTITE,
    order: -95,
  },
  {
    id: "commune",
    pdfFieldName: "commune",
    type: "text",
    required: true,
    label: { fr: "Commune", nl: "", de: "" },
    section: SECTION_IDENTITE,
    order: -94,
  },
  // En-tête de la page 2 ("Suite C1B NISS ... Nom ..."). Doublon du nom déjà
  // saisi page 1 — champ caché et pré-rempli automatiquement, pas de nouvelle
  // saisie demandée au citoyen.
  {
    id: "nomPage2",
    pdfFieldName: "Nom",
    type: "text",
    required: false,
    label: { fr: "Nom (en-tête page 2)", nl: "", de: "" },
    prefillFrom: "profile.lastName",
    readOnly: true,
    section: SECTION_IDENTITE,
    order: -93,
  },

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
      nl: "", de: "",
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
    label: { fr: "Cette pension de retraite complète est…", nl: "", de: "" },
    options: [
      { value: "belge", label: { fr: "Une pension de retraite belge", nl: "", de: "" } },
      { value: "etrangere", label: { fr: "Une pension de retraite étrangère", nl: "", de: "" } },
    ],
    visibleIf: { fieldId: "droitPensionRetraiteComplete", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 2,
  },
  {
    id: "denominationPensionRetraiteComplete",
    pdfFieldName: "undefined",
    type: "text",
    required: false,
    label: { fr: "Dénomination exacte de la pension de retraite complète", nl: "", de: "" },
    help: {
      fr: "Exemples : pension de retraite secteur public, pension de retraite secteur privé, pension de retraite d'indépendant.",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "droitPensionRetraiteComplete", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 3,
  },
  // A VALIDER Oraliks : le texte imprimé prévoit 3 lignes de pointillés pour
  // la dénomination (question 3), et le dump AcroForm expose bien 3 widgets
  // texte génériques à cet endroit ("undefined", "undefined_2", "undefined_3").
  // Je les traite comme 3 lignes de la MÊME réponse en texte libre (une
  // dénomination peut être longue). Si en réalité ce sont 3 champs distincts
  // avec un sens différent chacun, merci de préciser.
  {
    id: "denominationPensionRetraiteComplete2",
    pdfFieldName: "undefined_2",
    type: "text",
    required: false,
    label: { fr: "Dénomination exacte (suite, ligne 2)", nl: "", de: "" },
    visibleIf: { fieldId: "droitPensionRetraiteComplete", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 4,
  },
  {
    id: "denominationPensionRetraiteComplete3",
    pdfFieldName: "undefined_3",
    type: "text",
    required: false,
    label: { fr: "Dénomination exacte (suite, ligne 3)", nl: "", de: "" },
    visibleIf: { fieldId: "droitPensionRetraiteComplete", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 5,
  },
  {
    id: "datePensionRetraiteComplete",
    pdfFieldName: "Date46_af_date",
    type: "date",
    required: false,
    label: { fr: "À partir de quelle date avez-vous droit à cette pension ?", nl: "", de: "" },
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
    label: { fr: "Percevez-vous une pension ?", nl: "", de: "" },
    options: YN,
    section: SECTION_REVENUS,
    order: 10,
  },
  {
    id: "typePensionPercue",
    pdfFieldName: "une pens|une pens_2|une pens_3|une pens_4",
    type: "radio",
    required: false,
    label: { fr: "Je perçois…", nl: "", de: "" },
    help: {
      fr: "⚠ Pour une pension de retraite (belge ou étrangère) ou de survie étrangère, joins une copie de la décision d'octroi de la pension (décision provisoire ou définitive) et une copie du paiement le plus récent.",
      nl: "", de: "",
    },
    options: [
      { value: "retraite-belge", label: { fr: "Une pension de retraite belge", nl: "", de: "" } },
      { value: "retraite-etrangere", label: { fr: "Une pension de retraite étrangère", nl: "", de: "" } },
      { value: "survie-etrangere", label: { fr: "Une pension de survie étrangère", nl: "", de: "" } },
      { value: "survie-belge", label: { fr: "Une pension de survie belge", nl: "", de: "" } },
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
  // A VALIDER Oraliks : le texte imprimé de la question 7 affiche une date
  // "A partir du" (jour/mois/année) juste sous le titre, mais aucun widget
  // AcroForm dédié n'apparaît à cet endroit dans le dump (le bloc identité
  // occupe la position juste après). Cette date pourrait ne pas avoir de
  // champ de saisie sur ce PDF, ou avoir été fusionnée avec un autre widget.
  // Champ ajouté ici en virtuel (sans pdfFieldName) pour ne pas perdre la
  // donnée — à corriger dès que la position réelle est confirmée.
  {
    id: "dateEffetPensionSurvieBelge",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Pension de survie belge — à partir du", nl: "", de: "" },
    visibleIf: { fieldId: "typePensionPercue", op: "equals", value: "survie-belge" },
    section: SECTION_REVENUS,
    order: 20,
  },
  {
    id: "cumulPensionSurvieChomage",
    pdfFieldName: "non_3|oui Joignez",
    type: "radio",
    required: false,
    label: { fr: "Désirez-vous cumuler vos allocations de chômage avec votre pension de survie ?", nl: "", de: "" },
    help: {
      fr: "⚠ Si oui, joins : une copie de la décision d'octroi de la pension (décision provisoire ou définitive) ET une copie d'un modèle 74 ou 74bis PSS ou d'une Déclaration Pension, activité professionnelle et revenu de remplacement du Service fédéral des Pensions.",
      nl: "", de: "",
    },
    options: [
      { value: "non", label: { fr: "Non", nl: "", de: "" } },
      { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
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
      nl: "", de: "",
    },
    options: [
      { value: "non", label: { fr: "Non", nl: "", de: "" } },
      { value: "oui", label: { fr: "Oui, du…", nl: "", de: "" } },
    ],
    visibleIf: { fieldId: "typePensionPercue", op: "equals", value: "survie-belge" },
    section: SECTION_REVENUS,
    order: 22,
  },
  // A VALIDER Oraliks : le texte imprimé prévoit 2 dates ("du" ... "au" ...)
  // pour préciser la période de cumul antérieur quand la réponse ci-dessus
  // est "oui". Aucun widget AcroForm dédié n'a été identifié pour ces 2
  // dates dans le dump (contrairement à la période de congé sans solde, plus
  // bas, qui a bien 2 widgets). Champs ajoutés en virtuel pour ne pas perdre
  // la donnée — à corriger dès que confirmé sur le PDF réel.
  {
    id: "cumulAnterieurDateDebut",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Période de cumul antérieur — du", nl: "", de: "" },
    visibleIf: { fieldId: "cumulAnterieurMaladieChomagePrepension", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 23,
  },
  {
    id: "cumulAnterieurDateFin",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Période de cumul antérieur — au", nl: "", de: "" },
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
    label: { fr: "Percevez-vous une indemnité de maladie-invalidité à charge d'une institution étrangère ?", nl: "", de: "" },
    options: YN,
    section: SECTION_REVENUS,
    order: 30,
  },
  {
    id: "montantIndemniteMaladieInvalidite",
    pdfFieldName: "Texte48",
    type: "number",
    required: false,
    label: { fr: "Montant mensuel net de votre indemnité (EUR)", nl: "", de: "" },
    help: {
      fr: "Net = montant brut diminué des cotisations de sécurité sociale et du précompte professionnel. → Joins une copie de la décision d'octroi de cette allocation ET une copie de paiement le plus récent.",
      nl: "", de: "",
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
    label: { fr: "Percevez-vous une indemnité belge d'accident du travail ou de maladie professionnelle ?", nl: "", de: "" },
    options: YN,
    section: SECTION_REVENUS,
    order: 40,
  },
  {
    id: "natureIndemniteAccidentTravail",
    pdfFieldName: "i|i_2|i_3",
    type: "radio",
    required: false,
    label: { fr: "Cette indemnité est un dédommagement pour…", nl: "", de: "" },
    help: {
      fr: "→ Joins une attestation de l'organisme assureur mentionnant le degré d'incapacité permanente de travail et la date de consolidation.",
      nl: "", de: "",
    },
    options: [
      { value: "totale-temporaire", label: { fr: "Incapacité temporaire totale de travail", nl: "", de: "" } },
      { value: "partielle-temporaire", label: { fr: "Incapacité temporaire partielle de travail", nl: "", de: "" } },
      { value: "permanente", label: { fr: "Incapacité permanente de travail", nl: "", de: "" } },
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
    label: { fr: "Percevez-vous une indemnité d'accident du travail ou de maladie professionnelle à charge d'une institution étrangère ?", nl: "", de: "" },
    help: { fr: "→ Si oui, joins la décision d'octroi de cette allocation.", nl: "", de: "" },
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
    label: { fr: "Vous trouvez-vous dans une période de congé sans solde ?", nl: "", de: "" },
    options: YN,
    section: SECTION_DIVERS,
    order: 50,
  },
  {
    id: "congeSansSoldeNomEmployeur",
    pdfFieldName: "nom employeur",
    type: "text",
    required: false,
    label: { fr: "Congé sans solde — nom de l'employeur", nl: "", de: "" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 51,
  },
  {
    id: "congeSansSoldeAdresseEmployeur",
    pdfFieldName: "adresse employeur",
    type: "text",
    required: false,
    label: { fr: "Congé sans solde — adresse de l'employeur", nl: "", de: "" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 52,
  },
  {
    id: "congeSansSoldeDateDebut",
    pdfFieldName: "Date50_af_date",
    type: "date",
    required: false,
    label: { fr: "Période de congé sans solde — du", nl: "", de: "" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 53,
  },
  // A VALIDER Oraliks : le widget de fin de période ("au") est un dropdown
  // AcroForm SANS options prédéfinies (/Opt vide) — comportement inhabituel
  // pour une date. Je le traite comme un champ date classique côté citoyen
  // (le filler PDF y écrira une valeur texte, ce qui fonctionne pour un
  // dropdown éditable sans liste fermée). Merci de vérifier visuellement sur
  // le PDF que ce widget affiche bien un champ de saisie de date et non une
  // vraie liste déroulante avec des valeurs attendues.
  {
    id: "congeSansSoldeDateFin",
    pdfFieldName: "Liste déroulante49",
    type: "date",
    required: false,
    label: { fr: "Période de congé sans solde — au", nl: "", de: "" },
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
    id: "annexeDecisionsBelges",
    pdfFieldName: "déc",
    type: "checkbox",
    required: false,
    label: { fr: "Je joins : décision(s) d'octroi d'institutions belges", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 60,
  },
  {
    id: "annexeDecisionsEtrangeres",
    pdfFieldName: "déc_2",
    type: "checkbox",
    required: false,
    label: { fr: "Je joins : décision(s) d'octroi d'institutions étrangères", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 61,
  },
  {
    id: "annexeCopiesPaiement",
    pdfFieldName: "copies de paiement",
    type: "checkbox",
    required: false,
    label: { fr: "Je joins : copie(s) de paiement", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 62,
  },
  {
    id: "annexeModele74",
    pdfFieldName: "une copie du modèle 74 ou 74bis PSS ou de la Déc",
    type: "checkbox",
    required: false,
    label: { fr: "Je joins : une copie du modèle 74 ou 74bis PSS ou de la Déclaration Pension, activité professionnelle et revenu de remplacement du Service fédéral des Pensions", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 63,
  },
  {
    id: "annexeAutre",
    pdfFieldName: "autre à savoir",
    type: "checkbox",
    required: false,
    label: { fr: "Je joins : autre document, à savoir…", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 64,
  },
  {
    id: "annexeAutreDescription",
    pdfFieldName: "undefined_4",
    type: "text",
    required: false,
    label: { fr: "Description du document joint", nl: "", de: "" },
    visibleIf: { fieldId: "annexeAutre", op: "equals", value: true },
    section: SECTION_ANNEXES,
    order: 65,
  },
  {
    id: "annexeAutreDescriptionSuite",
    pdfFieldName: "undefined_5",
    type: "text",
    required: false,
    label: { fr: "Description du document joint (suite)", nl: "", de: "" },
    visibleIf: { fieldId: "annexeAutre", op: "equals", value: true },
    section: SECTION_ANNEXES,
    order: 66,
  },

  // ==========================================================================
  // Date et signature
  // ==========================================================================
  {
    id: "dateSignature",
    // A VALIDER Oraliks : nom de widget AcroForm inhabituel ("AUJOURD'HUI")
    // pour un champ de date de signature — à confirmer visuellement (position
    // juste au-dessus du widget de signature sur le PDF, cohérent avec
    // "date signature du travailleur" imprimé en fin de page 2).
    pdfFieldName: "AUJOURD'HUI",
    type: "date",
    required: true,
    label: { fr: "Date de signature", nl: "", de: "" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour.", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 67,
  },
  {
    id: "signature",
    pdfFieldName: "Signature51",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique", nl: "", de: "" },
    help: {
      fr: "Signature « façon Adobe » : ton nom + prénom + horodatage seront appliqués à la position de la signature.",
      nl: "", de: "",
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
export function applyC1BImprovements(fields: PdfFormField[]): PdfFormField[] {
  const newIds = new Set(C1B_FIELDS.map((f) => f.id));

  const covered = new Set<string>();
  for (const f of C1B_FIELDS) {
    if (!f.pdfFieldName) continue;
    for (const name of f.pdfFieldName.split("|")) {
      if (name) covered.add(name.trim());
    }
  }

  const preserved = fields.filter((f) => {
    if (covered.has(f.pdfFieldName)) return false;
    if (newIds.has(f.id)) return false;
    return true;
  });

  return [...preserved, ...C1B_FIELDS];
}
