import { describe, expect, it } from "vitest";

import { article110RandomCases } from "../article-110-random-cases";
import { explainArticle110RandomResult } from "../article-110-random-explanation";
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
  source: { fileId: "random-explanations", fileName: "bareme-test.xlsx", validFrom: new Date("2026-09-01") },
} as const;

const keys = (input: Parameters<typeof explainArticle110RandomResult>[0], result: Parameters<typeof explainArticle110RandomResult>[1]) =>
  explainArticle110RandomResult(input, result, "fr").paragraphs.map((paragraph) => paragraph.key);

describe("Article 110 random professional explanations", () => {
  it("uses the normalized relation facts without exposing a numbered technical third party", () => {
    const input = {
      thresholds,
      people: [
        { id: "friend", relation: "third_party" as const, label: "Ami", hasProfessionalIncome: false, hasReplacementIncome: false },
        { id: "cousin", relation: "third_party" as const, label: "Cousin", hasProfessionalIncome: false, hasReplacementIncome: false },
      ],
      cohousing: false,
    };

    expect(presentArticle110RandomInput(input, "fr").family.map((fact) => fact.key)).toEqual([
      "article110RandomHouseholdPeople",
      "article110RandomPersonFriend",
      "article110RandomPersonRelatedThirdParty",
    ]);
  });

  it("explains the spouse priority with the actual amount, dated ceiling and 60A treatment", () => {
    const scenario = article110RandomCases(thresholds).find((candidate) => candidate.id === "spouse-cdi-below")!;
    const explanation = explainArticle110RandomResult(scenario.input, scenario.result, "fr");

    expect(scenario.result.category).toBe("A");
    expect(explanation.paragraphs.map((paragraph) => paragraph.key)).toEqual([
      "article110RandomExplanationPartnerPriority",
      "article110RandomExplanationPartnerIncomeThreshold",
      "article110RandomExplanation60A",
    ]);
    expect(explanation.paragraphs[1]?.values).toMatchObject({ amount: "999,00 €", threshold: "1 000,00 €", date: "01/09/2026", comparison: "article110RandomExplanationAtOrBelow" });
  });

  it("mentions 60B only for a variable spouse income and keeps its category distinct from the monthly payment", () => {
    const input = {
      thresholds,
      asOf: "2026-10-08",
      people: [{ id: "spouse", relation: "spouse" as const, hasProfessionalIncome: true, professionalIncomeAmount: 900, professionalIncomeContract: "cdd" as const, professionalIncomeVariable: true, c110aReceived: true, c110aMonthlyDeclaredIncome: 900, hasReplacementIncome: false }],
    };
    const result = evaluateArticle110Verifier(input);

    expect(result.category).toBe("B");
    expect(result.householdAssessment.monthlyPaymentAssessment).toBe("A_RATE");
    expect(keys(input, result)).toContain("article110RandomExplanation60BMonthly");
  });

  it("explains an independent income and the declared SPF Handicap exception without changing the common result", () => {
    const independent = {
      thresholds,
      asOf: "2026-10-08",
      people: [{ id: "partner", relation: "partner" as const, hasProfessionalIncome: true, professionalIncomeType: "independent" as const, professionalIncomeAmount: 900, hasReplacementIncome: false }],
    };
    const disability = {
      thresholds,
      asOf: "2026-10-08",
      people: [{ id: "parent", relation: "relative" as const, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "disability_allowance" as const }],
    };

    expect(evaluateArticle110Verifier(independent).category).toBe("B");
    expect(keys(independent, evaluateArticle110Verifier(independent))).toContain("article110RandomExplanationIndependentIncome");
    expect(evaluateArticle110Verifier(disability).category).toBe("A");
    expect(keys(disability, evaluateArticle110Verifier(disability))).toEqual(["article110RandomExplanationSpfDisability"]);
  });

  it("keeps autonomous co-housing theoretical N while describing the distinct provisional B treatment", () => {
    const scenario = article110RandomCases(thresholds).find((candidate) => candidate.id === "cohousing-never-recognized")!;

    expect(scenario.result.category).toBe("N");
    expect(keys(scenario.input, scenario.result)).toEqual(["article110RandomExplanationCohousingPending"]);
  });

  it("does not turn incomplete alimony facts into a theoretical A entitlement", () => {
    const scenario = article110RandomCases(thresholds).find((candidate) => candidate.id === "cohousing-alimony-established")!;

    expect(scenario.result.category).toBe("N");
    expect(keys(scenario.input, scenario.result)).toEqual([
      "article110RandomExplanationCohousingPending",
      "article110RandomExplanationAlimonyBeneficiaryMissing",
    ]);
  });

  it("uses an incomplete explanation whenever the common evaluator has no category", () => {
    const scenario = article110RandomCases(thresholds).find((candidate) => candidate.id === "composition-missing")!;

    expect(scenario.result.category).toBeNull();
    expect(keys(scenario.input, scenario.result)).toEqual(["article110RandomExplanationIncomplete"]);
  });
});
