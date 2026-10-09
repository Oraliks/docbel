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
    expect(report.total).toBeGreaterThanOrEqual(20);
    expect(Object.keys(report.byBranch)).toEqual(expect.arrayContaining(["spouse_or_partner", "children_only", "relatives_only", "cohousing", "alimony", "alternating_care", "mixed_or_unsupported"]));
    expect(Object.values(report.byResultType).filter(Boolean)).toHaveLength(5);
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

  it("classifies documented cohousing as an ONEM decision, never as a generic check", () => {
    const cohousing = report.scenarios.find((scenario) => scenario.id === "cohousing-complete");
    expect(cohousing).toMatchObject({ resultType: "onem_decision_required", category: null });
    expect(cohousing?.reason).toContain("Bureau du chômage");
  });
});
