import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";

import {
  article110ScenarioToVerifierInput,
  generateRepresentativeArticle110Scenarios,
  type Article110Scenario,
} from "./article-110-scenario-matrix";
import { evaluateArticle110Verifier, type Article110VerifierInput } from "./article-110-verifier";

const DEFAULT_ASSESSMENT_DATE = "2026-10-08";

export type Article110RandomCase = {
  id: string;
  label: string;
  assessmentDate: string;
  input: Article110VerifierInput;
  facts: Article110Scenario["input"];
  result: ReturnType<typeof evaluateArticle110Verifier>;
  /** Matrix cases are exercise facts, not independent expected outcomes. */
  independentExpected: undefined;
};

function toRandomCase(scenario: Article110Scenario, thresholds: C1BaremeThresholds): Article110RandomCase {
  const input = article110ScenarioToVerifierInput(scenario.input);
  const assessmentDate = input.asOf ?? DEFAULT_ASSESSMENT_DATE;
  const inputWithDate = { ...input, asOf: assessmentDate, thresholds };
  return {
    id: scenario.id,
    label: scenario.label,
    assessmentDate,
    input: inputWithDate,
    facts: scenario.input,
    result: evaluateArticle110Verifier(inputWithDate),
    independentExpected: undefined,
  };
}

/**
 * Only representative scenarios are exposed in the manual mode. They are the
 * curated matrix cases, so random selection never assembles new household facts.
 */
export function article110RandomCases(thresholds: C1BaremeThresholds): Article110RandomCase[] {
  return generateRepresentativeArticle110Scenarios(thresholds).map((scenario) => toRandomCase(scenario, thresholds));
}

export function pickArticle110RandomCase(
  thresholds: C1BaremeThresholds,
  random: () => number = Math.random,
): Article110RandomCase {
  const cases = article110RandomCases(thresholds);
  return cases[Math.min(cases.length - 1, Math.floor(Math.max(0, random()) * cases.length))]!;
}
