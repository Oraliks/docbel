import { describe, expect, it } from "vitest"
import { Children, isValidElement, type ReactNode } from "react"

import { article110VerifierFacts, evaluateArticle110Verifier } from "@/lib/regulatory-decision/article-110-verifier"
import { buildFamilySituationEvaluationInput, canShowFamilySituationCategory, namedPensionAmounts, pensionAmountsByPerson, SummaryStep, type Person, type ChildFirstEmployment, type RelativeOtherIncomes, type RelativePensionStatus, ChildrenFirstEmploymentStep, PensionAmountsStep, childIncomeCollectionState, updateChildIncomeEntry, relativePensionCollectionState, resolveFamilySituationThresholds } from "@/app/outils/ma-situation-familiale/family-situation-client"

const thresholds = { spouseProfessionalMonthly: null, childProfessionalMonthly: null, spouseReplacementMonthly: null, childReplacementMonthly: null, ascendantPensionWithChildMonthly: null, ascendantPensionMonthly: null, ascendantDisabledPensionMonthly: null, source: null }

const pensionThresholds = { ...thresholds, ascendantPensionMonthly: 800, ascendantDisabledPensionMonthly: 900 }

describe("public family-situation paths use the shared Article 110 engine", () => {
  it("returns isolated for a person explicitly living alone", () => {
    expect(evaluateArticle110Verifier({ thresholds, asOf: "2026-10-18", isAloneExplicit: true, people: [] }).category).toBe("N")
  })

  it("keeps the owner-approved children and relatives case as cohabitant without family allowances", () => {
    const result = evaluateArticle110Verifier({ thresholds, asOf: "2026-10-18", anyChildReceivesFamilyAllowances: false, people: [
      { id: "child", relation: "child", receivesFamilyAllowances: false, hasProfessionalIncome: false, hasReplacementIncome: false },
      { id: "parent", relation: "relative", isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: false },
    ] })
    expect(result.category).toBe("B")
    expect(result.reason).toBe("Les faits déclarés correspondent à la situation théorique retenue pour ce ménage avec enfants et parents ou famille, sans allocations familiales déclarées.")
  })

  it("returns A for the two approved no-income paths exposed by the public journey", () => {
    const childOnly = buildFamilySituationEvaluationInput({
      thresholds, date: "18/10/2026", intent: "current", livesAlone: false,
      people: [{ id: "child", name: "Léa", relation: "child" }],
      answers: { childrenAllowance: "no", childrenIncome: "no" }, partnerAmount: "", relativeAmount: "",
    })
    const relativesOnly = buildFamilySituationEvaluationInput({
      thresholds, date: "18/10/2026", intent: "current", livesAlone: false,
      people: [{ id: "family", name: "Camille", relation: "family" }],
      answers: { relativeIncome: "no" }, partnerAmount: "", relativeAmount: "",
    })
    expect(evaluateArticle110Verifier(childOnly)).toMatchObject({ category: "A", householdAssessment: { status: "probable" } })
    const twoChildren = buildFamilySituationEvaluationInput({
      thresholds, date: "18/10/2026", intent: "current", livesAlone: false,
      people: [{ id: "lea", name: "Léa", relation: "child" }, { id: "noe", name: "Noé", relation: "child" }],
      answers: { childrenAllowance: "no", childrenIncome: "no" }, partnerAmount: "", relativeAmount: "",
    })
    expect(evaluateArticle110Verifier(twoChildren)).toMatchObject({ category: "A", householdAssessment: { status: "probable" } })
    expect(evaluateArticle110Verifier(relativesOnly)).toMatchObject({ category: "A", householdAssessment: { status: "probable" } })
  })

  it("only exposes partner results after the existing qualification facts are complete", () => {
    const partner = [{ id: "partner", name: "Sam", relation: "partner" as const }]
    const incomplete = evaluateArticle110Verifier(buildFamilySituationEvaluationInput({
      thresholds, date: "18/10/2026", intent: "current", livesAlone: false, people: partner,
      answers: { partnerSituation: "noIncome" }, partnerAmount: "", relativeAmount: "",
    }))
    expect(incomplete).toMatchObject({ category: null, householdAssessment: { status: "needs_information" } })
    expect(incomplete.missingFacts.map((fact) => fact.factKey)).toContain("partner.partnerQualification.facts.sameRoof")

    const qualified = evaluateArticle110Verifier(buildFamilySituationEvaluationInput({
      thresholds, date: "18/10/2026", intent: "current", livesAlone: false, people: partner,
      answers: {
        partnerSituation: "noIncome", partnerSameRoof: "yes", partnerSharedHousekeeping: "yes", partnerDeFactoHousehold: "yes",
        partnerFamilyRelationship: "no", partnerChildAllowance: "no", partnerParentMaintenance: "no", partnerRis: "no",
        partnerOtherUnemployed: "no", partnerMarriedAnother: "no",
      }, partnerAmount: "", relativeAmount: "",
    }))
    expect(qualified).toMatchObject({ category: "A", householdAssessment: { status: "probable" } })
  })

  it("distinguishes a variable partner monthly payment assessment from the family category", () => {
    const partner = [{ id: "spouse", name: "Sam", relation: "spouse" as const }]
    const common = {
      thresholds: { ...thresholds, spouseProfessionalMonthly: 1000 }, date: "18/10/2026", intent: "current" as const, livesAlone: false,
      people: partner, answers: { partnerSituation: "employee", partnerFixed: "variable", partnerContract: "temporary" }, partnerAmount: "900", relativeAmount: "",
    }
    const missingC110a = evaluateArticle110Verifier(buildFamilySituationEvaluationInput(common))
    expect(missingC110a).toMatchObject({ category: null, householdAssessment: { status: "needs_information" } })
    expect(missingC110a.missingFacts.map((fact) => fact.factKey)).toContain("spouse.incomes.0.monthlyAmount")
    expect(evaluateArticle110Verifier(buildFamilySituationEvaluationInput({ ...common, partnerC110aAmount: "900" })))
      .toMatchObject({ category: null, householdAssessment: { status: "needs_review", operationalArticle: "60B", monthlyPaymentAssessment: "NEEDS_REVIEW" } })
    expect(evaluateArticle110Verifier(buildFamilySituationEvaluationInput({ ...common, partnerC110aAmount: "1200" })))
      .toMatchObject({ category: "B", householdAssessment: { status: "probable", monthlyPaymentAssessment: "B_RATE" } })
  })

  it("uses the dated partner ceiling for a complete fixed CDI salary", () => {
    const result = evaluateArticle110Verifier(buildFamilySituationEvaluationInput({
      thresholds: { ...thresholds, spouseProfessionalMonthly: 1000 }, date: "18/10/2026", intent: "current", livesAlone: false,
      people: [{ id: "spouse", name: "Sam", relation: "spouse" }],
      answers: { partnerSituation: "employee", partnerFixed: "fixed", partnerContract: "cdi" },
      partnerAmount: "1000", relativeAmount: "",
    }))
    expect(result).toMatchObject({ category: "A", householdAssessment: { status: "probable", operationalArticle: "60A" } })
  })

  it("does not turn an unknown partner income into a category", () => {
    const result = evaluateArticle110Verifier({ thresholds, asOf: "2026-10-18", people: [{ id: "partner", relation: "partner" }] })
    expect(result.category).toBeNull()
  })

  it("forwards a sole child’s complete first-employment dates to the shared twelve-month neutralisation", () => {
    const child = [{ id: "lea", name: "Léa", relation: "child" as const }]
    const input = buildFamilySituationEvaluationInput({
      thresholds,
      date: "20/10/2026",
      intent: "current",
      livesAlone: false,
      people: child,
      answers: { childrenAllowance: "no", childrenIncome: "yes", childFirstWork: "yes" },
      partnerAmount: "",
      relativeAmount: "",
      studiesEndedAt: "01/02/2026",
      workStartedAt: "20/01/2026",
    })
    expect(input.people[0]).toMatchObject({ hasProfessionalIncome: true, firstProfessionalIncome: true, studiesEndedAt: "2026-02-01", firstProfessionalIncomeStartedAt: "2026-01-20" })
    expect(input.people[0].neutralisationRequested).toBe(true)
    expect(evaluateArticle110Verifier(input)).toMatchObject({ category: "A", appliedTreatments: { neutralisedChildIds: ["lea"] } })
  })

  it("does not turn an invalid first-employment date into a neutralisation request", () => {
    const input = buildFamilySituationEvaluationInput({
      thresholds,
      date: "20/10/2026",
      intent: "current",
      livesAlone: false,
      people: [{ id: "lea", name: "Léa", relation: "child" }],
      answers: { childrenAllowance: "no", childrenIncome: "yes", childFirstWork: "yes" },
      partnerAmount: "",
      relativeAmount: "",
      studiesEndedAt: "31/02/2026",
      workStartedAt: "20/01/2026",
    })
    expect(input.people[0].neutralisationRequested).toBeUndefined()
    expect(evaluateArticle110Verifier(input)).toMatchObject({ category: null, appliedTreatments: { neutralisedChildIds: [] } })
  })

  it("assigns first-employment facts only to the identified child", () => {
    const input = buildFamilySituationEvaluationInput({
      thresholds,
      date: "20/10/2026",
      intent: "current",
      livesAlone: false,
      people: [{ id: "lea", name: "Léa", relation: "child" }, { id: "noe", name: "Noé", relation: "child" }],
      answers: { childrenAllowance: "no", childrenIncome: "yes", childFirstWork: "yes" },
      partnerAmount: "",
      relativeAmount: "",
      childFirstEmployment: {
        lea: { hasIncome: "yes", incomeKind: "professional", firstWork: "yes", studiesEndedAt: "01/02/2026", workStartedAt: "20/01/2026" },
        noe: { hasIncome: "no" },
      },
    })
    expect(input.people.map((person) => person.firstProfessionalIncome)).toEqual([true, undefined])
    expect(evaluateArticle110Verifier(input)).toMatchObject({ appliedTreatments: { neutralisedChildIds: ["lea"] } })
  })

  it("collects every child’s income facts before showing a multi-child result", () => {
    const people = [{ id: "lea", name: "Léa", relation: "child" as const }, { id: "noe", name: "Noé", relation: "child" as const }]
    const common = {
      thresholds: { ...thresholds, childProfessionalMonthly: 1000 }, date: "20/10/2026", intent: "current" as const, livesAlone: false,
      people, answers: { childrenAllowance: "no", childrenIncome: "yes" }, partnerAmount: "", relativeAmount: "",
    }
    const complete = buildFamilySituationEvaluationInput({ ...common, childFirstEmployment: {
      lea: { hasIncome: "yes", incomeKind: "professional", firstWork: "yes", studiesEndedAt: "01/02/2026", workStartedAt: "20/01/2026" },
      noe: { hasIncome: "no" },
    } })
    expect(evaluateArticle110Verifier(complete)).toMatchObject({ category: "A", householdAssessment: { status: "probable" }, appliedTreatments: { neutralisedChildIds: ["lea"] } })

    const nonFirstIncome = buildFamilySituationEvaluationInput({ ...common, childFirstEmployment: {
      lea: { hasIncome: "yes", incomeKind: "professional", firstWork: "no", incomeAmount: "1200" },
      noe: { hasIncome: "no" },
    } })
    expect(evaluateArticle110Verifier(nonFirstIncome)).toMatchObject({ category: "B", householdAssessment: { status: "probable" } })

    const unknown = buildFamilySituationEvaluationInput({ ...common, childFirstEmployment: {
      lea: { hasIncome: "unknown" },
      noe: { hasIncome: "no" },
    } })
    expect(evaluateArticle110Verifier(unknown)).toMatchObject({ category: null, householdAssessment: { status: "needs_information" } })
  })

  it("does not infer isolation when the visitor says they do not know their household", () => {
    const result = evaluateArticle110Verifier({ thresholds, asOf: "2026-10-18", multiPersonHouseholdSelected: true, people: [] })
    expect(result.category).toBeNull()
  })

  it("does not turn an unknown third-party household arrangement into ordinary cohabitation", () => {
    const result = evaluateArticle110Verifier({ thresholds, asOf: "2026-10-18", people: [{ id: "other", relation: "third_party", hasProfessionalIncome: false, hasReplacementIncome: false }] })
    expect(result.category).toBeNull()
  })

  it("keeps autonomous co-housing distinct from ordinary cohabitation", () => {
    const result = evaluateArticle110Verifier({ thresholds, asOf: "2026-10-18", cohousing: true, cohousingAutonomousLiving: true, cohousingRecognition: "recognised_same_address", people: [{ id: "other", relation: "third_party", hasProfessionalIncome: false, hasReplacementIncome: false }] })
    expect(result.category).toBe("N")
  })

  it("parses named pensions once, with usual thousand separators, only for the named relative", () => {
    const amounts = namedPensionAmounts("Paul : 1 200 € ; Jeanne : 800 €", [
      { id: "child-paul", name: "Paul", relation: "child" },
      { id: "parent-paul", name: "Paul", relation: "parent" },
      { id: "jeanne", name: "Jeanne", relation: "family" },
    ])
    expect(Object.fromEntries(amounts)).toEqual({ "parent-paul": 1200, jeanne: 800 })
  })

  it("rejects ambiguous names and duplicate lines for one person", () => {
    const sameNamePeople = [{ id: "a", name: "Paul", relation: "parent" as const }, { id: "b", name: "Paul", relation: "family" as const }]
    const onePerson = [{ id: "a", name: "Paul", relation: "parent" as const }]
    expect(namedPensionAmounts("Paul : 700 €", sameNamePeople).size).toBe(0)
    expect(namedPensionAmounts("Paul : 700 € ; Paul : 800 €", onePerson).size).toBe(0)
  })

  it("collects gross pensions by person, so homonyms and cumulative ascendant amounts stay unambiguous", () => {
    const people = [{ id: "paul-a", name: "Paul", relation: "parent" as const }, { id: "paul-b", name: "Paul", relation: "parent" as const }]
    expect(Object.fromEntries(pensionAmountsByPerson({ "paul-a": "425", "paul-b": "425" }, people))).toEqual({ "paul-a": 425, "paul-b": 425 })
    const input = buildFamilySituationEvaluationInput({ thresholds: pensionThresholds, date: "18/10/2026", intent: "current", livesAlone: false, people, answers: { relativeIncome: "yes", relativeIncomeKind: "pension", relativeSpf: "no" }, partnerAmount: "", relativeAmount: "", relativePensionAmounts: { "paul-a": "425", "paul-b": "425" } })
    expect(evaluateArticle110Verifier(input)).toMatchObject({ category: "B", householdAssessment: { pensionAssessment: { grossTotal: 850 } } })
  })

  it("keeps an unknown pension amount non-conclusive and does not apply an ascendant ceiling to another relative", () => {
    const unknownParent = buildFamilySituationEvaluationInput({ thresholds: pensionThresholds, date: "18/10/2026", intent: "current", livesAlone: false, people: [{ id: "parent", name: "Paul", relation: "parent" }], answers: { relativeIncome: "yes", relativeIncomeKind: "pension" }, partnerAmount: "", relativeAmount: "", relativePensionAmounts: {}, relativePensionStatuses: { parent: "unknown" } })
    expect(evaluateArticle110Verifier(unknownParent)).toMatchObject({ category: null, householdAssessment: { status: "needs_information" } })

    const familyMember = buildFamilySituationEvaluationInput({ thresholds: pensionThresholds, date: "18/10/2026", intent: "current", livesAlone: false, people: [{ id: "family", name: "Camille", relation: "family" }], answers: { relativeIncome: "yes", relativeIncomeKind: "pension" }, partnerAmount: "", relativeAmount: "", relativePensionAmounts: { family: "850" } })
    expect(evaluateArticle110Verifier(familyMember)).toMatchObject({ category: null, householdAssessment: { status: "needs_review" } })
  })

  it("does not treat no pension as a complete income inventory", () => {
    const input = buildFamilySituationEvaluationInput({
      thresholds, date: "18/10/2026", intent: "current", livesAlone: false,
      people: [{ id: "parent", name: "Paul", relation: "parent" }],
      answers: { relativeIncome: "yes", relativeIncomeKind: "pension" }, partnerAmount: "", relativeAmount: "",
      relativePensionStatuses: { parent: "no_pension" },
    })
    expect(evaluateArticle110Verifier(input)).toMatchObject({ category: null, householdAssessment: { status: "needs_information" } })
  })

  it("passes the SPF answer through to the shared pension ceiling", () => {
    const common = { thresholds: pensionThresholds, date: "18/10/2026", intent: "current" as const, livesAlone: false, people: [{ id: "parent", name: "Paul", relation: "parent" as const }], answers: { relativeIncome: "yes", relativeIncomeKind: "pension" }, partnerAmount: "", relativeAmount: "Paul : 850 €" }
    expect(evaluateArticle110Verifier(buildFamilySituationEvaluationInput({ ...common, answers: { ...common.answers, relativeSpf: "no" } })).category).toBe("B")
    expect(evaluateArticle110Verifier(buildFamilySituationEvaluationInput({ ...common, answers: { ...common.answers, relativeSpf: "yes" } })).category).toBe("A")
  })

  it("only uses the SPF answer when the declared ascendant pension is between the two ceilings", () => {
    const common = { thresholds: pensionThresholds, date: "18/10/2026", intent: "current" as const, livesAlone: false, people: [{ id: "parent", name: "Paul", relation: "parent" as const }], answers: { relativeIncome: "yes", relativeIncomeKind: "pension", relativeSpf: "yes" }, partnerAmount: "" }
    for (const relativeAmount of ["Paul : 700 €", "Paul : 950 €"]) {
      const person = buildFamilySituationEvaluationInput({ ...common, relativeAmount }).people[0]
      expect(person.disabilityRelevant).toBeUndefined()
    }
  })

  it("uses the SPF answer when the declared ascendant pension total is between the two ceilings", () => {
    const input = buildFamilySituationEvaluationInput({ thresholds: pensionThresholds, date: "18/10/2026", intent: "current", livesAlone: false, people: [{ id: "paul", name: "Paul", relation: "parent" }, { id: "jeanne", name: "Jeanne", relation: "parent" }], answers: { relativeIncome: "yes", relativeIncomeKind: "pension", relativeSpf: "yes" }, partnerAmount: "", relativeAmount: "Paul : 425 € ; Jeanne : 425 €" })
    expect(input.people.map((person) => person.disabilityRelevant)).toEqual([true, true])
  })

  it("only displays categories for the explicitly complete public paths", () => {
    const alone: Person[] = []
    const parent: Person[] = [{ id: "parent", name: "Paul", relation: "parent" }]
    const child: Person[] = [{ id: "child", name: "Léa", relation: "child" }]
    const childAndParent: Person[] = [{ id: "child", name: "Léa", relation: "child" }, ...parent]
    const show = (input: Parameters<typeof canShowFamilySituationCategory>[0]) => canShowFamilySituationCategory(input)
    expect(show({ intent: "current", livesAlone: true, people: alone, answers: { aloneSituation: "none" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false })).toBe(true)
    expect(show({ intent: "current", livesAlone: true, people: alone, answers: { aloneSituation: "alimony", alimonyDocument: "judgment" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: true })).toBe(true)
    expect(show({ intent: "current", livesAlone: true, people: alone, answers: { aloneSituation: "alimony", alimonyDocument: "pending" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: true })).toBe(true)
    expect(show({ intent: "current", livesAlone: false, people: child, answers: { childrenAllowance: "yes" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false })).toBe(true)
    expect(show({ intent: "current", livesAlone: false, people: child, answers: { childrenAllowance: "no", childrenIncome: "no" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false })).toBe(true)
    expect(show({ intent: "current", livesAlone: false, people: child, answers: { childrenAllowance: "no", childrenIncome: "yes", childFirstWork: "yes" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false, hasProbableChildAssessment: true })).toBe(true)
    expect(show({ intent: "current", livesAlone: false, people: parent, answers: { relativeIncome: "no" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false })).toBe(true)
    expect(show({ intent: "current", livesAlone: false, people: parent, answers: { relativeIncome: "yes", relativeIncomeKind: "pension" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false, hasProbableAscendantPensionAssessment: true })).toBe(true)
    expect(show({ intent: "current", livesAlone: false, people: childAndParent, answers: { childrenAllowance: "no", relativeIncome: "no" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false })).toBe(true)
    expect(show({ intent: "current", livesAlone: false, people: [{ id: "spouse", name: "Sam", relation: "spouse" }], answers: { partnerSituation: "noIncome" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false, hasProbablePartnerAssessment: true })).toBe(true)
    expect(show({ intent: "current", livesAlone: false, people: [{ id: "spouse", name: "Sam", relation: "spouse" }, { id: "partner", name: "Alex", relation: "partner" }], answers: { partnerSituation: "noIncome" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false, hasProbablePartnerAssessment: true })).toBe(false)
    for (const input of [
      { intent: "unknown" as const, livesAlone: false, people: alone, answers: {}, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false },
      { intent: "current" as const, livesAlone: true, people: alone, answers: { aloneSituation: "unknown" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false },
      { intent: "current" as const, livesAlone: true, people: alone, answers: { aloneSituation: "alternating" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false },
      { intent: "current" as const, livesAlone: false, people: parent, answers: { relativeIncome: "yes", relativeIncomeKind: "salary" }, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false },
    ]) expect(show(input)).toBe(false)
  })

  it("keeps regulatory judgment facts unknown while exposing the declared public orientation", () => {
    const input = buildFamilySituationEvaluationInput({ thresholds, date: "18/10/2026", intent: "current", livesAlone: true, people: [], answers: { aloneSituation: "alimony", alimonyDocument: "judgment" }, partnerAmount: "", relativeAmount: "" })
    const result = evaluateArticle110Verifier(input)
    expect(result.category).toBeNull()
    expect(result.declaredOrientation).toEqual({ category: "A", basis: "alimony_legal_document" })
    expect(article110VerifierFacts(input).isolated?.alimony?.paid).toBeUndefined()
  })

  it("keeps a pending or absent judgment isolated without inventing payment", () => {
    for (const alimonyDocument of ["pending", "none"] as const) {
      const input = buildFamilySituationEvaluationInput({ thresholds, date: "18/10/2026", intent: "current", livesAlone: true, people: [], answers: { aloneSituation: "alimony", alimonyDocument }, partnerAmount: "", relativeAmount: "" })
      const result = evaluateArticle110Verifier(input)
      expect(result.category).toBeNull()
      expect(result.declaredOrientation).toEqual({ category: "N", basis: "alimony_pending_or_absent" })
      expect(article110VerifierFacts(input).isolated?.alimony?.paid).toBeUndefined()
    }
  })

  it("keeps an unknown document isolated declaratively without inventing legal or payment facts", () => {
    const input = buildFamilySituationEvaluationInput({ thresholds, date: "18/10/2026", intent: "current", livesAlone: true, people: [], answers: { aloneSituation: "alimony", alimonyDocument: "unknown" }, partnerAmount: "", relativeAmount: "" })
    expect(evaluateArticle110Verifier(input).declaredOrientation).toEqual({ category: "N", basis: "alimony_pending_or_absent" })
    expect(article110VerifierFacts(input).isolated?.alimony).toBeUndefined()
  })

  it("keeps the legacy alimony payment mapping for existing consumers", () => {
    const facts = article110VerifierFacts({ thresholds, isAloneExplicit: true, people: [], alimony: { enabled: true, legalConditionEstablished: true } })
    expect(facts.isolated?.alimony).toMatchObject({ paid: true, admissibleBasis: true })
  })
})

// Exercise the actual controls and their event handlers; the final assertion uses
// the shared engine, so a navigation fix alone cannot make the regression pass.
function controls(node: ReactNode): Array<Record<string, unknown>> {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return []
    return [child.props, ...controls(child.props.children as ReactNode)]
  })
}
const translate = ((key: string) => key) as Parameters<typeof ChildrenFirstEmploymentStep>[0]["t"]
const children: Person[] = [{ id: "lea", name: "Léa", relation: "child" }]
const childInput = (values: ChildFirstEmployment, date = "20/10/2026") => buildFamilySituationEvaluationInput({
  thresholds: { ...thresholds, childProfessionalMonthly: 1000, childReplacementMonthly: 500 }, date, intent: "current", livesAlone: false,
  people: children, answers: { childrenAllowance: "no", childrenIncome: "yes" }, partnerAmount: "", relativeAmount: "", childFirstEmployment: values,
})

describe("public income controls, navigation and edits", () => {
  it("returns to a complete collective no-income path after editing previously declared child income", () => {
    const result = evaluateArticle110Verifier(buildFamilySituationEvaluationInput({
      thresholds, date: "20/10/2026", intent: "current", livesAlone: false,
      people: [...children, { id: "noe", name: "Noé", relation: "child" }],
      answers: { childrenAllowance: "no", childrenIncome: "no" }, partnerAmount: "", relativeAmount: "",
      childFirstEmployment: { lea: { hasIncome: "yes", incomeKind: "professional", firstWork: "no", incomeAmount: "9000" } },
    }))
    expect(result).toMatchObject({ category: "A", missingFacts: [], householdAssessment: { status: "probable" } })
  })

  it("keeps the student employment path complete without an amount and clears it when edited to replacement income", () => {
    let values: ChildFirstEmployment = { lea: { hasIncome: "yes", incomeKind: "student" } }
    const render = () => ChildrenFirstEmploymentStep({ t: translate, people: children, date: "20/10/2026", values, onChange: (next) => { values = next }, onContinue: () => {} })
    expect(controls(render()).find((control) => control.id === "income-lea")).toBeUndefined()
    expect(controls(render()).at(-1)?.disabled).toBe(false)
    expect(evaluateArticle110Verifier(childInput(values))).toMatchObject({ category: "A", missingFacts: [] })
    const replacement = controls(render()).find((control) => control.children === "childIncomeKind.replacement")!
    ;(replacement.onClick as () => void)()
    expect(values.lea).toEqual({ hasIncome: "yes", incomeKind: "replacement" })
    expect(controls(render()).find((control) => control.id === "income-lea")).toBeDefined()
    expect(controls(render()).at(-1)?.disabled).toBe(true)
    expect(evaluateArticle110Verifier(childInput(values)).category).toBeNull()
  })

  it("asks for the monthly amount after twelve months and changes category using that amount", () => {
    let values: ChildFirstEmployment = { lea: { hasIncome: "yes", incomeKind: "professional", firstWork: "yes", studiesEndedAt: "01/09/2025", workStartedAt: "01/10/2025" } }
    const render = (date = "20/10/2026") => ChildrenFirstEmploymentStep({ t: translate, people: children, date, values, onChange: (next) => { values = next }, onContinue: () => {} })
    expect(controls(render()).at(-1)?.disabled).toBe(true)
    const amount = controls(render()).find((control) => control.id === "income-lea")!
    expect(amount).toBeDefined()
    expect(evaluateArticle110Verifier(childInput(values)).category).toBeNull()
    ;(amount.onChange as (event: { target: { value: string } }) => void)({ target: { value: "1 200" } })
    expect(controls(render()).at(-1)?.disabled).toBe(false)
    expect(evaluateArticle110Verifier(childInput(values))).toMatchObject({ category: "B", appliedTreatments: { neutralisedChildIds: [] } })
    values = updateChildIncomeEntry(values, "lea", { incomeAmount: "900,50" })
    expect(evaluateArticle110Verifier(childInput(values)).category).toBe("A")
    expect(controls(render("20/09/2026")).find((control) => control.id === "income-lea")).toBeUndefined()
    expect(evaluateArticle110Verifier(childInput(values, "20/09/2026"))).toMatchObject({ category: "A", appliedTreatments: { neutralisedChildIds: ["lea"] } })
  })

  it.each(["1200", "1 200", "1\u00a0200", "1\u202f200", "1200,00", "1200.00"])("accepts the same child amount %s in controls, completeness and evaluation", (incomeAmount) => {
    const values: ChildFirstEmployment = { lea: { hasIncome: "yes", incomeKind: "professional", firstWork: "no", incomeAmount } }
    expect(childIncomeCollectionState(values.lea, "20/10/2026").complete).toBe(true)
    expect(childInput(values).people[0].professionalIncomeAmount).toBe(1200)
    expect(evaluateArticle110Verifier(childInput(values)).category).toBe("B")
  })

  it("rechecks the amount after editing first work to no instead of reusing hidden dates or income", () => {
    let values: ChildFirstEmployment = { lea: { hasIncome: "yes", incomeKind: "professional", firstWork: "yes", studiesEndedAt: "01/09/2026", workStartedAt: "01/10/2026", incomeAmount: "1200" } }
    const render = () => ChildrenFirstEmploymentStep({ t: translate, people: children, date: "20/10/2026", values, onChange: (next) => { values = next }, onContinue: () => {} })
    const firstWorkNo = controls(render()).filter((control) => control.children === "no").at(-1)!
    ;(firstWorkNo.onClick as () => void)()
    expect(values.lea).toEqual({ hasIncome: "yes", incomeKind: "professional", firstWork: "no" })
    expect(controls(render()).at(-1)?.disabled).toBe(true)
    expect(evaluateArticle110Verifier(childInput(values)).category).toBeNull()
  })

  it("collects other income when a parent has no pension, then distinguishes no income from a salary", () => {
    const people: Person[] = [{ id: "father", name: "Paul", relation: "parent" }, { id: "mother", name: "Jeanne", relation: "parent" }]
    const values = { father: "700" }
    const statuses: Partial<Record<string, RelativePensionStatus>> = { mother: "no_pension" }
    let otherIncomes: RelativeOtherIncomes = {}
    const state = () => relativePensionCollectionState(people, pensionAmountsByPerson(values, people), statuses, otherIncomes, pensionThresholds)
    const render = () => PensionAmountsStep({ t: translate, people, values, statuses, otherIncomes, canContinue: state().complete, onAmountChange: () => {}, onStatusChange: () => {}, onOtherIncomeChange: (id, kind) => { otherIncomes = { ...otherIncomes, [id]: kind } }, onContinue: () => {} })
    const result = () => evaluateArticle110Verifier(buildFamilySituationEvaluationInput({ thresholds: pensionThresholds, date: "20/10/2026", intent: "current", livesAlone: false, people, answers: { relativeIncome: "yes", relativeIncomeKind: "pension" }, partnerAmount: "", relativeAmount: "", relativePensionAmounts: values, relativePensionStatuses: statuses, relativeOtherIncomes: otherIncomes }))
    expect(controls(render()).at(-1)?.disabled).toBe(true)
    expect(result().category).toBeNull()
    const noIncome = controls(render()).find((control) => control.children === "relativeOtherIncome.noIncome")!
    ;(noIncome.onClick as () => void)()
    expect(controls(render()).at(-1)?.disabled).toBe(false)
    expect(result()).toMatchObject({ category: "A", missingFacts: [], householdAssessment: { pensionAssessment: { grossTotal: 700 } } })
    const salary = controls(render()).find((control) => control.children === "relativeOtherIncome.professional")!
    ;(salary.onClick as () => void)()
    expect(result().category).toBe("B")
    const replacement = controls(render()).find((control) => control.children === "relativeOtherIncome.replacement")!
    ;(replacement.onClick as () => void)()
    expect(result().category).toBeNull()
    expect(result().missingFacts.map((fact) => fact.factKey)).toContain("mother.replacementIncomeType")
  })

  it("uses historical ceilings for the SPF question and discards old ceilings during date changes", () => {
    const people: Person[] = [{ id: "father", name: "Paul", relation: "parent" }]
    const amounts = { father: "850" }
    const current = { ...pensionThresholds, ascendantPensionMonthly: 1000, ascendantDisabledPensionMonthly: 1200 }
    const historical = resolveFamilySituationThresholds(current, true, "2025-01-01", "2025-01-01", pensionThresholds)
    expect(relativePensionCollectionState(people, pensionAmountsByPerson(amounts, people), {}, {}, historical.thresholds).shouldAskSpf).toBe(true)
    const input = (answer: string) => buildFamilySituationEvaluationInput({ thresholds: historical.thresholds, date: "01/01/2025", intent: "changed", livesAlone: false, people, answers: { relativeIncome: "yes", relativeIncomeKind: "pension", relativeSpf: answer }, partnerAmount: "", relativeAmount: "", relativePensionAmounts: amounts })
    expect(input("yes").people[0].disabilityRelevant).toBe(true)
    expect(evaluateArticle110Verifier(input("yes")).category).toBe("A")
    expect(evaluateArticle110Verifier(input("no")).category).toBe("B")
    const pending = resolveFamilySituationThresholds(current, true, "2024-01-01", "2025-01-01", pensionThresholds)
    expect(pending).toMatchObject({ resolved: false, thresholds: { ascendantPensionMonthly: null, ascendantDisabledPensionMonthly: null } })
    const returnToToday = resolveFamilySituationThresholds(current, false, "2026-10-21", "2025-01-01", pensionThresholds)
    expect(returnToToday.resolved).toBe(true)
    expect(relativePensionCollectionState(people, pensionAmountsByPerson(amounts, people), {}, {}, returnToToday.thresholds).shouldAskSpf).toBe(false)
  })
})


describe("incomplete answers remain editable without inventing a category", () => {
  it.each([
    { hasIncome: "unknown" as const },
    { hasIncome: "yes" as const, incomeKind: "professional" as const, firstWork: "unknown" as const },
    { hasIncome: "yes" as const, incomeKind: "professional" as const, firstWork: "yes" as const, studiesEndedAt: "01/09/2025", workStartedAt: "01/10/2025", incomeAmountUnknown: true },
  ])("lets the visitor continue with a declared unknown answer and supplies missing facts", (entry) => {
    let navigated = false
    const values: ChildFirstEmployment = { lea: entry }
    const screen = ChildrenFirstEmploymentStep({ t: translate, people: children, date: "20/10/2026", values, onChange: () => {}, onContinue: () => { navigated = true } })
    const next = controls(screen).at(-1)!
    expect(next.disabled).toBe(false)
    ;(next.onClick as () => void)()
    expect(navigated).toBe(true)
    expect(childIncomeCollectionState(entry, "20/10/2026").complete).toBe(false)
    const result = evaluateArticle110Verifier(childInput(values))
    expect(result.category).toBeNull()
    expect(result.missingFacts.length).toBeGreaterThan(0)
  })

  it("accepts an unknown amount after expiry, then clears it when the visitor edits the amount", () => {
    let values: ChildFirstEmployment = { lea: { hasIncome: "yes", incomeKind: "professional", firstWork: "yes", studiesEndedAt: "01/09/2025", workStartedAt: "01/10/2025" } }
    const render = () => ChildrenFirstEmploymentStep({ t: translate, people: children, date: "20/10/2026", values, onChange: (next) => { values = next }, onContinue: () => {} })
    const unknown = controls(render()).find((control) => control["aria-pressed"] === false && control.variant === "ghost")!
    ;(unknown.onClick as () => void)()
    expect(controls(render()).at(-1)?.disabled).toBe(false)
    expect(evaluateArticle110Verifier(childInput(values)).category).toBeNull()
    const amount = controls(render()).find((control) => control.id === "income-lea")!
    ;(amount.onChange as (event: { target: { value: string } }) => void)({ target: { value: "950" } })
    expect(values.lea?.incomeAmountUnknown).toBe(false)
    expect(evaluateArticle110Verifier(childInput(values)).category).toBe("A")
  })

  it.each(["no", "pension"])("shows the engine category for children with allowances and relatives with %s income", (incomeKind) => {
    const people: Person[] = [...children, { id: "father", name: "Paul", relation: "parent" }]
    const answers = { childrenAllowance: "yes", relativeIncome: incomeKind === "no" ? "no" : "yes", relativeIncomeKind: incomeKind === "pension" ? "pension" : undefined }
    const result = evaluateArticle110Verifier(buildFamilySituationEvaluationInput({ thresholds: { ...pensionThresholds, ascendantPensionWithChildMonthly: 1000 }, date: "20/10/2026", intent: "current", livesAlone: false, people, answers, partnerAmount: "", relativeAmount: "", relativePensionAmounts: { father: "700" } }))
    expect(result.category).toBe("A")
    expect(canShowFamilySituationCategory({ intent: "current", livesAlone: false, people, answers, unknownDetails: [], particular: [], hasDeclaredAlimonyOrientation: false, hasProbableRelativeAssessment: result.householdAssessment.status === "probable" && result.category !== null })).toBe(true)
  })
})


describe("first employment dates must describe the assessed period", () => {
  it("requires editing a future start date and cannot expose a category from a retained amount", () => {
    let values: ChildFirstEmployment = { lea: { hasIncome: "yes", incomeKind: "professional", firstWork: "yes", studiesEndedAt: "01/06/2026", workStartedAt: "01/07/2027", incomeAmount: "500" } }
    const render = () => ChildrenFirstEmploymentStep({ t: translate, people: children, date: "20/10/2026", values, onChange: (next) => { values = next }, onContinue: () => {} })
    expect(childIncomeCollectionState(values.lea, "20/10/2026")).toMatchObject({ complete: false, canContinue: false, requiresAmount: false, invalidWorkDate: true })
    expect(controls(render()).at(-1)?.disabled).toBe(true)
    const start = controls(render()).find((control) => control.id === "work-lea")!
    expect(start["aria-invalid"]).toBe(true)
    expect(controls(render()).find((control) => control.children === "childWorkFutureNotice")).toBeDefined()
    expect(evaluateArticle110Verifier(childInput(values)).category).toBeNull()
    ;(start.onChange as (event: { target: { value: string } }) => void)({ target: { value: "01/07/2026" } })
    expect(controls(render()).at(-1)?.disabled).toBe(false)
    expect(evaluateArticle110Verifier(childInput(values))).toMatchObject({ category: "A", appliedTreatments: { neutralisedChildIds: ["lea"] } })
  })

  it("does not label an already-started activity invalid only because studies finish later", () => {
    const values: ChildFirstEmployment = { lea: { hasIncome: "yes", incomeKind: "professional", firstWork: "yes", studiesEndedAt: "01/06/2027", workStartedAt: "01/07/2026", incomeAmount: "500" } }
    expect(childIncomeCollectionState(values.lea, "20/10/2026")).toMatchObject({ complete: true, canContinue: true, requiresAmount: true })
    expect(evaluateArticle110Verifier(childInput(values))).toMatchObject({ category: "A", appliedTreatments: { neutralisedChildIds: [] } })
  })
})


describe("neutral disability income and common orientation warning", () => {
  it("does not treat the other parent's SPF allowance as a relevant replacement income", () => {
    const people: Person[] = [{ id: "father", name: "Paul", relation: "parent" }, { id: "mother", name: "Jeanne", relation: "parent" }]
    const input = buildFamilySituationEvaluationInput({ thresholds: pensionThresholds, date: "20/10/2026", intent: "current", livesAlone: false, people, answers: { relativeIncome: "yes", relativeIncomeKind: "pension" }, partnerAmount: "", relativeAmount: "", relativePensionAmounts: { father: "700" }, relativePensionStatuses: { mother: "no_pension" }, relativeOtherIncomes: { mother: "disability" } })
    expect(input.people[1]).toMatchObject({ hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "disability_allowance" })
    expect(evaluateArticle110Verifier(input)).toMatchObject({ category: "A", missingFacts: [], householdAssessment: { pensionAssessment: { grossTotal: 700 } } })
  })

  it.each(["judgment", "pending", "none", "unknown"])("displays the mandatory common warning for an alimony document declared %s", (alimonyDocument) => {
    const answers = { aloneSituation: "alimony", alimonyDocument }
    const evaluation = evaluateArticle110Verifier(buildFamilySituationEvaluationInput({ thresholds, date: "20/10/2026", intent: "current", livesAlone: true, people: [], answers, partnerAmount: "", relativeAmount: "" }))
    const screen = SummaryStep({ t: translate, evaluation, intent: "current", date: "20/10/2026", people: [], livesAlone: true, answers, particular: [], relationLabel: () => "", details: [], onEdit: () => {} })
    expect(controls(screen).some((control) => control.children === "summaryNoCategoryBody")).toBe(true)
    expect(controls(screen).some((control) => control.children === (alimonyDocument === "judgment" ? "categoryA" : "categoryN"))).toBe(true)
  })
})


describe("unqualified child replacement income", () => {
  it.each(["100", "1200"])("keeps unqualified replacement income %s unresolved on either side of the child ceiling", (incomeAmount) => {
    const values: ChildFirstEmployment = { lea: { hasIncome: "yes", incomeKind: "replacement", incomeAmount } }
    const input = childInput(values)
    expect(input.people[0]).toMatchObject({ hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeAmount: Number(incomeAmount), replacementIncomeNeedsQualification: true })
    const result = evaluateArticle110Verifier(input)
    expect(result).toMatchObject({ category: null, householdAssessment: { status: "needs_information" } })
    expect(result.missingFacts.map((fact) => fact.factKey)).toContain("lea.replacementIncomeType")
  })

  it("does not turn a student child plus another child's unqualified replacement income of 100 into A", () => {
    const input = buildFamilySituationEvaluationInput({ thresholds: { ...thresholds, childProfessionalMonthly: 1000, childReplacementMonthly: 500 }, date: "20/10/2026", intent: "current", livesAlone: false,
      people: [...children, { id: "noe", name: "Noé", relation: "child" }], answers: { childrenAllowance: "no", childrenIncome: "yes" }, partnerAmount: "", relativeAmount: "",
      childFirstEmployment: { lea: { hasIncome: "yes", incomeKind: "student" }, noe: { hasIncome: "yes", incomeKind: "replacement", incomeAmount: "100" } },
    })
    const result = evaluateArticle110Verifier(input)
    expect(result).toMatchObject({ category: null, householdAssessment: { status: "needs_information" } })
    expect(result.missingFacts.map((fact) => fact.factKey)).toContain("noe.replacementIncomeType")
  })

  it("does not extend a student contract's exclusion to a replacement income received by the same child", () => {
    const input = childInput({ lea: { hasIncome: "yes", incomeKind: "replacement", incomeAmount: "100" } })
    input.people[0] = { ...input.people[0], hasProfessionalIncome: true, professionalIncomeType: "student_occupation_contract" }
    expect(evaluateArticle110Verifier(input)).toMatchObject({ category: null, householdAssessment: { status: "needs_information" } })
  })
})


it("keeps family allowances prior to an unqualified replacement income in the public adapter", () => {
  const input = buildFamilySituationEvaluationInput({ thresholds: { ...thresholds, childReplacementMonthly: 500 }, date: "20/10/2026", intent: "current", livesAlone: false,
    people: children, answers: { childrenAllowance: "yes", childrenIncome: "yes" }, partnerAmount: "", relativeAmount: "",
    childFirstEmployment: { lea: { hasIncome: "yes", incomeKind: "replacement", incomeAmount: "100" } },
  })
  expect(evaluateArticle110Verifier(input)).toMatchObject({ category: "A", missingFacts: [] })
})
