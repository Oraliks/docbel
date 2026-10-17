import { decideRegulatoryScenario } from "./engine";
import type { RegulatoryDecision, RegulatoryFacts, RegulatoryRule } from "./types";

/**
 * This rule deliberately identifies the already-existing C1 change workflow;
 * it does not infer a family category or a benefit consequence.
 */
export const PERSONAL_SITUATION_RULES: RegulatoryRule[] = [{
  id: "personal-situation-c1-workflow",
  version: 1,
  sourceRuleIds: ["formulaire_c1", "situation_familiale_c1"],
  explanation: "Le parcours demandé est la déclaration C1 de changement de situation personnelle ou familiale.",
  when: { type: "equals", fact: "entry.dossier", value: "changement-situation-personnelle" },
  decision: { scenarioId: "personal-situation-c1", bundleSlug: "changement-situation-personnelle" },
}];

export function decidePersonalSituation(facts: RegulatoryFacts, now = new Date()): RegulatoryDecision {
  return decideRegulatoryScenario(PERSONAL_SITUATION_RULES, facts, now);
}

export function decideRegulatoryScenarioForBundle(bundleSlug: string, now = new Date()): RegulatoryDecision | null {
  if (bundleSlug !== "changement-situation-personnelle") return null;
  return decidePersonalSituation({
    "entry.dossier": { value: bundleSlug, origin: "system" },
  }, now);
}

/** Selection only for a new run. Existing snapshots retain their original date and history. */
export function initializePersonalSituationSnapshot(
  bundleSlug: string,
  existing: RegulatoryDecision | null | undefined,
  now = new Date(),
): RegulatoryDecision | null {
  return existing ?? decideRegulatoryScenarioForBundle(bundleSlug, now);
}
