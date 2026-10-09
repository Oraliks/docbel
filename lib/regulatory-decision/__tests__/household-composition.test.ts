import { describe, expect, it } from "vitest";
import { assessHouseholdBranch, classifyHouseholdComposition } from "../household-composition";

const member = (relation: Parameters<typeof classifyHouseholdComposition>[0][number]["relation"], extra = {}) => ({
  relation,
  factKey: `household.${relation}`,
  ...extra,
});

describe("household composition before Article 110 branch evaluation", () => {
  it("expects B when a parent or ally has relevant professional income", () => {
    const composition = classifyHouseholdComposition([
      member("relative", { hasProfessionalIncome: true }),
      member("relative", { hasProfessionalIncome: true }),
    ]);
    expect(composition.kind).toBe("relatives_only");
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false })).toMatchObject({
      expectedCategory: "B",
      status: "probable",
    });
  });

  it("makes a spouse without income win over parents with income", () => {
    const composition = classifyHouseholdComposition([
      member("relative", { hasProfessionalIncome: true }),
      member("spouse", { hasProfessionalIncome: false, hasReplacementIncome: false }),
    ]);
    expect(composition.kind).toBe("spouse_or_partner");
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false })).toMatchObject({
      expectedCategory: "A",
      status: "probable",
    });
  });

  it("uses the published Article 60 ceiling for a fixed CDI, separately from salary relevance", () => {
    const composition = classifyHouseholdComposition([
      member("spouse", { hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeContract: "cdi", professionalIncomeVariable: false }),
    ]);
    expect(assessHouseholdBranch({
      composition,
      activeChildIncomeNeutralisation: false,
      spouseProfessionalMonthlyThreshold: 1000,
      baremeSource: { fileId: "published-april", fileName: "bareme-04-2026.xlsx", validFrom: new Date("2026-04-01") },
    })).toMatchObject({ expectedCategory: "A", operationalArticle: "60A", incomeAssessment: "not_relevant", baremeSource: { fileId: "published-april", validFrom: "2026-04-01" } });
  });

  it("keeps a salary above the versioned ceiling relevant and expects B", () => {
    const composition = classifyHouseholdComposition([
      member("spouse", { hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 1001, professionalIncomeContract: "cdi", professionalIncomeVariable: false }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000 })).toMatchObject({ expectedCategory: "B", operationalArticle: "none", incomeAssessment: "relevant" });
  });

  it("keeps 60B as the base B treatment while a missing C110A leaves the monthly rate unresolved", () => {
    const composition = classifyHouseholdComposition([
      member("spouse", { hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeContract: "cdi", professionalIncomeVariable: true }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000 })).toMatchObject({ expectedCategory: "B", operationalArticle: "60B", monthlyPaymentAssessment: "NEEDS_C110A", requiredExternalDocument: { document: "C110A", status: "required" } });
  });

  it("uses received C110A evidence only for the monthly rate, never for the base category", () => {
    const base = { hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeContract: "cdi" as const, professionalIncomeVariable: true, c110aReceived: true };
    const under = classifyHouseholdComposition([member("spouse", { ...base, c110aMonthlyDeclaredIncome: 900 })]);
    const over = classifyHouseholdComposition([member("spouse", { ...base, c110aMonthlyDeclaredIncome: 1001 })]);
    expect(assessHouseholdBranch({ composition: under, activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000 })).toMatchObject({ expectedCategory: "B", operationalArticle: "60B", monthlyPaymentAssessment: "A_RATE", monthlyC110aIncome: 900, requiredExternalDocument: { status: "received" } });
    expect(assessHouseholdBranch({ composition: over, activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000 })).toMatchObject({ expectedCategory: "B", operationalArticle: "60B", monthlyPaymentAssessment: "B_RATE", monthlyC110aIncome: 1001 });
  });

  it("does not infer 60A from a fixed CDD alone", () => {
    const composition = classifyHouseholdComposition([
      member("spouse", { hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeContract: "cdd", professionalIncomeVariable: false }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000 })).toMatchObject({ expectedCategory: null, operationalArticle: "needs_review", status: "needs_review" });
  });

  it("safe-fails if the barème is absent", () => {
    const composition = classifyHouseholdComposition([
      member("spouse", { hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeContract: "cdi", professionalIncomeVariable: false }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: null, operationalArticle: "needs_review", status: "needs_information" });
  });

  it("recomputes when the declared contract or income changes", () => {
    const fixed = classifyHouseholdComposition([
      member("spouse", { hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeContract: "cdi", professionalIncomeVariable: false }),
    ]);
    const changed = classifyHouseholdComposition([
      member("spouse", { hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 1100, professionalIncomeContract: "cdd", professionalIncomeVariable: false }),
    ]);
    expect(assessHouseholdBranch({ composition: fixed, activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000 }).operationalArticle).toBe("60A");
    expect(assessHouseholdBranch({ composition: changed, activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000 })).toMatchObject({ expectedCategory: "B", operationalArticle: "none" });
  });

  it("does not require monthly C110A evidence for 60A", () => {
    const composition = classifyHouseholdComposition([
      member("spouse", { hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeContract: "cdi", professionalIncomeVariable: false }),
    ]);
    const assessment = assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000 });
    expect(assessment).toMatchObject({ operationalArticle: "60A", monthlyPaymentAssessment: "A_RATE" });
    expect(assessment).not.toHaveProperty("requiredExternalDocument");
  });

  it("covers children only with family allowances", () => {
    const composition = classifyHouseholdComposition([member("child", { receivesFamilyAllowances: true })]);
    expect(composition.kind).toBe("children_only");
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false }).expectedCategory).toBe("A");
  });

  it("evaluates an active 110&1M in the children-only branch without locking A elsewhere", () => {
    const childrenOnly = classifyHouseholdComposition([member("child", { hasProfessionalIncome: true })]);
    expect(assessHouseholdBranch({ composition: childrenOnly, activeChildIncomeNeutralisation: true })).toMatchObject({
      expectedCategory: "A",
      composition: "children_only",
    });

    const withThirdParty = classifyHouseholdComposition([
      member("child", { hasProfessionalIncome: true }),
      member("third_party", { hasProfessionalIncome: true }),
    ]);
    expect(assessHouseholdBranch({ composition: withThirdParty, activeChildIncomeNeutralisation: true })).toMatchObject({
      expectedCategory: "B",
      composition: "children_and_third_parties",
      status: "probable",
    });
  });

  it("recalculates an active 110&1M through a newly declared partner branch", () => {
    const composition = classifyHouseholdComposition([
      member("child", { hasProfessionalIncome: true }),
      member("partner", { partnerEstablished: true, hasProfessionalIncome: false, hasReplacementIncome: false }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: true })).toMatchObject({
      composition: "spouse_or_partner",
      expectedCategory: "A",
    });
  });

  it("allows another child with family allowances to support A after 110&1M ends", () => {
    const composition = classifyHouseholdComposition([
      member("child", { hasProfessionalIncome: true }),
      member("child", { receivesFamilyAllowances: true }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false })).toMatchObject({
      expectedCategory: "A",
      status: "probable",
    });
  });

  it("does not invent a category when the complete branch is not covered", () => {
    const composition = classifyHouseholdComposition([member("third_party", { hasProfessionalIncome: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false })).toMatchObject({
      expectedCategory: null,
      status: "needs_review",
    });
  });

  it("sends an ambiguous partner relationship to review", () => {
    const composition = classifyHouseholdComposition([member("partner")]);
    expect(composition).toMatchObject({ kind: "mixed_or_unsupported", needsReview: true });
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false }).status).toBe("needs_review");
  });

  it("accepts a non-married partner only after its conditions are established, while a friend stays outside that branch", () => {
    const established = classifyHouseholdComposition([member("partner", { partnerEstablished: true, hasProfessionalIncome: false, hasReplacementIncome: false })]);
    expect(assessHouseholdBranch({ composition: established, activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: "A" });
    const friend = classifyHouseholdComposition([member("third_party", { hasProfessionalIncome: false })]);
    expect(friend.kind).not.toBe("spouse_or_partner");
    expect(assessHouseholdBranch({ composition: friend, activeChildIncomeNeutralisation: false }).status).toBe("needs_review");
  });

  it("keeps an official ONEM code separate from the calculated state", () => {
    const composition = classifyHouseholdComposition([
      member("partner", { partnerEstablished: true, hasProfessionalIncome: false, hasReplacementIncome: false }),
    ]);
    expect(assessHouseholdBranch({
      composition,
      activeChildIncomeNeutralisation: false,
      officialOnemCode: "110&1M",
    })).toMatchObject({
      officialOnemCode: "110&1M",
      expectedCategory: "A",
      recommendedAction: "await_onem_decision",
    });
  });

  it("does not treat an SPF disability allowance as relevant replacement income", () => {
    const composition = classifyHouseholdComposition([
      member("spouse", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeRelevantForFamilyStatus: false }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: "A" });
  });

  it("keeps a pension relevant even when the household member is recognised as disabled", () => {
    const composition = classifyHouseholdComposition([
      member("spouse", { hasProfessionalIncome: false, hasReplacementIncome: true }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: "B" });
  });

  it("A. lets an SPF disability allowance coexist with A for a parent-only household", () => {
    const composition = classifyHouseholdComposition([member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "disability_allowance", replacementIncomeRelevantForFamilyStatus: false })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: "A" });
  });

  it("B. still evaluates an ascendant pension when an SPF disability allowance is also present", () => {
    const composition = classifyHouseholdComposition([member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 900, pensionProofAvailable: true, pensionGrossAmountConfirmed: true, isAscendant: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, ascendantPensionMonthlyThreshold: 800 })).toMatchObject({ expectedCategory: "B" });
  });

  it("C. uses the special pension threshold only with official disability proof", () => {
    const composition = classifyHouseholdComposition([member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 850, pensionProofAvailable: true, pensionGrossAmountConfirmed: true, isAscendant: true, disabilityDeclared: true, disabilityProofAvailable: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, ascendantPensionMonthlyThreshold: 800, ascendantDisabledPensionMonthlyThreshold: 900 })).toMatchObject({ expectedCategory: "A" });
  });

  it("D. requires review rather than applying the special threshold from a declaration alone", () => {
    const composition = classifyHouseholdComposition([member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 850, isAscendant: true, disabilityDeclared: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, ascendantPensionMonthlyThreshold: 800, ascendantDisabledPensionMonthlyThreshold: 900 })).toMatchObject({ status: "needs_information", expectedCategory: null });
  });

  it("requires the SPF Pensions proof before deciding from a declared pension", () => {
    const composition = classifyHouseholdComposition([member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 500, pensionGrossAmountConfirmed: true, isAscendant: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, ascendantPensionMonthlyThreshold: 800 })).toMatchObject({ expectedCategory: null, pensionAssessment: { status: "NEEDS_DOCUMENT", document: "SPF_PENSIONS_PROOF" } });
  });

  it("safe-fails a net pension amount without treating it as a gross amount", () => {
    const composition = classifyHouseholdComposition([member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 500, pensionProofAvailable: true, pensionGrossAmountConfirmed: false, isAscendant: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, ascendantPensionMonthlyThreshold: 800 })).toMatchObject({ expectedCategory: null, pensionAssessment: { status: "NEEDS_INFORMATION" } });
  });

  it("cumulates verified gross pensions before the dated comparison", () => {
    const composition = classifyHouseholdComposition([
      member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 500, pensionProofAvailable: true, pensionGrossAmountConfirmed: true, isAscendant: true }),
      member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 400, pensionProofAvailable: true, pensionGrossAmountConfirmed: true, isAscendant: true }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, ascendantPensionMonthlyThreshold: 800 })).toMatchObject({ expectedCategory: "B", pensionAssessment: { grossTotal: 900 } });
  });

  it("uses the children-and-relatives threshold and never lets 110&1M neutralise a parent pension", () => {
    const composition = classifyHouseholdComposition([
      member("child", { receivesFamilyAllowances: true, hasProfessionalIncome: true, firstProfessionalIncome: true }),
      member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 900, pensionProofAvailable: true, pensionGrossAmountConfirmed: true, isAscendant: true }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: true, neutralisedChildFactKeys: ["household.child"], ascendantPensionWithChildMonthlyThreshold: 800 })).toMatchObject({ composition: "children_and_relatives", expectedCategory: "B" });
  });

  it("evaluates children and a tier as a distinct branch", () => {
    const childAf = member("child", { receivesFamilyAllowances: true, hasProfessionalIncome: false, hasReplacementIncome: false });
    const childNoIncome = member("child", { receivesFamilyAllowances: false, hasProfessionalIncome: false, hasReplacementIncome: false });
    const tierNoIncome = member("third_party", { hasProfessionalIncome: false, hasReplacementIncome: false });
    const tierIncome = member("third_party", { hasProfessionalIncome: true, hasReplacementIncome: false });
    expect(assessHouseholdBranch({ composition: classifyHouseholdComposition([childAf, tierNoIncome]), activeChildIncomeNeutralisation: false })).toMatchObject({ composition: "children_and_third_parties", expectedCategory: "A" });
    expect(assessHouseholdBranch({ composition: classifyHouseholdComposition([childAf, tierIncome]), activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: "B" });
    expect(assessHouseholdBranch({ composition: classifyHouseholdComposition([childNoIncome, tierNoIncome]), activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: "A" });
  });

  it("evaluates parent and mixed child-parent households with a tier", () => {
    const parentNoIncome = member("relative", { hasProfessionalIncome: false, hasReplacementIncome: false });
    const tierNoIncome = member("third_party", { hasProfessionalIncome: false, hasReplacementIncome: false });
    const tierIncome = member("third_party", { hasProfessionalIncome: true, hasReplacementIncome: false });
    const childAf = member("child", { receivesFamilyAllowances: true, hasProfessionalIncome: false, hasReplacementIncome: false });
    expect(assessHouseholdBranch({ composition: classifyHouseholdComposition([parentNoIncome, tierNoIncome]), activeChildIncomeNeutralisation: false })).toMatchObject({ composition: "relatives_and_third_parties", expectedCategory: "A" });
    expect(assessHouseholdBranch({ composition: classifyHouseholdComposition([parentNoIncome, tierIncome]), activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: "B" });
    expect(assessHouseholdBranch({ composition: classifyHouseholdComposition([childAf, parentNoIncome, tierNoIncome]), activeChildIncomeNeutralisation: false })).toMatchObject({ composition: "children_relatives_and_third_parties", expectedCategory: "A" });
    expect(assessHouseholdBranch({ composition: classifyHouseholdComposition([childAf, parentNoIncome, tierIncome]), activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: "B" });
  });

  it("safe-fails a tier with unknown income or a possible unestablished partner", () => {
    expect(assessHouseholdBranch({ composition: classifyHouseholdComposition([member("child", { receivesFamilyAllowances: true }), member("third_party")]), activeChildIncomeNeutralisation: false })).toMatchObject({ status: "needs_information", expectedCategory: null });
    expect(classifyHouseholdComposition([member("partner"), member("third_party")])).toMatchObject({ needsReview: true });
  });

  it("E. uses the threshold supplied by the applicable dated barème", () => {
    const composition = classifyHouseholdComposition([member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 850, pensionProofAvailable: true, pensionGrossAmountConfirmed: true, isAscendant: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, ascendantPensionMonthlyThreshold: 900, baremeSource: { fileId: "2026-09", fileName: "barema20260901-new.xlsx", validFrom: new Date("2026-09-01") } })).toMatchObject({ expectedCategory: "A", baremeSource: { fileName: "barema20260901-new.xlsx", validFrom: "2026-09-01" } });
  });
});
