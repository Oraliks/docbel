import { describe, expect, it } from "vitest"

import { evaluateArticle110Verifier } from "@/lib/regulatory-decision/article-110-verifier"
import { namedPensionAmounts } from "@/app/outils/ma-situation-familiale/family-situation-client"

const thresholds = { spouseProfessionalMonthly: null, childProfessionalMonthly: null, spouseReplacementMonthly: null, childReplacementMonthly: null, ascendantPensionWithChildMonthly: null, ascendantPensionMonthly: null, ascendantDisabledPensionMonthly: null, source: null }

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
})
