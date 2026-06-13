/**
 * Moteur PUR de génération de modèles de contrats de travail belges.
 * Assemble les clauses applicables (selon type + régime + options cochées) et
 * remplit les placeholders {{field_id}} avec les valeurs saisies. Aucune I/O,
 * réutilisable côté client + serveur. Le contenu légal vit dans `legal-content`.
 */
import {
  CONTRACT_CLAUSES,
  CONTRACT_FIELDS,
  CONTRACT_TYPES,
  CONTRACT_DISCLAIMER,
  type ContractType,
  type WorkRegime,
  type ContractField,
  type ContractClause,
} from "./legal-content";

export interface GenerateContractInput {
  type: ContractType;
  regime: WorkRegime;
  /** field_id -> valeur saisie. */
  values: Record<string, string>;
  /** ids des clauses optionnelles cochées. */
  optionalClauseIds: string[];
}

export interface GeneratedContract {
  title: string;
  text: string;
  /** Champs obligatoires (pour ce type/régime) encore vides. */
  missingRequired: { id: string; label: string }[];
}

/** Marqueur visuel d'un champ à compléter dans le texte généré. */
const BLANK = "……………";

/** Champs pertinents pour un type de contrat (filtre `appliesTo`). */
export function applicableFields(type: ContractType): ContractField[] {
  return CONTRACT_FIELDS.filter((f) => !f.appliesTo || f.appliesTo.includes(type));
}

/**
 * Un champ est-il obligatoire pour ce type + régime ?
 * `work_schedule` devient obligatoire au temps partiel (horaire détaillé) et
 * pour le contrat d'étudiant.
 */
export function isFieldRequired(field: ContractField, type: ContractType, regime: WorkRegime): boolean {
  if (field.id === "work_schedule") return regime === "temps_partiel" || type === "etudiant";
  return field.required;
}

/** Clauses OPTIONNELLES proposables (cases à cocher) pour un type. */
export function applicableOptionalClauses(type: ContractType): ContractClause[] {
  return CONTRACT_CLAUSES.filter((c) => !c.mandatory && c.appliesTo.includes(type));
}

/** Clauses retenues (obligatoires + optionnelles cochées), dans l'ordre source. */
function selectedClauses(input: GenerateContractInput): ContractClause[] {
  const optional = new Set(input.optionalClauseIds);
  return CONTRACT_CLAUSES.filter(
    (c) =>
      c.appliesTo.includes(input.type) &&
      (!c.onlyRegime || c.onlyRegime === input.regime) &&
      (c.mandatory || optional.has(c.id)),
  );
}

function fill(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_match, id: string) => {
    const v = values[id]?.trim();
    return v ? v : BLANK;
  });
}

export function typeLabel(type: ContractType): string {
  return CONTRACT_TYPES.find((t) => t.type === type)?.label ?? "Contrat de travail";
}

export function generateContract(input: GenerateContractInput): GeneratedContract {
  const { type, regime, values } = input;

  const clauses = selectedClauses(input);
  const body = clauses.map((c) => `${c.heading}\n\n${fill(c.body, values)}`).join("\n\n");

  const worker = `${values.worker_first_name ?? ""} ${values.worker_last_name ?? ""}`.trim();
  const label = typeLabel(type);
  const title = worker ? `${label} — ${worker}` : label;

  const signature =
    `Fait à ${BLANK}, le ${BLANK}, en deux exemplaires dont chacune des parties reconnaît avoir reçu le sien.\n\n` +
    `Pour l'employeur\n${values.employer_signatory_name?.trim() || BLANK} — ${values.employer_signatory_role?.trim() || BLANK}\n\n` +
    `Le travailleur (mention « lu et approuvé »)\n${worker || BLANK}`;

  const text = `${label.toUpperCase()}\n\n${body}\n\n${signature}\n\n———\n${CONTRACT_DISCLAIMER}`;

  const missingRequired = applicableFields(type)
    .filter((f) => isFieldRequired(f, type, regime) && !values[f.id]?.trim())
    .map((f) => ({ id: f.id, label: f.label }));

  return { title, text, missingRequired };
}
