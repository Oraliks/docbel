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
    expect(Object.keys(report.byBranch)).toEqual(expect.arrayContaining(["spouse_or_partner", "children_only", "relatives_only", "cohousing", "alimony", "alternating_care", "mixed_or_unsupported"]));
    expect(Object.values(report.byResultType).filter(Boolean)).toHaveLength(5);
  });

  it("accounts for every generated combination before execution", () => {
    expect(report.space.raw).toBe(report.space.executed + report.space.invalid + report.space.duplicates);
    expect(report.space.invalid).toBeGreaterThan(0);
    expect(report.space.duplicates).toBeGreaterThan(0);
    expect(report.coverage.enfants).toContain("nombre : 1/2/3");
  });

  it("keeps principal result types exclusive while assigning A, B or N to every scenario", () => {
    expect(Object.values(report.byResultType).reduce((sum, count) => sum + count, 0)).toBe(report.total);
    expect(Object.values(report.byCategory).reduce((sum, count) => sum + count, 0)).toBe(report.total);
    expect(report.assertions).toMatchObject({ resultTypesTotal: true, categoriesTotal: true, incoherent: true, withoutReason: true, atLeastOneA: true, atLeastOneB: true, atLeastOneN: true });
  });

  it("records the explicit isolated baseline as N without assuming it for an unknown composition", () => {
    const alone = report.scenarios.find((scenario) => scenario.id === "alone-no-special-situation");
    const unknown = report.scenarios.find((scenario) => scenario.id === "composition-missing");
    expect(alone).toMatchObject({ householdComposition: "alone", category: "N" });
    expect(unknown).toMatchObject({ resultType: "information_missing", category: "B", informationStatus: "incomplete" });
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

  it("keeps co-housing in B pending ONEM, surfaces supported potential outcomes, and accepts confirmed ONEM isolation", () => {
    const cohousing = report.scenarios.find((scenario) => scenario.id === "cohousing-never-recognized");
    const alimony = report.scenarios.find((scenario) => scenario.id === "cohousing-alimony-established");
    const confirmed = report.scenarios.find((scenario) => scenario.id === "cohousing-recognized-same-address");
    expect(cohousing).toMatchObject({ resultType: "onem_decision_required", category: "B", potentialCategory: "N", onemDecisionStatus: "required" });
    expect(alimony).toMatchObject({ category: "B", potentialCategory: "A", onemDecisionStatus: "required" });
    expect(confirmed).toMatchObject({ category: "N", onemDecisionStatus: "not_required" });
    expect(cohousing?.reason).toContain("Bureau du chômage");
    expect(confirmed?.reason).toContain("déjà été reconnu");
    expect(confirmed?.reason).not.toContain("Bureau du chômage");
    expect(report.potentialTransitions.B_to_N).toBeGreaterThan(0);
    expect(report.potentialTransitions.B_to_A).toBeGreaterThan(0);
  });

  it("keeps the cohousing category invariant across its documentary states", () => {
    const noRecognition = report.scenarios.filter((scenario) => scenario.id.startsWith("comb-cohousing-no-"));
    const recognition = report.scenarios.filter((scenario) => scenario.id.startsWith("comb-cohousing-yes-"));
    expect(new Set(noRecognition.map((scenario) => scenario.category))).toEqual(new Set(["B"]));
    expect(new Set(recognition.map((scenario) => scenario.category))).toEqual(new Set(["N"]));
    expect(noRecognition.some((scenario) => scenario.documentStatus === "required")).toBe(true);
  });

  it("keeps treatment 60B when its monthly C110A rate is A", () => {
    const scenario = report.scenarios.find((item) => item.id === "comb-partner-spouse-variable-c110a-present-no");
    expect(scenario).toMatchObject({ category: "B", treatment: "60B", monthlyRate: "A_RATE" });
  });

  it("documents every mixed or unsupported composition instead of silently dropping it", () => {
    expect(report.mixedOrUnsupported.length).toBeGreaterThan(0);
    expect(report.mixedOrUnsupported.every((group) => group.count > 0 && group.classifierReason.length > 0)).toBe(true);
  });
});
