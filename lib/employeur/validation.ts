/** Schémas Zod du wizard "Puis-je engager ?" (profil employeur + scénario). */
import { z } from "zod";
import {
  LEGAL_FORMS,
  REGIONS,
  WORKER_TYPES,
  CONTRACT_TYPES,
  BENEFIT_TYPES,
} from "./constants";

const values = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [string, ...string[]];

/** Tri-état du formulaire → boolean | null ("je ne sais pas"). */
export const triState = z.enum(["yes", "no", "unknown"]);
export function triToBool(v: "yes" | "no" | "unknown" | undefined): boolean | null {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

const optionalString = z.string().trim().max(200).optional().or(z.literal(""));

export const profileInputSchema = z.object({
  organisationName: optionalString,
  legalForm: z.enum(values(LEGAL_FORMS)).optional(),
  enterpriseNumber: optionalString,
  hasEmployees: triState.optional(),
  hasOnssNumber: triState.optional(),
  onssNumber: optionalString,
  region: z.enum(values(REGIONS)).optional(),
  sector: optionalString,
  naceCode: optionalString,
});

export const scenarioInputSchema = z.object({
  title: optionalString,
  workerType: z.enum(values(WORKER_TYPES)),
  contractType: z.enum(values(CONTRACT_TYPES)),
  plannedStartDate: z.string().trim().optional().or(z.literal("")),
  plannedEndDate: z.string().trim().optional().or(z.literal("")),
  functionTitle: optionalString,
  workplace: optionalString,
  weeklyHours: z.number().min(0).max(80).nullish(),
  fullTimeReferenceHours: z.number().min(1).max(50).nullish(),
  grossMonthlySalary: z.number().min(0).max(1_000_000).nullish(),
  benefits: z.array(z.enum(values(BENEFIT_TYPES))).optional(),
  jointCommitteeNumber: optionalString,
  region: z.enum(values(REGIONS)).optional(),
  nightWork: z.boolean().optional(),
  sundayWork: z.boolean().optional(),
  saturdayWork: z.boolean().optional(),
  telework: z.boolean().optional(),
});

export const createScenarioSchema = z.object({
  profile: profileInputSchema,
  scenario: scenarioInputSchema,
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;

/** "" → undefined ; "YYYY-MM-DD" → Date (ou undefined si invalide). */
export function parseOptionalDate(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** "" → null (normalise les champs texte optionnels). */
export function emptyToNull(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length === 0 ? null : t;
}
