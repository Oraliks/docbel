import { describe, expect, it } from "vitest";
import {
  deriveArticle110FactsFromC1,
  deriveHouseholdCompositionFromC1,
  derivePersonalSituationTrace,
  deriveFamilyFactsFromC1,
  withPersonalSituationTrace,
} from "../personal-situation-change";
import { decidePersonalSituation } from "../personal-situation";
import { evaluateArticle110Verifier, type Article110VerifierInput, type Article110VerifierPerson } from "../article-110-verifier";
import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";
import type { FormPayload } from "@/lib/pdf-forms/types";
import { familyTreeStateToArticle110VerifierInput, type FamilyTreeState } from "@/lib/family-situation-tree/interactive-flow";
import { decideArticle110ChildFirstProfessionalIncome, preserveArticle110TemporalHistory } from "../article-110-child-income";
import type { RegulatoryDecision } from "../types";

describe("tree / verifier / C1 adapter parity", () => {
  const asOf = "2026-10-12";
  const now = new Date(`${asOf}T00:00:00Z`);
  // Synthetic, deliberately distinct ceilings detect swapped or omitted roles.
  const thresholds: C1BaremeThresholds = {
    spouseProfessionalMonthly: 900,
    spouseReplacementMonthly: 750,
    childProfessionalMonthly: 200,
    childReplacementMonthly: 350,
    ascendantPensionWithChildMonthly: 600,
    ascendantPensionMonthly: 500,
    ascendantDisabledPensionMonthly: 550,
    source: { fileId: "synthetic", fileName: "synthetic.xlsx", validFrom: new Date("2026-09-01") },
  };
  const noIncomeChild: Article110VerifierPerson = { id: "child", relation: "child", receivesFamilyAllowances: false, hasProfessionalIncome: false, hasReplacementIncome: false };
  const noIncomeC1Child = { lien: "enfant", allocationsFamiliales: "non", typeRevenuPro: "aucun", revenuRemplacement: "aucun" };
  const officialOnemState = { onemCode: "B / 60B", recordedAt: "2026-10-08" };
  type Case = {
    title: string;
    people: Article110VerifierPerson[];
    payload: FormPayload;
    category: "A" | "N" | "B" | null;
    status?: "probable" | "needs_information";
    composition?: string;
    branch?: FamilyTreeState["branch"];
    thresholds?: C1BaremeThresholds;
  };

  function checkParity(test: Case) {
    const usedThresholds = test.thresholds ?? thresholds;
    const branch = test.branch ?? "others";
    // Both sources are declared by the fixture; neither adapter builds the other's input.
    const verifierInput: Article110VerifierInput = {
      people: test.people, thresholds: usedThresholds, asOf,
      isAloneExplicit: branch === "alone", multiPersonHouseholdSelected: branch === "others",
    };
    const tree = evaluateArticle110Verifier(familyTreeStateToArticle110VerifierInput({ branch, people: test.people }, usedThresholds, asOf));
    const verifier = evaluateArticle110Verifier(verifierInput);
    const c1 = withPersonalSituationTrace({
      ...decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } }),
      officialOnemState,
    }, test.payload, now, usedThresholds);
    const expected = {
      expectedCategory: test.category,
      status: test.status ?? "probable",
      composition: test.composition ?? "children_only",
      evaluatedAt: asOf,
    };
    for (const assessment of [tree.householdAssessment, verifier.householdAssessment, c1?.householdAssessment]) {
      expect(assessment).toMatchObject(expected);
      expect(assessment).toMatchObject({
        operationalArticle: verifier.householdAssessment.operationalArticle,
        monthlyPaymentAssessment: verifier.householdAssessment.monthlyPaymentAssessment,
        incomeAssessment: verifier.householdAssessment.incomeAssessment,
        sourceRuleIds: verifier.householdAssessment.sourceRuleIds,
      });
    }
    expect(tree.householdAssessment).toEqual(verifier.householdAssessment);
    expect(c1?.officialOnemState).toEqual(officialOnemState);
  }

  for (const [kind, ceiling] of [["professional", 200], ["replacement", 350]] as const) {
    it.each([[ceiling - 0.01, "A"], [ceiling, "A"], [ceiling + 0.01, "B"], [0, "A"]] as const)(
      `keeps ${kind} income %s at the correct child ceiling (${ceiling})`, (amount, category) => {
        checkParity({
          title: kind, category,
          people: [{ ...noIncomeChild, ...(kind === "professional"
            ? { hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeAmount: amount }
            : { hasReplacementIncome: true, replacementIncomeType: "unemployment", replacementIncomeAmount: amount }) }],
          payload: { cohabitants: [{ ...noIncomeC1Child, ...(kind === "professional"
            ? { typeRevenuPro: "salarie-employe", montantRevenuPro: amount }
            : { revenuRemplacement: "chomage", montantRevenuRemplacement: amount }) }] },
        });
      },
    );
  }

  it.each<Case>([
    { title: "explicit aucun remains negative", people: [noIncomeChild], payload: { cohabitants: [noIncomeC1Child] }, category: "A" },
    { title: "absent income answers remain unknown", people: [{ id: "child", relation: "child", receivesFamilyAllowances: false }], payload: { cohabitants: [{ lien: "enfant", allocationsFamiliales: "non" }] }, category: null, status: "needs_information" },
    { title: "empty income answers remain unknown", people: [{ id: "child", relation: "child", receivesFamilyAllowances: false }], payload: { cohabitants: [{ ...noIncomeC1Child, typeRevenuPro: "", revenuRemplacement: "  " }] }, category: null, status: "needs_information" },
    { title: "professional amount absent remains unknown", people: [{ ...noIncomeChild, hasProfessionalIncome: true, professionalIncomeType: "employee" }], payload: { cohabitants: [{ ...noIncomeC1Child, typeRevenuPro: "salarie-employe" }] }, category: null, status: "needs_information" },
    { title: "replacement amount absent remains unknown", people: [{ ...noIncomeChild, hasReplacementIncome: true, replacementIncomeType: "unemployment" }], payload: { cohabitants: [{ ...noIncomeC1Child, revenuRemplacement: "chomage" }] }, category: null, status: "needs_information" },
    { title: "professional income retained with replacement unanswered", people: [{ ...noIncomeChild, hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeAmount: 201, hasReplacementIncome: undefined }], payload: { cohabitants: [{ ...noIncomeC1Child, typeRevenuPro: "salarie-employe", montantRevenuPro: 201, revenuRemplacement: "" }] }, category: null, status: "needs_information" },
    { title: "replacement income retained with professional unanswered", people: [{ ...noIncomeChild, hasProfessionalIncome: undefined, hasReplacementIncome: true, replacementIncomeType: "unemployment", replacementIncomeAmount: 351 }], payload: { cohabitants: [{ ...noIncomeC1Child, typeRevenuPro: "", revenuRemplacement: "chomage", montantRevenuRemplacement: 351 }] }, category: null, status: "needs_information" },
    { title: "both income kinds keep their own ceiling", people: [{ ...noIncomeChild, hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeAmount: 200, hasReplacementIncome: true, replacementIncomeType: "unemployment", replacementIncomeAmount: 351 }], payload: { cohabitants: [{ ...noIncomeC1Child, typeRevenuPro: "salarie-employe", montantRevenuPro: 200, revenuRemplacement: "chomage", montantRevenuRemplacement: 351 }] }, category: "B" },
    { title: "family allowance retains priority over unknown income", people: [{ id: "child", relation: "child", receivesFamilyAllowances: true }], payload: { cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui" }] }, category: "A" },
    { title: "family allowance retains priority over above-ceiling income", people: [{ ...noIncomeChild, receivesFamilyAllowances: true, hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeAmount: 201 }], payload: { cohabitants: [{ ...noIncomeC1Child, allocationsFamiliales: "oui", typeRevenuPro: "salarie-employe", montantRevenuPro: 201 }] }, category: "A" },
    { title: "absent collective inventory stays unknown", people: [], payload: { statutFamilial: "cohabite" }, category: null, status: "needs_information", composition: "mixed_or_unsupported" },
    { title: "empty collective inventory stays unknown", people: [], payload: { statutFamilial: "cohabite", cohabitants: [] }, category: null, status: "needs_information", composition: "mixed_or_unsupported" },
    { title: "empty inventory without isolated declaration stays unknown", people: [], payload: { cohabitants: [] }, category: null, status: "needs_information", composition: "mixed_or_unsupported" },
    { title: "explicit isolated declaration remains known", people: [], payload: { statutFamilial: "isole", cohabitants: [] }, category: "N", composition: "alone", branch: "alone" },
    { title: "spouse priority over a child's unknown income", people: [{ id: "spouse", relation: "spouse", hasProfessionalIncome: false, hasReplacementIncome: false }, { id: "child", relation: "child" }], payload: { cohabitants: [{ lien: "epoux", typeRevenuPro: "aucun", revenuRemplacement: "aucun" }, { lien: "enfant" }] }, category: "A", composition: "spouse_or_partner" },
    { title: "third-party income retains priority over family allowance", people: [{ ...noIncomeChild, receivesFamilyAllowances: true }, { id: "third", relation: "third_party", hasProfessionalIncome: true, hasReplacementIncome: false }], payload: { cohabitants: [{ ...noIncomeC1Child, allocationsFamiliales: "oui" }, { lien: "aucun-lien", typeRevenuPro: "salarie-employe", revenuRemplacement: "aucun" }] }, category: "B", composition: "children_and_third_parties" },
    { title: "relative pension uses the relative ceiling", people: [{ id: "parent", relation: "relative", isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 500 }], payload: { cohabitants: [{ lien: "pere", typeRevenuPro: "aucun", revenuRemplacement: "pension", montantRevenuRemplacement: 500, montantPensionNature: "brut" }] }, category: "A", composition: "relatives_only" },
  ])("$title", checkParity);

  it.each(["professional", "replacement"] as const)("keeps a missing %s ceiling unknown", (kind) => {
    checkParity({
      title: kind, category: null, status: "needs_information",
      thresholds: { ...thresholds, ...(kind === "professional" ? { childProfessionalMonthly: null } : { childReplacementMonthly: null }) },
      people: [{ ...noIncomeChild, ...(kind === "professional"
        ? { hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeAmount: 100 }
        : { hasReplacementIncome: true, replacementIncomeType: "unemployment", replacementIncomeAmount: 100 }) }],
      payload: { cohabitants: [{ ...noIncomeC1Child, ...(kind === "professional"
        ? { typeRevenuPro: "salarie-employe", montantRevenuPro: 100 }
        : { revenuRemplacement: "chomage", montantRevenuRemplacement: 100 }) }] },
    });
  });

  it("does not invoke legacy child thresholds when the C1 threshold bundle is absent", () => {
    const decision = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    for (const row of [
      { ...noIncomeC1Child, typeRevenuPro: "salarie-employe", montantRevenuPro: 100 },
      { ...noIncomeC1Child, revenuRemplacement: "chomage", montantRevenuRemplacement: 100 },
    ]) {
      expect(withPersonalSituationTrace(decision, { cohabitants: [row] }, now)?.householdAssessment).toMatchObject({ expectedCategory: null, status: "needs_information" });
    }
  });
});

describe("C1 re-evaluation from an existing snapshot", () => {
  const now = new Date("2026-10-12T00:00:00Z");
  const thresholds: C1BaremeThresholds = {
    spouseProfessionalMonthly: 900, spouseReplacementMonthly: 750,
    childProfessionalMonthly: 200, childReplacementMonthly: 350,
    ascendantPensionMonthly: 500, source: null,
  };
  const child = { id: "child", lien: "enfant", allocationsFamiliales: "non", typeRevenuPro: "aucun", revenuRemplacement: "aucun" };
  const parent = { id: "parent", lien: "pere", typeRevenuPro: "aucun", revenuRemplacement: "pension", montantRevenuRemplacement: 400, montantPensionNature: "brut" };
  const third = { id: "third", lien: "aucun-lien", typeRevenuPro: "aucun", revenuRemplacement: "aucun" };
  function decision(): RegulatoryDecision {
    const temporalFacts = deriveArticle110FactsFromC1({ cohabitants: [{
      lien: "enfant", premierRevenuProfessionnel: "oui", demandeNeutralisationPremierRevenu: "oui",
      dateDebutPremiereActivite: "2025-04-01", dateFinEtudes: "2025-03-31",
    }] })!;
    const article110Decision = preserveArticle110TemporalHistory(
      decideArticle110ChildFirstProfessionalIncome(temporalFacts, new Date("2025-05-01T00:00:00Z")),
      decideArticle110ChildFirstProfessionalIncome(temporalFacts, now),
    );
    return {
      ...decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } }),
      officialOnemState: { onemCode: "B / 60B", recordedAt: "2026-10-08" },
      article110Decision,
      temporalHistory: article110Decision.temporalHistory,
      isolatedHouseholdAssessmentHistory: [{
        branch: "alimony", status: "probable", expectedCategory: "A", documents: [],
        recommendedAction: "onem_review", factKeys: [], sourceRuleIds: ["situation_familiale_isole_pension_alimentaire"],
      }],
    };
  }
  function expectPreserved(before: RegulatoryDecision, after: RegulatoryDecision) {
    expect(after.officialOnemState).toEqual(before.officialOnemState);
    expect(after.temporalHistory).toEqual(before.temporalHistory);
    expect(after.article110Decision).toEqual(before.article110Decision);
    expect(after.isolatedHouseholdAssessmentHistory).toEqual(before.isolatedHouseholdAssessmentHistory);
  }

  it.each([
    { professional: "aucun", replacement: "", stopped: true, expectedProfessional: false, expectedReplacement: undefined },
    { professional: "aucun", replacement: "aucun", stopped: true, expectedProfessional: false, expectedReplacement: false },
    { professional: "", replacement: "aucun", stopped: false, expectedProfessional: undefined, expectedReplacement: false },
    { professional: "", replacement: "", stopped: false, expectedProfessional: undefined, expectedReplacement: undefined },
    { professional: "salarie-employe", replacement: "", stopped: false, expectedProfessional: true, expectedReplacement: undefined },
  ])("keeps the child's explicit stop distinct from unknown income ($professional / $replacement)", ({ professional, replacement, stopped, expectedProfessional, expectedReplacement }) => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [{ ...child, typeRevenuPro: "salarie-employe", montantRevenuPro: 100 }] }, now, thresholds)!;
    const savedBefore = structuredClone(before);
    const after = withPersonalSituationTrace(before, {
      dateModificationSituationFamilialeEffective: "2026-10-10",
      cohabitants: [{ ...child, typeRevenuPro: professional, revenuRemplacement: replacement, montantRevenuPro: 100 }],
    }, now, thresholds)!;
    const reasons = after.childrenOnlyAssessment?.changes.map((change) => change.reason);
    expect(reasons?.includes("CHILD_STOPPED_WORK")).toBe(stopped);
    expect(after.childrenOnlyAssessment?.facts[0]).toMatchObject({ hasProfessionalIncome: expectedProfessional, hasReplacementIncome: expectedReplacement });
    if (stopped) expect(after.childrenOnlyAssessment?.changes).toContainEqual(expect.objectContaining({ reason: "CHILD_STOPPED_WORK", effectiveDate: "2026-10-10", current: expect.objectContaining({ hasProfessionalIncome: false }) }));
    if (replacement === "") expect(reasons).toContain("INCOME_CHANGED");
    expectPreserved(before, after);
    expect(before).toEqual(savedBefore);
  });

  it.each([
    { professional: "", replacement: "aucun", stopped: true },
    { professional: "aucun", replacement: "aucun", stopped: true },
    { professional: "aucun", replacement: "", stopped: false },
    { professional: "", replacement: "", stopped: false },
    { professional: "", replacement: "pension", stopped: false },
    { professional: "", replacement: "chomage", stopped: true },
  ])("keeps the parent's explicit pension stop distinct from unknown income ($professional / $replacement)", ({ professional, replacement, stopped }) => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [parent] }, now, thresholds)!;
    const savedBefore = structuredClone(before);
    const after = withPersonalSituationTrace(before, {
      dateModificationSituationFamilialeEffective: "2026-10-10",
      cohabitants: [{ ...parent, typeRevenuPro: professional, revenuRemplacement: replacement }],
    }, now, thresholds)!;
    const reasons = after.relativeHouseholdAssessment?.changes.map((change) => change.reason);
    expect(reasons?.includes("PENSION_STOPPED")).toBe(stopped);
    if (stopped) expect(after.relativeHouseholdAssessment?.changes).toContainEqual(expect.objectContaining({ reason: "PENSION_STOPPED", effectiveDate: "2026-10-10" }));
    if (replacement !== "pension" || professional === "") expect(reasons).toContain("INCOME_CHANGED");
    expectPreserved(before, after);
    expect(before).toEqual(savedBefore);
  });

  const firstJobChild = {
    ...child, typeRevenuPro: "salarie-employe", montantRevenuPro: 100,
    premierRevenuProfessionnel: "oui", demandeNeutralisationPremierRevenu: "oui",
    dateDebutPremiereActivite: "2026-04-01", dateFinEtudes: "2026-03-31",
  };
  it.each([
    { title: "unknown activity", row: { ...firstJobChild, typeRevenuPro: "" } },
    { title: "unknown first-income confirmation", row: { ...firstJobChild, premierRevenuProfessionnel: "" } },
    { title: "explicit activity stop within the calendar period", row: { ...firstJobChild, typeRevenuPro: "aucun" } },
  ])("does not announce a 110&1M expiry from $title", ({ row }) => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [firstJobChild] }, now, thresholds)!;
    const savedBefore = structuredClone(before);
    expect(before.childrenOnlyAssessment?.facts[0].neutralisedBy110_1M).toBe(true);
    const after = withPersonalSituationTrace(before, { cohabitants: [row] }, now, thresholds)!;
    expect(after.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toContain("CHILD_110_1M_ENDED");
    expect(after.childrenOnlyAssessment?.facts[0].firstProfessionalIncome).toBe(row.premierRevenuProfessionnel === "oui" ? true : undefined);
    expect(after.article110Decision?.temporalEffect).toMatchObject({ onemCode: "110&1M", effectiveUntil: "2027-03-31" });
    expect(after.article110Decision?.temporalHistory).toEqual(before.article110Decision?.temporalHistory);
    expectPreserved(before, after);
    expect(before).toEqual(savedBefore);
  });

  it("records an established 110&1M expiry once at the 110&1V boundary", () => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [firstJobChild] }, new Date("2027-03-31T00:00:00Z"), thresholds)!;
    const savedBefore = structuredClone(before);
    const payload = { dateModificationSituationFamilialeEffective: "2027-04-01", cohabitants: [firstJobChild] };
    const after = withPersonalSituationTrace(before, payload, new Date("2027-04-01T00:00:00Z"), thresholds)!;
    expect(after.article110Decision?.temporalEffect).toMatchObject({ onemCode: "110&1V", effectiveFrom: "2027-04-01" });
    expect(after.childrenOnlyAssessment?.changes.filter((change) => change.reason === "CHILD_110_1M_ENDED")).toEqual([expect.objectContaining({ factKey: "c1:id:child", effectiveDate: "2027-04-01" })]);
    expect(after.article110Decision?.temporalHistory).toEqual(expect.arrayContaining(before.article110Decision!.temporalHistory!));
    expect(after.officialOnemState).toEqual(before.officialOnemState);
    expect(after.temporalHistory).toEqual(before.temporalHistory);
    expect(after.isolatedHouseholdAssessmentHistory).toEqual(before.isolatedHouseholdAssessmentHistory);
    expect(before).toEqual(savedBefore);
    const repeated = withPersonalSituationTrace(after, payload, new Date("2027-04-02T00:00:00Z"), thresholds)!;
    expect(repeated.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toContain("CHILD_110_1M_ENDED");
    expect(repeated.article110Decision?.temporalHistory).toEqual(after.article110Decision?.temporalHistory);
  });

  it("establishes expiry for each child independently of the household's single temporal trace", () => {
    const second = { ...firstJobChild, id: "second", dateDebutPremiereActivite: "2026-10-01", dateFinEtudes: "2026-09-30" };
    const payload = { cohabitants: [firstJobChild, second] };
    const before = withPersonalSituationTrace(decision(), payload, new Date("2027-03-31T00:00:00Z"), thresholds)!;
    const after = withPersonalSituationTrace(before, payload, new Date("2027-04-01T00:00:00Z"), thresholds)!;
    expect(after.childrenOnlyAssessment?.changes.filter((change) => change.reason === "CHILD_110_1M_ENDED").map((change) => change.factKey)).toEqual(["c1:id:child"]);
    expect(after.childrenOnlyAssessment?.facts.find((fact) => fact.factKey === "c1:id:second")?.neutralisedBy110_1M).toBe(true);
    expectPreserved(before, after);
  });

  const temporalRows = {
    unknown: { ...firstJobChild, dateDebutPremiereActivite: "", dateFinEtudes: "" },
    active: firstJobChild,
    expired: { ...firstJobChild, dateDebutPremiereActivite: "2025-04-01", dateFinEtudes: "2025-03-31" },
  };
  const expiry = { factKey: "c1:id:child", periodStartedAt: "2025-04-01", reassessmentAt: "2026-04-01" };
  const temporalTransitions = [
    ["unknown", "unknown", false], ["unknown", "active", false], ["unknown", "expired", true],
    ["active", "unknown", false], ["active", "active", false], ["active", "expired", true],
    ["expired", "unknown", false], ["expired", "active", false], ["expired", "expired", false],
  ] as const;
  it.each(temporalTransitions)("handles temporal transition %s -> %s (emit expiry: %s)", (oldState, newState, emit) => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [temporalRows[oldState]] }, now, thresholds)!;
    const savedBefore = structuredClone(before);
    if (oldState === "unknown") expect(before.article110Decision).toMatchObject({ status: "needs_information" });
    const after = withPersonalSituationTrace(before, { cohabitants: [temporalRows[newState]] }, now, thresholds)!;
    const events = after.childrenOnlyAssessment?.changes.filter((change) => change.reason === "CHILD_110_1M_ENDED");
    expect(events).toHaveLength(emit ? 1 : 0);
    expect(after.childrenOnlyAssessment?.declarationRequired).toBe(emit);
    if (newState === "expired") {
      expect(after.article110Decision?.temporalEffect).toMatchObject({ onemCode: "110&1V", reassessmentAt: "2026-04-01" });
      expect(after.reportedChildIncomeExpiries).toContainEqual(expiry);
    } else {
      expect(after.article110Decision?.temporalEffect?.onemCode).toBe(newState === "active" ? "110&1M" : undefined);
      expect(after.reportedChildIncomeExpiries ?? []).toEqual(before.reportedChildIncomeExpiries ?? []);
    }
    expect(after.officialOnemState).toEqual(before.officialOnemState);
    expect(after.temporalHistory).toEqual(before.temporalHistory);
    expect(after.isolatedHouseholdAssessmentHistory).toEqual(before.isolatedHouseholdAssessmentHistory);
    expect(before).toEqual(savedBefore);
  });

  it("reports a corrected expired period even after an expiry was already reported for that child", () => {
    const first = withPersonalSituationTrace(decision(), { cohabitants: [temporalRows.expired] }, now, thresholds)!;
    const corrected = { ...firstJobChild, dateDebutPremiereActivite: "2024-04-01", dateFinEtudes: "2024-03-31" };
    const second = withPersonalSituationTrace(first, { cohabitants: [corrected] }, now, thresholds)!;
    expect(second.childrenOnlyAssessment?.changes).toContainEqual(expect.objectContaining({ reason: "CHILD_110_1M_ENDED", current: expect.objectContaining({ periodStartedAt: "2024-04-01", reassessmentAt: "2025-04-01" }) }));
    expect(second.reportedChildIncomeExpiries).toEqual([expiry, { factKey: "c1:id:child", periodStartedAt: "2024-04-01", reassessmentAt: "2025-04-01" }]);
    const returned = withPersonalSituationTrace(second, { cohabitants: [temporalRows.expired] }, now, thresholds)!;
    expect(returned.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toContain("CHILD_110_1M_ENDED");
    expect(returned.reportedChildIncomeExpiries).toEqual(second.reportedChildIncomeExpiries);
  });

  it("retains reported expiries through unknown answers, branch changes and JSON saves, while permitting a new period", () => {
    const first = withPersonalSituationTrace(decision(), { cohabitants: [temporalRows.expired] }, now, thresholds)!;
    const unknown = withPersonalSituationTrace(first, { cohabitants: [temporalRows.unknown] }, now, thresholds)!;
    const relative = withPersonalSituationTrace(unknown, { cohabitants: [parent] }, now, thresholds)!;
    expect(relative.childrenOnlyAssessment).toBeUndefined();
    const persisted = JSON.parse(JSON.stringify(relative)) as RegulatoryDecision;
    const repeated = withPersonalSituationTrace(persisted, { cohabitants: [temporalRows.expired] }, now, thresholds)!;
    expect(repeated.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toContain("CHILD_110_1M_ENDED");
    expect(repeated.reportedChildIncomeExpiries).toEqual([expiry]);
    const active = withPersonalSituationTrace(repeated, { cohabitants: [firstJobChild] }, now, thresholds)!;
    const next = withPersonalSituationTrace(active, { cohabitants: [firstJobChild] }, new Date("2027-04-01T00:00:00Z"), thresholds)!;
    expect(next.childrenOnlyAssessment?.changes).toContainEqual(expect.objectContaining({ reason: "CHILD_110_1M_ENDED", current: expect.objectContaining({ periodStartedAt: "2026-04-01", reassessmentAt: "2027-04-01" }) }));
    expect(next.reportedChildIncomeExpiries).toHaveLength(2);
  });

  it("deduplicates by the effective period, not by corrections to an occupation begun during studies", () => {
    const row = { ...temporalRows.expired, dateDebutPremiereActivite: "2025-01-01" };
    const before = withPersonalSituationTrace(decision(), { cohabitants: [row] }, now, thresholds)!;
    const after = withPersonalSituationTrace(before, { cohabitants: [{ ...row, dateDebutPremiereActivite: "2025-02-01" }] }, now, thresholds)!;
    expect(after.reportedChildIncomeExpiries).toEqual([expiry]);
    expect(after.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toContain("CHILD_110_1M_ENDED");
  });

  it("distinguishes corrected periods with different starts even when their leap-year expiry date is identical", () => {
    const row = { ...firstJobChild, dateDebutPremiereActivite: "2024-02-28", dateFinEtudes: "2024-02-27" };
    const before = withPersonalSituationTrace(decision(), { cohabitants: [row] }, now, thresholds)!;
    const after = withPersonalSituationTrace(before, { cohabitants: [{ ...row, dateDebutPremiereActivite: "2024-02-29", dateFinEtudes: "2024-02-28" }] }, now, thresholds)!;
    expect(after.reportedChildIncomeExpiries).toEqual([
      { factKey: "c1:id:child", periodStartedAt: "2024-02-28", reassessmentAt: "2025-02-28" },
      { factKey: "c1:id:child", periodStartedAt: "2024-02-29", reassessmentAt: "2025-02-28" },
    ]);
    expect(after.childrenOnlyAssessment?.changes.filter((change) => change.reason === "CHILD_110_1M_ENDED")).toHaveLength(1);
  });

  it("confirms an expired period from an old snapshot with no saved temporal state or prior event", () => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [temporalRows.unknown] }, now, thresholds)!;
    delete before.article110Decision;
    const savedBefore = structuredClone(before);
    const after = withPersonalSituationTrace(before, { cohabitants: [temporalRows.expired] }, now, thresholds)!;
    expect(after.childrenOnlyAssessment).toMatchObject({ declarationRequired: true, changes: expect.arrayContaining([expect.objectContaining({ reason: "CHILD_110_1M_ENDED" })]) });
    expect(after.reportedChildIncomeExpiries).toEqual([expiry]);
    expect(before).toEqual(savedBefore);
  });

  it("confirms a legacy expiry once when the old event has no explicit child/period association", () => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [temporalRows.expired] }, now, thresholds)!;
    delete before.reportedChildIncomeExpiries;
    for (const change of before.childrenOnlyAssessment!.changes) {
      delete change.current?.periodStartedAt;
      delete change.current?.reassessmentAt;
    }
    const savedBefore = structuredClone(before);
    const after = withPersonalSituationTrace(before, { cohabitants: [temporalRows.expired] }, now, thresholds)!;
    expect(after.reportedChildIncomeExpiries).toEqual([expiry]);
    expect(after.childrenOnlyAssessment?.changes.filter((change) => change.reason === "CHILD_110_1M_ENDED")).toHaveLength(1);
    expect(before).toEqual(savedBefore);
    const repeated = withPersonalSituationTrace(after, { cohabitants: [temporalRows.expired] }, now, thresholds)!;
    expect(repeated.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toContain("CHILD_110_1M_ENDED");
  });

  function legacyAfterFirstChildStopped() {
    const a = { ...firstJobChild, id: "A", dateDebutPremiereActivite: "2024-04-01", dateFinEtudes: "2024-03-31" };
    const b = { ...firstJobChild, id: "B", dateDebutPremiereActivite: "2025-04-01", dateFinEtudes: "2025-03-31" };
    const firstFacts = deriveArticle110FactsFromC1({ cohabitants: [a] })!;
    const globalA = preserveArticle110TemporalHistory(undefined, decideArticle110ChildFirstProfessionalIncome(firstFacts, now));
    // Historical record reproduced with e6ca4836: A starts, B is added, A stops.
    // The old compact facts mark only B as first-income, while the global
    // decision still contains A's dates. Neither proves ownership for B.
    const aBefore = { factKey: "c1:id:A", receivesFamilyAllowances: false, hasProfessionalIncome: true, hasReplacementIncome: false, firstProfessionalIncome: true };
    const aAfter = { ...aBefore, hasProfessionalIncome: false, firstProfessionalIncome: false };
    const bFact = { ...aBefore, factKey: "c1:id:B" };
    const snapshot: RegulatoryDecision = {
      ...decision(), article110Decision: globalA,
      childrenOnlyAssessment: {
        expectedCategory: "B", categoryChanged: false, declarationRequired: true,
        facts: [aAfter, bFact], sourceRuleIds: ["situation_familiale_children_only"],
        changes: [
          { reason: "CHILD_STOPPED_WORK", factKey: aAfter.factKey, previous: aBefore, current: aAfter },
          { reason: "CHILD_110_1M_ENDED", factKey: aAfter.factKey, previous: aBefore, current: aAfter },
          { reason: "CHILD_110_1M_ENDED", factKey: bFact.factKey, previous: bFact, current: bFact },
        ],
      },
    };
    return { snapshot, stoppedA: { ...a, typeRevenuPro: "aucun" }, a, b };
  }

  it.each([false, true])("does not assign A's legacy global period to B before a date correction (reordered: %s)", (reordered) => {
    const { snapshot, stoppedA, b } = legacyAfterFirstChildStopped();
    const saved = structuredClone(snapshot);
    const order = <T,>(rows: T[]) => reordered ? [...rows].reverse() : rows;
    const migrated = withPersonalSituationTrace(snapshot, { cohabitants: order([stoppedA, b]) }, now, thresholds)!;
    expect(migrated.reportedChildIncomeExpiries).toEqual(expect.arrayContaining([
      { factKey: "c1:id:A", periodStartedAt: "2024-04-01", reassessmentAt: "2025-04-01" },
      { factKey: "c1:id:B", periodStartedAt: "2025-04-01", reassessmentAt: "2026-04-01" },
    ]));
    expect(migrated.reportedChildIncomeExpiries).not.toContainEqual({ factKey: "c1:id:B", periodStartedAt: "2024-04-01", reassessmentAt: "2025-04-01" });
    const correctedB = { ...b, dateDebutPremiereActivite: "2024-04-01", dateFinEtudes: "2024-03-31" };
    const persisted = JSON.parse(JSON.stringify(migrated)) as RegulatoryDecision;
    const corrected = withPersonalSituationTrace(persisted, { cohabitants: order([stoppedA, correctedB]) }, now, thresholds)!;
    expect(corrected.childrenOnlyAssessment?.changes.filter((change) => change.reason === "CHILD_110_1M_ENDED")).toEqual([
      expect.objectContaining({ factKey: "c1:id:B", current: expect.objectContaining({ periodStartedAt: "2024-04-01", reassessmentAt: "2025-04-01" }) }),
    ]);
    expect(corrected.childrenOnlyAssessment?.declarationRequired).toBe(true);
    const repeated = withPersonalSituationTrace(corrected, { cohabitants: order([correctedB, stoppedA]) }, now, thresholds)!;
    expect(repeated.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toContain("CHILD_110_1M_ENDED");
    expect(repeated.reportedChildIncomeExpiries).toEqual(corrected.reportedChildIncomeExpiries);
    expectPreserved(snapshot, corrected);
    expect(snapshot).toEqual(saved);
  });

  it("keeps certain ledgers distinct from a stale global trace when two children stop and resume", () => {
    const { snapshot, stoppedA, a, b } = legacyAfterFirstChildStopped();
    const migrated = withPersonalSituationTrace(snapshot, { cohabitants: [stoppedA, b] }, now, thresholds)!;
    const savedLedger = structuredClone(migrated.reportedChildIncomeExpiries);
    const stoppedB = { ...b, typeRevenuPro: "aucun" };
    const resumedA = withPersonalSituationTrace(migrated, { cohabitants: [stoppedB, a] }, now, thresholds)!;
    expect(resumedA.childrenOnlyAssessment?.changes.map((change) => [change.reason, change.factKey])).toEqual(expect.arrayContaining([
      ["CHILD_STARTED_WORK", "c1:id:A"], ["CHILD_STOPPED_WORK", "c1:id:B"],
    ]));
    expect(resumedA.reportedChildIncomeExpiries).toEqual(savedLedger);
    const resumedB = withPersonalSituationTrace(resumedA, { cohabitants: [a, b] }, now, thresholds)!;
    expect(resumedB.childrenOnlyAssessment?.changes).toContainEqual(expect.objectContaining({ reason: "CHILD_STARTED_WORK", factKey: "c1:id:B" }));
    expect(resumedB.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toContain("CHILD_110_1M_ENDED");
    expect(resumedB.reportedChildIncomeExpiries).toEqual(savedLedger);
    expectPreserved(snapshot, resumedB);
  });

  it("preserves the reviewer's 1,536 temporal ledger transitions", () => {
    const row = (id: string, job: string, studies: string) => ({ ...firstJobChild, id, dateDebutPremiereActivite: job, dateFinEtudes: studies });
    const aExpiry = { factKey: "c1:id:A", periodStartedAt: "2025-04-01", reassessmentAt: "2026-04-01" };
    const bExpiry = { factKey: "c1:id:A", periodStartedAt: "2024-04-01", reassessmentAt: "2025-04-01" };
    const states = [
      { name: "unknown", payload: { cohabitants: [row("A", "", "")] }, expiries: [] },
      { name: "active", payload: { cohabitants: [row("A", "2026-04-01", "2026-03-31")] }, expiries: [] },
      { name: "expired", payload: { cohabitants: [row("A", "2025-04-01", "2025-03-31")] }, expiries: [aExpiry] },
      { name: "corrected", payload: { cohabitants: [row("A", "2024-04-01", "2024-03-31")] }, expiries: [bExpiry] },
      { name: "equivalent", payload: { cohabitants: [row("A", "2025-02-01", "2025-03-31")] }, expiries: [aExpiry] },
      { name: "relatives", payload: { cohabitants: [{ id: "parent", lien: "pere", typeRevenuPro: "aucun", revenuRemplacement: "aucun" }] }, expiries: [] },
      { name: "empty", payload: { statutFamilial: "cohabite", cohabitants: [] }, expiries: [] },
      { name: "twoChildren", payload: { cohabitants: [row("B", "2024-04-01", "2024-03-31"), row("A", "2025-04-01", "2025-03-31")] }, expiries: [{ ...bExpiry, factKey: "c1:id:B" }, aExpiry] },
    ];
    function freeze(value: unknown) {
      if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
      Object.freeze(value);
      Object.values(value).forEach(freeze);
    }
    let transitions = 0;
    for (const first of states) for (const second of states) for (const third of states) {
      let snapshot = decision();
      const seen = new Set<string>();
      const ledger: NonNullable<RegulatoryDecision["reportedChildIncomeExpiries"]> = [];
      for (const state of [first, second, third]) {
        freeze(snapshot);
        freeze(state.payload);
        const saved = JSON.stringify(snapshot);
        const expected = state.expiries.filter((entry) => !seen.has(JSON.stringify(entry)));
        expected.forEach((entry) => { seen.add(JSON.stringify(entry)); ledger.push(entry); });
        const out = withPersonalSituationTrace(snapshot, state.payload, now, thresholds)!;
        const emitted = out.childrenOnlyAssessment?.changes.filter((change) => change.reason === "CHILD_110_1M_ENDED").map((change) => ({ factKey: change.factKey, periodStartedAt: change.current?.periodStartedAt, reassessmentAt: change.current?.reassessmentAt })) ?? [];
        expect(emitted, [first.name, second.name, third.name].join(" -> ")).toEqual(expected);
        expect(out.reportedChildIncomeExpiries ?? []).toEqual(ledger);
        expect(out.officialOnemState).toEqual(snapshot.officialOnemState);
        expect(JSON.stringify(snapshot)).toBe(saved);
        snapshot = JSON.parse(JSON.stringify(out)) as RegulatoryDecision;
        transitions++;
      }
    }
    expect(transitions).toBe(1_536);
  });

  it("tracks each child's reported period through reordering, removal and reinsertion", () => {
    const second = { ...firstJobChild, id: "second" };
    const first = withPersonalSituationTrace(decision(), { cohabitants: [temporalRows.expired, second] }, now, thresholds)!;
    const reordered = withPersonalSituationTrace(first, { cohabitants: [second, temporalRows.expired] }, now, thresholds)!;
    expect(reordered.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toContain("CHILD_110_1M_ENDED");
    const next = withPersonalSituationTrace(reordered, { cohabitants: [second] }, new Date("2027-04-01T00:00:00Z"), thresholds)!;
    expect(next.childrenOnlyAssessment?.changes.filter((change) => change.reason === "CHILD_110_1M_ENDED").map((change) => change.factKey)).toEqual(["c1:id:second"]);
    const returned = withPersonalSituationTrace(next, { cohabitants: [temporalRows.expired, second] }, new Date("2027-04-01T00:00:00Z"), thresholds)!;
    expect(returned.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toContain("CHILD_110_1M_ENDED");
    expect(returned.reportedChildIncomeExpiries).toEqual([expiry, { factKey: "c1:id:second", periodStartedAt: "2026-04-01", reassessmentAt: "2027-04-01" }]);
    expect(returned.officialOnemState).toEqual(first.officialOnemState);
  });

  it.each([
    { kind: "professional", row: { ...child, typeRevenuPro: "salarie-employe", montantRevenuPro: 100 }, unavailable: { childProfessionalMonthly: null }, reason: "CHILD_STARTED_WORK", currentFact: { hasProfessionalIncome: true } },
    { kind: "replacement", row: { ...child, revenuRemplacement: "chomage", montantRevenuRemplacement: 100 }, unavailable: { childReplacementMonthly: null }, reason: "INCOME_CHANGED", currentFact: { hasReplacementIncome: true } },
  ])("records the known $kind change while the missing ceiling leaves the current category unresolved", ({ row, unavailable, reason, currentFact }) => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [child] }, now, thresholds)!;
    const savedBefore = structuredClone(before);
    expect(before.childrenOnlyAssessment).toMatchObject({ expectedCategory: "A", declarationRequired: false });
    const after = withPersonalSituationTrace(before, {
      dateModificationSituationFamilialeEffective: "2026-10-10", cohabitants: [row],
    }, now, { ...thresholds, ...unavailable })!;
    expect(after.householdAssessment).toMatchObject({ status: "needs_information", expectedCategory: null });
    expect(after.childrenOnlyAssessment).toMatchObject({
      expectedCategory: null, declarationRequired: true,
      facts: [expect.objectContaining({ factKey: "c1:id:child", ...currentFact })],
      changes: expect.arrayContaining([expect.objectContaining({ reason, effectiveDate: "2026-10-10", current: expect.objectContaining(currentFact) })]),
    });
    expectPreserved(before, after);
    expect(before).toEqual(savedBefore);
    const resolved = withPersonalSituationTrace(after, { cohabitants: [row] }, now, thresholds)!;
    expect(resolved.childrenOnlyAssessment).toMatchObject({ expectedCategory: "A", declarationRequired: false, changes: [] });
    expectPreserved(after, resolved);
  });

  it("does not turn unknown activity or allowances into an explicit stop or loss", () => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [{ ...child, allocationsFamiliales: "oui", typeRevenuPro: "salarie-employe", montantRevenuPro: 100 }] }, now, thresholds)!;
    const after = withPersonalSituationTrace(before, { cohabitants: [{ ...child, allocationsFamiliales: "", typeRevenuPro: "" }] }, now, thresholds)!;
    expect(after.childrenOnlyAssessment).toMatchObject({ expectedCategory: null, facts: [expect.objectContaining({ hasProfessionalIncome: undefined, receivesFamilyAllowances: undefined })] });
    expect(after.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toEqual(expect.arrayContaining(["CHILD_STOPPED_WORK"]));
    expect(after.childrenOnlyAssessment?.changes.map((change) => change.reason)).not.toEqual(expect.arrayContaining(["CHILD_LOST_FAMILY_ALLOWANCE"]));
    expectPreserved(before, after);
  });

  it("refreshes a pension trace and its known amount change even when its ceiling is unavailable", () => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [parent] }, now, thresholds)!;
    expect(before.relativeHouseholdAssessment).toMatchObject({ expectedCategory: "A" });
    const after = withPersonalSituationTrace(before, { cohabitants: [{ ...parent, montantRevenuRemplacement: 450 }] }, now, { ...thresholds, ascendantPensionMonthly: null })!;
    expect(after.householdAssessment).toMatchObject({ status: "needs_information", expectedCategory: null });
    expect(after.relativeHouseholdAssessment).toMatchObject({
      expectedCategory: null, declarationRequired: true, facts: [expect.objectContaining({ pensionGrossAmount: 450 })],
      changes: expect.arrayContaining([expect.objectContaining({ reason: "PENSION_AMOUNT_CHANGED" })]),
    });
    expectPreserved(before, after);
  });

  it.each([
    { title: "replacement answer", row: { ...parent, revenuRemplacement: "" } },
    { title: "pension amount", row: { ...parent, montantRevenuRemplacement: undefined } },
  ])("does not infer a pension stop or amount change from an unknown $title", ({ row }) => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [parent] }, now, thresholds)!;
    const after = withPersonalSituationTrace(before, { cohabitants: [row] }, now, thresholds)!;
    expect(after.relativeHouseholdAssessment?.facts[0].pensionGrossAmount).toBeUndefined();
    expect(after.relativeHouseholdAssessment?.changes.map((change) => change.reason)).not.toContain("PENSION_STOPPED");
    expect(after.relativeHouseholdAssessment?.changes.map((change) => change.reason)).not.toContain("PENSION_AMOUNT_CHANGED");
    expectPreserved(before, after);
  });

  it("refreshes a mixed third-party trace when the child's missing ceiling makes its result unresolved", () => {
    const before = withPersonalSituationTrace(decision(), { cohabitants: [child, third] }, now, thresholds)!;
    expect(before.thirdPartyHouseholdAssessment).toMatchObject({ expectedCategory: "A" });
    const after = withPersonalSituationTrace(before, { cohabitants: [{ ...child, typeRevenuPro: "salarie-employe", montantRevenuPro: 100 }, third] }, now, { ...thresholds, childProfessionalMonthly: null })!;
    expect(after.householdAssessment).toMatchObject({ status: "needs_information", expectedCategory: null });
    expect(after.thirdPartyHouseholdAssessment).toMatchObject({ expectedCategory: null, facts: [expect.objectContaining({ factKey: "c1:id:third", professional: false, relevantReplacement: false })] });
    expectPreserved(before, after);
  });

  it("drops derived children and relative conclusions on a branch change and retains the third-party departure event", () => {
    const children = withPersonalSituationTrace(decision(), { cohabitants: [child] }, now, thresholds)!;
    const relatives = withPersonalSituationTrace(children, { cohabitants: [parent] }, now, thresholds)!;
    expect(relatives).not.toHaveProperty("childrenOnlyAssessment");
    expect(relatives.relativeHouseholdAssessment).toMatchObject({ expectedCategory: "A" });
    const mixed = withPersonalSituationTrace(relatives, { cohabitants: [child, third] }, now, thresholds)!;
    expect(mixed).not.toHaveProperty("relativeHouseholdAssessment");
    const empty = withPersonalSituationTrace(mixed, { statutFamilial: "cohabite", cohabitants: [] }, now, thresholds)!;
    expect(empty.householdAssessment).toMatchObject({ status: "needs_information", expectedCategory: null });
    expect(empty).not.toHaveProperty("childrenOnlyAssessment");
    expect(empty).not.toHaveProperty("relativeHouseholdAssessment");
    expect(empty.thirdPartyHouseholdAssessment).toMatchObject({ composition: "none", expectedCategory: null, declarationRequired: true, changes: expect.arrayContaining([expect.objectContaining({ reason: "THIRD_PARTY_LEFT" })]) });
    expectPreserved(children, empty);
  });
});

describe("personal situation change trace", () => {
  it("keeps an absent C1 household inventory unknown instead of treating it as an isolated declaration", () => {
    const facts = deriveFamilyFactsFromC1({});

    expect(facts).toMatchObject({ people: [], householdDeclared: true });
  });

  it("does not calculate an isolated category from an unfinished C1 household", () => {
    const decision = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });

    expect(withPersonalSituationTrace(decision, {})?.householdAssessment).toMatchObject({
      expectedCategory: null,
      status: "needs_information",
      factKeys: ["household.people"],
    });
  });

  it("distinguishes an incomplete income inventory from explicit negative C1 answers", () => {
    const partial = deriveFamilyFactsFromC1({
      cohabitants: [{ lien: "epoux", typeRevenuPro: "aucun" }],
    }).people?.[0];
    const salaried = deriveFamilyFactsFromC1({
      cohabitants: [{ lien: "epoux", typeRevenuPro: "salarie-employe", montantRevenuPro: 900 }],
    }).people?.[0];
    const empty = deriveFamilyFactsFromC1({
      cohabitants: [{ lien: "epoux", typeRevenuPro: "aucun", revenuRemplacement: "aucun" }],
    }).people?.[0];

    expect(partial).toMatchObject({ incomeInventoryComplete: false });
    expect(partial?.incomes).toEqual([]);
    expect(salaried).toMatchObject({ incomeInventoryComplete: false });
    expect(salaried?.incomes).toEqual([expect.objectContaining({ kind: "professional", amount: 900 })]);
    expect(empty).toMatchObject({ incomeInventoryComplete: true, incomes: [] });
  });

  it.each([undefined, "", "  "])("keeps unanswered professional income %s unknown without discarding a declared zero replacement", (answer) => {
    const payload = { cohabitants: [{ lien: "enfant", typeRevenuPro: answer,
      revenuRemplacement: "mutuelle", montantRevenuRemplacement: 0 }] };
    const person = deriveFamilyFactsFromC1(payload).people[0];
    expect(person.incomeInventoryComplete).toBe(false);
    expect(person.incomes).toEqual([expect.objectContaining({ kind: "replacement", amount: 0 })]);
    expect(deriveHouseholdCompositionFromC1(payload).members[0]).toMatchObject({
      hasProfessionalIncome: undefined, hasReplacementIncome: true, replacementIncomeAmount: 0 });
  });

  it("preserves declared professional and replacement incomes without turning document statuses into facts", () => {
    const person = deriveFamilyFactsFromC1({
      cohabitants: [{
        lien: "epoux",
        typeRevenuPro: "salarie-employe",
        montantRevenuPro: 900,
        revenuRemplacement: "pension",
        montantRevenuRemplacement: 500,
        montantPensionNature: "brut",
        preuvePension: "manquante",
        handicapReconnu: "oui",
        preuveHandicap: "non",
        revenuProfessionnelVariable: "oui",
        c110aStatut: "non-recu",
        montantMensuelC110a: 850,
      }],
    }).people?.[0];

    expect(person?.incomes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "professional", amount: 900, monthlyAmount: 850 }),
      expect.objectContaining({ kind: "pension", amount: 500, amountKind: "gross" }),
    ]));
    for (const income of person?.incomes ?? []) {
      expect(income).not.toHaveProperty("c110aReceived");
      expect(income).not.toHaveProperty("pensionProofAvailable");
      expect(income).not.toHaveProperty("disabilityProofAvailable");
    }
  });

  it("keeps C1 person identifiers stable when rows are reordered", () => {
    const rows = [
      { prenom: "Anne", nom: "Martin", dateNaissance: "1980-01-01", lien: "enfant", allocationsFamiliales: "oui", typeRevenuPro: "aucun" },
      { prenom: "Benoît", nom: "Martin", dateNaissance: "2004-01-01", lien: "enfant", allocationsFamiliales: "non", typeRevenuPro: "aucun" },
    ];
    const first = deriveFamilyFactsFromC1({ cohabitants: rows });
    const reordered = deriveFamilyFactsFromC1({ cohabitants: [...rows].reverse() });
    expect(reordered.people.map((person) => person.id).sort()).toEqual(first.people.map((person) => person.id).sort());
  });

  it("does not let C110A availability change a result based on the declared monthly amount", () => {
    const decision = () => decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const payload = (c110aStatut: string) => ({ cohabitants: [{ lien: "epoux", typeRevenuPro: "salarie-employe", montantRevenuPro: 900, typeContratRevenuPro: "cdi", revenuProfessionnelVariable: "oui", c110aStatut, montantMensuelC110a: 900, revenuRemplacement: "aucun" }] });
    const thresholds = { spouseProfessionalMonthly: 1000, childProfessionalMonthly: null, spouseReplacementMonthly: null, childReplacementMonthly: null, source: null };
    expect(withPersonalSituationTrace(decision(), payload("recu"), new Date("2026-10-08T00:00:00Z"), thresholds)?.householdAssessment)
      .toEqual(withPersonalSituationTrace(decision(), payload("non-recu"), new Date("2026-10-08T00:00:00Z"), thresholds)?.householdAssessment);
  });

  it("uses alimony facts, not a judgment-copy status, in the common calculation", () => {
    const decision = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const result = withPersonalSituationTrace(decision, {
      statutFamilial: "isole",
      pensionAlimentaire: "oui",
      pensionAlimentairePaiementEffectif: "oui",
      pensionAlimentaireBaseJuridique: "decision-judiciaire",
      pensionAlimentaireBeneficiaire: "enfant-mineur",
      statutJugementPensionAlimentaire: "pas-encore-recu",
    });
    expect(result?.householdAssessment).toMatchObject({ expectedCategory: "A", sourceRuleIds: ["situation_familiale_isole_pension_alimentaire"] });
    expect(result?.isolatedHouseholdAssessment).toBeUndefined();
  });

  it("maps the C1 alternating-care average and cycle into the shared family facts", () => {
    const facts = deriveFamilyFactsFromC1({
      statutFamilial: "isole",
      hebergementAlterneEnfant: "oui",
      hebergementAlterneJoursMoyensSemaine: 2,
      hebergementAlterneCycle: "trimestriel",
      hebergementAlterneAllocationsFamiliales: "non",
      hebergementAlterneEnfantRevenuPertinent: "non",
      hebergementAlternePieceStatut: "en-cours",
    });
    expect(facts.isolated?.alternatingCare).toEqual({
      averageDaysPerWeek: 2,
      cycle: "quarterly",
      familyAllowances: false,
      childHasRelevantIncome: false,
    });
  });

  it("returns the same family category for equivalent C1 and verifier alternating-care facts", () => {
    const payload = {
      statutFamilial: "isole",
      hebergementAlterneEnfant: "oui",
      hebergementAlterneJoursMoyensSemaine: 2,
      hebergementAlterneCycle: "trimestriel",
      hebergementAlterneAllocationsFamiliales: "non",
      hebergementAlterneEnfantRevenuPertinent: "non",
    };
    const c1 = withPersonalSituationTrace(
      decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } }),
      payload,
    );
    const verifier = evaluateArticle110Verifier({
      thresholds: { spouseProfessionalMonthly: null, childProfessionalMonthly: null, spouseReplacementMonthly: null, childReplacementMonthly: null, source: null },
      isAloneExplicit: true,
      people: [],
      alternatingCare: {
        enabled: true,
        averageDaysPerWeek: 2,
        cycle: "quarterly",
        familyAllowances: false,
        childHasRelevantIncome: false,
      },
    });
    expect(c1?.householdAssessment?.expectedCategory).toBe(verifier.category);
    expect(c1?.householdAssessment?.expectedCategory).toBe("A");
  });

  it("returns the same spouse result for equivalent declared C1 and verifier income facts", () => {
    const thresholds = {
      spouseProfessionalMonthly: 1_000,
      childProfessionalMonthly: 1_000,
      spouseReplacementMonthly: null,
      childReplacementMonthly: null,
      source: null,
    };
    const c1 = withPersonalSituationTrace(
      decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } }),
      { cohabitants: [{ lien: "epoux", typeRevenuPro: "salarie-employe", montantRevenuPro: 900, typeContratRevenuPro: "cdi", revenuProfessionnelVariable: "non", revenuRemplacement: "aucun" }] },
      new Date("2026-10-13T00:00:00Z"),
      thresholds,
    );
    const verifier = evaluateArticle110Verifier({
      thresholds,
      asOf: "2026-10-13",
      people: [{ id: "spouse", relation: "spouse", hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeAmount: 900, professionalIncomeContract: "cdi", professionalIncomeVariable: false, hasReplacementIncome: false }],
    });

    expect(c1?.householdAssessment).toMatchObject({
      expectedCategory: verifier.category,
      operationalArticle: verifier.householdAssessment.operationalArticle,
      monthlyPaymentAssessment: verifier.householdAssessment.monthlyPaymentAssessment,
    });
  });
  it("keeps a previous family status, current status and its own effective date", () => {
    const trace = derivePersonalSituationTrace({
      modificationSituationFamiliale: true,
      previousStatutFamilial: "isole",
      statutFamilial: "cohabite",
      dateModificationSituationFamilialeEffective: "2026-10-15",
    });

    expect(trace.changes).toEqual([{
      factKey: "famille.statut",
      previousValue: "isole",
      currentValue: "cohabite",
      effectiveDate: "2026-10-15",
      source: "c1",
    }]);
  });

  it("keeps two declared changes with independent effective dates", () => {
    const trace = derivePersonalSituationTrace({
      modificationAdresse: true,
      dateModificationAdresseEffective: "2026-10-01",
      modificationSituationFamiliale: true,
      statutFamilial: "cohabite",
      dateModificationSituationFamilialeEffective: "2026-10-15",
    });

    expect(trace.changes.map((change) => [change.factKey, change.effectiveDate])).toEqual([
      ["adresse", "2026-10-01"],
      ["famille.statut", "2026-10-15"],
    ]);
  });

  it("does not invent a family qualification when the previous status is absent", () => {
    const trace = derivePersonalSituationTrace({
      modificationSituationFamiliale: true,
      statutFamilial: "cohabite",
      dateModificationSituationFamilialeEffective: "2026-10-15",
    });

    expect(trace.changes[0]).not.toHaveProperty("previousValue");
    expect(trace.companions).toEqual([]);
  });

  it("traces the sourced C1-Partenaire condition and keeps colocation under review", () => {
    const trace = derivePersonalSituationTrace({
      cohabitants: [{ lien: "FAC", c1PartenaireStatus: "premiere-fois" }],
      cohabiteType: "colocation",
    });

    expect(trace.companions).toEqual(expect.arrayContaining([
      expect.objectContaining({ formSlug: "c1-partenaire", status: "required", sourceRuleIds: ["c1_partenaire_personne_charge"] }),
      expect.objectContaining({ formSlug: "c1-regis", status: "needs_review" }),
    ]));
  });

  it("requires REGIS only for a declared difference with the registers", () => {
    const trace = derivePersonalSituationTrace({ situationCohabitationAmbigue: "oui" });
    expect(trace.companions).toEqual([expect.objectContaining({ formSlug: "c1-regis", status: "required" })]);
  });

  it("collects 110&1M temporal facts without inventing the category-A branch", () => {
    const facts = deriveArticle110FactsFromC1({
      cohabitants: [{
        lien: "enfant",
        premierRevenuProfessionnel: "oui",
        demandeNeutralisationPremierRevenu: "oui",
        dateDebutPremiereActivite: "2026-04-01",
        dateFinEtudes: "2026-03-31",
      }],
    });
    expect(facts).toMatchObject({
      "family.child.firstProfessionalIncome": { value: true },
      "family.child.neutralisationRequested": { value: true },
    });
    expect(facts).not.toHaveProperty("family.categoryA.branchEstablished");
  });

  it("maps C1 relations to a composition without retaining identities", () => {
    const composition = deriveHouseholdCompositionFromC1({
      cohabitants: [
        { lien: "enfant", allocationsFamiliales: "oui" },
        { lien: "aucun-lien", typeRevenuPro: "salarie-employe" },
      ],
    });
    expect(composition).toMatchObject({ kind: "children_and_third_parties" });
    expect(composition.factKeys.join(" ")).not.toContain("prenom");
  });

  it("keeps a cousin outside the relatives branch and sends an unknown relation to review", () => {
    expect(deriveHouseholdCompositionFromC1({ cohabitants: [{ lien: "cousin" }] }).kind).toBe("third_parties_only");
    expect(deriveHouseholdCompositionFromC1({ cohabitants: [{ lien: "inconnu" }] })).toMatchObject({ needsReview: true });
  });

  it("retains an SPF disability allowance but marks it neutral for family-status income", () => {
    const composition = deriveHouseholdCompositionFromC1({
      cohabitants: [{ lien: "pere", revenuRemplacement: "allocation-handicap" }],
    });
    expect(composition.members[0]).toMatchObject({ hasReplacementIncome: true, replacementIncomeRelevantForFamilyStatus: false });
  });

  it("keeps A with a child receiving family allowances and a parent without relevant income", () => {
    const base = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const snapshot = withPersonalSituationTrace(base, {
      cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui", revenuRemplacement: "aucun" }, { lien: "pere", revenuRemplacement: "allocation-handicap" }],
    });
    expect(snapshot?.householdAssessment).toMatchObject({ composition: "children_and_relatives", expectedCategory: "A" });
  });

  it("records a pension change even when the calculated parent branch remains A", () => {
    const base = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const first = withPersonalSituationTrace(base, { cohabitants: [{ lien: "pere", revenuRemplacement: "pension", montantRevenuRemplacement: 500, montantPensionNature: "brut", preuvePension: "recu" }] }, new Date(), { spouseProfessionalMonthly: null, childProfessionalMonthly: null, spouseReplacementMonthly: null, childReplacementMonthly: null, ascendantPensionWithChildMonthly: null, ascendantPensionMonthly: 800, ascendantDisabledPensionMonthly: null, source: null });
    const second = withPersonalSituationTrace(first, { cohabitants: [{ lien: "pere", revenuRemplacement: "pension", montantRevenuRemplacement: 600, montantPensionNature: "brut", preuvePension: "recu" }] }, new Date(), { spouseProfessionalMonthly: null, childProfessionalMonthly: null, spouseReplacementMonthly: null, childReplacementMonthly: null, ascendantPensionWithChildMonthly: null, ascendantPensionMonthly: 800, ascendantDisabledPensionMonthly: null, source: null });
    expect(second?.relativeHouseholdAssessment).toMatchObject({ expectedCategory: "A", categoryChanged: false, declarationRequired: true, changes: expect.arrayContaining([expect.objectContaining({ reason: "PENSION_AMOUNT_CHANGED" })]) });
  });

  it("reclassifies children-only immediately when a tier arrives and requires declaration", () => {
    const base = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const before = withPersonalSituationTrace(base, { cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui", revenuRemplacement: "aucun", typeRevenuPro: "aucun" }] });
    const after = withPersonalSituationTrace(before, { cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui", revenuRemplacement: "aucun", typeRevenuPro: "aucun" }, { lien: "cousin", revenuRemplacement: "aucun", typeRevenuPro: "salarie-employe" }] });
    expect(after?.householdAssessment).toMatchObject({ composition: "children_and_third_parties", expectedCategory: "B" });
    expect(after?.thirdPartyHouseholdAssessment).toMatchObject({ declarationRequired: true, changes: expect.arrayContaining([expect.objectContaining({ reason: "THIRD_PARTY_ARRIVED" })]) });
  });

  it("reclassifies again when the tier leaves", () => {
    const base = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const withTier = withPersonalSituationTrace(base, { cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui", revenuRemplacement: "aucun", typeRevenuPro: "aucun" }, { lien: "cousin", revenuRemplacement: "aucun", typeRevenuPro: "aucun" }] });
    const after = withPersonalSituationTrace(withTier, { cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui", revenuRemplacement: "aucun", typeRevenuPro: "aucun" }] });
    expect(after?.householdAssessment?.composition).toBe("children_only");
    expect(after?.thirdPartyHouseholdAssessment).toMatchObject({ composition: "none", declarationRequired: true, changes: expect.arrayContaining([expect.objectContaining({ reason: "THIRD_PARTY_LEFT" })]) });
  });

  it("uses the declared non-married partner branch in the theoretical simulation", () => {
    expect(deriveHouseholdCompositionFromC1({
      cohabitants: [{ lien: "partenaire", typeRevenuPro: "aucun", revenuRemplacement: "aucun" }],
    })).toMatchObject({ kind: "spouse_or_partner", needsReview: false });
  });

  it("persists the temporal effect beside a recomputed household branch", () => {
    const base = decidePersonalSituation({
      "entry.dossier": { value: "changement-situation-personnelle", origin: "system" },
    });
    const snapshot = withPersonalSituationTrace(base, {
      cohabitants: [
        {
          lien: "enfant",
          premierRevenuProfessionnel: "oui",
          demandeNeutralisationPremierRevenu: "oui",
          dateDebutPremiereActivite: "2026-04-01",
          dateFinEtudes: "2026-03-31",
        },
        { lien: "partenaire", partenaireConditionsEtablies: "oui", typeRevenuPro: "aucun", revenuRemplacement: "aucun" },
      ],
    }, new Date("2026-05-01T00:00:00Z"));
    expect(snapshot?.article110Decision?.temporalEffect).toMatchObject({ onemCode: "110&1M", familyCategory: null });
    expect(snapshot?.householdAssessment).toMatchObject({
      composition: "spouse_or_partner",
      expectedCategory: "A",
    });
  });

  it("preserves the official B / 60B state while C110A evidence makes one month A-rate eligible", () => {
    const base = {
      ...decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } }),
      officialOnemState: { onemCode: "B / 60B", recordedAt: "2026-10-08" },
    };
    const snapshot = withPersonalSituationTrace(base, {
      cohabitants: [{
        lien: "epoux",
        typeRevenuPro: "salarie-employe",
        montantRevenuPro: 900,
        typeContratRevenuPro: "cdi",
        revenuProfessionnelVariable: "oui",
        c110aStatut: "recu",
        montantMensuelC110a: 900,
        revenuRemplacement: "aucun",
      }],
    }, new Date("2026-10-08T00:00:00Z"), {
      spouseProfessionalMonthly: 1000,
      childProfessionalMonthly: null,
      spouseReplacementMonthly: null,
      childReplacementMonthly: null,
      source: null,
    });
    expect(snapshot?.officialOnemState).toEqual(base.officialOnemState);
    expect(snapshot?.householdAssessment).toMatchObject({
      expectedCategory: "B",
      operationalArticle: "60B",
      monthlyPaymentAssessment: "A_RATE",
    });
  });
});

describe("children-only branch and declaration events", () => {
  const decision = () => decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
  const children = (rows: Record<string, unknown>[]) => ({ cohabitants: rows.map((row) => ({ lien: "enfant", revenuRemplacement: "aucun", ...row })) });

  it("1. keeps A when two children receive family allowances", () => {
    const snapshot = withPersonalSituationTrace(decision(), children([{ allocationsFamiliales: "oui" }, { allocationsFamiliales: "oui" }]));
    expect(snapshot?.householdAssessment).toMatchObject({ composition: "children_only", expectedCategory: "A" });
  });

  it("2. records a declaration when one child starts work although another keeps A through family allowances", () => {
    const before = withPersonalSituationTrace(decision(), children([{ allocationsFamiliales: "oui" }, { allocationsFamiliales: "oui", typeRevenuPro: "aucun" }]));
    const after = withPersonalSituationTrace(before, children([{ allocationsFamiliales: "oui" }, { allocationsFamiliales: "non", typeRevenuPro: "salarie-employe" }]));
    expect(after?.childrenOnlyAssessment).toMatchObject({ expectedCategory: "A", categoryChanged: false, declarationRequired: true, changes: expect.arrayContaining([expect.objectContaining({ reason: "CHILD_STARTED_WORK" })]) });
  });

  it("keeps the official ONEM state unchanged while emitting the declaration event", () => {
    const before = withPersonalSituationTrace({ ...decision(), officialOnemState: { onemCode: "A", recordedAt: "2026-10-08" } }, children([{ allocationsFamiliales: "oui" }, { allocationsFamiliales: "oui", typeRevenuPro: "aucun" }]));
    const after = withPersonalSituationTrace(before, children([{ allocationsFamiliales: "oui" }, { allocationsFamiliales: "non", typeRevenuPro: "salarie-employe" }]));
    expect(after?.officialOnemState).toEqual({ onemCode: "A", recordedAt: "2026-10-08" });
    expect(after?.childrenOnlyAssessment?.declarationRequired).toBe(true);
  });

  it("3. expects A when no child has family allowances or relevant income", () => {
    expect(withPersonalSituationTrace(decision(), children([{ allocationsFamiliales: "non", typeRevenuPro: "aucun" }, { allocationsFamiliales: "non", typeRevenuPro: "aucun" }]))?.householdAssessment).toMatchObject({ expectedCategory: "A" });
  });

  it("4. expects B when no child has family allowances and one has an above-threshold declared income", () => {
    expect(withPersonalSituationTrace(decision(), children([{ allocationsFamiliales: "non", typeRevenuPro: "salarie-employe", montantRevenuPro: 1_001 }]), new Date(), {
      spouseProfessionalMonthly: null,
      childProfessionalMonthly: 1_000,
      spouseReplacementMonthly: null,
      childReplacementMonthly: null,
      source: null,
    })?.householdAssessment).toMatchObject({ expectedCategory: "B" });
  });

  it("5. traces 110&1M and the declaration while another child independently keeps A", () => {
    const snapshot = withPersonalSituationTrace(decision(), children([
      { allocationsFamiliales: "oui" },
      { allocationsFamiliales: "non", typeRevenuPro: "salarie-employe", premierRevenuProfessionnel: "oui", demandeNeutralisationPremierRevenu: "oui", dateDebutPremiereActivite: "2026-04-01", dateFinEtudes: "2026-03-31" },
    ]), new Date("2026-05-01T00:00:00Z"));
    expect(snapshot?.householdAssessment).toMatchObject({ expectedCategory: "A" });
    expect(snapshot?.article110Decision?.temporalEffect).toMatchObject({ onemCode: "110&1M" });
  });

  it("6. keeps A after 110&1M ends when another child still receives family allowances", () => {
    const prior = withPersonalSituationTrace(decision(), children([
      { allocationsFamiliales: "oui" },
      { allocationsFamiliales: "non", typeRevenuPro: "salarie-employe", premierRevenuProfessionnel: "oui", demandeNeutralisationPremierRevenu: "oui", dateDebutPremiereActivite: "2026-04-01", dateFinEtudes: "2026-03-31" },
    ]), new Date("2026-05-01T00:00:00Z"));
    const after = withPersonalSituationTrace(prior, children([
      { allocationsFamiliales: "oui" },
      { allocationsFamiliales: "non", typeRevenuPro: "salarie-employe", premierRevenuProfessionnel: "oui", demandeNeutralisationPremierRevenu: "oui", dateDebutPremiereActivite: "2026-04-01", dateFinEtudes: "2026-03-31" },
    ]), new Date("2027-05-01T00:00:00Z"));
    expect(after?.householdAssessment).toMatchObject({ expectedCategory: "A" });
  });

  it("7. leaves children-only when another household relation is declared", () => {
    const snapshot = withPersonalSituationTrace(decision(), { cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui" }, { lien: "pere", revenuRemplacement: "aucun" }] });
    expect(snapshot?.householdAssessment?.composition).not.toBe("children_only");
  });

});
