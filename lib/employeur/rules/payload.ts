/**
 * Construit le `CollectedPayloads` consommé par `evaluateCondition`
 * (lib/bundles/conditions.ts) à partir d'un profil employeur + d'un scénario.
 *
 * Toutes les feuilles de condition ciblent `sourceTemplateId = "scenario"`.
 * On aplatit profil + scénario en un seul objet de faits.
 */
import type { CollectedPayloads } from "@/lib/bundles/conditions";

export const SCENARIO_TEMPLATE_ID = "scenario";

/** Sous-ensemble du profil utile au moteur (évite de dépendre de Prisma). */
export interface ProfileFacts {
  hasEmployees?: boolean | null;
  hasOnssNumber?: boolean | null;
  legalForm?: string | null;
  region?: string | null;
  sector?: string | null;
  jointCommitteeKnown?: boolean | null;
  jointCommitteeNumber?: string | null;
}

/** Sous-ensemble du scénario utile au moteur. */
export interface ScenarioFacts {
  workerType?: string | null;
  contractType?: string | null;
  weeklyHours?: number | null;
  fullTimeReferenceHours?: number | null;
  grossMonthlySalary?: number | null;
  jointCommitteeNumber?: string | null;
  scheduleType?: string | null;
  /** Présence d'une date d'entrée (déclencheur Dimona). */
  plannedStartDate?: Date | string | null;
}

/** Faits aplatis, tels qu'évalués par les feuilles de règles. */
export interface ScenarioEvaluationFacts {
  hasEmployees: boolean | null;
  hasOnssNumber: boolean | null;
  legalForm: string;
  region: string;
  sector: string;
  workerType: string;
  contractType: string;
  weeklyHours: number | null;
  fullTimeReferenceHours: number | null;
  grossMonthlySalary: number | null;
  /** CP du scénario, à défaut celle du profil. */
  jointCommitteeNumber: string;
  scheduleType: string;
  /** "" si pas de date — permet op `isEmpty` / `isNotEmpty`. */
  plannedStartDate: string;
  /**
   * Fait dérivé : temps partiel. Le moteur de conditions ne compare qu'un champ
   * à une constante (pas champ-vs-champ), donc on précalcule la comparaison
   * `weeklyHours < fullTimeReferenceHours`. Vrai aussi si contrat = temps_partiel.
   */
  isPartTime: boolean;
}

function bool(v: boolean | null | undefined): boolean | null {
  return v == null ? null : v;
}

function str(v: string | null | undefined): string {
  return v == null ? "" : v;
}

function dateStr(v: Date | string | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString();
  return v;
}

function computeIsPartTime(scenario: ScenarioFacts): boolean {
  if (scenario.contractType === "temps_partiel") return true;
  const w = scenario.weeklyHours;
  const ref = scenario.fullTimeReferenceHours;
  return w != null && ref != null && ref > 0 && w < ref;
}

export function buildScenarioFacts(
  profile: ProfileFacts,
  scenario: ScenarioFacts
): ScenarioEvaluationFacts {
  return {
    hasEmployees: bool(profile.hasEmployees),
    hasOnssNumber: bool(profile.hasOnssNumber),
    legalForm: str(profile.legalForm),
    region: str(profile.region),
    sector: str(profile.sector),
    workerType: str(scenario.workerType),
    contractType: str(scenario.contractType),
    weeklyHours: scenario.weeklyHours ?? null,
    fullTimeReferenceHours: scenario.fullTimeReferenceHours ?? null,
    grossMonthlySalary: scenario.grossMonthlySalary ?? null,
    jointCommitteeNumber: str(scenario.jointCommitteeNumber ?? profile.jointCommitteeNumber),
    scheduleType: str(scenario.scheduleType),
    plannedStartDate: dateStr(scenario.plannedStartDate),
    isPartTime: computeIsPartTime(scenario),
  };
}

export function toPayloads(facts: ScenarioEvaluationFacts): CollectedPayloads {
  return { [SCENARIO_TEMPLATE_ID]: { ...facts } };
}
