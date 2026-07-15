import { buildEnrichedSchema } from "../field-inference";
import type { AcroFieldRaw, PdfFormField, PdfFormTrigger } from "../types";
import { C1_QUESTIONS, C1_TRIGGERS } from "./c1-fields-improvements";

// `c1-fr` est l'import historique du C1. Son PDF n'est pas celui des variantes
// plus recentes : ses ancres gardent accents, espaces et libelles longs.
// Cet adaptateur repart donc toujours du schema technique immuable, puis ne
// consolide que les questions dont chaque widget peut etre resolu sans doute.

const LEGACY_ALIASES: Record<string, string> = {
  DateNaissance: "Date de naissance",
  Nationalite: "nationalité 3",
  NumeroBoite: "numéro de boîte",
  Email: "adresse email  facultatif",
  Telephone: "numéro de téléphone facultatif",
  PremièreFois: "pour la première fois 5",
  SignatureDuChômeur: "Signature1",
  Oui_PremièreFoisC45DéjàDéclaré:
    "ma déclaration précédente sur le FORMULAIRE C46 reste inchangée",
  Oui_PremièreFoisC46:
    "je le déclare pour la première fois ou je déclare une modification et je joins",
  Oui_PremièreFoisC1CDéjàDéclaré:
    "ma déclaration précédente sur le FORMULAIRE C1C reste inchangée",
  Oui_PremièreFoisC1C:
    "je sollicite pour la première fois le bénéfice de lavantage  Tremplin",
};

// Ces champs demandent un mapping metier/positionnel qui n'est pas prouvable
// depuis le seul nom AcroForm historique. Le champ brut reste expose : aucune
// donnee officielle n'est perdue et aucune valeur n'est stampee au mauvais lieu.
const UNSAFE_ENRICHED_IDS = new Set([
  "dateDemande",
  "dateCreationDossier",
  "remarqueSituationFamiliale",
  "formationStageSyntraDate",
  "titulaireCompte",
]);

// Questions purement pedagogiques ou de routage. Elles ne stampent aucun
// widget, mais rendent le parcours intelligible et pilotent les compagnons.
const SAFE_VIRTUAL_IDS = new Set([
  "cohabiteType",
  "situationCohabitationAmbigue",
  "situationCohabitationAmbigueDejaDeclare",
  "habiteEnColocation",
  "statutJugementPensionAlimentaire",
  "aExerceActivite",
  "aAutresRevenus",
  "modePaiementChequeWarning",
  "incapacite33DejaDeclare",
  "activiteAccessoireDejaDeclare",
  "administrateurSocieteDejaDeclare",
  "independantAccessoireDejaDeclare",
]);

const SECTION_TO_STEP_GROUP: Record<string, string> = {
  demande: "motif",
  identite: "identite",
  adresse: "identite",
  banque: "identite",
  "mode-paiement": "identite",
  "situation-familiale": "famille",
  "mes-activites": "activites-revenus",
  "mes-revenus": "activites-revenus",
  "cotisation-syndicale": "final",
  "non-eee": "final",
  divers: "final",
  affirmations: "final",
  annexes: "final",
  signature: "final",
};

const LEGACY_DROPDOWN_OPTIONS: Record<
  string,
  NonNullable<PdfFormField["options"]>
> = {
  activit_professionnelle: [
    { value: "aucune", label: { fr: "Aucune" } },
    { value: "salariee", label: { fr: "Activité salariée" } },
    { value: "independante", label: { fr: "Activité indépendante" } },
    { value: "autre", label: { fr: "Autre activité" } },
  ],
  revenus_de_remplacement: [
    { value: "aucun", label: { fr: "Aucun" } },
    { value: "mutuelle", label: { fr: "Mutuelle" } },
    { value: "cpas", label: { fr: "CPAS" } },
    { value: "pension", label: { fr: "Pension" } },
    { value: "chomage", label: { fr: "Allocations de chômage" } },
    { value: "autre", label: { fr: "Autre revenu" } },
  ],
  allocation_familiale: [
    { value: "oui", label: { fr: "Oui" } },
    { value: "non", label: { fr: "Non" } },
  ],
};

function normalizeWidgetName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function resolveWidgetName(
  requested: string,
  exactNames: Set<string>,
  namesByNormalized: Map<string, string[]>,
): string | undefined {
  const alias = LEGACY_ALIASES[requested] ?? requested;
  if (exactNames.has(alias)) return alias;
  const matches = namesByNormalized.get(normalizeWidgetName(alias)) ?? [];
  return matches.length === 1 ? matches[0] : undefined;
}

function resolveFieldAnchor(
  pdfFieldName: string,
  exactNames: Set<string>,
  namesByNormalized: Map<string, string[]>,
): string | undefined {
  const resolved: string[] = [];
  for (const part of pdfFieldName.split("|")) {
    // Une paire `widget|` signifie volontairement que seul "oui" possede une
    // case dans le PDF. Le filler connait deja cette convention.
    if (!part) {
      resolved.push("");
      continue;
    }
    const widget = resolveWidgetName(part, exactNames, namesByNormalized);
    if (!widget) return undefined;
    resolved.push(widget);
  }
  return resolved.join("|");
}

function legacySectionForOrder(order: number): string {
  if (order <= 8 || [125, 127, 133].includes(order)) return "identite";
  if ((order >= 9 && order <= 20) || order === 128) return "demande";
  if ((order >= 21 && order <= 52) || (order >= 134 && order <= 138)) {
    return "situation-familiale";
  }
  if (order >= 53 && order <= 80) return "mes-activites";
  if (order >= 81 && order <= 92) return "mes-revenus";
  if ((order >= 93 && order <= 101) || (order >= 122 && order <= 124)) {
    return "mode-paiement";
  }
  if (order >= 102 && order <= 103) return "cotisation-syndicale";
  if (order >= 104 && order <= 116) return "non-eee";
  if (order >= 117 && order <= 121) return "affirmations";
  if (order >= 139 && order <= 145) return "annexes";
  return "divers";
}

function withGuidedStep(field: PdfFormField): PdfFormField {
  const section = field.section ?? legacySectionForOrder(field.order ?? 0);
  const stepGroup = SECTION_TO_STEP_GROUP[section] ?? "final";
  const fallbackOptions = LEGACY_DROPDOWN_OPTIONS[field.id];
  return {
    ...field,
    section,
    stepGroup,
    options: field.options?.length ? field.options : fallbackOptions,
  };
}

export function applyC1FrImprovements(
  fields: PdfFormField[],
  technicalSchema: AcroFieldRaw[] = [],
): PdfFormField[] {
  // Sans schema technique, aucune adaptation n'est sure. Ce cas ne survient
  // pas dans les points d'entree DB, qui chargent explicitement l'AcroForm.
  if (technicalSchema.length === 0) return fields;

  const baseline = buildEnrichedSchema(technicalSchema).map(withGuidedStep);
  const exactNames = new Set(technicalSchema.map((field) => field.pdfFieldName));
  const namesByNormalized = new Map<string, string[]>();
  for (const field of technicalSchema) {
    const key = normalizeWidgetName(field.pdfFieldName);
    namesByNormalized.set(key, [
      ...(namesByNormalized.get(key) ?? []),
      field.pdfFieldName,
    ]);
  }

  const enriched: PdfFormField[] = [];
  for (const question of C1_QUESTIONS) {
    if (UNSAFE_ENRICHED_IDS.has(question.id)) continue;

    if (!question.pdfFieldName) {
      if (SAFE_VIRTUAL_IDS.has(question.id)) enriched.push(withGuidedStep(question));
      continue;
    }

    const anchor = resolveFieldAnchor(
      question.pdfFieldName,
      exactNames,
      namesByNormalized,
    );
    if (anchor) {
      enriched.push(withGuidedStep({ ...question, pdfFieldName: anchor }));
    } else if (SAFE_VIRTUAL_IDS.has(question.id)) {
      enriched.push(withGuidedStep({ ...question, pdfFieldName: "" }));
    }
  }

  const coveredNames = new Set<string>();
  const enrichedIds = new Set(enriched.map((field) => field.id));
  for (const field of enriched) {
    for (const part of field.pdfFieldName.split("|")) {
      if (part) coveredNames.add(part);
    }
  }

  return [
    ...baseline.filter(
      (field) => !coveredNames.has(field.pdfFieldName) && !enrichedIds.has(field.id),
    ),
    ...enriched,
  ];
}

// Le trigger C1-PARTENAIRE repose sur la grille structuree du PDF recent.
// Le C1 historique conserve sa grille brute : les neuf autres compagnons sont
// compatibles et restent disponibles.
export const C1_FR_TRIGGERS: PdfFormTrigger[] = C1_TRIGGERS.filter(
  (trigger) => trigger.whenFieldId !== "cohabitants[*].c1PartenaireStatus",
);
