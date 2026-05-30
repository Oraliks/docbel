import { describe, it, expect } from "vitest";
import { todayISO, assembleFullName } from "../system-values";

describe("todayISO", () => {
  it("renvoie une date au format AAAA-MM-JJ", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("assembleFullName", () => {
  it("assemble Prénom Nom par défaut", () => {
    expect(assembleFullName({ first: "Jean", last: "Dupont" })).toBe("Jean Dupont");
  });
  it("assemble Nom Prénom en mode last-first", () => {
    expect(assembleFullName({ first: "Jean", last: "Dupont" }, "last-first")).toBe("Dupont Jean");
  });
  it("ignore les parties vides", () => {
    expect(assembleFullName({ first: "Jean", last: "" })).toBe("Jean");
    expect(assembleFullName({ first: "", last: "Dupont" }, "last-first")).toBe("Dupont");
  });
  it("tolère une chaîne legacy", () => {
    expect(assembleFullName("Jean Dupont")).toBe("Jean Dupont");
  });
  it("renvoie une chaîne vide pour une valeur non composite", () => {
    expect(assembleFullName(null)).toBe("");
    expect(assembleFullName(42)).toBe("");
  });
});
