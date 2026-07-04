import { describe, expect, it } from "vitest";
import { C1_QUESTIONS, C1_TRIGGERS } from "../c1-fields-improvements";
import { evaluateTrigger } from "../../triggers";

describe("C1_QUESTIONS — habiteEnColocation", () => {
  it("existe, est de type boolean-like (radio oui/non), et n'est visible que si cohabite", () => {
    const q = C1_QUESTIONS.find((f) => f.id === "habiteEnColocation");
    expect(q).toBeDefined();
    expect(q?.type).toBe("radio");
    expect(q?.visibleIf).toEqual({ fieldId: "statutFamilial", op: "equals", value: "cohabite" });
  });
});

describe("C1_TRIGGERS — colocation → Annexe Regis", () => {
  it("déclenche c1-regis quand habiteEnColocation = oui", () => {
    const t = C1_TRIGGERS.find(
      (trig) => trig.whenFieldId === "habiteEnColocation" && trig.requiresFormSlug === "c1-regis",
    );
    expect(t).toBeDefined();
    expect(evaluateTrigger(t!, { habiteEnColocation: "oui" })).toBe(true);
    expect(evaluateTrigger(t!, { habiteEnColocation: "non" })).toBe(false);
  });

  it("le trigger existant 'situationCohabitationAmbigue' reste inchangé (autres cas ambigus)", () => {
    const t = C1_TRIGGERS.find((trig) => trig.whenFieldId === "situationCohabitationAmbigue");
    expect(t).toBeDefined();
    expect(t?.requiresFormSlug).toBe("c1-regis");
  });

  it("les 9 déclencheurs pré-existants sont toujours présents (aucun retiré)", () => {
    expect(C1_TRIGGERS.length).toBeGreaterThanOrEqual(10); // 9 existants + 1 nouveau
    const targets = C1_TRIGGERS.map((t) => t.requiresFormSlug);
    for (const slug of ["c1-partenaire", "c47", "c1-regis", "c46", "c1c", "c1a", "c1b"]) {
      expect(targets).toContain(slug);
    }
  });
});
