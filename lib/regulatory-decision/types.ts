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
  status: "decided" | "needs_information" | "unsupported" | "reassessment_required";
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
  /**
   * Optional temporal effect attached by a narrowly-scoped regulatory rule.
   * `effectiveUntil` is inclusive; `reassessmentAt` is the first day on which
   * the previous effect must no longer be applied.
   */
  temporalEffect?: {
    kind: "article_110_child_first_professional_income";
    onemCode: "110&1M" | "110&1V";
    familyCategory: "A" | null;
    effectiveFrom: string;
    effectiveUntil?: string;
    reassessmentAt?: string;
  };
  /** Earlier temporal effects preserved in a BundleRun snapshot. */
  temporalHistory?: Array<{
    onemCode: "110&1M" | "110&1V";
    familyCategory: "A" | null;
    effectiveFrom: string;
    effectiveUntil?: string;
    reassessmentAt?: string;
    ruleIds: string[];
    ruleVersions: Record<string, number>;
    sourceRuleIds: string[];
    factsUsed: RegulatoryFacts;
    decidedAt: string;
  }>;
  /** Independent 110&1M/110&1V assessment kept beside the C1 workflow decision. */
  article110Decision?: RegulatoryDecision;
  /** Last ONEM state received from an official source; never derived from DocBel's calculation. */
  officialOnemState?: { onemCode: string; recordedAt?: string };
  /** Composition-first assessment; the known ONEM code is never overwritten by it. */
  householdAssessment?: {
    composition: "alone" | "spouse_or_partner" | "children_only" | "children_and_relatives" | "relatives_only" | "third_parties_only" | "children_and_third_parties" | "relatives_and_third_parties" | "children_relatives_and_third_parties" | "mixed_or_unsupported";
    status: "probable" | "needs_information" | "needs_review";
    expectedCategory: "A" | "B" | null;
    operationalArticle: "60A" | "60B" | "none" | "needs_review";
    incomeAssessment: "no_income" | "not_relevant" | "relevant" | "needs_review";
    monthlyPaymentAssessment: "A_RATE" | "B_RATE" | "NEEDS_C110A" | "NEEDS_REVIEW";
    baremeSource?: { fileId: string; fileName: string; validFrom?: string };
    requiredExternalDocument?: { document: "C110A"; status: "required" | "received"; url: string; reason: string };
    monthlyC110aIncome?: number;
    recommendedAction: "none" | "declaration_required" | "information_required" | "review_required" | "await_onem_decision";
    officialOnemCode?: string;
    trigger: "c1_household_update";
    factKeys: string[];
    sourceRuleIds: string[];
    pensionAssessment?: { status: "VERIFIED" | "NEEDS_DOCUMENT" | "NEEDS_INFORMATION"; grossTotal?: number; threshold?: number; document: "SPF_PENSIONS_PROOF"; proofStatus: "received" | "required" };
  };
  /** Narrow C1 claims for a person declaring an isolated household. Never an ONEM decision. */
  isolatedHouseholdAssessment?: {
    branch: "alimony" | "alternating_care" | "cohousing";
    status: "probable" | "needs_information" | "needs_review" | "pending_judgment";
    expectedCategory: "A" | null;
    claimState?: "ISOLATED_CLAIM" | "PENDING_JUDGMENT";
    documents: Array<{ document: "judgment_or_admissible_act" | "payment_proof" | "lease" | "sworn_statement" | "c1-regis"; status: "required" | "declared" | "received" | "pending" | "completed" }>;
    recommendedAction: "provide_judgment" | "provide_information" | "onem_review" | "reassess_from_effective_date" | "await_onem_decision";
    recalculationEffectiveAt?: string;
    retroactivity?: { status: "RETROACTIVE_REVIEW_REQUIRED"; requestDate?: string; legalDocumentDate?: string; receivedDate?: string; claimedEffectiveDate?: string };
    factKeys: string[];
    sourceRuleIds: string[];
  };
  /** Previous isolated-household claims are retained to support a human retroactive review. */
  isolatedHouseholdAssessmentHistory?: Array<NonNullable<RegulatoryDecision["isolatedHouseholdAssessment"]>>;
  /** Children-only branch: a calculated category plus the C1 declaration event, never an ONEM code. */
  childrenOnlyAssessment?: {
    expectedCategory: "A" | "B";
    categoryChanged: boolean;
    declarationRequired: boolean;
    facts: Array<{ factKey: string; receivesFamilyAllowances?: boolean; hasProfessionalIncome?: boolean; hasReplacementIncome?: boolean; firstProfessionalIncome?: boolean; studiesEndedAt?: string; neutralisedBy110_1M?: boolean }>;
    changes: Array<{ reason: "CHILD_STARTED_WORK" | "CHILD_STOPPED_WORK" | "CHILD_LOST_FAMILY_ALLOWANCE" | "CHILD_GAINED_FAMILY_ALLOWANCE" | "INCOME_CHANGED" | "HOUSEHOLD_MEMBER_CHANGED" | "CHILD_STUDIES_ENDED" | "CHILD_110_1M_ENDED"; factKey?: string; previous?: Record<string, unknown>; current?: Record<string, unknown>; effectiveDate?: string }>;
    sourceRuleIds: string[];
  };
  relativeHouseholdAssessment?: {
    composition: "relatives_only" | "children_and_relatives";
    expectedCategory: "A" | "B" | null;
    categoryChanged: boolean;
    declarationRequired: boolean;
    facts: Array<{ factKey: string; professional?: boolean; replacementType?: string; pensionGrossAmount?: number; pensionProof?: boolean; disabilityProof?: boolean }>;
    changes: Array<{ reason: "PENSION_STARTED" | "PENSION_STOPPED" | "PENSION_AMOUNT_CHANGED" | "HOUSEHOLD_MEMBER_CHANGED" | "INCOME_CHANGED" | "DISABILITY_PROOF_CHANGED"; factKey?: string; previous?: Record<string, unknown>; current?: Record<string, unknown>; effectiveDate?: string }>;
    sourceRuleIds: string[];
  };
  thirdPartyHouseholdAssessment?: {
    composition: "children_and_third_parties" | "relatives_and_third_parties" | "children_relatives_and_third_parties" | "none";
    expectedCategory: "A" | "B" | null;
    categoryChanged: boolean;
    declarationRequired: boolean;
    facts: Array<{ factKey: string; professional?: boolean; replacementType?: string; relevantReplacement?: boolean }>;
    changes: Array<{ reason: "THIRD_PARTY_ARRIVED" | "THIRD_PARTY_LEFT" | "THIRD_PARTY_INCOME_CHANGED"; factKey?: string; effectiveDate?: string }>;
    sourceRuleIds: string[];
  };
}
