import type { Article110VerifierInput, Article110VerifierPerson } from "@/lib/regulatory-decision/article-110-verifier";
import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";

export type FamilyTreeBranch = "alone" | "partner" | "others";
export type DeclaredAloneSituation = "none" | "alternating_care" | "alimony";

export type FamilyTreeState = {
  branch?: FamilyTreeBranch;
  people: Article110VerifierPerson[];
  /** A qualified declaration used only by the short isolated-person orientation. */
  declaredAloneSituation?: DeclaredAloneSituation;
  registryLivesAlone?: boolean;
  relevantHouseholdDiscordance?: boolean;
  alimony?: boolean;
  alimonyLegalCondition?: boolean;
  alimonyLegalBasis?: "established" | "pending" | "not_established" | "unknown";
  alimonyBeneficiary?: "minor_child" | "adult_child" | "other";
  alimonyAdultChildInNeed?: boolean;
  alternatingCare?: boolean;
  alternatingCareDaysPerWeek?: number;
  alternatingCareCycle?: "monthly" | "quarterly" | "semiannual" | "annual";
  alternatingCareFamilyAllowances?: boolean;
  alternatingCareChildHasRelevantIncome?: boolean;
  cohousing?: boolean;
  cohousingAutonomousLiving?: boolean;
  cohousingRecognition?: "recognised_same_address" | "pending" | "not_recognised";
  cohousingRelevantAddressChanged?: boolean;
  /** Declared once for the whole children branch when it can change the result. */
  anyChildReceivesFamilyAllowances?: boolean;
};

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

/** The Tree owns navigation only; this is its complete translation to common facts. */
export function familyTreeArticle110Input(
  state: FamilyTreeState,
  thresholds: C1BaremeThresholds,
  asOf: string,
): Article110VerifierInput {
  const isAlone = state.branch === "alone";
  const alimonySelected = state.declaredAloneSituation === "alimony";
  const careSelected = state.declaredAloneSituation === "alternating_care";
  return {
    people: state.people,
    thresholds,
    asOf,
    isAloneExplicit: isAlone,
    registryLivesAlone: state.registryLivesAlone,
    relevantHouseholdDiscordance: state.relevantHouseholdDiscordance,
    householdMembersPending: state.branch === "others" && state.people.length === 0,
    alimony: isAlone ? {
      enabled: alimonySelected,
      legalConditionEstablished: state.alimonyLegalCondition,
      legalBasis: state.alimonyLegalBasis,
      beneficiary: state.alimonyBeneficiary,
      adultChildInNeed: state.alimonyAdultChildInNeed,
    } : undefined,
    alternatingCare: isAlone ? {
      enabled: careSelected,
      averageDaysPerWeek: state.alternatingCareDaysPerWeek,
      cycle: state.alternatingCareCycle,
      familyAllowances: state.alternatingCareFamilyAllowances,
      childHasRelevantIncome: state.alternatingCareChildHasRelevantIncome,
    } : undefined,
    cohousing: state.cohousing,
    cohousingAutonomousLiving: state.cohousingAutonomousLiving,
    cohousingRecognition: state.cohousingRecognition,
    cohousingRelevantAddressChanged: state.cohousingRelevantAddressChanged,
  };
}
