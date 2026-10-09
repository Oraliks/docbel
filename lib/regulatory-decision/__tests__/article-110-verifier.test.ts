import { describe, expect, it } from "vitest";

import { compareArticle110Verifier, evaluateArticle110Verifier, getArticle110VerifierFormSections } from "../article-110-verifier";

const thresholds = {
  spouseProfessionalMonthly: 1_000,
  childProfessionalMonthly: 1_000,
  spouseReplacementMonthly: 1_000,
  childReplacementMonthly: 1_000,
  ascendantPensionWithChildMonthly: 1_500,
  ascendantPensionMonthly: 1_000,
  ascendantDisabledPensionMonthly: 1_200,
  source: { fileId: "test", fileName: "bareme-test", validFrom: new Date("2026-09-01") },
} as const;

describe("Article 110 verifier adapter", () => {
  it("uses the engine composition to expose only the spouse questions when a spouse is present", () => {
    expect(getArticle110VerifierFormSections({ people: [
      { id: "spouse", label: "Conjoint", relation: "spouse" },
      { id: "parent", label: "Père", relation: "relative", isAscendant: true },
    ] })).toEqual(["partner"]);
  });

  it("does not assume an isolated household before it is explicitly selected", () => {
    expect(getArticle110VerifierFormSections({ people: [] })).toEqual([]);
    expect(getArticle110VerifierFormSections({ people: [], isAloneExplicit: true })).toEqual(["isolated"]);
  });

  it("keeps child and ascendant questions visible for their actual mixed composition", () => {
    expect(getArticle110VerifierFormSections({ people: [
      { id: "child", label: "Enfant", relation: "child" },
      { id: "parent", label: "Mère", relation: "relative", isAscendant: true },
    ] })).toEqual(["children", "relatives"]);
  });
  it("uses spouse priority even when a relative has income", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [
      { id: "spouse", label: "Conjoint", relation: "spouse", hasProfessionalIncome: false, hasReplacementIncome: false },
      { id: "parent", label: "Père", relation: "relative", hasProfessionalIncome: true },
    ] });
    expect(result.expectedCategory).toBe("A");
    expect(result.composition.kind).toBe("spouse_or_partner");
  });

  it("keeps 110&1M temporal information separate from the household result", () => {
    const result = evaluateArticle110Verifier({ assessedAt: new Date("2026-10-08"), thresholds, people: [{
      id: "child", label: "Enfant", relation: "child", hasProfessionalIncome: true, hasReplacementIncome: false,
      firstProfessionalIncome: true, neutralisationRequested: true, firstProfessionalIncomeStartedAt: "2026-09-01", studiesEndedAt: "2026-08-31",
    }] });
    expect(result.article110Decision?.temporalEffect).toMatchObject({ onemCode: "110&1M", reassessmentAt: "2027-09-01" });
    expect(result.expectedCategory).toBe("A");
  });

  it("finds A for children only when a child opens family allowances", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [{
      id: "child", label: "Enfant", relation: "child", receivesFamilyAllowances: true,
      hasProfessionalIncome: false, hasReplacementIncome: false,
    }] });
    expect(result.expectedCategory).toBe("A");
  });

  it("keeps A when one child starts work while another child opens family allowances", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [
      { id: "working", label: "Enfant 1", relation: "child", hasProfessionalIncome: true, hasReplacementIncome: false },
      { id: "allowance", label: "Enfant 2", relation: "child", receivesFamilyAllowances: true, hasProfessionalIncome: false, hasReplacementIncome: false },
    ] });
    expect(result.expectedCategory).toBe("A");
    expect(result.declarationRequired).toBe(true);
  });

  it("uses the pension threshold for a documented ascendant pension below it", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [{
      id: "parent", label: "Père", relation: "relative", isAscendant: true,
      hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension",
      replacementIncomeAmount: 500, pensionProofAvailable: true, pensionGrossAmountConfirmed: true,
    }] });
    expect(result.expectedCategory).toBe("A");
  });

  it("finds B for a documented ascendant pension above its threshold", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [{
      id: "parent", label: "Père", relation: "relative", isAscendant: true,
      hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension",
      replacementIncomeAmount: 1_500, pensionProofAvailable: true, pensionGrossAmountConfirmed: true,
    }] });
    expect(result.expectedCategory).toBe("B");
  });

  it("finds B when a third party has a relevant income", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [
      { id: "child", label: "Enfant", relation: "child", receivesFamilyAllowances: true, hasProfessionalIncome: false, hasReplacementIncome: false },
      { id: "friend", label: "Ami", relation: "third_party", hasProfessionalIncome: true, hasReplacementIncome: false },
    ] });
    expect(result.expectedCategory).toBe("B");
  });

  it("keeps an unestablished partner in review", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [{
      id: "partner", label: "Partenaire", relation: "partner", partnerEstablished: false,
    }] });
    expect(result).toMatchObject({ expectedCategory: null, level: "review" });
  });

  it("lists unanswered partner income facts as information missing", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [{ id: "partner", label: "Conjoint", relation: "spouse" }] });
    expect(result.missingFacts.map((fact) => fact.factKey)).toEqual(["partner.hasProfessionalIncome", "partner.hasReplacementIncome"]);
    expect(result.missingFacts[0]?.label).toContain("conjoint");
  });

  it("removes a missing income fact after an explicit no", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [{ id: "partner", label: "Conjoint", relation: "spouse", hasProfessionalIncome: false, hasReplacementIncome: false }] });
    expect(result.missingFacts).toEqual([]);
  });

  it("requires the gross amount only after an explicit yes", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [{ id: "partner", label: "Conjoint", relation: "spouse", hasProfessionalIncome: true, hasReplacementIncome: false }] });
    expect(result.missingFacts).toContainEqual(expect.objectContaining({ factKey: "partner.professionalIncomeAmount", label: expect.stringContaining("montant brut mensuel") }));
  });

  it("surfaces C110A as an action without turning 60B into A", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [{
      id: "partner", label: "Partenaire", relation: "partner", partnerEstablished: true,
      hasProfessionalIncome: true, professionalIncomeAmount: 900, professionalIncomeContract: "cdd", professionalIncomeVariable: true,
      hasReplacementIncome: false, c110aReceived: false,
    }] });
    expect(result.householdAssessment).toMatchObject({ operationalArticle: "60B", expectedCategory: "B", monthlyPaymentAssessment: "NEEDS_C110A" });
    expect(result.actions).toContain("Fournir le C110A officiel");
  });

  it("makes an explicit cohousing claim a documented review", () => {
    const result = evaluateArticle110Verifier({ thresholds, cohousingClaim: true, people: [] });
    expect(result).toMatchObject({ expectedCategory: null, level: "review" });
    expect(result.actions).toContain("Annexe REGIS");
  });

  it("uses the existing alimony assessment and exposes the pending judgment", () => {
    const established = evaluateArticle110Verifier({ thresholds, people: [], alimony: { enabled: true, beneficiary: "enfant-mineur", paymentEffective: true, legalBasis: "decision-judiciaire", documentStatus: "en-main", effectiveDate: "2026-09-01" } });
    expect(established.isolatedAssessment).toMatchObject({ branch: "alimony", expectedCategory: "A" });
    const pending = evaluateArticle110Verifier({ thresholds, people: [], alimony: { enabled: true, documentStatus: "en-cours" } });
    expect(pending.isolatedAssessment).toMatchObject({ status: "pending_judgment" });
    expect(pending.actions).toContain("Jugement ou acte notarié");
  });

  it("uses the existing alternating-care assessment", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [], alternatingCare: { enabled: true, regular: true, familyAllowances: true, documentStatus: "jugement" } });
    expect(result.isolatedAssessment).toMatchObject({ branch: "alternating_care", expectedCategory: "A" });
  });

  it("compares facts without changing the official ONEM state", () => {
    const before = { thresholds, officialOnemCode: "B", people: [{ id: "child", label: "Enfant", relation: "child" as const, receivesFamilyAllowances: true, hasProfessionalIncome: false, hasReplacementIncome: false }] };
    const after = { ...before, people: [...before.people, { id: "working", label: "Enfant 2", relation: "child" as const, hasProfessionalIncome: true, hasReplacementIncome: false }] };
    const comparison = compareArticle110Verifier(before, after);
    expect(comparison).toMatchObject({ categoryChanged: false, declarationRequired: true, officialOnemCode: "B" });
  });

  it("exposes a complete, actionable contract for a cohousing review", () => {
    const result = evaluateArticle110Verifier({ thresholds, people: [], isAloneExplicit: true, cohousingClaim: true });
    expect(result).toMatchObject({ status: "review", reason: expect.any(String), reviewReason: expect.any(String) });
    expect(result.missingDocuments).toEqual(expect.arrayContaining(["Bail", "Annexe REGIS"]));
    expect(result.nextActions).toContain("Transmettre pour vérification au Bureau du chômage");
    expect(result.potentialOutcome).toContain("N ou A");
  });

  it("never returns an unexplained incomplete result", () => {
    const cases = [
      evaluateArticle110Verifier({ thresholds, people: [] }),
      evaluateArticle110Verifier({ thresholds, people: [{ id: "friend", label: "friend", relation: "third_party" }] }),
      evaluateArticle110Verifier({ thresholds, people: [], isAloneExplicit: true, cohousingClaim: true }),
    ];
    for (const result of cases.filter((result) => result.status !== "complete")) {
      expect(result.reason).not.toBe("");
      expect(result.missingFacts.length > 0 || result.missingDocuments.length > 0 || result.nextActions.length > 0 || result.reviewReason).toBeTruthy();
    }
  });
});
