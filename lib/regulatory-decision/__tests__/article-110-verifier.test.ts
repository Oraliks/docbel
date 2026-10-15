import { describe, expect, it } from "vitest";
import { evaluateArticle110Verifier } from "../article-110-verifier";

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
      people: [{ id: "spouse", relation: "spouse", hasProfessionalIncome: true, professionalIncomeAmount: 900, professionalIncomeType: "employee", professionalIncomeContract: "cdi", professionalIncomeVariable: false, hasReplacementIncome: false }],
    });
    expect(result.householdAssessment).toMatchObject({ expectedCategory: "A", operationalArticle: "60A" });
    expect(result.category).toBe("A");
  });

  it("does not neutralise a replacement income when a spouse also has a small fixed salary", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      people: [{ id: "spouse", relation: "spouse", hasProfessionalIncome: true, professionalIncomeAmount: 900, professionalIncomeType: "employee", professionalIncomeContract: "cdi", professionalIncomeVariable: false, hasReplacementIncome: true, replacementIncomeType: "mutuality", replacementIncomeAmount: 500 }],
    });
    expect(result.householdAssessment).toMatchObject({ expectedCategory: "B", incomeAssessment: "relevant" });
  });

  it("uses the same alternating-care result as the common calculation", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      isAloneExplicit: true,
      registryLivesAlone: true,
      relevantHouseholdDiscordance: false,
      people: [],
      alternatingCare: { enabled: true, averageDaysPerWeek: 2, cycle: "monthly", familyAllowances: true },
    });
    expect(result).toMatchObject({ category: "A", onemDecisionStatus: "not_required" });
    expect(result.missingFacts).toEqual([]);
  });

  it("does not accept a partner self-qualification in place of the underlying facts", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      people: [{ id: "partner", relation: "partner", partnerEstablished: true, hasProfessionalIncome: false, hasReplacementIncome: false }],
    });
    expect(result).toMatchObject({ category: null, onemDecisionStatus: "not_required" });
    expect(result.missingFacts.map((fact) => fact.factKey)).toContain("partner.formsHouseholdOfFact");
  });

  it("derives the partner qualification from concrete Article 110 facts", () => {
    const result = evaluateArticle110Verifier({
      thresholds,
      people: [{
        id: "partner", relation: "partner", hasProfessionalIncome: false, hasReplacementIncome: false,
        partnerFacts: { livesTogether: true, formsHouseholdOfFact: true, relatedWithinThirdDegree: false, receivesFamilyAllowances: false, receivesSocialIntegration: false, alreadyDependentElsewhere: false, marriedOrCohabitsWithSpouse: false },
      }],
    });
    expect(result).toMatchObject({ category: "A", onemDecisionStatus: "not_required" });
  });

  it("asks for missing alternating-care facts without a generic ONEM waiting state", () => {
    const result = evaluateArticle110Verifier({ thresholds, isAloneExplicit: true, registryLivesAlone: true, relevantHouseholdDiscordance: false, people: [], alternatingCare: { enabled: true, familyAllowances: true } });
    expect(result).toMatchObject({ category: null, onemDecisionStatus: "not_required" });
    expect(result.missingFacts.map((fact) => fact.factKey)).toEqual(["isolated.alternatingCare.averageDaysPerWeek", "isolated.alternatingCare.cycle"]);
  });

  it("separates recognised and pending co-housing from ordinary cohabitation", () => {
    const base = { thresholds, people: [{ id: "roommate", relation: "third_party" as const }] };
    const cohousing = evaluateArticle110Verifier({ ...base, cohousing: true, cohousingAutonomousLiving: true, cohousingRecognition: "pending" });
    const ordinaryCohabitation = evaluateArticle110Verifier({ ...base, cohousing: false });
    expect(cohousing).toMatchObject({ category: "N", onemDecisionStatus: "required", householdAssessment: { administrativeTreatment: { provisionalCategory: "B", decisionNeeded: true } } });
    expect(cohousing.reason).toContain("co-housing déclaré");
    expect(ordinaryCohabitation).toMatchObject({ category: "B", onemDecisionStatus: "not_required" });
    expect(ordinaryCohabitation.reason).toContain("cohabitation ordinaire");
  });
});
