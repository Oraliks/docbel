import { describe, expect, it } from "vitest";
import { article110VerifierFacts, evaluateArticle110Verifier } from "../article-110-verifier";

const thresholds = {
  spouseProfessionalMonthly: 1000,
  childProfessionalMonthly: null,
  spouseReplacementMonthly: null,
  childReplacementMonthly: null,
  source: null,
};

describe("Article 110 theoretical verifier", () => {
  it("does not turn unanswered spouse incomes into an explicit absence of income", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      people: [{ id: "spouse", relation: "spouse" }],
    });

    expect(result).toMatchObject({
      category: null,
      householdAssessment: { status: "needs_information", expectedCategory: null },
    });
  });

  it("does not infer A for a child whose income inventory and family-allowance status are unanswered", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      people: [{ id: "child", relation: "child" }],
    });

    expect(result).toMatchObject({
      category: null,
      householdAssessment: { status: "needs_information", expectedCategory: null },
    });
  });

  it("uses the dated child threshold and asks for a declared child-income amount", () => {
    const childThresholds = { ...thresholds, childProfessionalMonthly: 100, childReplacementMonthly: 200 };
    const base = { thresholds: childThresholds, anyChildReceivesFamilyAllowances: false };

    expect(evaluateArticle110Verifier({ ...base, people: [{ id: "child", relation: "child", hasProfessionalIncome: true, hasReplacementIncome: false }] }).category).toBeNull();
    expect(evaluateArticle110Verifier({ ...base, people: [{ id: "child", relation: "child", hasProfessionalIncome: true, professionalIncomeAmount: 100, hasReplacementIncome: false }] }).category).toBe("A");
    expect(evaluateArticle110Verifier({ ...base, people: [{ id: "child", relation: "child", hasProfessionalIncome: true, professionalIncomeAmount: 100.01, hasReplacementIncome: false }] }).category).toBe("B");
  });

  it("uses the shared family evaluation for a spouse income", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      people: [{ id: "spouse", relation: "spouse", hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeType: "employee", professionalIncomeContract: "cdi", professionalIncomeVariable: false }],
    });
    expect(result.householdAssessment).toMatchObject({ expectedCategory: "A", operationalArticle: "60A" });
    expect(result.category).toBe("A");
  });

  it("forwards a received C110A monthly amount to the shared assessment", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      people: [{ id: "spouse", relation: "spouse", hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeType: "employee", professionalIncomeContract: "cdi", professionalIncomeVariable: true, c110aReceived: true, c110aMonthlyDeclaredIncome: 900 }],
    });
    expect(result.householdAssessment).toMatchObject({
      expectedCategory: "B",
      monthlyPaymentAssessment: "A_RATE",
      monthlyC110aIncome: 900,
    });
  });

  it("uses a declared variable monthly amount without inferring that the C110A is available", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      people: [{ id: "spouse", relation: "spouse", hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeType: "employee", professionalIncomeContract: "cdi", professionalIncomeVariable: true, c110aReceived: false, c110aMonthlyDeclaredIncome: 900 }],
    });
    expect(result.householdAssessment).toMatchObject({
      status: "probable",
      expectedCategory: "B",
      operationalArticle: "60B",
      monthlyPaymentAssessment: "A_RATE",
      monthlyC110aIncome: 900,
    });
  });

  it("applies the dated child-income ceiling to a declared student occupation amount", () => {
    const result = evaluateArticle110Verifier({
      thresholds: { ...thresholds, childProfessionalMonthly: 500 },
      anyChildReceivesFamilyAllowances: false,
      people: [{ id: "child", relation: "child", hasProfessionalIncome: true, professionalIncomeType: "student_occupation_contract", professionalIncomeAmount: 450, hasReplacementIncome: false }],
    });

    expect(result.householdAssessment).toMatchObject({
      expectedCategory: "A",
    });
    expect(article110VerifierFacts({
      thresholds: { ...thresholds, childProfessionalMonthly: 500 },
      people: [{ id: "child", relation: "child", hasProfessionalIncome: true, professionalIncomeType: "student_occupation_contract", professionalIncomeAmount: 450 }],
    }).people[0].incomes).toMatchObject([{ amount: 450 }]);
  });

  it("uses the same alternating-care result as the common calculation", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      isAloneExplicit: true,
      people: [],
      alternatingCare: { enabled: true, averageDaysPerWeek: 2, cycle: "monthly", familyAllowances: true },
    });
    expect(result).toMatchObject({ category: "A", onemDecisionStatus: "not_required" });
    expect(result.missingFacts).toEqual([]);
  });

  it("keeps the isolated result when alternating care is explicitly declined", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      isAloneExplicit: true,
      people: [],
      alimony: { enabled: false },
      alternatingCare: { enabled: false },
    });

    expect(result).toMatchObject({
      category: "N",
      householdAssessment: { status: "probable", expectedCategory: "N", operationalArticle: "none" },
    });
    expect(result.missingFacts).toEqual([]);
  });

  it.each([
    ["alternating_care", "situation_familiale_isole_garde_alternee"],
    ["alimony", "situation_familiale_isole_pension_alimentaire"],
  ] as const)("returns an A orientation for a qualified isolated declaration: %s", (isolatedDeclaration, sourceRuleId) => {
    const result = evaluateArticle110Verifier({ thresholds, isAloneExplicit: true, people: [], isolatedDeclaration });

    expect(result).toMatchObject({
      category: "A",
      householdAssessment: { status: "probable", expectedCategory: "A", declaredQualifiedBasis: isolatedDeclaration, sourceRuleIds: [sourceRuleId] },
    });
    expect(result.missingFacts).toEqual([]);
  });

  it("asks for missing alternating-care facts without a generic ONEM waiting state", () => {
    const result = evaluateArticle110Verifier({ thresholds, isAloneExplicit: true, people: [], alternatingCare: { enabled: true, familyAllowances: true } });
    expect(result).toMatchObject({ category: null, onemDecisionStatus: "not_required" });
    expect(result.missingFacts.map((fact) => fact.factKey)).toEqual(["isolated.alternatingCare.averageDaysPerWeek", "isolated.alternatingCare.cycle"]);
  });

  it("sends an answered co-housing or ordinary cohabitation fact to ONEM review", () => {
    const base = { thresholds, people: [{ id: "roommate", relation: "third_party" as const }] };
    const cohousing = evaluateArticle110Verifier({ ...base, cohousing: true });
    const ordinaryCohabitation = evaluateArticle110Verifier({ ...base, cohousing: false });
    expect(cohousing).toMatchObject({ category: null, onemDecisionStatus: "required" });
    expect(cohousing.reason).toContain("doit être examinée");
    expect(ordinaryCohabitation).toMatchObject({ category: null, onemDecisionStatus: "required" });
    expect(ordinaryCohabitation.reason).toContain("doit être examinée");
  });
});
