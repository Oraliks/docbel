import type { Article110VerifierPerson } from "@/lib/regulatory-decision/article-110-verifier";

export type HouseholdRole = "spouse" | "partner" | "child" | "father" | "mother" | "sibling" | "grandparent" | "cousin" | "friend" | "other";
export type VerifierMember = Article110VerifierPerson & { role: HouseholdRole };

export function createVerifierMember(id: string, role: HouseholdRole): VerifierMember {
  const relation = role === "spouse" ? "spouse" : role === "partner" ? "partner" : role === "child" ? "child" : role === "cousin" || role === "friend" ? "third_party" : role === "other" ? "unknown" : "relative";
  return { id, role, relation, label: role, ...(role === "father" || role === "mother" || role === "grandparent" ? { isAscendant: true } : {}) };
}

export function addVerifierMember(people: VerifierMember[], role: HouseholdRole, id: string) {
  if ((role === "spouse" || role === "partner") && people.some((person) => person.relation === "spouse" || person.relation === "partner")) return people;
  return [...people, createVerifierMember(id, role)];
}

export function updateVerifierMember(people: VerifierMember[], id: string, patch: Partial<VerifierMember>) {
  return people.map((person) => {
    if (person.id !== id) return person;
    const next = { ...person, ...patch };
    if (patch.hasProfessionalIncome === false) Object.assign(next, { professionalIncomeType: undefined, professionalIncomeOtherDescription: undefined, professionalIncomeAmount: undefined, professionalIncomeContract: undefined, professionalIncomeVariable: undefined, c110aReceived: undefined, c110aMonthlyDeclaredIncome: undefined });
    if (patch.hasReplacementIncome === false) Object.assign(next, { replacementIncomeType: undefined, replacementIncomeAmount: undefined });
    if (patch.professionalIncomeType && patch.professionalIncomeType !== person.professionalIncomeType) Object.assign(next, { professionalIncomeOtherDescription: undefined, professionalIncomeAmount: undefined, professionalIncomeContract: undefined, professionalIncomeVariable: undefined, c110aReceived: undefined, c110aMonthlyDeclaredIncome: undefined });
    return next;
  });
}

export function removeVerifierMember(people: VerifierMember[], id: string) { return people.filter((person) => person.id !== id); }
