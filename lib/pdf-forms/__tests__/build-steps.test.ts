import { describe, expect, it } from "vitest";
import { buildSteps } from "../build-steps";
import type { PublicField } from "../public-serializer";

const LABELS = { fallbackTitle: "Informations", fallbackSubtitle: "Complétez les champs" };

function field(overrides: Partial<PublicField> & { id: string }): PublicField {
  return {
    type: "text",
    required: false,
    label: { fr: overrides.id },
    ...overrides,
  } as PublicField;
}

describe("buildSteps — comportement inchangé sans stepPriority (rétrocompatibilité)", () => {
  it("toutes les sections deviennent des core steps, comme aujourd'hui", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "adresse" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps).toHaveLength(2);
    expect(result.coreSteps[0].id).toBe("identite");
    expect(result.coreSteps[1].id).toBe("adresse");
    expect(result.optionalSections).toHaveLength(0);
  });

  it("regroupe globalement par section (pas seulement les champs consécutifs)", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "adresse" }),
      field({ id: "c", section: "identite" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps).toHaveLength(2);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["a", "c"]);
  });

  it("un champ sans section utilise le titre/sous-titre de repli", () => {
    const fields = [field({ id: "a" })];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps[0].title).toBe("Informations");
  });
});

describe("buildSteps — sections optionnelles", () => {
  it("une section stepPriority=optional ne devient pas un core step", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "mes-activites", stepPriority: "optional" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps).toHaveLength(1);
    expect(result.coreSteps[0].id).toBe("identite");
    expect(result.optionalSections).toHaveLength(1);
    expect(result.optionalSections[0].key).toBe("mes-activites");
  });

  it("une section optionnelle SANS réponse est repliée par défaut", () => {
    const fields = [field({ id: "b", section: "mes-activites", stepPriority: "optional" })];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.optionalSections[0].defaultOpen).toBe(false);
  });

  it("une section optionnelle AVEC une valeur déjà répondue est dépliée par défaut", () => {
    const fields = [field({ id: "b", section: "mes-activites", stepPriority: "optional" })];
    const result = buildSteps(fields, { b: "oui" }, "fr", LABELS);
    expect(result.optionalSections[0].defaultOpen).toBe(true);
  });

  it("mélange core + optional : l'ordre des core steps ne compte pas les sections optionnelles", () => {
    const fields = [
      field({ id: "a", section: "identite" }),
      field({ id: "b", section: "mes-activites", stepPriority: "optional" }),
      field({ id: "c", section: "adresse" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps.map((s) => s.id)).toEqual(["identite", "adresse"]);
    expect(result.optionalSections.map((s) => s.key)).toEqual(["mes-activites"]);
  });
});

describe("buildSteps — champs invisibles et auto-champs exclus", () => {
  it("un champ dont visibleIf n'est pas satisfait n'apparaît dans aucun step", () => {
    const fields = [
      field({ id: "a", section: "demande" }),
      field({ id: "b", section: "demande", visibleIf: { fieldId: "a", op: "equals", value: "oui" } }),
    ];
    const result = buildSteps(fields, { a: "non" }, "fr", LABELS);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["a"]);
  });
});
