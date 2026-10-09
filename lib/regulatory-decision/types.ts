/** Minimal, typed contract between orientation facts and dossier composition. */
export type FactValue = string | boolean | number | { kind: "date"; value: string };

export interface RegulatoryFact {
  value?: FactValue;
  origin: "orientation" | "user" | "profile" | "system";
  effectiveAt?: string;
}

export type RegulatoryFacts = Record<string, RegulatoryFact | undefined>;

export type RuleCondition =
  | { type: "all"; conditions: RuleCondition[] }
  | { type: "any"; conditions: RuleCondition[] }
  | { type: "not"; condition: RuleCondition }
  | { type: "equals"; fact: string; value: FactValue }
  | { type: "notEquals"; fact: string; value: FactValue }
  | { type: "exists"; fact: string }
  | { type: "unknown"; fact: string };

export interface RegulatoryRule {
  id: string;
  version: number;
  effectiveFrom?: string;
  sourceRuleIds: string[];
  explanation: string;
  when: RuleCondition;
  decision: { scenarioId: string; bundleSlug: string };
}

export interface RegulatoryDecision {
  status: "decided" | "needs_information" | "unsupported";
  scenarioId: string | null;
  bundleSlug: string | null;
  ruleIds: string[];
  ruleVersions: Record<string, number>;
  factsUsed: RegulatoryFacts;
  missingFacts: string[];
  explanation: string;
  sourceRuleIds: string[];
  /** Mandatory warning for any future user-facing consumer of this decision. */
  legalWarning: string;
  decidedAt: string;
}
