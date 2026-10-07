import type {
  FactValue,
  RegulatoryDecision,
  RegulatoryFacts,
  RegulatoryRule,
  RuleCondition,
} from "./types";

type ConditionResult = { matches: boolean; missingFacts: string[]; usedFacts: string[] };

const LEGAL_WARNING =
  "Cet outil vous aide à vous orienter. Il ne remplace pas une décision de l'ONEM, de votre organisme de paiement ou d'un conseiller compétent.";

function sameValue(a: FactValue | undefined, b: FactValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function conditionResult(condition: RuleCondition, facts: RegulatoryFacts): ConditionResult {
  if (condition.type === "exists") {
    const known = facts[condition.fact]?.value !== undefined;
    return { matches: known, missingFacts: known ? [] : [condition.fact], usedFacts: [condition.fact] };
  }
  if (condition.type === "unknown") {
    const unknown = facts[condition.fact]?.value === undefined;
    return { matches: unknown, missingFacts: [], usedFacts: [condition.fact] };
  }
  if (condition.type === "equals" || condition.type === "notEquals") {
    const fact = facts[condition.fact];
    if (!fact || fact.value === undefined) {
      return { matches: false, missingFacts: [condition.fact], usedFacts: [condition.fact] };
    }
    const equal = sameValue(fact.value, condition.value);
    return { matches: condition.type === "equals" ? equal : !equal, missingFacts: [], usedFacts: [condition.fact] };
  }
  if (condition.type === "not") {
    const nested = conditionResult(condition.condition, facts);
    return { ...nested, matches: nested.missingFacts.length === 0 && !nested.matches };
  }
  const results = condition.conditions.map((child) => conditionResult(child, facts));
  const missingFacts = [...new Set(results.flatMap((r) => r.missingFacts))];
  const usedFacts = [...new Set(results.flatMap((r) => r.usedFacts))];
  if (condition.type === "all") {
    const knownMismatch = results.some((result) => !result.matches && result.missingFacts.length === 0);
    return {
      matches: !knownMismatch && results.every((result) => result.matches),
      missingFacts: knownMismatch ? [] : missingFacts,
      usedFacts,
    };
  }
  const matchingResults = results.filter((result) => result.matches);
  return {
    matches: matchingResults.length > 0,
    missingFacts: matchingResults.length > 0 ? [] : missingFacts,
    usedFacts,
  };
}

function pickFacts(facts: RegulatoryFacts, names: string[]): RegulatoryFacts {
  return Object.fromEntries(names.flatMap((name) => (facts[name] ? [[name, facts[name]]] : [])));
}

/** Evaluates ordered, versioned rules. Missing facts never become a guessed decision. */
export function decideRegulatoryScenario(
  rules: RegulatoryRule[],
  facts: RegulatoryFacts,
  now = new Date(),
): RegulatoryDecision {
  const evaluated = rules.map((rule) => ({ rule, result: conditionResult(rule.when, facts) }));
  const match = evaluated.find(({ result }) => result.matches);
  if (match) {
    return {
      status: "decided", scenarioId: match.rule.decision.scenarioId, bundleSlug: match.rule.decision.bundleSlug,
      ruleIds: [match.rule.id], ruleVersions: { [match.rule.id]: match.rule.version },
      factsUsed: pickFacts(facts, match.result.usedFacts), missingFacts: [], explanation: match.rule.explanation,
      sourceRuleIds: match.rule.sourceRuleIds, legalWarning: LEGAL_WARNING, decidedAt: now.toISOString(),
    };
  }
  const missing = [...new Set(evaluated.flatMap(({ result }) => result.missingFacts))];
  return {
    status: missing.length ? "needs_information" : "unsupported", scenarioId: null, bundleSlug: null,
    ruleIds: [], ruleVersions: {}, factsUsed: pickFacts(facts, evaluated.flatMap(({ result }) => result.usedFacts)),
    missingFacts: missing,
    explanation: missing.length ? "Des informations sont nécessaires avant de déterminer le scénario." : "Cette situation n'est pas encore couverte.",
    sourceRuleIds: [], legalWarning: LEGAL_WARNING, decidedAt: now.toISOString(),
  };
}
