/**
 * Boussole d'orientation — moteur de scoring PUR (aucune I/O, testable seul).
 * Calque du pattern lib/employeur/rules/engine.ts. Prend des questions (avec
 * leur barème par option) + les réponses, renvoie un classement de branches,
 * une branche principale, deux secondaires et un niveau de confiance.
 */
import { BRANCHES, BRANCH_KEYS, type BranchKey } from "./branches";
import type { QuestionDef } from "./questions";

export interface BranchScore {
  key: BranchKey;
  score: number;
  /** Part du score total (0..1). */
  share: number;
}

export type ConfidenceLabel = "low" | "medium" | "high";

export interface BoussoleResult {
  ranking: BranchScore[];
  primaryKey: BranchKey | null;
  secondaryKeys: BranchKey[];
  totalScore: number;
  /** Nombre de réponses fournies (y compris "je ne sais pas"). */
  answeredCount: number;
  /** Nombre de réponses ayant apporté un signal (> 0 point). */
  signalCount: number;
  /** Indice de confiance 0..100. */
  confidence: number;
  confidenceLabel: ConfidenceLabel;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Ordre stable des branches pour départager les égalités. */
const BRANCH_ORDER: Record<BranchKey, number> = Object.fromEntries(
  BRANCHES.map((b) => [b.key, b.order]),
) as Record<BranchKey, number>;

export function scoreBoussole(
  questions: QuestionDef[],
  answers: Record<string, string>,
): BoussoleResult {
  const totals: Record<BranchKey, number> = Object.fromEntries(
    BRANCH_KEYS.map((k) => [k, 0]),
  ) as Record<BranchKey, number>;

  let answeredCount = 0;
  let signalCount = 0;

  for (const question of questions) {
    const value = answers[question.key];
    if (value == null || value === "") continue;
    answeredCount++;

    const option = question.options.find((o) => o.value === value);
    if (!option) continue;

    let contributed = false;
    for (const [branch, pts] of Object.entries(option.scores)) {
      if (!pts) continue;
      totals[branch as BranchKey] += pts;
      contributed = true;
    }
    if (contributed) signalCount++;
  }

  const totalScore = Object.values(totals).reduce((a, b) => a + b, 0);

  const ranking: BranchScore[] = BRANCH_KEYS.map((key) => ({
    key,
    score: totals[key],
    share: totalScore > 0 ? totals[key] / totalScore : 0,
  })).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return BRANCH_ORDER[a.key] - BRANCH_ORDER[b.key];
  });

  const scored = ranking.filter((r) => r.score > 0);
  const primaryKey = scored[0]?.key ?? null;
  const secondaryKeys = scored.slice(1, 3).map((r) => r.key);

  // Confiance : combine la netteté du leader et la complétude du test.
  const top1 = ranking[0]?.share ?? 0;
  const top2 = ranking[1]?.share ?? 0;
  const separation = clamp01(top1 - top2);
  const base = clamp01(top1 * 0.6 + separation * 0.4);
  const completeness =
    questions.length > 0 ? signalCount / questions.length : 0;
  const confidence =
    totalScore === 0
      ? 0
      : Math.round(100 * clamp01(0.65 * base + 0.35 * completeness));

  const confidenceLabel: ConfidenceLabel =
    confidence < 40 ? "low" : confidence < 70 ? "medium" : "high";

  return {
    ranking,
    primaryKey,
    secondaryKeys,
    totalScore,
    answeredCount,
    signalCount,
    confidence,
    confidenceLabel,
  };
}
