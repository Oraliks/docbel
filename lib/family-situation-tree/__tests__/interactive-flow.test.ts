import { describe, expect, it } from "vitest";
import type { Article110VerifierInput } from "@/lib/regulatory-decision/article-110-verifier";
import { article110VerifierFacts, evaluateArticle110Verifier } from "@/lib/regulatory-decision/article-110-verifier";
import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";
import { evaluateFamilySituation } from "@/lib/regulatory-decision/household-composition";
import { article110VerifierInputToFamilyTreeState, familyTreeStateToArticle110VerifierInput, chooseFamilyTreeBranch, resetFamilyTreeBranch, setDeclaredAloneSituation, setTreeProfessionalIncomeType, updateTreePerson, type FamilyTreeState } from "../interactive-flow";

const thresholds: C1BaremeThresholds = {
  spouseProfessionalMonthly: 1_000,
  childProfessionalMonthly: 1_000,
  spouseReplacementMonthly: 1_000,
  childReplacementMonthly: 1_000,
  ascendantPensionWithChildMonthly: 1_500,
  ascendantPensionMonthly: 1_000,
  ascendantDisabledPensionMonthly: 1_200,
  source: { fileId: "family-tree-test", fileName: "bareme-test.xlsx", validFrom: new Date("2026-09-01") },
};

/** Exercise the same mapping used by FamilySituationTree. */
function evaluateTree(state: FamilyTreeState) {
  return evaluateArticle110Verifier(familyTreeStateToArticle110VerifierInput(state, thresholds, "2026-10-12"));
}
describe("interactive family tree state", () => {
  it("passes the supplied date and ceilings and preserves detailed isolated facts", () => {
    const state: FamilyTreeState = {
      branch: "alone", people: [],
      alimony: true, alimonyLegalCondition: true, alimonyBeneficiary: "adult_child", alimonyAdultChildInNeed: false,
      alternatingCare: true, alternatingCareDaysPerWeek: 2, alternatingCareCycle: "quarterly",
      alternatingCareFamilyAllowances: false, alternatingCareChildHasRelevantIncome: false,
    };
    const before = structuredClone(state);
    const input = familyTreeStateToArticle110VerifierInput(state, thresholds, "2026-10-12");
    expect(input.thresholds).toBe(thresholds);
    expect(input).toMatchObject({
      asOf: "2026-10-12", isAloneExplicit: true, multiPersonHouseholdSelected: false,
      alimony: { enabled: true, legalConditionEstablished: true, beneficiary: "adult_child", adultChildInNeed: false },
      alternatingCare: { enabled: true, averageDaysPerWeek: 2, cycle: "quarterly", familyAllowances: false, childHasRelevantIncome: false },
    });
    expect(state).toEqual(before);
  });

  it("prefills a representable matrix household without changing its facts", () => {
    const state = article110VerifierInputToFamilyTreeState({
      thresholds,
      people: [{ id: "child", relation: "child", receivesFamilyAllowances: true, hasProfessionalIncome: false, hasReplacementIncome: false }],
      anyChildReceivesFamilyAllowances: true,
    });

    expect(state).toMatchObject({ branch: "others", anyChildReceivesFamilyAllowances: true, people: [{ id: "child", relation: "child" }] });
  });

  it("refuses a tree prefill when the interactive path cannot preserve the legal fact", () => {
    expect(article110VerifierInputToFamilyTreeState({ thresholds, people: [], alternatingCare: { enabled: true } })).toBeUndefined();
    expect(article110VerifierInputToFamilyTreeState({ thresholds, people: [{ id: "third", relation: "third_party" }], cohousing: true, cohousingRecognition: "not_recognised" })).toBeUndefined();
  });

  it("starts a partner branch without assuming either qualification or income", () => {
    const state = chooseFamilyTreeBranch("partner");
    expect(state.people).toMatchObject([{ relation: "partner" }]);
    expect(state.people[0]).not.toHaveProperty("partnerEstablished");
    expect(state.people[0]).not.toHaveProperty("hasProfessionalIncome");
  });

  it("drops incompatible facts on a branch change", () => {
    const partner = updateTreePerson(chooseFamilyTreeBranch("partner"), "partner", { hasProfessionalIncome: true, professionalIncomeAmount: 800 });
    expect(resetFamilyTreeBranch(partner, "alone")).toEqual({ branch: "alone", people: [] });
  });

  it("keeps the solo baseline explicit without inventing a negative special-situation fact", () => {
    const state = chooseFamilyTreeBranch("alone");
    expect(state.alimony).toBeUndefined();
    expect(state.alternatingCare).toBeUndefined();
    expect(evaluateTree(state)).toMatchObject({
      category: "N",
      householdAssessment: { expectedCategory: "N", operationalArticle: "none" },
      missingFacts: [],
    });
  });

  it("does not turn an empty selected multi-person branch into an isolated situation", () => {
    const result = evaluateTree(chooseFamilyTreeBranch("others"));

    expect(result).toMatchObject({
      category: null,
      householdAssessment: { status: "needs_information", expectedCategory: null },
    });
    expect(result.missingFacts.map((fact) => fact.factKey)).toContain("household.people");
  });

  it("turns an incomplete alimony or alternating-care declaration into the next factual question", () => {
    const alone = chooseFamilyTreeBranch("alone");
    const alimony = evaluateTree({ ...alone, alimony: true });
    const care = evaluateTree({ ...alone, alternatingCare: true });
    expect(alimony.missingFacts.map((fact) => fact.factKey)).toContain("isolated.alimony");
    expect(care.missingFacts.map((fact) => fact.factKey)).toEqual(expect.arrayContaining([
      "isolated.alternatingCare.averageDaysPerWeek",
      "isolated.alternatingCare.cycle",
    ]));
  });

  it("keeps only the selected qualified isolated declaration in the simulation", () => {
    const care = setDeclaredAloneSituation({
      ...chooseFamilyTreeBranch("alone"),
      alimony: true,
      alimonyLegalCondition: true,
      alternatingCare: true,
      alternatingCareDaysPerWeek: 2,
    }, "alternating_care");
    const alimony = { ...setDeclaredAloneSituation(care, "alimony"), alimonyLegalCondition: true };

    expect(care).toMatchObject({ declaredAloneSituation: "alternating_care" });
    expect(care.alimony).toBeUndefined();
    expect(care.alternatingCare).toBeUndefined();
    expect(evaluateTree(care)).toMatchObject({ category: "A", householdAssessment: { declaredQualifiedBasis: "alternating_care" } });
    expect(alimony).toMatchObject({ declaredAloneSituation: "alimony" });
    expect(evaluateTree(alimony)).toMatchObject({ category: "A", householdAssessment: { sourceRuleIds: ["situation_familiale_isole_pension_alimentaire"] } });
  });

  it("delegates a partner without income to the shared A result", () => {
    const partner = updateTreePerson(chooseFamilyTreeBranch("partner"), "partner", {
      partnerEstablished: true,
      hasProfessionalIncome: false,
      hasReplacementIncome: false,
    });
    expect(evaluateTree(partner)).toMatchObject({
      category: "A",
      householdAssessment: { composition: "spouse_or_partner", expectedCategory: "A", operationalArticle: "none", monthlyPaymentAssessment: "A_RATE" },
    });
  });

  it.each([
    [999, "A", "60A", "A_RATE"],
    [1_000, "A", "60A", "A_RATE"],
    [1_001, "B", "none", "B_RATE"],
  ] as const)("uses the dated shared ceiling for an employee income of %i", (amount, expectedCategory, operationalArticle, monthlyPaymentAssessment) => {
    const state = updateTreePerson(chooseFamilyTreeBranch("partner"), "partner", {
      partnerEstablished: true,
      hasProfessionalIncome: true,
      professionalIncomeType: "employee",
      professionalIncomeAmount: amount,
      professionalIncomeContract: "cdi",
      professionalIncomeVariable: false,
      hasReplacementIncome: false,
    });
    expect(evaluateTree(state).householdAssessment).toMatchObject({ expectedCategory, operationalArticle, monthlyPaymentAssessment });
  });

  it("keeps the 60B base treatment distinct from a missing monthly declaration", () => {
    const state = updateTreePerson(chooseFamilyTreeBranch("partner"), "partner", {
      partnerEstablished: true,
      hasProfessionalIncome: true,
      professionalIncomeType: "employee",
      professionalIncomeAmount: 900,
      professionalIncomeContract: "cdd",
      professionalIncomeVariable: true,
      hasReplacementIncome: false,
    });
    expect(evaluateTree(state).householdAssessment).toMatchObject({
      expectedCategory: "B",
      operationalArticle: "60B",
      monthlyPaymentAssessment: "NEEDS_REVIEW",
    });
  });

  it("has parity with the shared family evaluator for the same tree facts and dated barème", () => {
    const state = updateTreePerson(chooseFamilyTreeBranch("partner"), "partner", {
      partnerEstablished: true,
      hasProfessionalIncome: true,
      professionalIncomeType: "employee",
      professionalIncomeAmount: 1_000,
      professionalIncomeContract: "cdi",
      professionalIncomeVariable: false,
      hasReplacementIncome: false,
    });
    const input: Article110VerifierInput = { people: state.people, thresholds, asOf: "2026-10-12" };
    const shared = evaluateFamilySituation({
      facts: article110VerifierFacts(input),
      activeChildIncomeNeutralisation: false,
      spouseProfessionalMonthlyThreshold: thresholds.spouseProfessionalMonthly,
      ascendantPensionWithChildMonthlyThreshold: thresholds.ascendantPensionWithChildMonthly,
      ascendantPensionMonthlyThreshold: thresholds.ascendantPensionMonthly,
      ascendantDisabledPensionMonthlyThreshold: thresholds.ascendantDisabledPensionMonthly,
      baremeSource: thresholds.source,
    });
    expect(evaluateTree(state).householdAssessment).toEqual(shared);
  });

  it("preserves simultaneous professional and replacement facts instead of treating the latter as no income", () => {
    const state = updateTreePerson(chooseFamilyTreeBranch("partner"), "partner", {
      partnerEstablished: true,
      hasProfessionalIncome: true,
      professionalIncomeType: "employee",
      professionalIncomeAmount: 1_001,
      professionalIncomeContract: "cdi",
      professionalIncomeVariable: false,
      hasReplacementIncome: true,
      replacementIncomeType: "unemployment",
    });
    const result = evaluateTree(state);
    expect(state.people[0]).toMatchObject({ hasProfessionalIncome: true, hasReplacementIncome: true });
    expect(result.householdAssessment).toMatchObject({ expectedCategory: "B", monthlyPaymentAssessment: "B_RATE" });
    expect(result.missingFacts.map((fact) => fact.factKey)).not.toContain("partner.hasReplacementIncome");
  });

  it("routes children, relatives and third parties through the shared composition engine", () => {
    const base = chooseFamilyTreeBranch("others");
    const people = [
      { id: "child", label: "Enfant", relation: "child" as const, receivesFamilyAllowances: true, hasProfessionalIncome: false, hasReplacementIncome: false },
      { id: "parent", label: "Père", relation: "relative" as const, isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: false },
      { id: "friend", label: "Ami", relation: "third_party" as const, hasProfessionalIncome: false, hasReplacementIncome: false },
    ];
    const withoutThirdIncome = evaluateTree({ ...base, people });
    const withThirdIncome = evaluateTree({ ...base, people: people.map((person) => person.id === "friend" ? { ...person, hasProfessionalIncome: true } : person) });
    expect(withoutThirdIncome.householdAssessment).toMatchObject({ composition: "children_relatives_and_third_parties", expectedCategory: "A" });
    expect(withThirdIncome.householdAssessment).toMatchObject({ composition: "children_relatives_and_third_parties", expectedCategory: "B" });
  });

  it("applies the dated child-income ceiling to a declared student occupation amount", () => {
    const state = {
      ...chooseFamilyTreeBranch("others"),
      anyChildReceivesFamilyAllowances: false,
      people: [{ id: "child", relation: "child" as const, hasProfessionalIncome: true, professionalIncomeType: "student_occupation_contract" as const, professionalIncomeAmount: 450, hasReplacementIncome: false }],
    };

    expect(evaluateTree(state).householdAssessment).toMatchObject({
      expectedCategory: "A",
    });
  });

  it("clears incompatible professional facts when the activity changes", () => {
    const state = updateTreePerson({
      ...chooseFamilyTreeBranch("others"),
      people: [{ id: "child", relation: "child" as const, hasProfessionalIncome: true, professionalIncomeType: "employee" as const, professionalIncomeAmount: 500, professionalIncomeContract: "cdi", professionalIncomeVariable: true, c110aMonthlyDeclaredIncome: 480 }],
    }, "child", {});

    expect(setTreeProfessionalIncomeType(state, "child", "student_occupation_contract").people[0]).toMatchObject({
      professionalIncomeType: "student_occupation_contract",
    });
    expect(setTreeProfessionalIncomeType(state, "child", "student_occupation_contract").people[0]).toMatchObject({ professionalIncomeAmount: undefined, professionalIncomeContract: undefined, professionalIncomeVariable: undefined, c110aMonthlyDeclaredIncome: undefined });
  });

  it("uses the shared co-housing fact rather than an isolated UI rule", () => {
    const state = {
      ...chooseFamilyTreeBranch("others"),
      people: [{ id: "friend", label: "Ami", relation: "third_party" as const, hasProfessionalIncome: false, hasReplacementIncome: false }],
    };
    expect(evaluateTree({ ...state, cohousing: true, cohousingAutonomousLiving: true, cohousingRecognition: false }).householdAssessment).toMatchObject({
      composition: "third_parties_only",
      expectedCategory: "N",
      status: "probable",
      administrativeTreatment: { provisionalCategory: "B" },
    });
    expect(evaluateTree({ ...state, cohousing: false }).householdAssessment).toMatchObject({
      composition: "third_parties_only",
      expectedCategory: "B",
      status: "probable",
    });
  });

  it("removes a previous partner income when the user changes branch", () => {
    const partner = updateTreePerson(chooseFamilyTreeBranch("partner"), "partner", {
      partnerEstablished: true,
      hasProfessionalIncome: true,
      professionalIncomeType: "employee",
      professionalIncomeAmount: 1_500,
      professionalIncomeContract: "cdi",
      professionalIncomeVariable: false,
      hasReplacementIncome: false,
    });
    expect(evaluateTree(partner).householdAssessment.expectedCategory).toBe("B");
    const alone = resetFamilyTreeBranch(partner, "alone");
    expect(alone.people).toEqual([]);
    expect(evaluateTree(alone)).toMatchObject({ category: "N", missingFacts: [] });
  });
});
