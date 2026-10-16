import { describe, expect, it } from "vitest";

import { article110RandomCases, pickArticle110RandomCase } from "../article-110-random-cases";
import { article110RandomChoiceMatches } from "../article-110-random-comparison";
import { presentArticle110RandomInput } from "../article-110-random-presentation";
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

  it("prioritizes a case that the active tool can load faithfully", () => {
    const selected = pickArticle110RandomCase(thresholds, () => 0, (scenario) => scenario.input.isAloneExplicit === true);

    expect(selected.input.isAloneExplicit).toBe(true);
  });

  it("presents normalized evaluator facts rather than the legacy matrix payload", () => {
    const cohousing = article110RandomCases(thresholds).find((scenario) => scenario.id === "cohousing-alimony-established")!;
    const presentation = presentArticle110RandomInput(cohousing.input, "fr");

    expect(presentation.particulars.map((fact) => fact.key)).toEqual(expect.arrayContaining([
      "article110RandomCohousingDeclared",
      "article110RandomCohousingAutonomous",
      "article110RandomAlimonyPaid",
      "article110RandomAlimonyLegalBasisEstablished",
      "article110RandomAlimonyBeneficiaryMissing",
    ]));
    expect(presentation.incomplete).toBe(true);
  });

  it("keeps the cohousing/alimony exercise explicit about its incomplete pension facts", () => {
    const cohousing = article110RandomCases(thresholds).find((scenario) => scenario.id === "cohousing-alimony-established")!;

    expect(cohousing.input.alimony).toMatchObject({ enabled: true, legalConditionEstablished: true });
    expect(cohousing.input.alimony?.beneficiary).toBeUndefined();
    expect(cohousing.input.isAloneExplicit).toBe(false);
    expect(cohousing.result.category).toBe("N");
    expect(cohousing.result.householdAssessment.sourceRuleIds).toContain("situation_familiale_cohousing_a_verifier");
  });

  it("compares an operator choice with DocBel without treating it as an independent expectation", () => {
    expect(article110RandomChoiceMatches("A", "A")).toBe(true);
    expect(article110RandomChoiceMatches("B", "A")).toBe(false);
    expect(article110RandomChoiceMatches("insufficient", null)).toBe(true);
  });
});
