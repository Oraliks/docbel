import type { FamilyPerson } from "./household-composition";
import type { RegulatoryFact } from "./types";

/** A declared answer, not official proof. An absent value remains unknown, unlike false. */
export type QualificationAnswer<T> = Readonly<{
  value?: T;
  origin: RegulatoryFact["origin"];
  /** Field in the source questionnaire; neither proof nor a confidence score. */
  sourceField: string;
  effectiveAt?: string;
}>;

export type FamilyPersonQualificationFacts = Readonly<{
  sameRoof?: QualificationAnswer<boolean>;
  mainlySharedHousekeeping?: QualificationAnswer<boolean>;
  formsDeFactoHousehold?: QualificationAnswer<boolean>;

  /** Supported family link, never inferred from declaredRelation. Foster parent means the legally qualified link. */
  familyRelationship?: QualificationAnswer<
    "none" | "kin_or_ally_through_third_degree" | "foster_parent"
  >;
  /** Allowances for this candidate person, claimable by the worker or another family member; not allowances they receive for their children. */
  childWithFamilyAllowanceEntitlement?: QualificationAnswer<boolean>;
  dependentOnParentWithMaintenanceDuty?: QualificationAnswer<boolean>;
  /** RIS or its specified equivalent, not any assistance from the CPAS. */
  receivesRisOrEquivalent?: QualificationAnswer<boolean>;
  dependentOnAnotherUnemployedCohabitant?: QualificationAnswer<boolean>;

  marriedToAnotherPerson?: QualificationAnswer<boolean>;
  cohabitsWithThatSpouse?: QualificationAnswer<boolean>;

  absenceReason?: QualificationAnswer<
    | "none"
    | "professional"
    | "imprisonment"
    | "internment"
    | "mental_health_institution"
    | "ordinary_hospitalisation"
    | "care_home"
    | "other"
  >;
  absenceStartedAt?: QualificationAnswer<string>;
}>;

export type FamilyPersonQualificationFactKey = keyof FamilyPersonQualificationFacts;

export type PartnerDeclarationStatus =
  | "unknown"
  | "to_prepare"
  | "prepared"
  | "submitted"
  | "previously_submitted_unchanged";

export type LegacyPartnerDeclarations = Readonly<{
  partnerEstablished?: boolean;
  partenaireConditionsEtablies?: "oui" | "non";
}>;

export type FamilyPersonQualificationInput = Readonly<{
  schemaVersion: 2;
  personId: FamilyPerson["id"];
  declaredRelation: FamilyPerson["relation"];
  /** Date of the situation. An answer without effectiveAt describes this date; no history is invented. */
  asOf: string;
  facts: FamilyPersonQualificationFacts;
  declarationStatus: PartnerDeclarationStatus;
  legacy?: LegacyPartnerDeclarations;
}>;

/** Preserve historical declarations without expanding either boolean into regulatory facts. */
export function qualificationInputFromLegacy(
  person: Readonly<Pick<FamilyPerson, "id" | "relation" | "partnerEstablished">>,
  context: Readonly<{ asOf: string; partenaireConditionsEtablies?: "oui" | "non" }>,
): FamilyPersonQualificationInput {
  return {
    schemaVersion: 2,
    personId: person.id,
    declaredRelation: person.relation,
    asOf: context.asOf,
    facts: {},
    declarationStatus: "unknown",
    legacy: {
      partnerEstablished: person.partnerEstablished,
      partenaireConditionsEtablies: context.partenaireConditionsEtablies,
    },
  };
}
