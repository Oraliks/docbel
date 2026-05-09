import type { CommissionParitaire } from "@prisma/client";

export const COMMISSION_TYPES = [
  "commission_paritaire",
  "sous_commission_paritaire",
  "sous_secteur_officieux_ou_interne",
] as const;

export type CommissionType = (typeof COMMISSION_TYPES)[number];

export function isCommissionType(value: unknown): value is CommissionType {
  return typeof value === "string" && (COMMISSION_TYPES as readonly string[]).includes(value);
}

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  commission_paritaire: "Commission paritaire",
  sous_commission_paritaire: "Sous-commission",
  sous_secteur_officieux_ou_interne: "Sous-secteur",
};

export interface CommissionInput {
  code: string;
  numero: string;
  numeroOfficiel: string;
  codeOfficiel5: string;
  suffixeInterne: string;
  type: CommissionType;
  nom: string;
}

const CODE_RE = /^\d{7}$/;
const NUMERO_RE = /^\d{3}(?:\.\d{2}){0,2}$/;
const SUFFIX_RE = /^\d{2}$/;
const CODE_OFFICIEL_RE = /^\d{5}$/;

function clean(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

export function buildLabel(numero: string, nom: string): string {
  return `${numero} - ${nom.toUpperCase()}`;
}

export function buildSearchText(input: {
  code: string;
  numero: string;
  numeroOfficiel: string;
  suffixeInterne: string;
  nom: string;
}): string {
  const numeroParts = input.numero.split(".");
  const officielParts = input.numeroOfficiel.split(".");
  const tokens = [
    input.code,
    ...numeroParts,
    ...officielParts,
    input.nom
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, ""),
  ];
  return tokens.join(" ").replace(/\s+/g, " ").trim();
}

export type ValidationError = { field: string; message: string };

export function validateCommissionInput(
  body: unknown
): { ok: true; data: CommissionInput } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const raw = (body ?? {}) as Record<string, unknown>;

  const code = clean(raw.code);
  const numero = clean(raw.numero);
  const numeroOfficiel = clean(raw.numeroOfficiel);
  const codeOfficiel5 = clean(raw.codeOfficiel5);
  const suffixeInterne = clean(raw.suffixeInterne);
  const type = clean(raw.type);
  const nom = clean(raw.nom);

  if (!CODE_RE.test(code)) {
    errors.push({ field: "code", message: "Code: 7 chiffres requis (ex: 1020401)" });
  }
  if (!NUMERO_RE.test(numero)) {
    errors.push({ field: "numero", message: "Numéro invalide (ex: 102.04.01)" });
  }
  if (!NUMERO_RE.test(numeroOfficiel)) {
    errors.push({ field: "numeroOfficiel", message: "Numéro officiel invalide (ex: 102.04)" });
  }
  if (!CODE_OFFICIEL_RE.test(codeOfficiel5)) {
    errors.push({ field: "codeOfficiel5", message: "Code officiel: 5 chiffres requis" });
  }
  if (!SUFFIX_RE.test(suffixeInterne)) {
    errors.push({ field: "suffixeInterne", message: "Suffixe interne: 2 chiffres requis" });
  }
  if (!isCommissionType(type)) {
    errors.push({ field: "type", message: "Type invalide" });
  }
  if (nom.length < 2) {
    errors.push({ field: "nom", message: "Nom requis (min 2 caractères)" });
  }
  if (nom.length > 500) {
    errors.push({ field: "nom", message: "Nom trop long (max 500)" });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      code,
      numero,
      numeroOfficiel,
      codeOfficiel5,
      suffixeInterne,
      type: type as CommissionType,
      nom,
    },
  };
}

export type SerializedCommission = {
  id: string;
  code: string;
  numero: string;
  numeroOfficiel: string;
  codeOfficiel5: string;
  suffixeInterne: string;
  type: string;
  nom: string;
  label: string;
  searchText: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeCommission(c: CommissionParitaire): SerializedCommission {
  return {
    id: c.id,
    code: c.code,
    numero: c.numero,
    numeroOfficiel: c.numeroOfficiel,
    codeOfficiel5: c.codeOfficiel5,
    suffixeInterne: c.suffixeInterne,
    type: c.type,
    nom: c.nom,
    label: c.label,
    searchText: c.searchText,
    updatedBy: c.updatedBy,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
