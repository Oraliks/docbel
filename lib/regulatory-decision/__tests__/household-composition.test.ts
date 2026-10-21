import { describe, expect, it } from "vitest";
import { assessHouseholdBranch, classifyHouseholdComposition, evaluateFamilySituation, type FamilyPerson, type PartnerQualificationData } from "../household-composition";

const member = (relation: Parameters<typeof classifyHouseholdComposition>[0][number]["relation"], extra = {}) => ({
  relation,
  factKey: `household.${relation}`,
  ...extra,
});

describe("prepared strict partner qualification", () => {
  it("does not let a child's family allowances bypass the date coverage of the spouse's salary", () => {
    const result = evaluateFamilySituation({
      facts: { asOf: "2025-10-01", people: [
        { id: "s", relation: "spouse", incomes: [{ kind: "professional", amount: 500, contract: "cdi", variable: false }] },
        { id: "c", relation: "child", receivesFamilyAllowances: true, incomes: [] },
      ] },
      activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000,
      baremeSource: { fileId: "future", fileName: "future.xlsx", validFrom: new Date("2026-09-01") },
    });
    expect(result).toMatchObject({ expectedCategory: null, missingFacts: ["bareme.coverage"] });
  });

  it("does not let one child's neutralisation bypass another child's salary date coverage", () => {
    const result = evaluateFamilySituation({
      facts: { asOf: "2025-10-01", people: [
        { id: "c1", relation: "child", receivesFamilyAllowances: false, incomes: [{ kind: "professional", amount: 500 }] },
        { id: "c2", relation: "child", receivesFamilyAllowances: false, incomes: [{ kind: "professional", amount: 500 }] },
      ] },
      activeChildIncomeNeutralisation: true, neutralisedChildIds: ["c1"], childProfessionalMonthlyThreshold: 1000,
      baremeSource: { fileId: "future", fileName: "future.xlsx", validFrom: new Date("2026-09-01") },
    });
    expect(result).toMatchObject({ expectedCategory: null, missingFacts: ["bareme.coverage"] });
  });

  it("does not neutralise a spouse's replacement income through a simultaneous low salary", () => {
    const result = evaluateFamilySituation({
      facts: { asOf: "2026-10-20", people: [{ id: "s", relation: "spouse", incomeInventoryComplete: true, incomes: [
        { kind: "professional", amount: 500, contract: "cdi", variable: false },
        { kind: "replacement", amount: 1500 },
      ] }] },
      activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000,
      partnerQualificationPolicy: "require_facts",
    });
    expect(result).toMatchObject({ expectedCategory: null, status: "needs_review", missingFacts: ["partnerIncome.mixedIncomeCoverage"] });
  });

  it("keeps neutral SPF disability separate from a spouse's salary assessment", () => {
    const result = evaluateFamilySituation({
      facts: { asOf: "2026-10-20", people: [{ id: "s", relation: "spouse", incomeInventoryComplete: true, incomes: [
        { kind: "professional", amount: 500, contract: "cdi", variable: false },
        { kind: "spf_disability", amount: 1500 },
      ] }] },
      activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000,
      partnerQualificationPolicy: "require_facts",
    });
    expect(result).toMatchObject({ expectedCategory: "A", status: "probable", operationalArticle: "60A" });
  });

  const answer = <T,>(value: T, effectiveAt?: string) => ({ value, origin: "user" as const, sourceField: "test", effectiveAt });
  const qualified: PartnerQualificationData = {
    schemaVersion: 2, declarationStatus: "prepared",
    facts: {
      sameRoof: answer(true), mainlySharedHousekeeping: answer(true), formsDeFactoHousehold: answer(true),
      familyRelationship: answer("none"), childWithFamilyAllowanceEntitlement: answer(false),
      dependentOnParentWithMaintenanceDuty: answer(false), receivesRisOrEquivalent: answer(false),
      dependentOnAnotherUnemployedCohabitant: answer(false), marriedToAnotherPerson: answer(false),
    },
  };
  const evaluate = (people: FamilyPerson[]) => evaluateFamilySituation({
    facts: { asOf: "2026-10-10", people }, activeChildIncomeNeutralisation: false,
    partnerQualificationPolicy: "require_facts",
  });

  it.each([undefined, true, false])("keeps legacy declaration %s unknown", (partnerEstablished) => {
    const person: FamilyPerson = { id: "p", relation: "partner", partnerEstablished, incomes: [] };
    expect(evaluate([person])).toMatchObject({
      status: "needs_information", expectedCategory: null, composition: "spouse_or_partner",
      factKeys: ["p"], partnerQualifications: [{ personId: "p", status: "needs_information" }],
      missingFacts: expect.arrayContaining(["p.partnerQualification.facts.sameRoof"]),
    });
    expect(evaluateFamilySituation({ facts: { asOf: "2026-10-10", people: [person] }, activeChildIncomeNeutralisation: false }))
      .toMatchObject({ status: "probable", expectedCategory: "A" });
  });

  it("requires a complete empty income inventory after material qualification", () => {
    expect(evaluate([{ id: "p", relation: "partner", partnerQualification: qualified, incomes: [] }]))
      .toMatchObject({ status: "probable", expectedCategory: "A", partnerQualifications: [{ status: "eligible_on_facts", declarationStatus: "prepared" }] });
    expect(evaluate([{ id: "p", relation: "partner", partnerQualification: qualified }]))
      .toMatchObject({ status: "needs_information", expectedCategory: null, missingFacts: ["p.incomes"] });
  });

  it("keeps an established spouse priority without demanding partner assimilation facts", () => {
    expect(evaluate([
      { id: "spouse", relation: "spouse", incomes: [] },
      { id: "other", relation: "partner", incomes: [] },
    ])).toMatchObject({ expectedCategory: "A", status: "probable",
      partnerQualifications: [{ personId: "other", status: "needs_information" }] });
  });

  it.each(["first", "last"])("keeps spouse priority when an excluded partner is declared %s", (order) => {
    const spouse: FamilyPerson = { id: "s", relation: "spouse", incomes: [] };
    const excluded: FamilyPerson = { id: "p", relation: "partner", partnerQualification: {
      ...qualified, facts: { ...qualified.facts, familyRelationship: answer("kin_or_ally_through_third_degree") },
    }, incomes: [] };
    const people = order === "first" ? [excluded, spouse] : [spouse, excluded];
    expect(evaluate(people)).toMatchObject({ expectedCategory: "A", status: "probable",
      partnerQualifications: [{ personId: "p", status: "excluded_on_facts", nextStep: "clarify_actual_relationship" }] });
  });

  it("keeps spouse priority over several eligible partner declarations", () => {
    const result = evaluate([
      { id: "p1", relation: "partner", partnerQualification: qualified, incomes: [] },
      { id: "s", relation: "spouse", incomes: [] },
      { id: "p2", relation: "partner", partnerQualification: qualified, incomes: [] },
    ]);
    expect(result).toMatchObject({ expectedCategory: "A", status: "probable",
      partnerQualifications: [{ personId: "p1", status: "eligible_on_facts" }, { personId: "p2", status: "eligible_on_facts" }] });
    expect(result.missingFacts).toBeUndefined();
  });

  it("preserves an excluded person and asks for the actual relationship", () => {
    const result = evaluate([
      { id: "child", relation: "child", receivesFamilyAllowances: true, incomes: [] },
      { id: "p", relation: "partner", partnerQualification: { ...qualified, facts: { receivesRisOrEquivalent: answer(true) } }, incomes: [] },
    ]);
    expect(result).toMatchObject({ expectedCategory: null, composition: "spouse_or_partner", factKeys: ["child", "p"],
      missingFacts: ["p.actualRelationship"], partnerQualifications: [{ personId: "p", status: "excluded_on_facts", preservePartnerCpasContext: true }] });
    expect(result.missingFacts).not.toContain("p.partnerQualification.facts.sameRoof");
  });

  it("does not erase RIS context when another qualified person has no income", () => {
    expect(evaluate([
      { id: "qualified", relation: "partner", partnerQualification: qualified, incomes: [] },
      { id: "ris", relation: "partner", partnerQualification: { ...qualified, facts: { receivesRisOrEquivalent: answer(true) } }, incomes: [] },
    ])).toMatchObject({ expectedCategory: null, missingFacts: ["ris.actualRelationship"],
      partnerQualifications: [{ personId: "qualified", status: "eligible_on_facts" },
        { personId: "ris", status: "excluded_on_facts", preservePartnerCpasContext: true }] });
  });

  it("retains identity, effective dates, documentary status and all unresolved candidates", () => {
    const future = { ...qualified, declarationStatus: "submitted" as const, facts: { ...qualified.facts, sameRoof: answer(true, "2026-10-11") } };
    const people: FamilyPerson[] = [
      { id: "second", relation: "partner", partnerQualification: future, incomes: [] },
      { id: "first", relation: "partner", partnerEstablished: false, partnerQualification: { ...qualified, declarationStatus: "submitted" }, incomes: [] },
    ];
    const result = evaluate(people);
    expect(result).toMatchObject({ expectedCategory: null, partnerQualifications: [
      { personId: "second", status: "needs_information", missingFactKeys: expect.arrayContaining(["sameRoof"]) },
      { personId: "first", status: "eligible_on_facts", declarationStatus: "submitted" },
    ] });
    const unresolved = evaluate(people.map((person) => ({ ...person, partnerQualification: future })));
    expect(unresolved.expectedCategory).toBeNull();
    expect(unresolved.missingFacts).toEqual(expect.arrayContaining([
      "second.partnerQualification.facts.sameRoof", "first.partnerQualification.facts.sameRoof",
    ]));
    expect(evaluate(people.map((person) => ({ ...person, partnerQualification: qualified }))))
      .toMatchObject({ status: "needs_review", expectedCategory: null, missingFacts: ["household.partnerPriority"] });
  });

  it("does not present an incomplete 60B month as a category", () => {
    const result = evaluateFamilySituation({
      facts: { asOf: "2026-10-10", people: [{ id: "p", relation: "partner", partnerQualification: qualified,
        incomes: [{ kind: "professional", amount: 500, contract: "cdd", variable: true }] }] },
      activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1_000,
      partnerQualificationPolicy: "require_facts",
    });
    expect(result).toMatchObject({ status: "needs_information", expectedCategory: null,
      missingFacts: ["p.incomes.0.monthlyAmount"] });
  });

  it("uses the existing 60A branch when fixed CDI facts and the dated ceiling are complete", () => {
    const result = evaluateFamilySituation({
      facts: { asOf: "2026-10-10", people: [{ id: "p", relation: "partner", partnerQualification: qualified,
        incomes: [{ kind: "professional", amount: 500, contract: "cdi", variable: false }] }] },
      activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1_000,
      partnerQualificationPolicy: "require_facts",
    });
    expect(result).toMatchObject({ status: "probable", expectedCategory: "A", operationalArticle: "60A" });
    expect(result.sourceRuleIds).toContain("situation_familiale_conjoint_revenus_conditions_am60");
  });

  it.each([
    [{ kind: "pension" as const, amountKind: "gross" as const }, "p.incomes.0.amount"],
    [{ kind: "pension" as const, amount: 100, amountKind: "gross" as const }, "partnerIncome.article60Coverage"],
    [{ kind: "pension" as const, amount: 100 }, "p.incomes.0.amountKind"],
    [{ kind: "replacement" as const }, "p.incomes.0.amount"],
    [{ kind: "professional" as const, amount: 1500, contract: "cdd" as const, variable: true }, "p.incomes.0.monthlyAmount"],
    [{ kind: "professional" as const, amount: 1500, contract: "cdd" as const, variable: true, monthlyAmount: 1500 }, "partnerIncome.article60Coverage"],
  ])("preserves missing partner facts while evaluating complete dated income facts %j", (income, missingFact) => {
    const result = evaluateFamilySituation({
      facts: { asOf: "2026-10-10", people: [{ id: "p", relation: "partner", partnerQualification: qualified,
        incomes: [income] }] },
      activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1_000,
      baremeSource: { fileId: "2026-09", fileName: "2026-09.xlsx", validFrom: new Date("2026-09-01") },
      partnerQualificationPolicy: "require_facts",
    });
    if (missingFact === "partnerIncome.article60Coverage") {
      expect(result).toMatchObject(income.kind === "pension"
        ? { expectedCategory: null, status: "needs_review", missingFacts: [missingFact] }
        : { expectedCategory: "B", status: "probable" });
    } else {
      expect(result).toMatchObject({ expectedCategory: null, missingFacts: [missingFact] });
    }
  });

  it("requires the dated professional threshold before reaching unsupported AM60 coverage", () => {
    const facts = { asOf: "2026-10-10", people: [{ id: "p", relation: "partner" as const,
      partnerQualification: qualified, incomes: [{ kind: "professional" as const, amount: 1500, contract: "cdd" as const,
        variable: true, monthlyAmount: 1500 }] }] };
    const noThreshold = evaluateFamilySituation({ facts, activeChildIncomeNeutralisation: false,
      spouseProfessionalMonthlyThreshold: null, partnerQualificationPolicy: "require_facts" });
    expect(noThreshold).toMatchObject({ status: "needs_information", expectedCategory: null,
      missingFacts: ["bareme.spouseProfessionalMonthly"] });
    const afterDate = evaluateFamilySituation({ facts: { ...facts, asOf: "2026-08-31" },
      activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000,
      baremeSource: { fileId: "2026-09", fileName: "2026-09.xlsx", validFrom: new Date("2026-09-01") },
      partnerQualificationPolicy: "require_facts" });
    expect(afterDate).toMatchObject({ expectedCategory: null, missingFacts: ["bareme.coverage"] });
  });
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

  it("does not equate unknown alimony payment with an explicitly stopped payment", () => {
    const assess = (paid?: boolean) => evaluateFamilySituation({
      facts: { asOf: "2026-10-17", people: [], isolated: { alimony: { paid } } },
      activeChildIncomeNeutralisation: false,
    });
    expect(assess()).toMatchObject({ status: "needs_information", expectedCategory: null,
      missingFacts: expect.arrayContaining(["isolated.alimony.paid"]) });
    expect(assess(false)).toMatchObject({ status: "probable", expectedCategory: "N" });
    expect(assess(true)).toMatchObject({ status: "needs_information", expectedCategory: null });
  });

  it.each([{}, { paid: true }, { paid: true, admissibleBasis: true }])(
    "retains the existing alternating-care A result with incomplete alimony facts %j", (alimony) => {
    const facts = { asOf: "2026-10-17", people: [], isolated: {
      alimony, alternatingCare: { averageDaysPerWeek: 2, cycle: "monthly" as const, familyAllowances: true },
    } };
    expect(evaluateFamilySituation({ facts, activeChildIncomeNeutralisation: false })).toMatchObject({
      status: "probable", expectedCategory: "A", sourceRuleIds: ["situation_familiale_isole_garde_alternee"],
    });
    facts.isolated.alternatingCare.familyAllowances = false;
    expect(evaluateFamilySituation({ facts: { ...facts, isolated: { ...facts.isolated,
      alternatingCare: { ...facts.isolated.alternatingCare, childHasRelevantIncome: true },
    } }, activeChildIncomeNeutralisation: false })).toMatchObject({ status: "needs_information", expectedCategory: null });
  });

  it("uses N only for an established autonomous co-housing and keeps pending B administrative", () => {
    const facts = { asOf: "2026-10-10", people: [{ id: "roommate", relation: "third_party" as const, incomes: [] }] };
    expect(evaluateFamilySituation({ facts: { ...facts, cohousing: { declared: true } }, activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: null, status: "needs_information", factKeys: ["cohousing.autonomousLiving"] });
    expect(evaluateFamilySituation({ facts: { ...facts, cohousing: { declared: true, autonomousLiving: true, recognition: "pending" } }, activeChildIncomeNeutralisation: false })).toMatchObject({ composition: "third_parties_only", expectedCategory: "N", status: "probable", administrativeTreatment: { provisionalCategory: "B", recognition: "pending", decisionNeeded: true } });
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
      member("child", { factKey: "child-1", hasProfessionalIncome: true, firstProfessionalIncome: true, receivesFamilyAllowances: false }),
      member("child", { factKey: "child-2", hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 101, receivesFamilyAllowances: false }),
    ]);
    expect(assessHouseholdBranch({
      composition,
      activeChildIncomeNeutralisation: true,
      neutralisedChildFactKeys: ["child-1"],
      childProfessionalMonthlyThreshold: 100,
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

  it("keeps 60B as the base B treatment while a missing monthly declaration leaves the rate unresolved", () => {
    const composition = classifyHouseholdComposition([
      member("spouse", { hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeContract: "cdi", professionalIncomeVariable: true }),
    ]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000 })).toMatchObject({ expectedCategory: "B", operationalArticle: "60B", monthlyPaymentAssessment: "NEEDS_REVIEW" });
  });

  it("uses the declared monthly amount only for the monthly rate, never for the base category", () => {
    const base = { hasProfessionalIncome: true, hasReplacementIncome: false, professionalIncomeAmount: 900, professionalIncomeContract: "cdi" as const, professionalIncomeVariable: true };
    const under = classifyHouseholdComposition([member("spouse", { ...base, c110aMonthlyDeclaredIncome: 900 })]);
    const over = classifyHouseholdComposition([member("spouse", { ...base, c110aMonthlyDeclaredIncome: 1001 })]);
    expect(assessHouseholdBranch({ composition: under, activeChildIncomeNeutralisation: false, spouseProfessionalMonthlyThreshold: 1000 })).toMatchObject({ expectedCategory: "B", operationalArticle: "60B", monthlyPaymentAssessment: "A_RATE", monthlyC110aIncome: 900 });
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

  it("does not apply a later barème to a threshold-dependent historical income", () => {
    const assessment = evaluateFamilySituation({
      facts: {
        asOf: "2026-01-31",
        people: [{
          id: "spouse",
          relation: "spouse",
          incomes: [{ kind: "professional", active: true, amount: 900, contract: "cdi", variable: false }],
        }],
      },
      activeChildIncomeNeutralisation: false,
      spouseProfessionalMonthlyThreshold: 1_000,
      baremeSource: { fileId: "april", fileName: "bareme-04-2026.xlsx", validFrom: new Date("2026-04-01") },
    });

    expect(assessment).toMatchObject({
      status: "needs_information",
      expectedCategory: null,
      factKeys: ["bareme.coverage"],
      sourceRuleIds: [],
    });
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

  it("uses a declared partner branch without an administrative precondition", () => {
    const composition = classifyHouseholdComposition([member("partner")]);
    expect(composition).toMatchObject({ kind: "spouse_or_partner", needsReview: false });
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false })).toMatchObject({ status: "needs_information" });
  });

  it("uses the declared partner branch while a friend remains in the co-housing branch", () => {
    const declared = classifyHouseholdComposition([member("partner", { hasProfessionalIncome: false, hasReplacementIncome: false })]);
    expect(assessHouseholdBranch({ composition: declared, activeChildIncomeNeutralisation: false })).toMatchObject({ expectedCategory: "A" });
    const friend = classifyHouseholdComposition([member("third_party", { hasProfessionalIncome: false })]);
    expect(friend.kind).not.toBe("spouse_or_partner");
    expect(assessHouseholdBranch({ composition: friend, activeChildIncomeNeutralisation: false, cohousing: { declared: false } })).toMatchObject({ expectedCategory: "B", status: "probable" });
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

  it("C. uses the special pension threshold from the declared situation, not the availability of an attestation", () => {
    const composition = classifyHouseholdComposition([member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 850, pensionGrossAmountConfirmed: true, isAscendant: true, disabilityDeclared: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, ascendantPensionMonthlyThreshold: 800, ascendantDisabledPensionMonthlyThreshold: 900 })).toMatchObject({ expectedCategory: "A" });
  });

  it("D. does not require a disability document to apply the declared situation", () => {
    const composition = classifyHouseholdComposition([member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 850, pensionGrossAmountConfirmed: true, isAscendant: true, disabilityDeclared: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, ascendantPensionMonthlyThreshold: 800, ascendantDisabledPensionMonthlyThreshold: 900 })).toMatchObject({ status: "probable", expectedCategory: "A" });
  });

  it("uses a declared gross pension without making a document available a condition of the simulation", () => {
    const composition = classifyHouseholdComposition([member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 500, pensionGrossAmountConfirmed: true, isAscendant: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, ascendantPensionMonthlyThreshold: 800 })).toMatchObject({ expectedCategory: "A", pensionAssessment: { status: "VERIFIED", grossTotal: 500 } });
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

  it("safe-fails a tier with unknown income while a declared partner remains priority", () => {
    expect(assessHouseholdBranch({ composition: classifyHouseholdComposition([member("child", { receivesFamilyAllowances: true }), member("third_party")]), activeChildIncomeNeutralisation: false })).toMatchObject({ status: "needs_information", expectedCategory: null });
    expect(classifyHouseholdComposition([member("partner"), member("third_party")])).toMatchObject({ kind: "spouse_or_partner", needsReview: false });
  });

  it("E. uses the threshold supplied by the applicable dated barème", () => {
    const composition = classifyHouseholdComposition([member("relative", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: 850, pensionProofAvailable: true, pensionGrossAmountConfirmed: true, isAscendant: true })]);
    expect(assessHouseholdBranch({ composition, activeChildIncomeNeutralisation: false, ascendantPensionMonthlyThreshold: 900, baremeSource: { fileId: "2026-09", fileName: "barema20260901-new.xlsx", validFrom: new Date("2026-09-01") } })).toMatchObject({ expectedCategory: "A", baremeSource: { fileName: "barema20260901-new.xlsx", validFrom: "2026-09-01" } });
  });
});
