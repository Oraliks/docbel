import type { Article110VerifierInput, Article110VerifierPerson } from "@/lib/regulatory-decision/article-110-verifier";
import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";

export type FamilyTreeBranch = "alone" | "partner" | "others";
export type DeclaredAloneSituation = "none" | "alternating_care" | "alimony";

export type FamilyTreeState = {
  branch?: FamilyTreeBranch;
  people: Article110VerifierPerson[];
  /** A qualified declaration used only by the short isolated-person orientation. */
  declaredAloneSituation?: DeclaredAloneSituation;
  alimony?: boolean;
  alimonyLegalCondition?: boolean;
  alimonyBeneficiary?: "minor_child" | "adult_child" | "other";
  alimonyAdultChildInNeed?: boolean;
  alternatingCare?: boolean;
  alternatingCareDaysPerWeek?: number;
  alternatingCareCycle?: "monthly" | "quarterly" | "semiannual" | "annual";
  alternatingCareFamilyAllowances?: boolean;
  alternatingCareChildHasRelevantIncome?: boolean;
  cohousing?: boolean;
  cohousingRecognition?: boolean;
  cohousingAutonomousLiving?: boolean;
  /** Declared once for the whole children branch when it can change the result. */
  anyChildReceivesFamilyAllowances?: boolean;
};

/** Production boundary: navigation supplies facts; the shared verifier decides. */
export function familyTreeStateToArticle110VerifierInput(
  state: FamilyTreeState,
  thresholds: C1BaremeThresholds,
  asOf: string,
): Article110VerifierInput {
  return {
    people: state.people, thresholds, asOf,
    isAloneExplicit: state.branch === "alone",
    multiPersonHouseholdSelected: state.branch === "others",
    anyChildReceivesFamilyAllowances: state.anyChildReceivesFamilyAllowances,
    isolatedDeclaration: state.declaredAloneSituation === "alternating_care" ? "alternating_care" : undefined,
    alimony: state.declaredAloneSituation === "alimony" ? { enabled: true, legalConditionEstablished: state.alimonyLegalCondition, beneficiary: "minor_child" } : state.alimony === undefined ? undefined : { enabled: state.alimony, legalConditionEstablished: state.alimonyLegalCondition, beneficiary: state.alimonyBeneficiary, adultChildInNeed: state.alimonyAdultChildInNeed },
    alternatingCare: state.alternatingCare === undefined ? undefined : { enabled: state.alternatingCare, averageDaysPerWeek: state.alternatingCareDaysPerWeek, cycle: state.alternatingCareCycle, familyAllowances: state.alternatingCareFamilyAllowances, childHasRelevantIncome: state.alternatingCareChildHasRelevantIncome },
    cohousing: state.cohousing,
    cohousingAutonomousLiving: state.cohousingAutonomousLiving,
    cohousingRecognition: state.cohousingRecognition === true ? "recognised_same_address" : state.cohousingRecognition === false ? "pending" : undefined,
  };
}

/** UI-only state transitions. Categories and thresholds always remain in the shared verifier. */
export function chooseFamilyTreeBranch(branch: FamilyTreeBranch): FamilyTreeState {
  if (branch === "partner") {
    return {
      branch,
      people: [{ id: "partner", relation: "partner", label: "partner" }],
    };
  }
  if (branch === "others") return { branch, people: [] };
  return { branch, people: [] };
}

/** A branch change intentionally drops facts that cannot describe the new household. */
export function resetFamilyTreeBranch(state: FamilyTreeState, branch: FamilyTreeBranch): FamilyTreeState {
  return state.branch === branch ? state : chooseFamilyTreeBranch(branch);
}

/** Selecting a short isolated-person path must not turn the other path into a negative fact. */
export function setDeclaredAloneSituation(state: FamilyTreeState, declaredAloneSituation: DeclaredAloneSituation): FamilyTreeState {
  return {
    ...state,
    declaredAloneSituation,
    alimony: undefined,
    alimonyLegalCondition: undefined,
    alimonyBeneficiary: undefined,
    alimonyAdultChildInNeed: undefined,
    alternatingCare: undefined,
    alternatingCareDaysPerWeek: undefined,
    alternatingCareCycle: undefined,
    alternatingCareFamilyAllowances: undefined,
    alternatingCareChildHasRelevantIncome: undefined,
  };
}

export function updateTreePerson(
  state: FamilyTreeState,
  id: string,
  patch: Partial<Article110VerifierPerson>,
): FamilyTreeState {
  return { ...state, people: state.people.map((person) => person.id === id ? { ...person, ...patch } : person) };
}

/** An activity-type change drops details that belong only to the former activity. */
export function setTreeProfessionalIncomeType(
  state: FamilyTreeState,
  id: string,
  professionalIncomeType: NonNullable<Article110VerifierPerson["professionalIncomeType"]>,
): FamilyTreeState {
  return updateTreePerson(state, id, {
    professionalIncomeType,
    professionalIncomeOtherDescription: undefined,
    professionalIncomeAmount: undefined,
    professionalIncomeContract: undefined,
    professionalIncomeVariable: undefined,
    c110aReceived: undefined,
    c110aMonthlyDeclaredIncome: undefined,
  });
}

/** Removing a household member also removes every fact attached to that person. */
export function removeTreePerson(state: FamilyTreeState, id: string): FamilyTreeState {
  return { ...state, people: state.people.filter((person) => person.id !== id) };
}

/** Changing the relation is a composition change: retain only the identity, not income facts. */
export function changeTreePersonRelation(
  state: FamilyTreeState,
  id: string,
  relation: Exclude<Article110VerifierPerson["relation"], "spouse" | "partner" | "unknown">,
): FamilyTreeState {
  return {
    ...state,
    people: state.people.map((person) => person.id === id
      ? { id: person.id, relation, label: relation }
      : person),
  };
}

/**
 * Converts only facts the interactive tree can represent. Returning undefined
 * prevents a test case from being loaded as a different household.
 */
export function article110VerifierInputToFamilyTreeState(input: Article110VerifierInput): FamilyTreeState | undefined {
  if (input.alternatingCare?.enabled || input.cohousingRecognition === "not_recognised" || input.people.some((person) => person.relation === "unknown")) return undefined;
  const people = input.people.map((person) => ({ ...person }));
  if (input.isAloneExplicit && people.length === 0) {
    return {
      branch: "alone",
      people: [],
      declaredAloneSituation: input.alimony?.enabled ? "alimony" : "none",
      alimonyLegalCondition: input.alimony?.legalConditionEstablished,
    };
  }
  if (people.length === 1 && (people[0]?.relation === "spouse" || people[0]?.relation === "partner") && !input.cohousing && !input.alimony?.enabled) {
    return { branch: "partner", people: [{ ...people[0], id: "partner" }] };
  }
  if (people.length > 0 && people.every((person) => person.relation === "child" || person.relation === "relative" || person.relation === "third_party") && !input.alimony?.enabled) {
    return {
      branch: "others",
      people,
      anyChildReceivesFamilyAllowances: input.anyChildReceivesFamilyAllowances,
      cohousing: input.cohousing,
      cohousingAutonomousLiving: input.cohousingAutonomousLiving,
      cohousingRecognition: input.cohousingRecognition === "recognised_same_address" ? true : input.cohousingRecognition ? false : undefined,
    };
  }
  return undefined;
}
