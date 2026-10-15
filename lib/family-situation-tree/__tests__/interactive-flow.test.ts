import { describe, expect, it } from "vitest";
import type { Article110VerifierInput } from "@/lib/regulatory-decision/article-110-verifier";
import { evaluateArticle110Verifier } from "@/lib/regulatory-decision/article-110-verifier";
import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";
import { changeTreePersonRelation, chooseFamilyTreeBranch, removeTreePerson, resetFamilyTreeBranch, setTreeProfessionalIncomeType, updateTreePerson, type FamilyTreeState } from "../interactive-flow";

const thresholds: C1BaremeThresholds = {
  spouseProfessionalMonthly: 1_000, childProfessionalMonthly: 1_000,
  spouseReplacementMonthly: 1_000, childReplacementMonthly: 1_000,
  ascendantPensionWithChildMonthly: 1_500, ascendantPensionMonthly: 1_000, ascendantDisabledPensionMonthly: 1_200,
  source: { fileId: "family-tree-test", fileName: "bareme-test.xlsx", validFrom: new Date("2026-09-01") },
};
function evaluateTree(state: FamilyTreeState, extra: Partial<Article110VerifierInput> = {}) {
  return evaluateArticle110Verifier({ people: state.people, thresholds, asOf: "2026-10-12", isAloneExplicit: state.branch === "alone", ...extra });
}

describe("interactive family tree state", () => {
  it("starts a partner branch without inventing qualification or income", () => {
    const state = chooseFamilyTreeBranch("partner");
    expect(state.people).toMatchObject([{ relation: "partner" }]);
    expect(state.people[0]).not.toHaveProperty("partnerFacts");
    expect(state.people[0]).not.toHaveProperty("hasProfessionalIncome");
  });

  it("keeps a declared partner incomplete only until its income facts are declared", () => {
    const incomplete = chooseFamilyTreeBranch("partner");
    expect(evaluateTree(incomplete).householdAssessment).toMatchObject({ status: "needs_information", expectedCategory: null });
    const complete = updateTreePerson(incomplete, "partner", { hasProfessionalIncome: false, hasReplacementIncome: false });
    expect(evaluateTree(complete).householdAssessment).toMatchObject({ composition: "spouse_or_partner", expectedCategory: "A" });
  });

  it("uses the dated ceiling and retains professional and replacement income together", () => {
    const state = updateTreePerson(chooseFamilyTreeBranch("partner"), "partner", { hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeAmount: 1_000, professionalIncomeContract: "cdi", professionalIncomeVariable: false, hasReplacementIncome: true, replacementIncomeType: "unemployment" });
    expect(evaluateTree(state).householdAssessment).toMatchObject({ expectedCategory: "B", monthlyPaymentAssessment: "B_RATE" });
  });

  it("requires the discriminating co-housing facts for third parties", () => {
    const state: FamilyTreeState = { ...chooseFamilyTreeBranch("others"), people: [{ id: "friend", relation: "third_party", hasProfessionalIncome: false, hasReplacementIncome: false }] };
    expect(evaluateTree(state, { cohousing: true, cohousingAutonomousLiving: true, cohousingRecognition: "recognised_same_address", cohousingRelevantAddressChanged: false }).householdAssessment).toMatchObject({ expectedCategory: "N", status: "probable" });
    expect(evaluateTree(state, { cohousing: false }).householdAssessment).toMatchObject({ expectedCategory: "B", status: "probable" });
  });

  it("does not turn a selected special isolated path into an automatic A result", () => {
    const state: FamilyTreeState = { ...chooseFamilyTreeBranch("alone"), declaredAloneSituation: "alternating_care" };
    expect(evaluateTree(state, { alternatingCare: { enabled: true } }).householdAssessment).toMatchObject({ status: "needs_information", expectedCategory: null });
  });

  it("drops incompatible facts when a relation or branch changes", () => {
    const state: FamilyTreeState = { ...chooseFamilyTreeBranch("others"), people: [{ id: "person", relation: "child", hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeAmount: 500 }] };
    expect(changeTreePersonRelation(state, "person", "relative").people[0]).toEqual({ id: "person", relation: "relative", label: "relative" });
    expect(resetFamilyTreeBranch(state, "alone")).toEqual({ branch: "alone", people: [] });
    expect(removeTreePerson(state, "person").people).toEqual([]);
  });

  it("clears activity-specific professional facts", () => {
    const state: FamilyTreeState = { ...chooseFamilyTreeBranch("others"), people: [{ id: "child", relation: "child", hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeAmount: 500, professionalIncomeContract: "cdi", professionalIncomeVariable: true, c110aMonthlyDeclaredIncome: 480 }] };
    expect(setTreeProfessionalIncomeType(state, "child", "student_occupation_contract").people[0]).toMatchObject({ professionalIncomeAmount: undefined, professionalIncomeContract: undefined, professionalIncomeVariable: undefined, c110aMonthlyDeclaredIncome: undefined });
  });
});
