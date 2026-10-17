import { describe, expect, it } from "vitest";
import type { FamilyPersonQualificationFacts, FamilyPersonQualificationInput, QualificationAnswer } from "../family-person-facts";
import { qualifyPartnerAssimilation } from "../family-person-qualification";

const answer = <T>(value: T, effectiveAt?: string): QualificationAnswer<T> => ({
  value, origin: "user", sourceField: "test.declaration", ...(effectiveAt ? { effectiveAt } : {}),
});

const complete: FamilyPersonQualificationFacts = {
  sameRoof: answer(true), mainlySharedHousekeeping: answer(true), formsDeFactoHousehold: answer(true),
  familyRelationship: answer("none"), childWithFamilyAllowanceEntitlement: answer(false),
  dependentOnParentWithMaintenanceDuty: answer(false), receivesRisOrEquivalent: answer(false),
  dependentOnAnotherUnemployedCohabitant: answer(false), marriedToAnotherPerson: answer(false),
};

function input(facts: FamilyPersonQualificationFacts = complete, overrides: Partial<FamilyPersonQualificationInput> = {}): FamilyPersonQualificationInput {
  return {
    schemaVersion: 2, personId: "person-1", declaredRelation: "partner",
    asOf: "2026-10-17", facts, declarationStatus: "to_prepare", ...overrides,
  };
}

describe("partner assimilation — material facts only", () => {
  it("qualifies complete positive material facts without a family category", () => {
    const result = qualifyPartnerAssimilation(input());
    expect(result).toMatchObject({
      status: "eligible_on_facts", missingFactKeys: [], declarationRequirement: "required",
      declarationStatus: "to_prepare", nextStep: "continue_household_assessment",
      sourceRuleIds: [
        "situation_familiale_cohabitation_am59",
        "situation_familiale_partenaire_assimilation_art110",
        "situation_familiale_charge_financiere_am59",
      ],
    });
    expect(result.decisiveFactKeys).toEqual(Object.keys(complete));
    expect("category" in result).toBe(false);
    expect("expectedCategory" in result).toBe(false);
    expect("officialOnemState" in result).toBe(false);
  });

  it("asks precisely for a missing decisive condition", () => {
    const facts = { ...complete, dependentOnParentWithMaintenanceDuty: undefined };
    const result = qualifyPartnerAssimilation(input(facts));
    expect(result).toMatchObject({ status: "needs_information", missingFactKeys: ["dependentOnParentWithMaintenanceDuty"], nextStep: "complete_facts" });
  });

  it.each([
    ["familyRelationship", "kin_or_ally_through_third_degree", "FAMILY_RELATIONSHIP_EXCLUSION"],
    ["familyRelationship", "foster_parent", "FAMILY_RELATIONSHIP_EXCLUSION"],
    ["childWithFamilyAllowanceEntitlement", true, "CHILD_ALLOWANCE_ENTITLEMENT"],
    ["dependentOnParentWithMaintenanceDuty", true, "PARENT_MAINTENANCE_DEPENDENCY"],
    ["receivesRisOrEquivalent", true, "RIS_OR_EQUIVALENT"],
    ["dependentOnAnotherUnemployedCohabitant", true, "OTHER_UNEMPLOYED_COHABITANT_DEPENDENCY"],
  ] as const)("stops on independent exclusion %s", (key, value, reason) => {
    const result = qualifyPartnerAssimilation(input({ [key]: answer(value) }));
    expect(result).toMatchObject({ status: "excluded_on_facts", reasonCodes: [reason], missingFactKeys: [], nextStep: "clarify_actual_relationship" });
    expect(result.decisiveFactKeys).toEqual([key]);
  });

  it("preserves partner and RIS context without producing a fallback role", () => {
    const result = qualifyPartnerAssimilation(input({ receivesRisOrEquivalent: answer(true) }));
    expect(result).toMatchObject({ declaredRelation: "partner", preservePartnerCpasContext: true, status: "excluded_on_facts" });
    expect(result.sourceRuleIds).toContain("situation_familiale_cpas_contexte_partenaire");
    expect("fallbackRelation" in result).toBe(false);
  });

  it("does not exclude on marriage alone and asks for spouse cohabitation only when relevant", () => {
    const married = { ...complete, marriedToAnotherPerson: answer(true) };
    expect(qualifyPartnerAssimilation(input(married))).toMatchObject({
      status: "needs_information", missingFactKeys: ["cohabitsWithThatSpouse"],
    });
    expect(qualifyPartnerAssimilation(input({ ...married, cohabitsWithThatSpouse: answer(false) })).status).toBe("eligible_on_facts");
    const excluded = qualifyPartnerAssimilation(input({ marriedToAnotherPerson: answer(true), cohabitsWithThatSpouse: answer(true) }));
    expect(excluded).toMatchObject({ status: "excluded_on_facts", reasonCodes: ["MARRIED_WITH_COHABITING_SPOUSE"], missingFactKeys: [] });
    expect(qualifyPartnerAssimilation(input({ ...complete, cohabitsWithThatSpouse: answer(true) })).status).toBe("eligible_on_facts");
  });

  it.each([
    [undefined, false, "eligible_on_facts", []],
    [false, undefined, "eligible_on_facts", []],
    [true, false, "eligible_on_facts", []],
    [undefined, true, "needs_information", ["marriedToAnotherPerson"]],
    [undefined, undefined, "needs_information", ["marriedToAnotherPerson"]],
    [true, undefined, "needs_information", ["cohabitsWithThatSpouse"]],
  ] as const)("evaluates both sides of the marital conjunction (%s, %s)", (married, cohabits, status, missing) => {
    const facts: FamilyPersonQualificationFacts = {
      ...complete,
      marriedToAnotherPerson: married === undefined ? undefined : answer(married),
      cohabitsWithThatSpouse: cohabits === undefined ? undefined : answer(cohabits),
    };
    const result = qualifyPartnerAssimilation(input(facts));
    expect(result.status).toBe(status);
    expect(result.missingFactKeys).toEqual(missing);
    if (cohabits === false && married === undefined) {
      expect(result.decisiveFactKeys).toContain("cohabitsWithThatSpouse");
      expect(result.decisiveFactKeys).not.toContain("marriedToAnotherPerson");
      const reversed = input(Object.fromEntries(Object.entries(facts).reverse()) as FamilyPersonQualificationFacts);
      expect(qualifyPartnerAssimilation(reversed)).toEqual(result);
    }
  });

  it("asks for absence context before interpreting a missing shared roof", () => {
    const result = qualifyPartnerAssimilation(input({ ...complete, sameRoof: answer(false) }));
    expect(result).toMatchObject({ status: "needs_information", missingFactKeys: ["absenceReason"] });
    expect(qualifyPartnerAssimilation(input({ ...complete, sameRoof: answer(false), formsDeFactoHousehold: undefined, absenceReason: answer("none") })))
      .toMatchObject({ status: "excluded_on_facts", reasonCodes: ["COHABITATION_NOT_ESTABLISHED"] });
  });

  it.each(["professional", "imprisonment", "internment", "mental_health_institution", "ordinary_hospitalisation", "care_home", "other"] as const)(
    "routes a decisive %s absence to review without automating a duration", (reason) => {
      const result = qualifyPartnerAssimilation(input({ ...complete, sameRoof: answer(false), absenceReason: answer(reason), absenceStartedAt: answer("2026-09-01") }));
      expect(result).toMatchObject({ status: "needs_review", reasonCodes: ["ABSENCE_REQUIRES_REVIEW"], nextStep: "manual_review" });
      expect("durationMonths" in result).toBe(false);
    },
  );

  it("reviews a particular absence before a current-housekeeping exclusion", () => {
    const facts: FamilyPersonQualificationFacts = {
      ...complete, sameRoof: answer(false), mainlySharedHousekeeping: answer(false),
      formsDeFactoHousehold: undefined, absenceReason: answer("imprisonment"),
      absenceStartedAt: answer("2026-09-01"),
    };
    expect(qualifyPartnerAssimilation(input(facts))).toMatchObject({
      status: "needs_review", reasonCodes: ["ABSENCE_REQUIRES_REVIEW"],
      missingFactKeys: [],
    });
    expect(qualifyPartnerAssimilation(input({ ...facts, familyRelationship: answer("kin_or_ally_through_third_degree") })))
      .toMatchObject({ status: "excluded_on_facts", reasonCodes: ["FAMILY_RELATIONSHIP_EXCLUSION"] });
    expect(qualifyPartnerAssimilation(input({ ...facts, sameRoof: undefined })))
      .toMatchObject({ status: "needs_review", reasonCodes: ["ABSENCE_REQUIRES_REVIEW"] });
  });

  it("keeps formalities distinct from the same material result", () => {
    const prepared = qualifyPartnerAssimilation(input(complete, { declarationStatus: "prepared" }));
    const submitted = qualifyPartnerAssimilation(input(complete, { declarationStatus: "submitted" }));
    expect(prepared.status).toBe(submitted.status);
    expect(prepared.declarationRequirement).toBe("required");
    expect(prepared.declarationStatus).toBe("prepared");
    expect(submitted.declarationStatus).toBe("submitted");
  });

  it("rejects unsupported dates and ignores facts whose effect starts later", () => {
    expect(qualifyPartnerAssimilation(input(complete, { asOf: "2026-02-30" })).reasonCodes).toEqual(["UNSUPPORTED_DATE"]);
    expect(qualifyPartnerAssimilation(input(complete, { asOf: "1997-06-30" })).reasonCodes).toEqual(["UNSUPPORTED_DATE"]);
    const future = qualifyPartnerAssimilation(input({ ...complete, receivesRisOrEquivalent: answer(false, "2026-11-01") }));
    expect(future).toMatchObject({ status: "needs_information", missingFactKeys: ["receivesRisOrEquivalent"] });
    const futureRis = qualifyPartnerAssimilation(input({ ...complete, receivesRisOrEquivalent: answer(true, "2026-11-01") }));
    expect(futureRis).toMatchObject({ status: "needs_information", preservePartnerCpasContext: false });
    const invalid = qualifyPartnerAssimilation(input({ ...complete, receivesRisOrEquivalent: answer(false, "2026-02-30") }));
    expect(invalid).toMatchObject({ status: "needs_review", reasonCodes: ["UNSUPPORTED_DATE"] });
    const invalidAbsence = qualifyPartnerAssimilation(input({ ...complete, sameRoof: answer(false), absenceReason: answer("professional"), absenceStartedAt: answer("2026-02-30") }));
    expect(invalidAbsence).toMatchObject({ status: "needs_review", reasonCodes: ["UNSUPPORTED_DATE"] });
  });

  it("reviews an invalid date on an otherwise contradictory absence", () => {
    const invalid = qualifyPartnerAssimilation(input({ ...complete, absenceReason: answer("imprisonment", "2026-02-30") }));
    expect(invalid).toMatchObject({
      status: "needs_review", reasonCodes: ["UNSUPPORTED_DATE"], decisiveFactKeys: ["absenceReason"],
    });
    expect(qualifyPartnerAssimilation(input({ ...complete, absenceReason: answer("imprisonment", "2026-10-01") })))
      .toMatchObject({ status: "needs_review", reasonCodes: ["CONTRADICTORY_FACTS"] });
    expect(qualifyPartnerAssimilation(input({ ...complete, familyRelationship: answer("foster_parent"), absenceReason: answer("imprisonment", "2026-02-30") })))
      .toMatchObject({ status: "excluded_on_facts", reasonCodes: ["FAMILY_RELATIONSHIP_EXCLUSION"] });
  });

  it("lets an independent exclusion prevail over an irrelevant contradiction", () => {
    const result = qualifyPartnerAssimilation(input({
      familyRelationship: answer("kin_or_ally_through_third_degree"),
      sameRoof: answer(true), mainlySharedHousekeeping: answer(false), formsDeFactoHousehold: answer(true),
    }));
    expect(result).toMatchObject({ status: "excluded_on_facts", reasonCodes: ["FAMILY_RELATIONSHIP_EXCLUSION"] });
  });

  it("flags a decisive contradiction and does not mutate frozen input or depend on property order", () => {
    const conflicting = input({ ...complete, mainlySharedHousekeeping: answer(false) });
    expect(qualifyPartnerAssimilation(conflicting)).toMatchObject({ status: "needs_review", reasonCodes: ["CONTRADICTORY_FACTS"] });
    const frozenFacts = Object.freeze({ ...complete });
    const frozen = Object.freeze(input(frozenFacts));
    const first = qualifyPartnerAssimilation(frozen);
    expect(qualifyPartnerAssimilation(frozen)).toEqual(first);
    const reversed = input(Object.fromEntries(Object.entries(complete).reverse()) as FamilyPersonQualificationFacts);
    expect(qualifyPartnerAssimilation(reversed)).toEqual(first);
    expect(frozen.facts).toBe(frozenFacts);
  });
});
