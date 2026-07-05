// Schéma enrichi du formulaire "C46" — déclaration d'un mandat rémunéré dans
// un organisme de paiement, un organe consultatif du secteur culturel ou dans
// la Commission du travail des arts (art. 46, §3, 7° de l'AR du 25.11.1991).
//
// Petit formulaire compagnon du C1 (déclenché par la question
// `mandatArtistique` du C1 — cf. lib/pdf-forms/seed/c1-fields-improvements.ts,
// trigger `requiresFormSlug: "c46"`).
//
// Mapping AcroForm vérifié sur le dump JSON fourni (13 widgets, 2 pages).
// Référence métier : texte imprimé du FORMULAIRE C46 (Version 01.03.2026).
//
// Structure du texte officiel (page 1) :
//   - Votre identité : Nom et prénom, NISS.
//   - Votre déclaration : nom du/des organisme(s) ("l'organisme(s)
//     suivant(s)"), avec pour chaque mandat déclaré soit une publication au
//     Moniteur belge (date), soit — à défaut de publication — une copie des
//     "nominations suivantes" jointe en annexe (jusqu'à 5 lignes).
// Page 2 : rappel des règles (plafond annuel, obligations, feuille-info
//   T41/T191), affirmation sur l'honneur (texte fixe, pas de case à cocher
//   sur ce PDF), puis Date + Signature.
//
// A VALIDER Oraliks : le dump ne fournit que 2 widgets "Moniteur Belge du"
// (moniteur_belge_du / moniteur_belge_du_2) alors que le texte imprimé montre
// 3 lignes de mandat, chacune avec sa propre mention "Moniteur Belge du". Soit
// le PDF officiel ne propose réellement que 2 dates de publication malgré 3
// lignes de texte (3e ligne = mandat sans date saisissable ?), soit un widget
// a été omis du dump — à vérifier sur le PDF source (private/pdfs/C46_FR.pdf)
// avant mise en prod. On modélise ici 2 lignes de mandat "avec date Moniteur
// belge" (cohérent avec les 2 widgets réels), la question de la 3e ligne
// restant ouverte.

import type { PdfFormField } from "../types";

const SECTION_IDENTITE = "identite";
const SECTION_MANDAT = "mandat-culturel";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";

const YN = [
  { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
  { value: "non", label: { fr: "Non", nl: "", de: "" } },
];

export const C46_FIELDS: PdfFormField[] = [
  // ====================================================================
  // SECTION — VOTRE IDENTITÉ (page 1)
  // ====================================================================
  {
    id: "nom_et_pr_nom",
    pdfFieldName: "Nom et prénom",
    type: "fullname",
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
      fr: "11 chiffres au dos de ta carte d'identité (eID), au-dessus du code-barres.",
      nl: "", de: "",
    },
    placeholder: { fr: "00.00.00-000.00", nl: "", de: "" },
    prefillFrom: "profile.niss",
    section: SECTION_IDENTITE,
    order: -99,
  },

  // ====================================================================
  // SECTION — VOTRE DÉCLARATION (le/les mandat(s))
  // ====================================================================
  {
    id: "lorganismes_suivants",
    pdfFieldName: "lorganismes suivants",
    type: "textarea",
    required: true,
    label: { fr: "Nom du/des organisme(s) concerné(s)", nl: "", de: "" },
    help: {
      fr: "Indique le nom de l'organisme (ou des organismes) auprès duquel/desquels tu exerces ce mandat rémunéré. Il doit s'agir d'un organe consultatif du secteur culturel ou de la Commission du travail des arts.",
      nl: "", de: "",
    },
    section: SECTION_MANDAT,
    order: 1,
  },
  {
    id: "publicationMoniteurBelge",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "Ta nomination en tant que membre a-t-elle été publiée au Moniteur belge ?", nl: "", de: "" },
    help: {
      fr: "Si oui, indique la (les) date(s) de publication ci-dessous. Si non, tu dois joindre en annexe une copie des nominations.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_MANDAT,
    order: 2,
  },
  {
    id: "moniteur_belge_du",
    pdfFieldName: "Moniteur Belge du",
    type: "date",
    required: false,
    label: { fr: "Publiée au Moniteur belge du (mandat 1)", nl: "", de: "" },
    visibleIf: { fieldId: "publicationMoniteurBelge", op: "equals", value: "oui" },
    section: SECTION_MANDAT,
    order: 3,
  },
  {
    id: "moniteur_belge_du_2",
    pdfFieldName: "Moniteur Belge du_2",
    type: "date",
    required: false,
    label: { fr: "Publiée au Moniteur belge du (mandat 2, si applicable)", nl: "", de: "" },
    help: { fr: "À remplir uniquement si tu déclares un second mandat distinct.", nl: "", de: "" },
    visibleIf: { fieldId: "publicationMoniteurBelge", op: "equals", value: "oui" },
    section: SECTION_MANDAT,
    order: 4,
  },

  // ====================================================================
  // SECTION — ANNEXES (à défaut de publication au Moniteur belge)
  // ====================================================================
  {
    id: "nominations_suivantes_1",
    pdfFieldName: "nominations suivantes 1",
    type: "text",
    required: false,
    label: { fr: "Copie de nomination jointe — ligne 1", nl: "", de: "" },
    help: {
      fr: "→ Joins une copie de ta nomination en annexe et précise ici de quel document il s'agit.",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "publicationMoniteurBelge", op: "equals", value: "non" },
    section: SECTION_ANNEXES,
    order: 100,
  },
  {
    id: "nominations_suivantes_2",
    pdfFieldName: "nominations suivantes 2",
    type: "text",
    required: false,
    label: { fr: "Copie de nomination jointe — ligne 2", nl: "", de: "" },
    visibleIf: { fieldId: "publicationMoniteurBelge", op: "equals", value: "non" },
    section: SECTION_ANNEXES,
    order: 101,
  },
  {
    id: "nominations_suivantes_3",
    pdfFieldName: "nominations suivantes 3",
    type: "text",
    required: false,
    label: { fr: "Copie de nomination jointe — ligne 3", nl: "", de: "" },
    visibleIf: { fieldId: "publicationMoniteurBelge", op: "equals", value: "non" },
    section: SECTION_ANNEXES,
    order: 102,
  },
  {
    id: "nominations_suivantes_4",
    pdfFieldName: "nominations suivantes 4",
    type: "text",
    required: false,
    label: { fr: "Copie de nomination jointe — ligne 4", nl: "", de: "" },
    visibleIf: { fieldId: "publicationMoniteurBelge", op: "equals", value: "non" },
    section: SECTION_ANNEXES,
    order: 103,
  },
  {
    id: "nominations_suivantes_5",
    pdfFieldName: "nominations suivantes 5",
    type: "text",
    required: false,
    label: { fr: "Copie de nomination jointe — ligne 5", nl: "", de: "" },
    visibleIf: { fieldId: "publicationMoniteurBelge", op: "equals", value: "non" },
    section: SECTION_ANNEXES,
    order: 104,
  },

  // ====================================================================
  // SECTION — CASE ADMINISTRATIVE (page 1, tampon de réception)
  // "date cachet" en haut de la page 1 : case remplie par le bureau du
  // chômage / l'organisme de paiement à la réception, pas par le citoyen.
  // Masquée — même traitement que les cases administratives du C1 ANNEXE
  // REGIS (cf. c1-regis-fields.ts, regisRegistreIndisponible1/2).
  // ====================================================================
  {
    id: "aujourd_hui",
    pdfFieldName: "AUJOURD'HUI",
    type: "text",
    required: false,
    label: { fr: "(cas administratif — tampon de réception)", nl: "", de: "" },
    hidden: true,
    section: SECTION_ANNEXES,
    order: 900,
  },

  // ====================================================================
  // SECTION — DATE + SIGNATURE (page 2)
  // Texte imprimé : "Date: __ __ / __ __ / __ __ __ __   Signature"
  // ====================================================================
  {
    id: "date39_af_date",
    pdfFieldName: "Date39_af_date",
    type: "date",
    required: true,
    label: { fr: "Date de signature", nl: "", de: "" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour.", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 1000,
  },
  {
    id: "signature",
    pdfFieldName: "Signature",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique", nl: "", de: "" },
    help: {
      fr: "Signature « façon Adobe » : ton nom + prénom + horodatage seront appliqués à la position de la signature.",
      nl: "", de: "",
    },
    section: SECTION_SIGNATURE,
    order: 1001,
  },
];

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id`).
export function applyC46Improvements(fields: PdfFormField[]): PdfFormField[] {
  const newIds = new Set(C46_FIELDS.map((f) => f.id));
  const preserved = fields.filter((f) => !newIds.has(f.id));
  return [...preserved, ...C46_FIELDS];
}
