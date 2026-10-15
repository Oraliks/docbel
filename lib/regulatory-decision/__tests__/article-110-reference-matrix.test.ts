import { describe, expect, it } from "vitest";
import { familyTreeArticle110Input, type FamilyTreeState } from "@/lib/family-situation-tree/interactive-flow";
import { evaluateArticle110Verifier, type Article110VerifierInput, type Article110VerifierPerson } from "../article-110-verifier";

const thresholds = {
  spouseProfessionalMonthly: 1_000, childProfessionalMonthly: 1_000,
  spouseReplacementMonthly: null, childReplacementMonthly: null,
  ascendantPensionWithChildMonthly: 1_500, ascendantPensionMonthly: 1_000,
  ascendantDisabledPensionMonthly: 1_200, source: null,
};

const alone: Pick<Article110VerifierInput, "isAloneExplicit" | "registryLivesAlone" | "relevantHouseholdDiscordance" | "people"> = { isAloneExplicit: true, registryLivesAlone: true, relevantHouseholdDiscordance: false, people: [] };
const spouse = (extra: Omit<Article110VerifierPerson, "id" | "relation">) => ({ people: [{ ...extra, id: "spouse", relation: "spouse" as const }] });

describe("Article 110 reference matrix", () => {
  it.each([
    ["unknown composition", { people: [] }, null],
    ["declared alone confirmed by registry", alone, "N"],
    ["recognised autonomous co-housing", { people: [{ id: "third", relation: "third_party" as const }], cohousing: true, cohousingAutonomousLiving: true, cohousingRecognition: "recognised_same_address" as const, cohousingRelevantAddressChanged: false }, "N"],
    ["pending autonomous co-housing", { people: [{ id: "third", relation: "third_party" as const }], cohousing: true, cohousingAutonomousLiving: true, cohousingRecognition: "pending" as const }, "N"],
    ["unqualified co-housing", { people: [{ id: "third", relation: "third_party" as const }], cohousing: true }, null],
    ["alimony with an established basis", { ...alone, alimony: { enabled: true, legalBasis: "established" as const, beneficiary: "minor_child" as const } }, "A"],
    ["alimony with a pending judgment is terminal", { ...alone, alimony: { enabled: true, legalBasis: "pending" as const, beneficiary: "minor_child" as const }, alternatingCare: { enabled: true, averageDaysPerWeek: 3, cycle: "monthly" as const, familyAllowances: true } }, "N"],
    ["alternating care after a negative alimony answer", { ...alone, alimony: { enabled: false }, alternatingCare: { enabled: true, averageDaysPerWeek: 2, cycle: "monthly" as const, familyAllowances: true } }, "A"],
    ["no particular isolated situation", { ...alone, alimony: { enabled: false }, alternatingCare: { enabled: false } }, "N"],
    ["spouse without income", spouse({ hasProfessionalIncome: false, hasReplacementIncome: false }), "A"],
    ["independent activity is relevant without an amount", spouse({ hasProfessionalIncome: true, professionalIncomeType: "independent", hasReplacementIncome: false }), "B"],
    ["fixed salary below the dated ceiling", spouse({ hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeContract: "cdi", professionalIncomeVariable: false, professionalIncomeAmount: 1_000, hasReplacementIncome: false }), "A"],
    ["variable salary has a B base treatment", spouse({ hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeContract: "cdi", professionalIncomeVariable: true, professionalIncomeAmount: 900, hasReplacementIncome: false }), "B"],
  ] as const)("returns the independent expected category for %s", (_name, facts, expected) => {
    expect(evaluateArticle110Verifier({ thresholds, ...(facts as Omit<Article110VerifierInput, "thresholds">) }).category).toBe(expected);
  });

  it("keeps the pending co-housing administrative B separate from theoretical N", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [{ id: "third", relation: "third_party" }], cohousing: true, cohousingAutonomousLiving: true, cohousingRecognition: "pending" });
    expect(result.householdAssessment.administrativeTreatment).toMatchObject({ provisionalCategory: "B", decisionNeeded: true });
  });

  it("keeps the theoretical A category when the legal basis exists but its copy is unavailable", () => {
    const result = evaluateArticle110Verifier({ thresholds, ...alone, alimony: { enabled: true, legalBasis: "established", proofAvailable: false, beneficiary: "minor_child" } });
    expect(result.category).toBe("A");
    expect(result.householdAssessment.declaredQualifiedBasis).toBe("alimony");
  });

  it("gives the Tree and Verifier identical outcomes from the same normalised facts", () => {
    const state: FamilyTreeState = {
      branch: "alone", people: [], registryLivesAlone: true, relevantHouseholdDiscordance: false,
      declaredAloneSituation: "alternating_care", alternatingCareDaysPerWeek: 2,
      alternatingCareCycle: "monthly", alternatingCareFamilyAllowances: true,
    };
    const treeInput = familyTreeArticle110Input(state, thresholds, "2026-10-14");
    const verifierInput: Article110VerifierInput = { ...alone, thresholds, asOf: "2026-10-14", alimony: { enabled: false }, alternatingCare: { enabled: true, averageDaysPerWeek: 2, cycle: "monthly", familyAllowances: true } };
    const tree = evaluateArticle110Verifier(treeInput);
    const verifier = evaluateArticle110Verifier(verifierInput);
    expect(tree.category).toBe("A");
    expect(tree.category).toBe(verifier.category);
    expect(tree.householdAssessment.sourceRuleIds).toEqual(verifier.householdAssessment.sourceRuleIds);
  });
});
