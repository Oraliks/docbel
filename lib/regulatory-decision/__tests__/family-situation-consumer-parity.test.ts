import { afterEach, describe, expect, it, vi } from "vitest";
import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";
import { familyTreeStateToArticle110VerifierInput } from "@/lib/family-situation-tree/interactive-flow";
import { evaluateArticle110Verifier } from "../article-110-verifier";
import { withPersonalSituationTrace } from "../personal-situation-change";
import { decidePersonalSituation } from "../personal-situation";
import * as household from "../household-composition";

vi.mock("../household-composition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../household-composition")>();
  return {
    ...actual,
    evaluateFamilySituation: vi.fn((input: household.FamilySituationEvaluationInput) =>
      actual.evaluateFamilySituation({ ...input, partnerQualificationPolicy: "require_facts" })),
  };
});

const asOf = "2026-10-12";
const now = new Date(`${asOf}T00:00:00Z`);
const thresholds = (child: number | null): C1BaremeThresholds => ({
  spouseProfessionalMonthly: 1_000, spouseReplacementMonthly: null,
  childProfessionalMonthly: child, childReplacementMonthly: null,
  ascendantPensionWithChildMonthly: null, ascendantPensionMonthly: null,
  ascendantDisabledPensionMonthly: null,
  source: { fileId: "dated-test", fileName: "dated-test.xlsx", validFrom: new Date("2026-09-01") },
});

function snapshot() {
  const decision = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } }, now);
  return {
    ...decision,
    officialOnemState: { onemCode: "B", recordedAt: "2026-10-01" },
    temporalHistory: [{
      onemCode: "110&1M" as const, familyCategory: "A" as const,
      effectiveFrom: "2026-01-01", ruleIds: [], ruleVersions: {}, sourceRuleIds: [], factsUsed: {}, decidedAt: "2026-01-01",
    }],
    article110Decision: decision,
    reportedChildIncomeExpiries: [{ factKey: "child", periodStartedAt: "2025-01-01", reassessmentAt: "2026-01-01" }],
  };
}

afterEach(() => vi.mocked(household.evaluateFamilySituation).mockClear());

describe("strict family situation through the real consumer adapters", () => {
  it("passes old partner declarations through one conservative evaluator", () => {
    const rates = thresholds(200);
    const tree = familyTreeStateToArticle110VerifierInput({ branch: "partner", people: [{ id: "p", relation: "partner", partnerEstablished: true, hasProfessionalIncome: false, hasReplacementIncome: false }] }, rates, asOf);
    const fromTree = evaluateArticle110Verifier(tree).householdAssessment;
    const fromVerifier = evaluateArticle110Verifier({ ...tree, people: [{ ...tree.people[0], partnerEstablished: false }] }).householdAssessment;
    const before = snapshot();
    const fromC1 = withPersonalSituationTrace(before, { cohabitants: [{ id: "p", lien: "partenaire", partenaireConditionsEtablies: "oui", typeRevenuPro: "aucun", revenuRemplacement: "aucun" }] }, now, rates)!;
    expect(household.evaluateFamilySituation).toHaveBeenCalledTimes(3);
    for (const assessment of [fromTree, fromVerifier, fromC1.householdAssessment]) {
      expect(assessment).toMatchObject({ expectedCategory: null, status: "needs_information",
        partnerQualifications: [{ status: "needs_information" }] });
    }
    const calls = vi.mocked(household.evaluateFamilySituation).mock.calls.map(([input]) => input);
    expect(calls.map((input) => input.facts.asOf)).toEqual([asOf, asOf, asOf]);
    expect(calls.map((input) => input.childProfessionalMonthlyThreshold)).toEqual([200, 200, 200]);
    expect(calls.map((input) => input.baremeSource)).toEqual([rates.source, rates.source, rates.source]);
    expect(calls.every((input) => input.facts.people[0].partnerQualification === undefined)).toBe(true);
    expect(fromC1.officialOnemState).toEqual(before.officialOnemState);
    expect(fromC1.temporalHistory).toEqual(before.temporalHistory);
    expect(fromC1.article110Decision).toEqual(before.article110Decision);
    expect(fromC1.reportedChildIncomeExpiries).toEqual(before.reportedChildIncomeExpiries);
  });

  it.each([
    [100, "B"], [200, "A"], [null, null],
  ] as const)("propagates dated child ceiling %s and its resulting category", (ceiling, expected) => {
    const rates = thresholds(ceiling);
    const child = { id: "child", relation: "child" as const, receivesFamilyAllowances: false,
      hasProfessionalIncome: true, professionalIncomeAmount: 150, hasReplacementIncome: false };
    const tree = evaluateArticle110Verifier(familyTreeStateToArticle110VerifierInput({ branch: "others", people: [child] }, rates, asOf));
    const verifier = evaluateArticle110Verifier({ people: [child], thresholds: rates, asOf });
    const c1 = withPersonalSituationTrace(snapshot(), { cohabitants: [{ id: "child", lien: "enfant", allocationsFamiliales: "non",
      typeRevenuPro: "salarie-employe", montantRevenuPro: 150, revenuRemplacement: "aucun" }] }, now, rates)!;
    expect([tree.category, verifier.category, c1.householdAssessment?.expectedCategory]).toEqual([expected, expected, expected]);
    const calls = vi.mocked(household.evaluateFamilySituation).mock.calls.map(([input]) => input);
    expect(calls).toHaveLength(3);
    expect(calls.map((input) => input.childProfessionalMonthlyThreshold)).toEqual([ceiling, ceiling, ceiling]);
    expect(calls.map((input) => input.baremeSource)).toEqual([rates.source, rates.source, rates.source]);
  });
});
