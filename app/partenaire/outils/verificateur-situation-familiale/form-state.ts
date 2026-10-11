import type { Article110VerifierPerson } from "@/lib/regulatory-decision/article-110-verifier";

export type HouseholdRole = "spouse" | "partner" | "child" | "father" | "mother" | "sibling" | "grandparent" | "friend" | "other";
export type VerifierMember = Article110VerifierPerson & { role: HouseholdRole };

export function createVerifierMember(id: string, role: HouseholdRole): VerifierMember {
  const relation = role === "spouse" ? "spouse" : role === "partner" ? "partner" : role === "child" ? "child" : role === "friend" ? "third_party" : role === "other" ? "unknown" : "relative";
  return { id, role, relation, label: role, ...(role === "partner" ? { partnerEstablished: true } : {}), ...(role === "father" || role === "mother" || role === "grandparent" ? { isAscendant: true } : {}) };
}

export function addVerifierMember(people: VerifierMember[], role: HouseholdRole, id: string) {
  if ((role === "spouse" || role === "partner") && people.some((person) => person.relation === "spouse" || person.relation === "partner")) return people;
  return [...people, createVerifierMember(id, role)];
}

export function updateVerifierMember(people: VerifierMember[], id: string, patch: Partial<VerifierMember>) {
  return people.map((person) => person.id === id ? { ...person, ...patch } : person);
}

export function removeVerifierMember(people: VerifierMember[], id: string) { return people.filter((person) => person.id !== id); }
