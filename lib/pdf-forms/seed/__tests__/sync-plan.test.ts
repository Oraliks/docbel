import { describe, expect, it } from "vitest";
import { planSeedSync, sameSeedJson } from "../sync-plan";

const champ = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  pdfFieldName: id,
  type: "text",
  required: false,
  label: { fr: id },
  ...extra,
});

const declencheur = (slug: string) => ({
  whenFieldId: "motif",
  whenValue: "oui",
  requiresFormSlug: slug,
});

describe("sameSeedJson", () => {
  it("ignore l'ordre des clés (Prisma réordonne le JSON qu'il relit)", () => {
    expect(sameSeedJson({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameSeedJson([{ id: "x", type: "text" }], [{ type: "text", id: "x" }])).toBe(true);
  });

  it("ignore les propriétés `undefined` (Prisma ne les relit jamais)", () => {
    expect(sameSeedJson({ id: "x" }, { id: "x", help: undefined })).toBe(true);
  });

  it("voit une vraie différence de valeur", () => {
    expect(sameSeedJson({ id: "x" }, { id: "y" })).toBe(false);
    expect(sameSeedJson([champ("a")], [champ("a"), champ("b")])).toBe(false);
  });
});

describe("planSeedSync", () => {
  it("re-semis idempotent : rien à écrire, aucune révision", () => {
    const plan = planSeedSync({
      existingFields: [champ("nom"), champ("prenom")],
      improvedFields: [champ("nom"), champ("prenom")],
      existingTriggers: [declencheur("c1a")],
      targetTriggers: [declencheur("c1a")],
    });
    expect(plan.fieldsChanged).toBe(false);
    expect(plan.triggersChanged).toBe(false);
    expect(plan.needsWrite).toBe(false);
    expect(plan.needsRevision).toBe(false);
  });

  it("re-semis idempotent MALGRÉ un réordonnancement des clés par Prisma", () => {
    // Le cas qui rendrait chaque re-semis « modifiant » avec une comparaison
    // par JSON.stringify : même contenu, clés dans un autre ordre.
    const plan = planSeedSync({
      existingFields: [{ type: "text", label: { fr: "Nom" }, id: "nom" }],
      improvedFields: [{ id: "nom", label: { fr: "Nom" }, type: "text" }],
      existingTriggers: [],
      targetTriggers: [],
    });
    expect(plan.fieldsChanged).toBe(false);
    expect(plan.needsWrite).toBe(false);
  });

  it("champs modifiés : écriture + révision + bump", () => {
    const plan = planSeedSync({
      existingFields: [champ("nom")],
      improvedFields: [champ("nom"), champ("niss")],
      existingTriggers: [],
      targetTriggers: [],
    });
    expect(plan.fieldsChanged).toBe(true);
    expect(plan.needsWrite).toBe(true);
    expect(plan.needsRevision).toBe(true);
  });

  it("déclencheurs SEULS modifiés : écriture, mais ni révision ni bump", () => {
    // Même règle que le PATCH admin : une révision est un instantané de
    // `fields`. Changer les seuls déclencheurs n'en justifie pas une.
    const plan = planSeedSync({
      existingFields: [champ("nom")],
      improvedFields: [champ("nom")],
      existingTriggers: [],
      targetTriggers: [declencheur("c1a")],
    });
    expect(plan.fieldsChanged).toBe(false);
    expect(plan.triggersChanged).toBe(true);
    expect(plan.needsWrite).toBe(true);
    expect(plan.needsRevision).toBe(false);
  });

  it("`triggers` null en base (colonne jamais écrite) compte comme un changement vers []", () => {
    const plan = planSeedSync({
      existingFields: [champ("nom")],
      improvedFields: [champ("nom")],
      existingTriggers: null,
      targetTriggers: [],
    });
    expect(plan.triggersChanged).toBe(true);
    expect(plan.needsWrite).toBe(true);
    expect(plan.needsRevision).toBe(false);
  });
});
