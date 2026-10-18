import { describe, expect, it } from "vitest"

import { article110VerifierFacts, evaluateArticle110Verifier } from "@/lib/regulatory-decision/article-110-verifier"
import { buildFamilySituationEvaluationInput, namedPensionAmounts } from "@/app/outils/ma-situation-familiale/family-situation-client"

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
  })

  it("does not turn an unknown partner income into a category", () => {
    const result = evaluateArticle110Verifier({ thresholds, asOf: "2026-10-18", people: [{ id: "partner", relation: "partner" }] })
    expect(result.category).toBeNull()
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

  it("passes the SPF answer through to the shared pension ceiling", () => {
    const common = { thresholds: pensionThresholds, date: "18/10/2026", intent: "current" as const, livesAlone: false, people: [{ id: "parent", name: "Paul", relation: "parent" as const }], answers: { relativeIncome: "yes", relativeIncomeKind: "pension" }, partnerAmount: "", relativeAmount: "Paul : 850 €" }
    expect(evaluateArticle110Verifier(buildFamilySituationEvaluationInput({ ...common, answers: { ...common.answers, relativeSpf: "no" } })).category).toBe("B")
    expect(evaluateArticle110Verifier(buildFamilySituationEvaluationInput({ ...common, answers: { ...common.answers, relativeSpf: "yes" } })).category).toBe("A")
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

  it("keeps an unknown document outside the declared orientation", () => {
    const input = buildFamilySituationEvaluationInput({ thresholds, date: "18/10/2026", intent: "current", livesAlone: true, people: [], answers: { aloneSituation: "alimony", alimonyDocument: "unknown" }, partnerAmount: "", relativeAmount: "" })
    expect(evaluateArticle110Verifier(input).declaredOrientation).toBeNull()
    expect(article110VerifierFacts(input).isolated?.alimony).toBeUndefined()
  })

  it("keeps the legacy alimony payment mapping for existing consumers", () => {
    const facts = article110VerifierFacts({ thresholds, isAloneExplicit: true, people: [], alimony: { enabled: true, legalConditionEstablished: true } })
    expect(facts.isolated?.alimony).toMatchObject({ paid: true, admissibleBasis: true })
  })
})
