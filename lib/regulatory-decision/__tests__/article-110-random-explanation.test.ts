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
    expect(explanation.paragraphs[1]?.values).toMatchObject({ amount: "999,00 €", threshold: "1 000,00 €", date: "01/09/2026", comparison: "article110RandomExplanationBelow" });
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

  it("keeps the dated ascendant-pension comparison for the operator without carrying document follow-up", () => {
    const ascendantThresholds = {
      ...thresholds,
      ascendantPensionMonthly: 1_779.27,
      source: { fileId: "t147-2026-09", fileName: "t147-2026-09.xlsx", validFrom: new Date("2026-09-01") },
    };
    const inputFor = (amount: number) => ({
      thresholds: ascendantThresholds,
      asOf: "2026-10-08",
      people: [{ id: "father", relation: "relative" as const, label: "Père", isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension" as const, replacementIncomeAmount: amount }],
    });
    const below = evaluateArticle110Verifier(inputFor(1_700));
    const atThreshold = evaluateArticle110Verifier(inputFor(1_779.27));
    const above = evaluateArticle110Verifier(inputFor(1_779.28));

    expect(below.category).toBe("A");
    expect(atThreshold.category).toBe("A");
    expect(above.category).toBe("B");
    expect(atThreshold.householdAssessment.pensionAssessment).toEqual({
      status: "VERIFIED",
      grossTotal: 1_779.27,
      threshold: 1_779.27,
    });
    expect(keys(inputFor(1_779.27), atThreshold)).toEqual(["article110RandomExplanationAscendantPensionA"]);
    expect(explainArticle110RandomResult(inputFor(1_779.27), atThreshold, "fr").paragraphs[0]?.values).toMatchObject({
      amount: "1 779,27 €",
      threshold: "1 779,27 €",
      date: "01/09/2026",
    });
  });

  it("presents declared relationships and income types exactly, without treating an unknown type as a pension", () => {
    const facts = {
      thresholds,
      people: [
        { id: "father", relation: "relative" as const, label: "Père", isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension" as const, replacementIncomeAmount: 900 },
        { id: "mother", relation: "relative" as const, label: "Mère", isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "unemployment" as const, replacementIncomeAmount: 900 },
        { id: "grandparent", relation: "relative" as const, label: "Grand-parent", isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "mutuality" as const, replacementIncomeAmount: 900 },
        { id: "disability", relation: "relative" as const, label: "Autre ascendant", isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "disability_allowance" as const, replacementIncomeAmount: 900 },
        { id: "unknown", relation: "relative" as const, label: "Autre ascendant", isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeAmount: 900 },
      ],
    };
    const presentation = presentArticle110RandomInput(facts, "fr");
    const unemployment = evaluateArticle110Verifier({ thresholds, people: [facts.people[1]! ] });
    const mutuality = evaluateArticle110Verifier({ thresholds, people: [facts.people[2]! ] });
    const unknownType = evaluateArticle110Verifier({ thresholds, people: [facts.people[4]! ] });

    expect(presentation.family).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "article110RandomPersonRelativeNamed", values: { relation: "père" } }),
      expect.objectContaining({ key: "article110RandomPersonRelativeNamed", values: { relation: "grand-parent" } }),
    ]));
    expect(presentation.incomes.map((fact) => fact.key)).toEqual(expect.arrayContaining([
      "article110RandomRetirementPensionAmount",
      "article110RandomUnemploymentIncomeAmount",
      "article110RandomMutualityIncomeAmount",
      "article110RandomDisabilityIncomeAmount",
      "article110RandomReplacementIncomeUnknownNatureAmount",
    ]));
    expect(unemployment.category).toBe("B");
    expect(mutuality.category).toBe("B");
    expect(unknownType.category).toBe("B");
    expect(unknownType.householdAssessment.pensionAssessment).toBeUndefined();
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
