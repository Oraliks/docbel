// Schéma enrichi du formulaire "C46" — déclaration d'un mandat rémunéré dans
// un organisme de paiement, un organe consultatif du secteur culturel ou dans
// la Commission du travail des arts (art. 46, §3, 7° de l'AR du 25.11.1991).
//
// Petit formulaire compagnon du C1 (déclenché par la question
// `mandatArtistique` du C1 — cf. lib/pdf-forms/seed/c1-fields-improvements.ts,
// trigger `requiresFormSlug: "c46"`).
//
// Mapping AcroForm : 13 widgets, 2 pages, `pnpm tsx scripts/dump-pdf-widgets.ts C46_FR`.
// Référence métier : texte imprimé du FORMULAIRE C46 (Version 01.03.2026).
//
// ===========================================================================
// REMAPPÉ LE 2026-07-31 — le mapping d'origine était décalé d'une ligne
// ===========================================================================
//
// C'est le piège n°1 des AcroForms de l'ONEM (cf. PDF_FORMS_RULES.md) : un
// widget porte le nom du texte imprimé AU-DESSUS de lui, pas celui de la donnée
// qu'il reçoit. Mesuré sur le PDF, la page 1 se lit ainsi :
//
//   y=520,3  widget « lorganismes suivants »   → 1re ligne d'organisme
//   y=491,7  widget « Date39_af_date » (kid 1) → « Moniteur Belge du __ __ / … » n°1
//   y=467,9  widget « Moniteur Belge du »      → 2e ligne d'ORGANISME
//   y=439,0  widget « Date39_af_date » (kid 2) → « Moniteur Belge du … » n°2
//   y=415,4  widget « Moniteur Belge du_2 »    → 3e ligne d'ORGANISME
//   y=386,8  widget « Date39_af_date » (kid 3) → « Moniteur Belge du … » n°3
//
// Le schéma précédent écrivait donc une DATE sur les deux dernières lignes
// d'organisme, la date du jour dans les TROIS guides « Moniteur Belge du »
// (un seul champ AcroForm à trois widgets — `date39_af_date` était de surcroît
// libellé « Date de signature »), et laissait BLANCHE la vraie case de date de
// signature de la page 2 (`AUJOURD'HUI`), qui était marquée `hidden` comme
// « tampon de réception ». Le doute consigné en tête du fichier (« 2 widgets
// Moniteur Belge pour 3 lignes ? ») venait de là : les trois dates existent
// bien, groupées dans un seul champ.
//
// Sortie : les trois dates passent en ÉCRITURE POSITIONNELLE (un champ AcroForm
// à plusieurs widgets partage une seule valeur), les trois lignes d'organisme
// gardent leur widget, et la page 2 retrouve sa date.

import type { PdfFormField } from "../types";
import { mergeEnrichedFields } from "./_merge";
import {
  appliquerGroupes,
  carteDesGroupes,
  champDateDeSignature,
  champNISS,
  champSignature,
  SECTION_ANNEXES,
  SECTION_IDENTITE,
  SECTION_MANDAT_CULTUREL as SECTION_MANDAT,
} from "./_shared/moules";

/// « Une valeur est présente » — le seul moyen d'exprimer « non vide » avec les
/// opérateurs de `visibleIf` (equals / notEquals / in / notIn / matchesRegex).
const NON_VIDE = "\\S";

// ===========================================================================
// PEIGNES IMPRIMÉS
// ===========================================================================
//
// Toutes les valeurs sont MESURÉES sur `private/pdfs/C46_FR.pdf` : abscisse de
// chaque tiret à pdfplumber, position verticale de l'encre par rastérisation à
// 800 dpi (la ligne de base ne se déduit PAS du jambage supposé de la police —
// cf. PDF_FORMS_RULES.md, « peignes imprimés »).

/// « Numéro registre national (NISS) __ __ __ __ __ __ / __ __ __ - __ __ »
/// (page 1, y≈624,4). Onze cases groupées 6-3-2, pas de 12,68 pt.
const NISS_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [6, 3, 2],
  slotWidth: 12.68,
  groupExtra: 5.26,
  startX: 4.16,
  baselineY: 1.05,
};

/// « Moniteur Belge du __ __ / __ __ / __ __ __ __ » — le MÊME guide, imprimé
/// trois fois (Calibri 11 pt, huit cases, pas de 13,44). Seule l'ordonnée
/// change, elle vit donc dans le `drawAt` de chaque champ.
const MONITEUR_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [2, 2, 4],
  slotWidth: 13.44,
  groupExtra: 6.78,
  startX: 2.45,
};

/// Abscisse commune des trois guides « Moniteur Belge du » (mesurée : le
/// premier tiret des trois lignes est exactement au même x).
const MONITEUR_X = 291.36;

/// « Date: __ __ / __ __ / __ __ __ __ » de la page 2, à côté de la signature.
const DATE_SIGNATURE_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [2, 2, 4],
  slotWidth: 11.3,
  groupExtra: 5.38,
  startX: 2.41,
  baselineY: 0.98,
};

/// Une ligne « (ma nomination en tant que membre a été publiée au Moniteur
/// Belge du … *) ». Les trois sont identiques à l'ordonnée près.
function dateMoniteur(opts: {
  id: string;
  rang: number;
  y: number;
  order: number;
  visibleIf?: PdfFormField["visibleIf"];
}): PdfFormField {
  return {
    id: opts.id,
    // Aucun widget revendiqué : le champ AcroForm `Date39_af_date` porte les
    // TROIS guides, une seule valeur les remplirait tous les trois.
    pdfFieldName: "",
    drawAt: { page: 0, x: MONITEUR_X, y: opts.y, size: 11 },
    printAsComb: MONITEUR_COMB,
    fontSize: 11,
    type: "date",
    required: false,
    label: { fr: `Publiée au Moniteur belge du (mandat ${opts.rang})` },
    help: {
      fr: "À défaut de publication au Moniteur belge, laissez cette date vide et joignez en annexe une copie de la nomination (plus bas).",
    },
    visibleIf: opts.visibleIf,
    section: SECTION_MANDAT,
    order: opts.order,
  };
}

export const C46_FIELDS: PdfFormField[] = [
  // ====================================================================
  // SECTION — VOTRE IDENTITÉ (page 1)
  // ====================================================================
  {
    id: "nom_et_pr_nom",
    pdfFieldName: "Nom et prénom",
    // PAS de `prefillFrom` (retiré le 2026-07-26) : un champ `fullname` porte
    // un `{ first, last }`, que `prefillFrom` ne sait pas transporter — il ne
    // connaît que des chaînes, et le runner relit une chaîne comme un NOM.
    // Le type suffit : `canonicalToPrefill` (héritage depuis le dossier) et
    // `buildProfilePrefill` (profil du compte) remplissent tous deux ce type.
    type: "fullname",
    alignTextToGuide: true,
    // Le libellé imprimé est « Nom et prénom » → on assemble dans cet ordre.
    nameOrder: "last-first",
    required: true,
    label: { fr: "Nom et prénom" },
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: -100,
  },
  champNISS({
    pdfFieldName: "NISS",
    printAsComb: NISS_COMB,
    section: SECTION_IDENTITE,
    order: -99,
  }),
  // NOTE canonique : `nom_et_pr_nom` (type "fullname" = { first, last })
  // combine deux clés canoniques (identity.nom + identity.prenom) → non tagué.

  // ====================================================================
  // SECTION — VOTRE DÉCLARATION : jusqu'à TROIS mandats
  //
  // Le papier imprime trois blocs identiques « ligne d'organisme + (ma
  // nomination … a été publiée au Moniteur Belge du …) ». Les mandats 2 et 3
  // n'apparaissent à l'écran qu'une fois le précédent renseigné : afficher six
  // cases vides à quelqu'un qui n'a qu'un mandat est un défaut d'écran, pas une
  // fidélité au papier.
  // ====================================================================
  {
    id: "organisme1",
    pdfFieldName: "lorganismes suivants",
    alignTextToGuide: true,
    type: "text",
    required: true,
    label: { fr: "Nom de l'organisme (mandat 1)" },
    help: {
      fr: "Indiquez le nom de l'organisme auprès duquel vous exercez ce mandat rémunéré. Il doit s'agir d'un organe consultatif du secteur culturel ou de la Commission du travail des arts.",
    },
    section: SECTION_MANDAT,
    order: 1,
  },
  dateMoniteur({ id: "moniteurBelgeDate1", rang: 1, y: 492.4, order: 2 }),
  {
    // ⚠ Le widget s'appelle « Moniteur Belge du » et c'est la 2e ligne
    // d'ORGANISME — cf. l'en-tête du fichier. Ne pas « corriger » ce mapping
    // sur la foi du nom.
    id: "organisme2",
    pdfFieldName: "Moniteur Belge du",
    alignTextToGuide: true,
    type: "text",
    required: false,
    label: { fr: "Nom de l'organisme (mandat 2)" },
    help: { fr: "À remplir uniquement si vous déclarez un second mandat distinct." },
    section: SECTION_MANDAT,
    order: 3,
  },
  dateMoniteur({
    id: "moniteurBelgeDate2",
    rang: 2,
    y: 439.95,
    order: 4,
    visibleIf: { fieldId: "organisme2", op: "matchesRegex", value: NON_VIDE },
  }),
  {
    // Idem : « Moniteur Belge du_2 » est la 3e ligne d'ORGANISME.
    id: "organisme3",
    pdfFieldName: "Moniteur Belge du_2",
    alignTextToGuide: true,
    type: "text",
    required: false,
    label: { fr: "Nom de l'organisme (mandat 3)" },
    visibleIf: { fieldId: "organisme2", op: "matchesRegex", value: NON_VIDE },
    section: SECTION_MANDAT,
    order: 5,
  },
  dateMoniteur({
    id: "moniteurBelgeDate3",
    rang: 3,
    y: 387.6,
    order: 6,
    visibleIf: { fieldId: "organisme3", op: "matchesRegex", value: NON_VIDE },
  }),

  // ====================================================================
  // SECTION — ANNEXES (à défaut de publication au Moniteur belge)
  //
  // Cinq lignes pointillées IDENTIQUES pour une seule question imprimée
  // (« * A défaut de publication au Moniteur belge, je joins en annexe une
  // copie des nominations suivantes : ») : un seul textarea, replié sur les
  // cinq lignes physiques par `lineTargets` — même correction que la
  // description d'activité du C1C. Cinq champs numérotés étaient un défaut
  // d'écran, pas une fidélité au papier.
  // ====================================================================
  {
    // `id` conservé (celui de l'ex-1re ligne) pour ne pas perdre les brouillons
    // déjà en base ; les quatre autres sont purgés par LEGACY_C46_FIELD_IDS.
    id: "nominations_suivantes_1",
    pdfFieldName: "",
    alignTextToGuide: [
      "nominations suivantes 1",
      "nominations suivantes 2",
      "nominations suivantes 3",
      "nominations suivantes 4",
      "nominations suivantes 5",
    ],
    lineTargets: [
      "nominations suivantes 1",
      "nominations suivantes 2",
      "nominations suivantes 3",
      "nominations suivantes 4",
      "nominations suivantes 5",
    ].map((pdfFieldName) => ({ pdfFieldName })),
    type: "textarea",
    required: false,
    label: { fr: "Nominations dont je joins une copie en annexe" },
    help: {
      fr: "À remplir seulement pour les mandats qui n'ont PAS été publiés au Moniteur belge : précisez ici de quels documents il s'agit, et joignez-en une copie.",
    },
    section: SECTION_ANNEXES,
    order: 100,
  },

  // ====================================================================
  // SECTION — DATE + SIGNATURE (page 2)
  // Texte imprimé : « Date: __ __ / __ __ / __ __ __ __   Signature »
  // ====================================================================
  // C'EST la date de signature, et elle est sur la PAGE 2. Elle était `hidden`
  // et décrite comme un « tampon de réception » de la page 1 : sa case partait
  // blanche sur chaque C46 généré, pendant que la date du jour s'imprimait dans
  // les trois guides « Moniteur Belge » de la page 1.
  champDateDeSignature({
    pdfFieldName: "AUJOURD'HUI",
    fontSize: 8,
    printAsComb: DATE_SIGNATURE_COMB,
    order: 1000,
  }),
  champSignature({ pdfFieldName: "Signature", order: 1001 }),
];

/// Champs d'une version antérieure à purger de la base. Sans cette liste ils
/// survivraient (le merge ne compare que les `id`) et continueraient d'écrire
/// dans les mauvaises cases.
const LEGACY_C46_FIELD_IDS = new Set<string>([
  // Renommé `organisme1` : le libellé disait « organisme(s) », le champ n'en
  // portait qu'un.
  "lorganismes_suivants",
  // Question INVENTÉE (elle n'est pas sur le papier) qui gouvernait les trois
  // mandats d'un coup — impossible dès qu'un mandat est publié et un autre non.
  // Remplacée par une visibilité mandat par mandat.
  "publicationMoniteurBelge",
  // Écrivaient une DATE sur les lignes d'organisme 2 et 3.
  "moniteur_belge_du",
  "moniteur_belge_du_2",
  // Écrivait la date du jour dans les trois guides « Moniteur Belge » à la fois
  // (champ AcroForm à trois widgets), sous le libellé « Date de signature ».
  "date39_af_date",
  // Repliés dans le textarea `nominations_suivantes_1` via `lineTargets`.
  "nominations_suivantes_2",
  "nominations_suivantes_3",
  "nominations_suivantes_4",
  "nominations_suivantes_5",
]);

// ===========================================================================
// PARCOURS À L'ÉCRAN — une question = une étape (patron du C1A / C1C / C47)
// ===========================================================================

/// Étape de l'en-tête d'identité — la seule qui ne soit pas une question.
export const C46_GROUPE_IDENTITE = "identite";

/// Les questions du document, DANS L'ORDRE IMPRIMÉ. Chacune devient une étape
/// et porte l'identifiant du champ qui la pose : ce champ est alors l'ANCRE de
/// son étape (cf. `stepAnchorField`) et sa question titre l'étape.
///
/// `signature` ferme la liste sans jamais produire d'étape : la date et la
/// signature sont posées par le serveur (`applyServerAutoFields`).
export const C46_QUESTIONS: readonly string[] = [
  "organisme1",
  "organisme2",
  "organisme3",
  "nominations_suivantes_1",
  "signature",
];

/// Champs RATTACHÉS à une question : la date de publication suit son mandat.
const RATTACHEMENTS: Readonly<Record<string, readonly string[]>> = {
  organisme1: ["moniteurBelgeDate1"],
  organisme2: ["moniteurBelgeDate2"],
  organisme3: ["moniteurBelgeDate3"],
  signature: ["aujourd_hui"],
};

const CARTE_DES_GROUPES = carteDesGroupes(C46_QUESTIONS, RATTACHEMENTS);

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id`).
export function applyC46Improvements(fields: PdfFormField[]): PdfFormField[] {
  return appliquerGroupes(mergeEnrichedFields(fields, C46_FIELDS, LEGACY_C46_FIELD_IDS), {
    parChamp: CARTE_DES_GROUPES,
    groupeEntete: C46_GROUPE_IDENTITE,
    sectionsEntete: [SECTION_IDENTITE],
  });
}
