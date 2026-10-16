import { describe, expect, it } from "vitest";

import { article110RandomCases, pickArticle110RandomCase } from "../article-110-random-cases";
import { evaluateArticle110Verifier } from "../article-110-verifier";

const thresholds = {
  spouseProfessionalMonthly: 1_000,
  childProfessionalMonthly: 1_000,
  spouseReplacementMonthly: 1_000,
  childReplacementMonthly: 1_000,
  ascendantPensionWithChildMonthly: 1_500,
  ascendantPensionMonthly: 1_000,
  ascendantDisabledPensionMonthly: 1_200,
  source: { fileId: "random-cases", fileName: "bareme-test.xlsx", validFrom: new Date("2026-09-01") },
} as const;

describe("Article 110 random test cases", () => {
  it("draws a reproducible curated matrix case with a stable assessment date", () => {
    const first = pickArticle110RandomCase(thresholds, () => 0);
    const last = pickArticle110RandomCase(thresholds, () => 1);

    expect(first.id).toBe("composition-missing");
    expect(last.id).toBe("unknown-relation");
    expect(first.assessmentDate).toBe("2026-10-08");
    expect(first.independentExpected).toBeUndefined();
  });

  it("never creates facts: each displayed result is the existing shared evaluator result", () => {
    const cases = article110RandomCases(thresholds);

    expect(cases.map((scenario) => scenario.id)).toContain("children-110-1m");
    expect(cases.map((scenario) => scenario.id)).toContain("cohousing-never-recognized");
    for (const scenario of cases) {
      expect(scenario.result).toEqual(evaluateArticle110Verifier(scenario.input));
      expect(scenario.input.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
