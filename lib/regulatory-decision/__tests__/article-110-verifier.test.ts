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
  it("uses the shared family evaluation for a spouse income", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      people: [{ id: "spouse", relation: "spouse", hasProfessionalIncome: true, professionalIncomeAmount: 900, professionalIncomeType: "employee", professionalIncomeContract: "cdi", professionalIncomeVariable: false }],
    });
    expect(result.householdAssessment).toMatchObject({ expectedCategory: "A", operationalArticle: "60A" });
    expect(result.category).toBe("A");
  });

  it("forwards a received C110A monthly amount to the shared assessment", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      people: [{ id: "spouse", relation: "spouse", hasProfessionalIncome: true, professionalIncomeAmount: 900, professionalIncomeType: "employee", professionalIncomeContract: "cdi", professionalIncomeVariable: true, c110aReceived: true, c110aMonthlyDeclaredIncome: 900 }],
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
      people: [{ id: "spouse", relation: "spouse", hasProfessionalIncome: true, professionalIncomeAmount: 900, professionalIncomeType: "employee", professionalIncomeContract: "cdi", professionalIncomeVariable: true, c110aReceived: false, c110aMonthlyDeclaredIncome: 900 }],
    });
    expect(result.householdAssessment).toMatchObject({
      status: "probable",
      expectedCategory: "B",
      operationalArticle: "60B",
      monthlyPaymentAssessment: "A_RATE",
      monthlyC110aIncome: 900,
    });
  });

  it("keeps a declared student occupation amount while excluding it from the child's professional-income assessment", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      anyChildReceivesFamilyAllowances: false,
      people: [{ id: "child", relation: "child", hasProfessionalIncome: true, professionalIncomeType: "student_occupation_contract", professionalIncomeAmount: 450, hasReplacementIncome: false }],
    });

    expect(result.householdAssessment).toMatchObject({
      expectedCategory: "A",
      excludedStudentOccupationIncome: true,
      sourceRuleIds: expect.arrayContaining(["situation_familiale_revenu_enfant_contrat_etudiant"]),
    });
    expect(article110VerifierFacts({
      thresholds,
      people: [{ id: "child", relation: "child", hasProfessionalIncome: true, professionalIncomeType: "student_occupation_contract", professionalIncomeAmount: 450 }],
    }).people[0].incomes).toMatchObject([{ amount: 450, excludedFromChildProfessionalAssessment: true }]);
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
