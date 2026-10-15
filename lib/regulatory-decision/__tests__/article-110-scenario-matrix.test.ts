import { describe, expect, it } from "vitest";

import { evaluateArticle110ScenarioMatrix } from "../article-110-scenario-matrix";

const thresholds = {
  spouseProfessionalMonthly: 1_000,
  childProfessionalMonthly: 1_000,
  spouseReplacementMonthly: 1_000,
  childReplacementMonthly: 1_000,
  ascendantPensionWithChildMonthly: 1_500,
  ascendantPensionMonthly: 1_000,
  ascendantDisabledPensionMonthly: 1_200,
  source: { fileId: "matrix", fileName: "bareme-matrix", validFrom: new Date("2026-09-01") },
} as const;

describe("Article 110 scenario matrix", () => {
  const report = evaluateArticle110ScenarioMatrix(thresholds);

  it("covers every meaningful evaluator branch and result family", () => {
    expect(report.total).toBeGreaterThan(100);
    expect(Object.keys(report.byBranch)).toEqual(expect.arrayContaining(["spouse_or_partner", "children_only", "relatives_only", "third_parties_only", "mixed_or_unsupported"]));
    expect(Object.values(report.byResultType).filter(Boolean)).toHaveLength(3);
  });

  it("accounts for every generated combination before execution", () => {
    expect(report.space.raw).toBe(report.space.executed + report.space.invalid + report.space.duplicates);
    expect(report.space.invalid).toBeGreaterThan(0);
    expect(report.space.duplicates).toBeGreaterThan(0);
    expect(report.coverage.enfants).toContain("nombre : 1/2/3");
  });

  it("keeps principal result types exclusive while recording an undetermined category when review is required", () => {
    expect(Object.values(report.byResultType).reduce((sum, count) => sum + count, 0)).toBe(report.total);
    expect(Object.values(report.byCategory).reduce((sum, count) => sum + count, 0)).toBe(report.total);
    expect(report.assertions).toMatchObject({ resultTypesTotal: true, categoriesTotal: true, incoherent: true, withoutReason: true, atLeastOneA: true, atLeastOneB: true, atLeastOneN: true });
  });

  it("records the explicit isolated baseline as N without assuming it for an unknown composition", () => {
    const alone = report.scenarios.find((scenario) => scenario.id === "alone-no-special-situation");
    const unknown = report.scenarios.find((scenario) => scenario.id === "composition-missing");
    expect(alone).toMatchObject({ householdComposition: "alone", category: "N" });
    expect(unknown).toMatchObject({ resultType: "information_missing", category: null, informationStatus: "incomplete" });
    expect(report.assertions.atLeastOneN).toBe(true);
    expect(report.anomalies).toEqual([]);
  });

  it("keeps every generated contract justified and internally coherent", () => {
    expect(report.incoherent).toEqual([]);
    expect(report.withoutReason).toEqual([]);
    for (const scenario of report.scenarios) {
      expect(scenario.id).toMatch(/^[a-z0-9-]+$/);
      expect(scenario.branch).not.toBe("");
      expect(scenario.reason).not.toBe("");
      expect(scenario.resultType).toBeDefined();
    }
  });

  it("distinguishes missing co-housing facts, autonomous living and the administrative follow-up", () => {
    const missingAutonomy = report.scenarios.find((scenario) => scenario.id === "cohousing-autonomy-missing");
    const cohousing = report.scenarios.find((scenario) => scenario.id === "cohousing-never-recognized");
    const alimony = report.scenarios.find((scenario) => scenario.id === "cohousing-alimony-established");
    const confirmed = report.scenarios.find((scenario) => scenario.id === "cohousing-recognized-same-address");
    expect(missingAutonomy).toMatchObject({ resultType: "information_missing", category: null });
    expect(cohousing).toMatchObject({ resultType: "decision_determined", category: "N", onemDecisionStatus: "required" });
    expect(alimony).toMatchObject({ category: "N", onemDecisionStatus: "required" });
    expect(confirmed).toMatchObject({ resultType: "decision_determined", category: "N", onemDecisionStatus: "not_required" });
    expect(cohousing?.reason).toContain("vie autonome");
    expect(confirmed?.reason).toContain("vie autonome");
    expect(report.potentialTransitions).toEqual({ B_to_N: 0, B_to_A: 0, N_to_A: 0 });
  });

  it("keeps autonomous co-housing independent from obsolete documentary states", () => {
    const noRecognition = report.scenarios.filter((scenario) => scenario.id.startsWith("comb-cohousing-no-"));
    const recognition = report.scenarios.filter((scenario) => scenario.id.startsWith("comb-cohousing-yes-"));
    expect(new Set(noRecognition.map((scenario) => scenario.category))).toEqual(new Set(["N"]));
    expect(new Set(recognition.map((scenario) => scenario.category))).toEqual(new Set(["N"]));
    expect(noRecognition.every((scenario) => scenario.documentStatus === "complete")).toBe(true);
  });

  it("keeps treatment 60B separate from a missing monthly declaration", () => {
    const scenario = report.scenarios.find((item) => item.id === "spouse-variable-monthly-declaration-missing");
    expect(scenario).toMatchObject({ category: "B", treatment: "60B", monthlyRate: "NEEDS_REVIEW" });
  });

  it("documents every mixed or unsupported composition instead of silently dropping it", () => {
    expect(report.mixedOrUnsupported.length).toBeGreaterThan(0);
    expect(report.mixedOrUnsupported.every((group) => group.count > 0 && group.classifierReason.length > 0)).toBe(true);
  });
});
