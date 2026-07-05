// Schéma enrichi du formulaire "C1C - Déclaration d'une activité accessoire"
// (mesure « Tremplin-indépendants », art. 48 §1bis AR 25.11.1991).
//
// Formulaire compagnon (2 pages, 33 widgets AcroForm) déclenché depuis le C1
// quand le citoyen répond "oui" à la question "J'exerce une activité
// accessoire comme indépendant et je bénéficie (ou souhaite bénéficier) de la
// mesure « Tremplin-indépendants »" (cf. C1_TRIGGERS dans
// c1-fields-improvements.ts, requiresFormSlug: "c1c").
//
// Principe de la mesure (texte imprimé sur le PDF) : le citoyen peut exercer
// une activité accessoire comme indépendant pendant son chômage et conserver
// son droit aux allocations pendant 12 mois maximum (limité en tout cas à la
// durée de son droit aux allocations). Pas de mention sur la carte de
// contrôle pendant cette période.
//
// Mapping AcroForm vérifié sur le dump JSON fourni (33 champs, pdfFieldName
// vérifié tel quel — aucune modification de casse/espaces).
// Version imprimée : 06.11.2025 / FORMULAIRE C1C.

import type { PdfFormField } from "../types";

const SECTION_IDENTITE = "identite";
const SECTION_ACTIVITES = "mes-activites";
const SECTION_REVENUS = "mes-revenus";
const SECTION_ACTIVITES_ANTERIEURES = "activites-anterieures";
const SECTION_AFFIRMATIONS = "affirmations";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";

const YN = [
  { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
  { value: "non", label: { fr: "Non", nl: "", de: "" } },
];

export const C1C_FIELDS: PdfFormField[] = [
  // ==========================================================================
  // Votre identité
  // ==========================================================================
  {
    id: "pr_nom_et_nom",
    pdfFieldName: "Prénom et nom",
    type: "fullname",
    required: true,
    label: { fr: "Prénom et nom", nl: "", de: "" },
    prefillFrom: "profile.firstName",
    section: SECTION_IDENTITE,
    order: 0,
  },
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
    section: SECTION_IDENTITE,
    order: 1,
  },

  // ==========================================================================
  // Votre déclaration (intro) — date de début de l'activité accessoire.
  // ==========================================================================
  {
    id: "dateDebutActivite",
    pdfFieldName: "Date53_af_date",
    type: "date",
    required: true,
    label: { fr: "Je souhaite exercer cette activité accessoire à partir du", nl: "", de: "" },
    help: {
      fr: "L'avantage « Tremplin-indépendants » dure 12 mois maximum, et en tout cas jamais plus longtemps que ton droit aux allocations. Pendant cette période, tu ne dois ni mentionner cette activité sur ta carte de contrôle, ni introduire de formulaire de déclaration remplaçant la carte de contrôle en cas de dispense.",
      nl: "", de: "",
    },
    section: SECTION_IDENTITE,
    order: 2,
  },

  // ==========================================================================
  // 1. Description de mon activité
  // ==========================================================================
  {
    id: "descriptionActivite1",
    pdfFieldName: "Je décris cidessous lactivité accessoire exercée 1",
    type: "textarea",
    required: true,
    label: { fr: "Description de l'activité accessoire exercée", nl: "", de: "" },
    help: { fr: "Décris concrètement en quoi consiste ton activité indépendante.", nl: "", de: "" },
    section: SECTION_ACTIVITES,
    order: 10,
  },
  {
    id: "descriptionActivite2",
    pdfFieldName: "Je décris cidessous lactivité accessoire exercée 2",
    type: "textarea",
    required: false,
    label: { fr: "Description de l'activité accessoire (suite)", nl: "", de: "" },
    section: SECTION_ACTIVITES,
    order: 11,
  },
  {
    id: "descriptionActivite3",
    pdfFieldName: "Je décris cidessous lactivité accessoire exercée 3",
    type: "textarea",
    required: false,
    label: { fr: "Description de l'activité accessoire (suite)", nl: "", de: "" },
    section: SECTION_ACTIVITES,
    order: 12,
  },
  {
    id: "possedeSiteInternet",
    pdfFieldName: "non|oui www",
    type: "radio",
    required: true,
    label: { fr: "Je dispose d'un site internet pour mon activité", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 13,
  },
  {
    id: "siteInternetUrl",
    pdfFieldName: "Je dispose dun site internet pour mon activité",
    type: "text",
    required: false,
    label: { fr: "Adresse du site internet", nl: "", de: "" },
    placeholder: { fr: "www.exemple.be", nl: "", de: "" },
    visibleIf: { fieldId: "possedeSiteInternet", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 14,
  },
  {
    id: "lieuExerciceActivite",
    pdfFieldName: "à ladresse de mon domicile|à une autre adresse",
    type: "radio",
    required: true,
    label: { fr: "J'exerce mon activité…", nl: "", de: "" },
    options: [
      { value: "domicile", label: { fr: "À l'adresse de mon domicile", nl: "", de: "" } },
      { value: "autre", label: { fr: "À une autre adresse", nl: "", de: "" } },
    ],
    section: SECTION_ACTIVITES,
    order: 15,
  },
  // A VALIDER Oraliks : le PDF officiel n'affiche qu'une seule ligne de
  // pointillés pour "à une autre adresse ..." (texte imprimé), mais le dump
  // AcroForm expose 2 widgets texte distincts et génériques ("undefined",
  // "undefined_2") à cet endroit. Je les traite comme 2 lignes d'une même
  // adresse (rue+numéro / code postal+commune), par analogie avec les autres
  // formulaires du dossier — mais je n'ai aucune confirmation visuelle de la
  // disposition réelle de ces 2 widgets sur le PDF. Merci de vérifier si un
  // seul des deux suffit, ou si l'ordre rue/commune est correct.
  {
    id: "adresseActiviteLigne1",
    pdfFieldName: "undefined",
    type: "text",
    required: false,
    label: { fr: "Autre adresse — rue et numéro", nl: "", de: "" },
    visibleIf: { fieldId: "lieuExerciceActivite", op: "equals", value: "autre" },
    section: SECTION_ACTIVITES,
    order: 16,
  },
  {
    id: "adresseActiviteLigne2",
    pdfFieldName: "undefined_2",
    type: "text",
    required: false,
    label: { fr: "Autre adresse — code postal et commune", nl: "", de: "" },
    visibleIf: { fieldId: "lieuExerciceActivite", op: "equals", value: "autre" },
    section: SECTION_ACTIVITES,
    order: 17,
  },

  // ==========================================================================
  // 2. Exercice de mon activité
  // ==========================================================================
  {
    id: "formeExerciceActivite",
    pdfFieldName: "toggle_5|société mandataire administrateur gérant ou associé actif",
    type: "radio",
    required: true,
    label: { fr: "Je souhaite exercer cette activité en tant que…", nl: "", de: "" },
    help: {
      fr: "Indique le numéro BCE si tu en disposes déjà (même si l'activité n'a pas encore débuté).",
      nl: "", de: "",
    },
    options: [
      { value: "personne-physique", label: { fr: "Personne physique", nl: "", de: "" } },
      { value: "societe", label: { fr: "Société (mandataire, administrateur, gérant ou associé actif)", nl: "", de: "" } },
    ],
    section: SECTION_ACTIVITES,
    order: 20,
  },
  // A VALIDER Oraliks : le texte imprimé affiche 2 emplacements BCE distincts
  // (un pour la personne physique, un pour "Numéro BCE de l'entreprise :"),
  // mais le dump AcroForm ne contient qu'UN SEUL widget texte générique
  // ("fill_10") à cet endroit du formulaire, sans second champ BCE identifié.
  // Je mappe donc ce widget unique aux deux cas (personne physique OU
  // société) — merci de confirmer qu'il s'agit bien du même widget technique
  // partagé, sinon il manque un champ BCE dans ce dump.
  {
    id: "numeroBce",
    pdfFieldName: "fill_10",
    type: "bce",
    required: false,
    label: { fr: "Numéro BCE", nl: "", de: "" },
    help: { fr: "Numéro d'entreprise (BCE) à 10 chiffres, si tu en disposes déjà.", nl: "", de: "" },
    placeholder: { fr: "0123.456.789", nl: "", de: "" },
    section: SECTION_ACTIVITES,
    order: 21,
  },
  {
    id: "nomEntreprise",
    pdfFieldName: "Nom de lentreprise",
    type: "text",
    required: false,
    label: { fr: "Nom de l'entreprise", nl: "", de: "" },
    visibleIf: { fieldId: "formeExerciceActivite", op: "equals", value: "societe" },
    section: SECTION_ACTIVITES,
    order: 22,
  },
  // A VALIDER Oraliks : le widget correspondant au champ "Autre : ..." du
  // texte imprimé ("Indiquez ici si, p.ex., vous n'avez pas encore débuté
  // l'activité. Autre : ...") n'a pas de pdfFieldName explicite dans le dump.
  // Le seul candidat texte restant à cet emplacement de l'ordre AcroForm est
  // "Je dispose des compétences professionnelles spécifiques pour exercer mon
  // activité" (typé "text" dans le dump alors que la vraie question
  // "compétences professionnelles" du texte imprimé est déjà couverte plus
  // bas par une paire de checkboxes oui/non distincte — oui_2/non_jai_besoin).
  // Je fais l'hypothèse que ce widget texte générique est en réalité le champ
  // libre "Autre", et non un doublon de la question compétences. À vérifier
  // visuellement sur le PDF avant mise en production.
  {
    id: "formeExerciceAutre",
    pdfFieldName: "Je dispose des compétences professionnelles spécifiques pour exercer mon activité",
    type: "text",
    required: false,
    label: { fr: "Autre (précise ta situation)", nl: "", de: "" },
    help: {
      fr: "Utilise ce champ si tu n'as pas encore débuté l'activité, ou pour toute autre précision utile.",
      nl: "", de: "",
    },
    section: SECTION_ACTIVITES,
    order: 23,
  },
  {
    id: "activiteExerceeParTiers",
    pdfFieldName: "non_2|oui",
    type: "radio",
    required: true,
    label: { fr: "Une partie de mon activité est exercée par des tiers (travailleurs, sous-traitants, apprentis)", nl: "", de: "" },
    help: {
      fr: "⚠ Attention : ta demande ne peut pas être acceptée si une partie de ton activité est exercée par des tiers. Si, en cours d'activité, une partie de celle-ci est exercée par des tiers, tu dois le déclarer — l'avantage te sera alors retiré.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 24,
  },
  {
    id: "competencesProfessionnellesSpecifiques",
    pdfFieldName: "oui_2|non jai besoin dun tiers conjoint aidantfamilial mandataire pour me",
    type: "radio",
    required: true,
    label: { fr: "Je dispose des compétences professionnelles spécifiques pour exercer mon activité", nl: "", de: "" },
    help: {
      fr: "Coche « oui » si aucune compétence professionnelle spécifique n'est demandée pour ton activité.",
      nl: "", de: "",
    },
    options: [
      { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
      {
        value: "non",
        label: {
          fr: "Non, j'ai besoin d'un tiers (conjoint, aidant-familial, mandataire…) pour me permettre d'exercer mon activité",
          nl: "", de: "",
        },
      },
    ],
    section: SECTION_ACTIVITES,
    order: 25,
  },

  // ==========================================================================
  // Revenus de l'activité indépendante (page 2, avant la section 3)
  // ==========================================================================
  {
    id: "revenuBrutAnnuel",
    pdfFieldName: "Texte55",
    type: "number",
    required: true,
    label: { fr: "Revenu brut total annuel de l'activité (EUR/an)", nl: "", de: "" },
    help: {
      fr: "Montant total du bénéfice brut, sans déduction des charges, dépenses et pertes professionnelles. Si tu es mandataire ou gérant, mentionne le revenu brut total de l'entreprise. Ce montant permet de calculer le montant provisoire de tes allocations de chômage.",
      nl: "", de: "",
    },
    section: SECTION_REVENUS,
    order: 30,
  },
  {
    id: "revenuNetImposableAnnuel",
    pdfFieldName: "Texte56",
    type: "number",
    required: true,
    label: { fr: "Revenu net imposable annuel de l'indépendant (EUR/an)", nl: "", de: "" },
    help: {
      fr: "Revenu imposable qui sera indiqué sur l'avertissement-extrait de rôle (recettes diminuées des charges, dépenses et pertes professionnelles). Après réception de l'avertissement-extrait de rôle, un calcul définitif sera effectué — il peut mener à un paiement supplémentaire, à une récupération d'allocations, ou n'avoir aucune incidence.",
      nl: "", de: "",
    },
    section: SECTION_REVENUS,
    order: 31,
  },

  // ==========================================================================
  // 3. Informations sur vos éventuelles activités antérieures
  // ==========================================================================
  {
    id: "activiteIndependanteAnterieure",
    pdfFieldName: "non_3|oui_3",
    type: "radio",
    required: true,
    label: {
      fr: "J'ai exercé une activité indépendante à titre principal au cours des 6 dernières années (calculées de date à date), précédant la date de début de la nouvelle activité",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES_ANTERIEURES,
    order: 40,
  },
  {
    id: "descriptionActivitesAnterieures1",
    pdfFieldName: "Je décris précisément cidessous chaque activité exercée 1",
    type: "textarea",
    required: false,
    label: { fr: "Description de chaque activité antérieure exercée", nl: "", de: "" },
    visibleIf: { fieldId: "activiteIndependanteAnterieure", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES_ANTERIEURES,
    order: 41,
  },
  {
    id: "descriptionActivitesAnterieures2",
    pdfFieldName: "Je décris précisément cidessous chaque activité exercée 2",
    type: "textarea",
    required: false,
    label: { fr: "Description de chaque activité antérieure exercée (suite)", nl: "", de: "" },
    visibleIf: { fieldId: "activiteIndependanteAnterieure", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES_ANTERIEURES,
    order: 42,
  },

  // ==========================================================================
  // Affirmations obligatoires (page 2 — "Signature")
  // Le PDF officiel formule ces points comme des affirmations sur l'honneur
  // continues (pas de case à cocher dédiée par point sur l'AcroForm, à
  // l'exception de l'engagement de communication ci-dessous qui a un widget
  // texte propre). Les autres affirmations (non-origine du chômage,
  // non-exercice en profession principale, réduction du montant journalier,
  // maintien de la disponibilité, retrait possible de l'avantage) sont
  // reprises comme rappel informatif — cf. note ci-dessous.
  // ==========================================================================
  // A VALIDER Oraliks : le texte imprimé liste 5 affirmations sur l'honneur
  // ("je déclare que : mon chômage ne trouve pas son origine dans…", etc.)
  // avant la phrase finale "J'affirme sur l'honneur que la présente
  // déclaration est sincère et complète et je communiquerai toute
  // modification à mon organisme de paiement." Seul le widget texte
  // "je communiquerai toute modification à mon organisme de paiement" existe
  // dans le dump AcroForm — je le mappe comme case de confirmation globale
  // (checkbox) plutôt que "text", car le texte imprimé n'attend pas de saisie
  // libre à cet endroit. Merci de confirmer que ce widget est bien une case
  // à cocher sur le PDF réel (type AcroForm) et non un champ texte.
  {
    id: "affirmationSincereEtComplete",
    pdfFieldName: "je communiquerai toute modification à mon organisme de paiement",
    type: "checkbox",
    required: true,
    label: {
      fr: "J'affirme sur l'honneur que la présente déclaration est sincère et complète et je communiquerai toute modification à mon organisme de paiement",
      nl: "", de: "",
    },
    help: {
      fr: "En cochant, tu confirmes aussi avoir pris connaissance des points suivants : ton chômage ne trouve pas son origine dans l'arrêt ou la réduction d'un travail salarié en vue d'entamer une activité indépendante ; tu n'as pas exercé cette activité accessoire en profession principale durant les 6 dernières années ; le montant journalier de ton allocation sera réduit en fonction des revenus de ton activité accessoire ; tu dois rester inscrit comme demandeur d'emploi et disponible pour le marché de l'emploi ; l'avantage peut t'être retiré si l'activité ne présente plus le caractère d'une profession accessoire (nombre d'heures ou montant des revenus).",
      nl: "", de: "",
    },
    section: SECTION_AFFIRMATIONS,
    order: 100,
  },

  // ==========================================================================
  // Annexes (optionnelles)
  // ==========================================================================
  {
    id: "annexes",
    pdfFieldName: "Je joins en annexes 1",
    type: "textarea",
    required: false,
    label: { fr: "Je joins en annexe(s)", nl: "", de: "" },
    help: { fr: "Décris les documents que tu joins à cette déclaration, s'il y en a.", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 200,
  },
  {
    id: "annexesSuite",
    pdfFieldName: "Je joins en annexes 2",
    type: "textarea",
    required: false,
    label: { fr: "Je joins en annexe(s) (suite)", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 201,
  },

  // ==========================================================================
  // Date et signature
  // ==========================================================================
  {
    id: "dateSignature",
    pdfFieldName: "Date57_af_date",
    type: "date",
    required: true,
    label: { fr: "Date de signature", nl: "", de: "" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour.", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 210,
  },
  {
    id: "signature",
    pdfFieldName: "Signature58",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique", nl: "", de: "" },
    help: {
      fr: "Signature « façon Adobe » : ton nom + prénom + horodatage seront appliqués à la position de la signature.",
      nl: "", de: "",
    },
    section: SECTION_SIGNATURE,
    order: 211,
  },
];

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id`).
///
/// Retire aussi les anciens champs checkbox individuels désormais couverts
/// par les nouveaux champs `radio` fusionnés (paires oui/non), en comparant
/// leur `pdfFieldName` d'origine.
export function applyC1CImprovements(fields: PdfFormField[]): PdfFormField[] {
  const newIds = new Set(C1C_FIELDS.map((f) => f.id));

  const covered = new Set<string>();
  for (const f of C1C_FIELDS) {
    if (!f.pdfFieldName.includes("|")) continue;
    for (const name of f.pdfFieldName.split("|")) covered.add(name.trim());
  }

  const preserved = fields.filter((f) => {
    if (covered.has(f.pdfFieldName)) return false;
    if (newIds.has(f.id)) return false;
    return true;
  });

  return [...preserved, ...C1C_FIELDS];
}
