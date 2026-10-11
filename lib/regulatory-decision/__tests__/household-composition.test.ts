import { describe, expect, it } from "vitest";
import { assessHouseholdBranch, classifyHouseholdComposition, evaluateFamilySituation } from "../household-composition";

const member = (relation: Parameters<typeof classifyHouseholdComposition>[0][number]["relation"], extra = {}) => ({
  relation,
  factKey: `household.${relation}`,
  ...extra,
});

describe("household composition before Article 110 branch evaluation", () => {
  const alternatingCare = (facts: { averageDaysPerWeek?: number; cycle?: "monthly" | "quarterly" | "semiannual" | "annual"; familyAllowances?: boolean; childHasRelevantIncome?: boolean; children?: Array<{ id: string; familyAllowances?: boolean; hasRelevantIncome?: boolean }> }) => evaluateFamilySituation({
    facts: { asOf: "2026-10-10", people: [], isolated: { alternatingCare: facts } },
    activeChildIncomeNeutralisation: false,
  });

  it("uses the average calendar presence threshold for alternating care", () => {
    expect(alternatingCare({ averageDaysPerWeek: 1.99, cycle: "monthly", familyAllowances: true }).expectedCategory).toBe("N");
    expect(alternatingCare({ averageDaysPerWeek: 2, cycle: "monthly", familyAllowances: true })).toMatchObject({ expectedCategory: "A", monthlyPaymentAssessment: "A_RATE", appliesAllWeek: true });
    expect(alternatingCare({ averageDaysPerWeek: 3.5, cycle: "annual", familyAllowances: true }).expectedCategory).toBe("A");
  });

  it("accepts an irregular cycle when its declared monthly average reaches two days", () => {
    expect(alternatingCare({ averageDaysPerWeek: 2, cycle: "monthly", childHasRelevantIncome: false })).toMatchObject({ expectedCategory: "A", status: "probable" });
  });

  it("uses family allowances or the absence of relevant child income, and otherwise applies B", () => {
    expect(alternatingCare({ averageDaysPerWeek: 2, cycle: "annual", familyAllowances: true, childHasRelevantIncome: true }).expectedCategory).toBe("A");
    expect(alternatingCare({ averageDaysPerWeek: 2, cycle: "quarterly", familyAllowances: false, childHasRelevantIncome: false }).expectedCategory).toBe("A");
    expect(alternatingCare({ averageDaysPerWeek: 2, cycle: "semiannual", familyAllowances: false, childHasRelevantIncome: true })).toMatchObject({ expectedCategory: "B", incomeAssessment: "relevant" });
  });

  it("assesses several alternating-care children as one family situation", () => {
    const base = { averageDaysPerWeek: 2, cycle: "annual" as const };
    expect(alternatingCare({ ...base, children: [{ id: "first", familyAllowances: false, hasRelevantIncome: true }, { id: "second", familyAllowances: true, hasRelevantIncome: false }] }).expectedCategory).toBe("A");
    expect(alternatingCare({ ...base, children: [{ id: "first", familyAllowances: false, hasRelevantIncome: false }, { id: "second", familyAllowances: false, hasRelevantIncome: false }] }).expectedCategory).toBe("A");
    expect(alternatingCare({ ...base, children: [{ id: "first", familyAllowances: false, hasRelevantIncome: true }, { id: "second", familyAllowances: false, hasRelevantIncome: false }] }).expectedCategory).toBe("B");
  });

  it("keeps the spouse or partner branch ahead of alternating-care facts", () => {
    const assessment = evaluateFamilySituation({
      facts: {
        asOf: "2026-10-10",
        people: [{ id: "spouse", relation: "spouse", incomes: [] }],
        isolated: { alternatingCare: { averageDaysPerWeek: 2, cycle: "annual", familyAllowances: false, childHasRelevantIncome: true } },
      },
      activeChildIncomeNeutralisation: false,
    });
    expect(assessment).toMatchObject({ composition: "spouse_or_partner", expectedCategory: "A", status: "probable" });
  });

  it("asks only for the alternating-care fact that is missing and retains an established alimony basis", () => {
    expect(alternatingCare({ familyAllowances: true })).toMatchObject({ status: "needs_information", factKeys: ["isolated.alternatingCare.averageDaysPerWeek", "isolated.alternatingCare.cycle"] });
    const withAlimony = evaluateFamilySituation({
      facts: { asOf: "2026-10-10", people: [], isolated: { alimony: { paid: true, admissibleBasis: true, beneficiary: "minor_child" }, alternatingCare: { familyAllowances: true } } },
      activeChildIncomeNeutralisation: false,
    });
    expect(withAlimony).toMatchObject({ expectedCategory: "A", sourceRuleIds: ["situation_familiale_isole_pension_alimentaire"] });
  });

  it("evaluates the shared fact contract, preserving false, zero and multiple incomes", () => {
    const assessment = evaluateFamilySituation({
      facts: {
        asOf: "2026-10-10",
        people: [{
          id: "partner-1",
          relation: "spouse",
          incomes: [
            { kind: "professional", active: true, amount: 0, contract: "cdi", variable: false },
            { kind: "spf_disability", active: true },
          ],
        }],
      },
      activeChildIncomeNeutralisation: false,
      spouseProfessionalMonthlyThreshold: 1000,
    });
    expect(assessment).toMatchObject({ expectedCategory: "A", operationalArticle: "60A", factKeys: ["partner-1"], evaluatedAt: "2026-10-10" });
    expect(assessment.explanation).toContain("charge de famille");
  });

  it("decides the third-parties-only branch from the explicit co-housing fact", () => {
    const facts = { asOf: "2026-10-10", people: [{ id: "roommate", relation: "third_party" as const, incomes: [] }] };
    expect(evaluateFamilySituation({ facts: { ...facts, cohousing: { declared: true } }, activeChildIncomeNeutralisation: false })).toMatchObject({ composition: "third_parties_only", expectedCategory: "N", status: "probable", sourceRuleIds: expect.arrayContaining(["situation_familiale_cohousing"]) });
    expect(evaluateFamilySituation({ facts: { ...facts, cohousing: { declared: false } }, activeChildIncomeNeutralisation: false })).toMatchObject({ composition: "third_parties_only", expectedCategory: "B", status: "probable" });
    expect(evaluateFamilySituation({ facts, activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: null, status: "needs_information", factKeys: ["cohousing.declared"] });
  });

  it("keeps the spouse priority ahead of a co-housing declaration", () => {
    expect(evaluateFamilySituation({
      facts: { asOf: "2026-10-10", cohousing: { declared: true }, people: [{ id: "spouse", relation: "spouse", incomes: [] }, { id: "roommate", relation: "third_party", incomes: [] }] },
      activeChildIncomeNeutralisation: false,
    })).toMatchObject({ composition: "spouse_or_partner", expectedCategory: "A" });
  });

  it("does not neutralise every child's income when only one Article 110 period is active", () => {
    const composition = classifyHouseholdComposition([
      member("child", { factKey: "child-1", hasProfessionalIncome: true, firstProfessionalIncome: true }),
      member("child", { factKey: "child-2", hasProfessionalIncome: true }),
    ]);
    expect(assessHouseholdBranch({
      composition,
      activeChildIncomeNeutralisation: true,
      neutralisedChildFactKeys: ["child-1"],
    })).toMatchObject({ expectedCategory: "B" });
  });

  it("requires family allowances in the children-and-relatives branch", () => {
    const composition = classifyHouseholdComposition([
      member("child", { receivesFamilyAllowances: false, hasProfessionalIncome: false, hasReplacementIncome: false }),
      member("relative", { hasProfessionalIncome: false, hasReplacementIncome: false }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: "B" });
  });

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
    const childrenOnly = classifyHouseholdComposition([member("child", { factKey: "child-110", hasProfessionalIncome: true })]);
    expect(assessHouseholdBranch({ composition: childrenOnly, activeChildIncomeNeutralisation: true, neutralisedChildFactKeys: ["child-110"] })).toMatchObject({
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

  it("asks the co-housing question before deciding the third-parties-only branch", () => {
    const composition = classifyHouseholdComposition([member("third_party", { hasProfessionalIncome: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false })).toMatchObject({
      expectedCategory: null,
      status: "needs_information",
      factKeys: ["cohousing.declared"],
    });
  });

  it("sends an ambiguous partner relationship to review", () => {
    const composition = classifyHouseholdComposition([member("partner")]);
    expect(composition).toMatchObject({ kind: "mixed_or_unsupported", needsReview: true });
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false }).status).toBe("needs_review");
  });

  it("accepts a non-married partner only after its conditions are established, while a friend uses the co-housing branch", () => {
    const established = classifyHouseholdComposition([member("partner", { partnerEstablished: true, hasProfessionalIncome: false, hasReplacementIncome: false })]);
    expect(assessHouseholdBranch({ composition: established, activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: "A" });
    const friend = classifyHouseholdComposition([member("third_party", { hasProfessionalIncome: false })]);
    expect(friend.kind).not.toBe("spouse_or_partner");
    expect(assessHouseholdBranch({ composition: friend, activeChildIncomeNeutralisation: false, cohousingDeclared: false })).toMatchObject({ expectedCategory: "B", status: "probable" });
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
