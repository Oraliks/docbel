import type { Article110VerifierPerson } from "@/lib/regulatory-decision/article-110-verifier";

export type FamilyTreeBranch = "alone" | "partner" | "others";

export type FamilyTreeState = {
  branch?: FamilyTreeBranch;
  people: Article110VerifierPerson[];
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

export function updateTreePerson(
  state: FamilyTreeState,
  id: string,
  patch: Partial<Article110VerifierPerson>,
): FamilyTreeState {
  return { ...state, people: state.people.map((person) => person.id === id ? { ...person, ...patch } : person) };
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
