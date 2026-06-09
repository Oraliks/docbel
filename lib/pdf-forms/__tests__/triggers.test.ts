import { describe, it, expect } from "vitest";
import {
  evaluateTrigger,
  collectTriggeredSlugs,
  parseTriggers,
  activeTriggers,
} from "../triggers";
import type { PdfFormTrigger } from "../types";

const TRIG: PdfFormTrigger = {
  whenFieldId: "tremplin",
  whenValue: "oui",
  unlessFieldId: "tremplinDeja",
  unlessValue: "oui",
  requiresFormSlug: "c1c",
  reason: { fr: "Tremplin à déclarer" },
};

describe("evaluateTrigger", () => {
  it("renvoie true quand whenField=whenValue et pas d'exclusion", () => {
    expect(evaluateTrigger(TRIG, { tremplin: "oui" })).toBe(true);
  });

  it("renvoie false si whenField ≠ whenValue", () => {
    expect(evaluateTrigger(TRIG, { tremplin: "non" })).toBe(false);
  });

  it("renvoie false si whenField absent du payload", () => {
    expect(evaluateTrigger(TRIG, {})).toBe(false);
  });

  it("renvoie false si l'exclusion est satisfaite", () => {
    expect(
      evaluateTrigger(TRIG, { tremplin: "oui", tremplinDeja: "oui" })
    ).toBe(false);
  });

  it("renvoie true si l'exclusion existe mais n'est pas satisfaite", () => {
    expect(
      evaluateTrigger(TRIG, { tremplin: "oui", tremplinDeja: "non" })
    ).toBe(true);
  });

  it("compare loosement (casse + espaces)", () => {
    expect(evaluateTrigger(TRIG, { tremplin: "  OUI " })).toBe(true);
  });

  it("tolère boolean ↔ string", () => {
    const t: PdfFormTrigger = { ...TRIG, whenValue: true, unlessFieldId: undefined };
    expect(evaluateTrigger(t, { tremplin: "true" })).toBe(true);
    expect(evaluateTrigger(t, { tremplin: true })).toBe(true);
  });
});

describe("collectTriggeredSlugs", () => {
  it("déduplique les slugs identiques (3 triggers convergent sur C1A)", () => {
    const triggers: PdfFormTrigger[] = [
      { whenFieldId: "a", whenValue: "oui", requiresFormSlug: "c1a" },
      { whenFieldId: "b", whenValue: "oui", requiresFormSlug: "c1a" },
      { whenFieldId: "c", whenValue: "oui", requiresFormSlug: "c1c" },
    ];
    const slugs = collectTriggeredSlugs(triggers, { a: "oui", b: "oui", c: "non" });
    expect(slugs.sort()).toEqual(["c1a"]);
  });

  it("renvoie [] si aucun trigger ne matche", () => {
    expect(collectTriggeredSlugs([TRIG], { tremplin: "non" })).toEqual([]);
  });
});

describe("activeTriggers", () => {
  it("renvoie les triggers satisfaits avec leur raison", () => {
    const triggers: PdfFormTrigger[] = [TRIG, { ...TRIG, whenFieldId: "autre", requiresFormSlug: "c1b" }];
    const active = activeTriggers(triggers, { tremplin: "oui" });
    expect(active).toHaveLength(1);
    expect(active[0].reason?.fr).toBe("Tremplin à déclarer");
  });
});

describe("parseTriggers", () => {
  it("filtre les éléments mal formés sans crasher", () => {
    const raw = [
      { whenFieldId: "ok", whenValue: "oui", requiresFormSlug: "c1a" },
      { whenFieldId: 123, whenValue: "oui", requiresFormSlug: "c1a" }, // mal formé
      null,
      { whenFieldId: "ok2", whenValue: true, requiresFormSlug: "c1b", unlessFieldId: "u", unlessValue: "x" },
    ];
    const parsed = parseTriggers(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].unlessFieldId).toBe("u");
  });

  it("retourne [] si raw n'est pas un tableau", () => {
    expect(parseTriggers(null)).toEqual([]);
    expect(parseTriggers("nope")).toEqual([]);
    expect(parseTriggers({})).toEqual([]);
  });
});
