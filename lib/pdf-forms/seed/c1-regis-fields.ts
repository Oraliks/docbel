// Schéma enrichi du formulaire "C1 ANNEXE REGIS" — précisions sur la
// composition de ménage quand une différence existe entre le C1 et les
// registres officiels (registre national).
//
// Mapping AcroForm vérifié sur private/pdfs/Annexe_Regis_FR.pdf via
// lib/pdf-forms/acroform-parser.ts#parsePdf (2 pages, 42 widgets).
// Référence métier : légende "Explications relatives à la rubrique I" (page
// 2 du formulaire officiel) — codes N1-N2 (nationalité), A1-A2 + sous-codes
// (adresse), FN1-FN5 / FY1-FY5 (membres du ménage).

import type { PdfFormField } from "../types";

const SECTION_IDENTITE = "identite";
const SECTION_GRILLE1 = "grille-differences";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";

const YN = [
  { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
  { value: "non", label: { fr: "Non", nl: "", de: "" } },
];

/// Préfixes exacts des 2 colonnes de la Grille 1 sur le PDF officiel — la
/// virgule et les apostrophes du texte affiché sont absentes du nom de champ
/// technique (comportement du PDF source, pas une décision de notre côté).
const GRILLE1_C1_PREFIX =
  "INDICATION SUR LE C1 indiquez la nationalité ladresse le nom et le prénom";
const GRILLE1_REGISTRE_PREFIX =
  "INDICATION DANS LES REGISTRES indiquez la nationalité ladresse le nom et le prénom";

const FN4_HELP =
  "Si cette personne est une ou un colocataire (aucun lien de parenté) qui vit réellement à la même adresse mais avec qui tu ne partages pas la vie domestique/financière : indique le code FN4. Pour les autres cas, réfère-toi à la légende page 2 du formulaire officiel (codes FN1-FN5, FY1-FY5).";

/// Une ligne de la Grille 1/Grille 2 hors "personne" (nationalité, adresse).
function fixedRow(opts: {
  key: "nationalite" | "adresse";
  label: string;
  checkboxSuffix: string; // "" pour la 1re ligne (bare), "_2" pour la 2e…
  grille1Suffix: string; // "MA NATIONALITE" | "MON ADRESSE"
  order: number;
}): PdfFormField[] {
  const diffId = `${opts.key}Difference`;
  const checkbox =
    opts.checkboxSuffix === ""
      ? "oui|non"
      : `oui${opts.checkboxSuffix}|non${opts.checkboxSuffix}`;
  return [
    {
      id: diffId,
      pdfFieldName: checkbox,
      type: "radio",
      required: false,
      label: { fr: `${opts.label} — y a-t-il une différence avec les registres ?`, nl: "", de: "" },
      options: YN,
      section: SECTION_GRILLE1,
      order: opts.order,
    },
    {
      id: `${opts.key}C1`,
      pdfFieldName: `${GRILLE1_C1_PREFIX}${opts.grille1Suffix}`,
      type: "text",
      required: false,
      label: { fr: `${opts.label} — indication sur le C1`, nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: opts.order + 1,
    },
    {
      id: `${opts.key}Registre`,
      pdfFieldName: `${GRILLE1_REGISTRE_PREFIX}${opts.grille1Suffix}`,
      type: "text",
      required: false,
      label: { fr: `${opts.label} — indication dans les registres officiels`, nl: "", de: "" },
      help: { fr: "Ce que dit ton registre national — vérifie sur ton eID.", nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: opts.order + 2,
    },
    {
      id: `${opts.key}Explication`,
      pdfFieldName: opts.grille1Suffix,
      type: "text",
      required: false,
      label: { fr: `${opts.label} — explication (voir légende page 2, codes N/A)`, nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: opts.order + 3,
    },
  ];
}

/// Une ligne "Personne N" (N = 1..5). La 5e personne n'a pas de suffixe
/// numérique sur le PDF officiel (nommage irrégulier — même limitation déjà
/// documentée pour la grille "cohabitants" du C1 lui-même).
function personneRow(n: 1 | 2 | 3 | 4 | 5): PdfFormField[] {
  const checkboxSuffix = { 1: "_3", 2: "_4", 3: "_5", 4: "_6", 5: "_7" }[n];
  const grille1Suffix = n === 5 ? "PERSONNE" : `PERSONNE ${n}`;
  const label = n === 5 ? "Personne (5e)" : `Personne ${n}`;
  const diffId = `personne${n}Difference`;
  const order = 200 + n * 10;
  return [
    {
      id: diffId,
      pdfFieldName: `oui${checkboxSuffix}|non${checkboxSuffix}`,
      type: "radio",
      required: false,
      label: { fr: `${label} — y a-t-il une différence avec les registres ?`, nl: "", de: "" },
      options: YN,
      section: SECTION_GRILLE1,
      order,
    },
    {
      id: `personne${n}C1`,
      pdfFieldName: `${GRILLE1_C1_PREFIX}${grille1Suffix}`,
      type: "text",
      required: false,
      label: { fr: `${label} — indication sur le C1 (nom, prénom)`, nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: order + 1,
    },
    {
      id: `personne${n}Registre`,
      pdfFieldName: `${GRILLE1_REGISTRE_PREFIX}${grille1Suffix}`,
      type: "text",
      required: false,
      label: { fr: `${label} — indication dans les registres officiels`, nl: "", de: "" },
      help: { fr: "Ce que dit ton registre national pour cette personne — vérifie sur son eID ou demande-lui.", nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: order + 2,
    },
    {
      id: `personne${n}Explication`,
      pdfFieldName: grille1Suffix,
      type: "text",
      required: false,
      label: { fr: `${label} — explication (code)`, nl: "", de: "" },
      help: { fr: FN4_HELP, nl: "", de: "" },
      visibleIf: { fieldId: diffId, op: "equals", value: "oui" },
      section: SECTION_GRILLE1,
      order: order + 3,
    },
  ];
}

export const C1_REGIS_FIELDS: PdfFormField[] = [
  {
    id: "nom",
    pdfFieldName: "NOM",
    type: "text",
    required: true,
    label: { fr: "Nom", nl: "", de: "" },
    prefillFrom: "profile.lastName",
    section: SECTION_IDENTITE,
    order: -100,
  },
  {
    id: "prenom",
    pdfFieldName: "PRENOM",
    type: "text",
    required: true,
    label: { fr: "Prénom", nl: "", de: "" },
    prefillFrom: "profile.firstName",
    section: SECTION_IDENTITE,
    order: -99,
  },
  {
    id: "dateDA",
    pdfFieldName: "Date de DA",
    type: "date",
    required: true,
    label: { fr: "Date de la demande d'allocations", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_IDENTITE,
    order: -98,
  },

  ...fixedRow({ key: "nationalite", label: "Ma nationalité", checkboxSuffix: "", grille1Suffix: "MA NATIONALITE", order: 100 }),
  ...fixedRow({ key: "adresse", label: "Mon adresse", checkboxSuffix: "_2", grille1Suffix: "MON ADRESSE", order: 110 }),
  ...personneRow(1),
  ...personneRow(2),
  ...personneRow(3),
  ...personneRow(4),
  ...personneRow(5),

  {
    id: "nombreAnnexesJointes",
    pdfFieldName: "Nombre d'annexe joint",
    type: "number",
    required: false,
    label: { fr: "Nombre d'annexes jointes", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 900,
  },
  {
    id: "signature",
    pdfFieldName: "Signature6",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique", nl: "", de: "" },
    help: { fr: "Signature « façon Adobe » : ton nom + prénom + horodatage seront appliqués à la position de la signature.", nl: "", de: "" },
    section: SECTION_SIGNATURE,
    order: 1000,
  },

  // Cases administratives (page 2) : utilisées uniquement quand le Registre
  // national lui-même n'a aucune donnée exploitable — décision de
  // l'ONEM/bureau du chômage, pas une déclaration citoyenne. Masquées.
  {
    id: "regisRegistreIndisponible1",
    pdfFieldName:
      "La rubrique I ne peut pas être complétée parce que les données du Registre national ou des registres de la",
    type: "checkbox",
    required: false,
    label: { fr: "(cas administratif — registre indisponible)", nl: "", de: "" },
    hidden: true,
    section: SECTION_ANNEXES,
    order: 1100,
  },
  {
    id: "regisRegistreIndisponible2",
    pdfFieldName:
      "La rubrique I nest pas entièrement complétée parce que le chômeur est uniquement connu dans les registres",
    type: "checkbox",
    required: false,
    label: { fr: "(cas administratif — registre partiellement indisponible)", nl: "", de: "" },
    hidden: true,
    section: SECTION_ANNEXES,
    order: 1101,
  },
];

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id`).
export function applyC1RegisImprovements(fields: PdfFormField[]): PdfFormField[] {
  const newIds = new Set(C1_REGIS_FIELDS.map((f) => f.id));
  const preserved = fields.filter((f) => !newIds.has(f.id));
  return [...preserved, ...C1_REGIS_FIELDS];
}
