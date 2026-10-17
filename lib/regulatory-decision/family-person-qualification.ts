import type {
  FamilyPersonQualificationFactKey,
  FamilyPersonQualificationFacts,
  FamilyPersonQualificationInput,
} from "./family-person-facts";

const COHABITATION = "situation_familiale_cohabitation_am59";
const ASSIMILATION = "situation_familiale_partenaire_assimilation_art110";
const FINANCIAL = "situation_familiale_charge_financiere_am59";
const CPAS = "situation_familiale_cpas_contexte_partenaire";

export type PartnerAssimilationStatus =
  | "eligible_on_facts"
  | "excluded_on_facts"
  | "needs_information"
  | "needs_review";

export type PartnerAssimilationReasonCode =
  | "FACTS_ESTABLISHED"
  | "FAMILY_RELATIONSHIP_EXCLUSION"
  | "CHILD_ALLOWANCE_ENTITLEMENT"
  | "PARENT_MAINTENANCE_DEPENDENCY"
  | "RIS_OR_EQUIVALENT"
  | "OTHER_UNEMPLOYED_COHABITANT_DEPENDENCY"
  | "MARRIED_WITH_COHABITING_SPOUSE"
  | "NO_DE_FACTO_HOUSEHOLD"
  | "COHABITATION_NOT_ESTABLISHED"
  | "ABSENCE_REQUIRES_REVIEW"
  | "CONTRADICTORY_FACTS"
  | "UNSUPPORTED_DATE"
  | "MISSING_DECISIVE_FACTS";

export type PartnerAssimilationAssessment = Readonly<{
  personId: FamilyPersonQualificationInput["personId"];
  declaredRelation: FamilyPersonQualificationInput["declaredRelation"];
  asOf: string;
  status: PartnerAssimilationStatus;
  decisiveFactKeys: FamilyPersonQualificationFactKey[];
  missingFactKeys: FamilyPersonQualificationFactKey[];
  reasonCodes: PartnerAssimilationReasonCode[];
  sourceRuleIds: string[];
  declarationStatus: FamilyPersonQualificationInput["declarationStatus"];
  declarationRequirement: "required" | "not_assessed";
  preservePartnerCpasContext: boolean;
  nextStep:
    | "continue_household_assessment"
    | "complete_facts"
    | "clarify_actual_relationship"
    | "manual_review";
}>;

type FactKey = FamilyPersonQualificationFactKey;
type AnswerValue<K extends FactKey> = NonNullable<FamilyPersonQualificationFacts[K]>["value"];
type ReadFact<T> = { value: T | undefined; invalidDate: boolean };

/** Strict civil date, independent of the machine's timezone and current clock. */
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Material qualification only: no household category, income test or official decision. */
export function qualifyPartnerAssimilation(
  input: FamilyPersonQualificationInput,
): PartnerAssimilationAssessment {
  const read = <K extends FactKey>(key: K): ReadFact<AnswerValue<K>> => {
    const answer = input.facts[key];
    if (!answer || answer.value === undefined) return { value: undefined, invalidDate: false };
    if (answer.effectiveAt && !validDate(answer.effectiveAt)) return { value: undefined, invalidDate: true };
    if (answer.effectiveAt && answer.effectiveAt > input.asOf) return { value: undefined, invalidDate: false };
    return { value: answer.value as AnswerValue<K>, invalidDate: false };
  };

  const ris = read("receivesRisOrEquivalent");
  const preservePartnerCpasContext = input.declaredRelation === "partner" && ris.value === true;
  const result = (
    status: PartnerAssimilationStatus,
    decisiveFactKeys: FactKey[],
    missingFactKeys: FactKey[],
    reasonCodes: PartnerAssimilationReasonCode[],
    sourceRuleIds: string[],
  ): PartnerAssimilationAssessment => ({
    personId: input.personId,
    declaredRelation: input.declaredRelation,
    asOf: input.asOf,
    status,
    decisiveFactKeys,
    missingFactKeys,
    reasonCodes,
    sourceRuleIds,
    declarationStatus: input.declarationStatus,
    declarationRequirement: status === "eligible_on_facts" ? "required" : "not_assessed",
    preservePartnerCpasContext,
    nextStep: status === "eligible_on_facts" ? "continue_household_assessment"
      : status === "excluded_on_facts" ? "clarify_actual_relationship"
        : status === "needs_information" ? "complete_facts" : "manual_review",
  });

  // This contract covers the cumulative financial conditions from 01/07/1997.
  if (!validDate(input.asOf) || input.asOf < "1997-07-01") {
    return result("needs_review", [], [], ["UNSUPPORTED_DATE"], []);
  }

  // A proven independent exclusion ends this qualification before unrelated unknowns.
  const exclusions: Array<{ keys: FactKey[]; applies: boolean; reason: PartnerAssimilationReasonCode; rules: string[] }> = [
    { keys: ["familyRelationship"], applies: ["kin_or_ally_through_third_degree", "foster_parent"].includes(read("familyRelationship").value ?? ""), reason: "FAMILY_RELATIONSHIP_EXCLUSION", rules: [ASSIMILATION] },
    { keys: ["childWithFamilyAllowanceEntitlement"], applies: read("childWithFamilyAllowanceEntitlement").value === true, reason: "CHILD_ALLOWANCE_ENTITLEMENT", rules: [ASSIMILATION] },
    { keys: ["dependentOnParentWithMaintenanceDuty"], applies: read("dependentOnParentWithMaintenanceDuty").value === true, reason: "PARENT_MAINTENANCE_DEPENDENCY", rules: [FINANCIAL] },
    { keys: ["receivesRisOrEquivalent"], applies: ris.value === true, reason: "RIS_OR_EQUIVALENT", rules: [FINANCIAL, CPAS] },
    { keys: ["dependentOnAnotherUnemployedCohabitant"], applies: read("dependentOnAnotherUnemployedCohabitant").value === true, reason: "OTHER_UNEMPLOYED_COHABITANT_DEPENDENCY", rules: [FINANCIAL] },
    { keys: ["marriedToAnotherPerson", "cohabitsWithThatSpouse"], applies: read("marriedToAnotherPerson").value === true && read("cohabitsWithThatSpouse").value === true, reason: "MARRIED_WITH_COHABITING_SPOUSE", rules: [FINANCIAL] },
  ];
  const certain = exclusions.filter((item) => item.applies);
  if (certain.length) {
    return result(
      "excluded_on_facts",
      [...new Set(certain.flatMap((item) => item.keys))],
      [],
      certain.map((item) => item.reason),
      [...new Set(certain.flatMap((item) => item.rules))],
    );
  }

  const required: FactKey[] = [
    "sameRoof", "mainlySharedHousekeeping", "formsDeFactoHousehold",
    "familyRelationship", "childWithFamilyAllowanceEntitlement",
    "dependentOnParentWithMaintenanceDuty", "receivesRisOrEquivalent",
    "dependentOnAnotherUnemployedCohabitant", "marriedToAnotherPerson",
  ];
  if (read("marriedToAnotherPerson").value === true) required.push("cohabitsWithThatSpouse");
  if (read("sameRoof").value === false) required.push("absenceReason");

  const invalid = required.filter((key) => read(key).invalidDate);
  const absenceStart = read("absenceStartedAt");
  const absenceDate = absenceStart.value;
  if (read("sameRoof").value === false && (absenceStart.invalidDate ||
    (absenceDate !== undefined && (!validDate(absenceDate) || absenceDate > input.asOf)))) {
    invalid.push("absenceStartedAt");
  }
  if (invalid.length) return result("needs_review", invalid, [], ["UNSUPPORTED_DATE"], [COHABITATION]);

  const sameRoof = read("sameRoof").value;
  const shared = read("mainlySharedHousekeeping").value;
  const deFacto = read("formsDeFactoHousehold").value;
  const absence = read("absenceReason").value;
  if ((deFacto === true && shared === false) ||
    (deFacto === false && sameRoof === true && shared === true) ||
    (sameRoof === true && absence !== undefined && absence !== "none") ||
    (sameRoof === false && absence === "none" && deFacto === true)) {
    return result("needs_review", ["sameRoof", "mainlySharedHousekeeping", "formsDeFactoHousehold"], [], ["CONTRADICTORY_FACTS"], [COHABITATION, ASSIMILATION]);
  }

  if (shared === false || deFacto === false) {
    const keys: FactKey[] = [...(shared === false ? ["mainlySharedHousekeeping" as const] : []), ...(deFacto === false ? ["formsDeFactoHousehold" as const] : [])];
    return result("excluded_on_facts", keys, [], ["NO_DE_FACTO_HOUSEHOLD"], [COHABITATION, ASSIMILATION]);
  }
  if (sameRoof === false && absence === "none") {
    return result("excluded_on_facts", ["sameRoof", "absenceReason"], [], ["COHABITATION_NOT_ESTABLISHED"], [COHABITATION]);
  }
  if (sameRoof === false && absence !== undefined) {
    return result("needs_review", ["sameRoof", "absenceReason"], [], ["ABSENCE_REQUIRES_REVIEW"], [COHABITATION]);
  }
  if (sameRoof === false && absence === undefined) {
    return result("needs_information", ["sameRoof"], ["absenceReason"], ["MISSING_DECISIVE_FACTS"], [COHABITATION]);
  }

  const missing = required.filter((key) => read(key).value === undefined);
  if (missing.length) return result("needs_information", [], missing, ["MISSING_DECISIVE_FACTS"], []);

  return result("eligible_on_facts", required, [], ["FACTS_ESTABLISHED"], [COHABITATION, ASSIMILATION, FINANCIAL]);
}
