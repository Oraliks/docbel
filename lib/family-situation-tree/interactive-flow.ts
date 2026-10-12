import type { Article110VerifierPerson } from "@/lib/regulatory-decision/article-110-verifier";

export type FamilyTreeBranch = "alone" | "partner" | "others";

export type FamilyTreeState = {
  branch?: FamilyTreeBranch;
  people: Article110VerifierPerson[];
  alimony?: boolean;
  alternatingCare?: boolean;
  cohousing?: boolean;
};

/** UI-only state transitions. Categories and thresholds always remain in the shared verifier. */
export function chooseFamilyTreeBranch(branch: FamilyTreeBranch): FamilyTreeState {
  if (branch === "partner") {
    return {
      branch,
      people: [{ id: "partner", relation: "partner", label: "partner", partnerEstablished: true }],
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
