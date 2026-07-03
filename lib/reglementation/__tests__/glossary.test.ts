// lib/reglementation/__tests__/glossary.test.ts
import { describe, it, expect } from "vitest";
import { parseDefinitions, termsInText, isDistinctive } from "../glossary";

const AM_ART1 = [
  "Pour l'application du présent arrêté, il faut entendre par :",
  "",
  "1° l'arrêté royal : l'arrêté royal du 25 novembre 1991 portant réglementation du chômage;",
  "",
  "2° le Ministre : le Ministre qui a la réglementation du chômage dans ses attributions;",
  "",
  "3° l'Office : l'Office national de l'emploi institué par l'article 7 de l'arrêté-loi;",
].join("\n");

const WITH_SUBS = [
  "1° chômeur complet :",
  "a) le chômeur qui n'est pas lié par un contrat de travail;",
  "b) le travailleur à temps partiel visé à l'article 29;",
  "2° chômeur temporaire :",
  "a) le chômeur lié par un contrat de travail suspendu;",
].join("\n");

describe("parseDefinitions", () => {
  it("extrait les couples terme : définition", () => {
    const entries = parseDefinitions(AM_ART1, "26_11_1991-1-art_1");
    const arrete = entries.find((e) => e.term === "l'arrêté royal");
    expect(arrete).toBeTruthy();
    expect(arrete!.definition).toContain("25 novembre 1991");
    expect(entries.map((e) => e.term)).toContain("le Ministre");
    expect(entries.every((e) => e.sourceRiolexId === "26_11_1991-1-art_1")).toBe(true);
  });

  it("gère les termes à sous-items (a/b/c)", () => {
    const entries = parseDefinitions(WITH_SUBS, "src");
    const cc = entries.find((e) => e.term === "chômeur complet");
    expect(cc).toBeTruthy();
    expect(cc!.definition).toContain("contrat de travail");
    expect(cc!.definition).toContain("temps partiel");
  });

  it("texte sans définitions → []", () => {
    expect(parseDefinitions("Un texte ordinaire sans structure.", "s")).toEqual([]);
  });
});

describe("isDistinctive", () => {
  it("multi-mots ou long = distinctif", () => {
    expect(isDistinctive("chômeur complet")).toBe(true);
    expect(isDistinctive("allocation de garantie de revenus")).toBe(true);
    expect(isDistinctive("Office")).toBe(false);
  });
});

describe("termsInText", () => {
  it("ne retient que les termes présents (insensible aux accents)", () => {
    const entries = parseDefinitions(AM_ART1, "src");
    const present = termsInText(entries, "Le Ministre fixe les regles applicables.");
    expect(present.map((e) => e.term)).toContain("le Ministre");
    expect(present.map((e) => e.term)).not.toContain("l'arrêté royal");
  });
});
