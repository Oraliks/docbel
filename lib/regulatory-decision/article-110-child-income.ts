import { decideRegulatoryScenario } from "./engine";
import type { RegulatoryDecision, RegulatoryFacts, RegulatoryRule } from "./types";

const RULE_ID = "situation_familiale_revenu_enfant_premier_emploi";

export const ARTICLE_110_CHILD_INCOME_RULES: RegulatoryRule[] = [{
  id: RULE_ID,
  version: 1,
  effectiveFrom: "2002-01-01",
  sourceRuleIds: [RULE_ID, "formulaire_c1"],
  explanation:
    "Le revenu professionnel du premier emploi d'un enfant après les études peut être neutralisé temporairement ; la catégorie familiale reste évaluée séparément selon la composition complète du ménage.",
  when: {
    type: "all",
    conditions: [
      { type: "equals", fact: "family.child.firstProfessionalIncome", value: true },
      { type: "equals", fact: "family.child.neutralisationRequested", value: true },
      { type: "exists", fact: "family.child.firstProfessionalIncomeStartedAt" },
      { type: "exists", fact: "family.child.studiesEndedAt" },
    ],
  },
  decision: {
    scenarioId: "article-110-child-first-professional-income",
    bundleSlug: "changement-situation-personnelle",
  },
}];

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function factDate(facts: RegulatoryFacts, key: string): string | null {
  const value = facts[key]?.value;
  return typeof value === "object" && value?.kind === "date" ? isoDate(value.value) : null;
}

function plusDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** Adds calendar months while clamping 29 February to 28 February in a non-leap year. */
export function addCalendarMonths(date: string, months: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();
  const targetMonth = month + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalisedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalisedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, normalisedMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function temporalHistoryEntry(decision: RegulatoryDecision) {
  const effect = decision.temporalEffect!;
  return {
    onemCode: effect.onemCode,
    familyCategory: effect.familyCategory,
    effectiveFrom: effect.effectiveFrom,
    ...(effect.effectiveUntil ? { effectiveUntil: effect.effectiveUntil } : {}),
    ...(effect.reassessmentAt ? { reassessmentAt: effect.reassessmentAt } : {}),
    ruleIds: decision.ruleIds,
    ruleVersions: decision.ruleVersions,
    sourceRuleIds: decision.sourceRuleIds,
    factsUsed: decision.factsUsed,
    decidedAt: decision.decidedAt,
  };
}

/**
 * Implements the single temporal slice 110&1M -> 110&1V.
 * The temporal effect only neutralises the child's income: it never infers A,
 * B or N. The household composition evaluator consumes it separately.
 */
export function decideArticle110ChildFirstProfessionalIncome(
  facts: RegulatoryFacts,
  now = new Date(),
): RegulatoryDecision {
  const decision = decideRegulatoryScenario(ARTICLE_110_CHILD_INCOME_RULES, facts, now);
  if (decision.status !== "decided") return decision;

  const occupationStartedAt = factDate(facts, "family.child.firstProfessionalIncomeStartedAt");
  const studiesEndedAt = factDate(facts, "family.child.studiesEndedAt");
  if (!occupationStartedAt || !studiesEndedAt) {
    return {
      ...decision,
      status: "needs_information",
      scenarioId: null,
      bundleSlug: null,
      missingFacts: [
        ...(!occupationStartedAt ? ["family.child.firstProfessionalIncomeStartedAt"] : []),
        ...(!studiesEndedAt ? ["family.child.studiesEndedAt"] : []),
      ],
      explanation: "Les dates de la première activité et de la fin des études doivent être valides avant toute orientation.",
    };
  }

  // A job started while still studying starts the neutralised period only on
  // the following day, as the end-of-study date itself is still a study day.
  const effectiveFrom = occupationStartedAt > studiesEndedAt
    ? occupationStartedAt
    : plusDays(studiesEndedAt, 1);
  const reassessmentAt = addCalendarMonths(effectiveFrom, 12);
  const asOf = now.toISOString().slice(0, 10);

  if (asOf >= reassessmentAt) {
    return {
      ...decision,
      status: "reassessment_required",
      explanation:
        "La période temporaire est échue : la situation familiale doit être réévaluée avant toute nouvelle qualification.",
      temporalEffect: {
        kind: "article_110_child_first_professional_income",
        onemCode: "110&1V",
        familyCategory: null,
        effectiveFrom: reassessmentAt,
        reassessmentAt,
      },
    };
  }

  return {
    ...decision,
    temporalEffect: {
      kind: "article_110_child_first_professional_income",
      onemCode: "110&1M",
        familyCategory: null,
      effectiveFrom,
      effectiveUntil: plusDays(reassessmentAt, -1),
      reassessmentAt,
    },
  };
}

/** Retains a prior 110&1M snapshot when a later save reaches the 110&1V review. */
export function preserveArticle110TemporalHistory(
  previous: RegulatoryDecision | null | undefined,
  current: RegulatoryDecision,
): RegulatoryDecision {
  if (!current.temporalEffect) return current;
  const existing = previous?.temporalHistory ?? (previous?.temporalEffect ? [temporalHistoryEntry(previous)] : []);
  const next = temporalHistoryEntry(current);
  const history = [...existing];
  if (!history.some((item) => item.onemCode === next.onemCode && item.reassessmentAt === next.reassessmentAt)) {
    history.push(next);
  }
  return { ...current, temporalHistory: history };
}
