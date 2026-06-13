/**
 * Moteur de règles déterministe Docbel Employeur.
 *
 * Réutilise `evaluateCondition` (lib/bundles/conditions.ts) — AUCUNE logique de
 * condition réécrite ici. Chaque règle active est évaluée contre les faits du
 * scénario ; les effets des règles vérifiées sont collectés en items de
 * checklist, alertes et niveau de fiabilité.
 */
import {
  evaluateCondition,
  type BundleCondition,
} from "@/lib/bundles/conditions";
import { PRIORITY_RANK, RELIABILITY_RANK, type ReliabilityLevel } from "../constants";
import { parseRuleOutputs } from "./output";
import {
  buildScenarioFacts,
  toPayloads,
  type ProfileFacts,
  type ScenarioFacts,
  type ScenarioEvaluationFacts,
} from "./payload";

/** Règle telle que consommée par le moteur (découplée de Prisma). */
export interface EngineRule {
  code: string;
  conditionJson: unknown;
  outputJson: unknown;
  severity?: string | null;
  sourceCode?: string | null;
  active?: boolean | null;
}

export interface EngineChecklistItem {
  title: string;
  description?: string;
  priority: "obligatoire" | "recommande" | "optionnel";
  sourceCode?: string;
  legalBasisRef?: string;
  tooltip?: string;
  ruleCode: string;
}

export interface EngineAlert {
  severity: "info" | "warning" | "critical";
  message: string;
  sourceCode?: string;
  ruleCode: string;
}

export interface EngineResult {
  items: EngineChecklistItem[];
  alerts: EngineAlert[];
  reliability: ReliabilityLevel;
  firedRuleCodes: string[];
}

/** Fiabilité de départ avant application des règles. */
const BASELINE_RELIABILITY: ReliabilityLevel = "medium";

function lowestReliability(a: ReliabilityLevel, b: ReliabilityLevel): ReliabilityLevel {
  return RELIABILITY_RANK[a] <= RELIABILITY_RANK[b] ? a : b;
}

/** Évalue un jeu de règles contre des faits déjà construits. */
export function evaluateRulesOnFacts(
  facts: ScenarioEvaluationFacts,
  rules: EngineRule[]
): EngineResult {
  const payloads = toPayloads(facts);
  const items: EngineChecklistItem[] = [];
  const alerts: EngineAlert[] = [];
  const firedRuleCodes: string[] = [];
  let reliability: ReliabilityLevel = BASELINE_RELIABILITY;

  for (const rule of rules) {
    if (rule.active === false) continue;
    const result = evaluateCondition(rule.conditionJson as BundleCondition, payloads);
    if (result !== true) continue;

    firedRuleCodes.push(rule.code);
    for (const out of parseRuleOutputs(rule.outputJson)) {
      if (out.kind === "checklist_item") {
        items.push({
          title: out.title,
          description: out.description,
          priority: out.priority,
          sourceCode: out.sourceCode ?? rule.sourceCode ?? undefined,
          legalBasisRef: out.legalBasisRef,
          tooltip: out.tooltip,
          ruleCode: rule.code,
        });
      } else if (out.kind === "alert") {
        alerts.push({
          severity: out.severity,
          message: out.message,
          sourceCode: out.sourceCode ?? rule.sourceCode ?? undefined,
          ruleCode: rule.code,
        });
      } else {
        reliability = lowestReliability(reliability, out.level);
      }
    }
  }

  items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  return { items, alerts, reliability, firedRuleCodes };
}

/** Point d'entrée principal : construit les faits puis évalue les règles. */
export function evaluateRules(
  profile: ProfileFacts,
  scenario: ScenarioFacts,
  rules: EngineRule[]
): EngineResult {
  return evaluateRulesOnFacts(buildScenarioFacts(profile, scenario), rules);
}
