import type { Article110VerifierPerson } from "@/lib/regulatory-decision/article-110-verifier";

export type HouseholdRole = "spouse" | "partner" | "child" | "father" | "mother" | "sibling" | "grandparent" | "uncle_aunt" | "nephew_niece" | "cousin" | "friend" | "other";
export type VerifierMember = Article110VerifierPerson & { role: HouseholdRole };

const uniqueRoles = new Set<HouseholdRole>(["spouse", "partner", "father", "mother"]);

export function createVerifierMember(id: string, role: HouseholdRole): VerifierMember {
  const relation = role === "spouse" ? "spouse" : role === "partner" ? "partner" : role === "child" ? "child"
    : role === "cousin" || role === "friend" ? "third_party" : role === "other" ? "unknown" : "relative";
  return {
    id, role, relation, label: role,
    ...(role === "partner" ? { partnerEstablished: true } : {}),
    ...(role === "father" || role === "mother" || role === "grandparent" ? { isAscendant: true } : {}),
  };
}

export function canAddVerifierMember(people: VerifierMember[], role: HouseholdRole) {
  if (role === "spouse" || role === "partner") {
    return !people.some((person) => person.role === "spouse" || person.role === "partner");
  }
  return !uniqueRoles.has(role) || !people.some((person) => person.role === role);
}

/**
 * Keeps the composition selector controlled until the person is actually added.
 * The UI must never require selecting the same role twice.
 */
export function addSelectedVerifierMember(people: VerifierMember[], role: HouseholdRole | "", id: string) {
  if (!role || !canAddVerifierMember(people, role)) return { people, selectedRole: role } as const;
  return { people: [...people, createVerifierMember(id, role)], selectedRole: "" } as const;
}

export function updateVerifierMember(people: VerifierMember[], id: string, patch: Partial<VerifierMember>) {
  return people.map((person) => person.id === id ? { ...person, ...patch } : person);
}

export function removeVerifierMember(people: VerifierMember[], id: string) {
  return people.filter((person) => person.id !== id);
}

export function moveVerifierMember(people: VerifierMember[], id: string, direction: -1 | 1) {
  const index = people.findIndex((person) => person.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= people.length) return people;
  const next = [...people];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
