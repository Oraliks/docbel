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

  it("requires the family-allowance fact even when a child has explicitly no income", () => {
    const base = {
      thresholds,
      people: [{ id: "child", relation: "child" as const, hasProfessionalIncome: false, hasReplacementIncome: false }],
    };

    expect(evaluateArticle110Verifier(base)).toMatchObject({
      category: null,
      householdAssessment: {
        status: "needs_information",
        expectedCategory: null,
        factKeys: ["child.receivesFamilyAllowances"],
      },
    });
    expect(evaluateArticle110Verifier({ ...base, anyChildReceivesFamilyAllowances: false })).toMatchObject({
      category: "A",
      householdAssessment: { status: "probable", expectedCategory: "A" },
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

  it("excludes only a child's student occupation contract without requiring its amount or a threshold", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      anyChildReceivesFamilyAllowances: false,
      people: [{ id: "child", relation: "child", hasProfessionalIncome: true, professionalIncomeType: "student_occupation_contract", hasReplacementIncome: false }],
    });
    expect(result.category).toBe("A");
    expect(result.householdAssessment.excludedStudentOccupationIncome).toBe(true);
  });

  it("does not extend the student contract exclusion to a child's replacement income", () => {
    const result = evaluateArticle110Verifier({
      thresholds: { ...thresholds, childReplacementMonthly: 200 },
      anyChildReceivesFamilyAllowances: false,
      people: [{ id: "child", relation: "child", hasProfessionalIncome: true, professionalIncomeType: "student_occupation_contract", hasReplacementIncome: true, replacementIncomeType: "unemployment", replacementIncomeAmount: 300 }],
    });
    expect(result.category).toBe("B");
  });

  it("keeps a spouse's declared student occupation income relevant", () => {
    const input = {
      thresholds,
      people: [{ id: "spouse", relation: "spouse" as const, hasProfessionalIncome: true, professionalIncomeType: "student_occupation_contract" as const, professionalIncomeAmount: 1200, professionalIncomeContract: "cdi" as const, professionalIncomeVariable: false, hasReplacementIncome: false }],
    };
    expect(evaluateArticle110Verifier(input).category).toBe("B");
    expect(article110VerifierFacts(input).people[0].incomes?.[0].excludedFromChildProfessionalAssessment).not.toBe(true);
  });

  it("does not require a dated threshold for an excluded child student contract", () => {
    const result = evaluateArticle110Verifier({
      thresholds: { ...thresholds, source: { fileId: "later", fileName: "later.xlsx", validFrom: new Date("2026-10-01") } },
      asOf: "2026-09-01",
      anyChildReceivesFamilyAllowances: false,
      people: [{ id: "child", relation: "child", hasProfessionalIncome: true, professionalIncomeType: "student_occupation_contract", hasReplacementIncome: false }],
    });
    expect(result.category).toBe("A");
  });

  it("preserves a declared student occupation amount while excluding it for a child", () => {
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

  it.each([false, true])("keeps an unqualified child replacement income unresolved, student=%s", (student) => {
    const input = {
      thresholds: { ...thresholds, childReplacementMonthly: 600 },
      anyChildReceivesFamilyAllowances: false,
      people: [{ id: "child", relation: "child" as const, hasProfessionalIncome: student,
        professionalIncomeType: "student_occupation_contract" as const,
        hasReplacementIncome: true, replacementIncomeType: "other" as const,
        replacementIncomeAmount: 100, replacementIncomeNeedsQualification: true }],
    };
    const result = evaluateArticle110Verifier(input);
    expect(result.category).toBeNull();
    expect(result.missingFacts.map((fact) => fact.factKey)).toContain("child.replacementIncomeType");
    expect(article110VerifierFacts(input).people[0].incomes).toContainEqual(expect.objectContaining({ kind: "replacement", amount: 100, needsQualification: true }));
    expect(evaluateArticle110Verifier({ ...input, anyChildReceivesFamilyAllowances: true }).category).toBe("A");
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

  it("returns an A orientation for a qualified alternating-care declaration", () => {
    const isolatedDeclaration = "alternating_care";
    const result = evaluateArticle110Verifier({ thresholds, isAloneExplicit: true, people: [], isolatedDeclaration });

    expect(result).toMatchObject({
      category: "A",
      householdAssessment: { status: "probable", expectedCategory: "A", declaredQualifiedBasis: isolatedDeclaration, sourceRuleIds: ["situation_familiale_isole_garde_alternee"] },
    });
    expect(result.missingFacts).toEqual([]);
  });

  it("asks for missing alternating-care facts without a generic ONEM waiting state", () => {
    const result = evaluateArticle110Verifier({ thresholds, isAloneExplicit: true, people: [], alternatingCare: { enabled: true, familyAllowances: true } });
    expect(result).toMatchObject({ category: null, onemDecisionStatus: "not_required" });
    expect(result.missingFacts.map((fact) => fact.factKey)).toEqual(["isolated.alternatingCare.averageDaysPerWeek", "isolated.alternatingCare.cycle"]);
  });

  it("preserves the theoretical A when the alimony basis exists even if its copy is pending", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      isAloneExplicit: true,
      people: [],
      alimony: { enabled: true, legalConditionEstablished: true, beneficiary: "minor_child" },
      alternatingCare: { enabled: true, averageDaysPerWeek: 2, cycle: "monthly", familyAllowances: true },
    });
    expect(result).toMatchObject({ category: "A", householdAssessment: { sourceRuleIds: ["situation_familiale_isole_pension_alimentaire"] } });
  });

  it("keeps N when an alimony judgment is not yet legally established", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      isAloneExplicit: true,
      people: [],
      alimony: { enabled: true, legalConditionEstablished: false, beneficiary: "minor_child" },
    });
    expect(result).toMatchObject({ category: "N", householdAssessment: { sourceRuleIds: ["situation_familiale_isole_pension_alimentaire"] } });
  });

  it("distinguishes established autonomous co-housing from the administrative pending state", () => {
    const base = { thresholds, people: [{ id: "roommate", relation: "third_party" as const }] };
    const cohousing = evaluateArticle110Verifier({ ...base, cohousing: true, cohousingAutonomousLiving: true, cohousingRecognition: "pending" });
    const ordinaryCohabitation = evaluateArticle110Verifier({ ...base, cohousing: false });
    expect(cohousing).toMatchObject({ category: "N", onemDecisionStatus: "required", householdAssessment: { administrativeTreatment: { provisionalCategory: "B", decisionNeeded: true } } });
    expect(ordinaryCohabitation).toMatchObject({ category: "B", onemDecisionStatus: "not_required" });
  });
});
