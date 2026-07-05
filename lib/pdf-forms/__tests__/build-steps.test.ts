import { describe, expect, it } from "vitest";
import { buildSteps, buildMacroSteps } from "../build-steps";
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

  it("un champ signature est exclu des steps (auto-rempli)", () => {
    const fields = [
      field({ id: "name", section: "demande" }),
      field({ id: "sig", section: "demande", type: "signature" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["name"]);
  });

  it("un champ avec prefillFrom=system.today est exclu des steps (date de création auto-injectée)", () => {
    const fields = [
      field({ id: "name", section: "demande" }),
      field({ id: "created_at", section: "demande", type: "text", prefillFrom: "system.today" }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["name"]);
  });

  it("un champ signature détecté au label est exclu (rétrocompatibilité)", () => {
    const fields = [
      field({ id: "name", section: "demande" }),
      field({ id: "sig", section: "demande", type: "text", label: { fr: "Signature numérique" } }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["name"]);
  });

  it("un champ date créée détecté au label est exclu (rétrocompatibilité)", () => {
    const fields = [
      field({ id: "name", section: "demande" }),
      field({ id: "date_doc", section: "demande", type: "text", label: { fr: "Date de création" } }),
    ];
    const result = buildSteps(fields, {}, "fr", LABELS);
    expect(result.coreSteps[0].fields.map((f) => f.id)).toEqual(["name"]);
  });
});

describe("buildMacroSteps — regroupement en macro-étapes (mode opt-in)", () => {
  it("renvoie null si aucun champ n'a de stepGroup (formulaire non-macro)", () => {
    const fields = [field({ id: "a", section: "identite" }), field({ id: "b", section: "adresse" })];
    expect(buildMacroSteps(fields, {})).toBeNull();
  });

  it("ordonne selon l'ordre canonique du C1, pas l'ordre des champs du PDF", () => {
    // Champs dans l'ordre PDF : identité d'abord, motif ensuite — l'ordre du
    // parcours doit rester Motif → Identité → Activités&revenus → Famille.
    const fields = [
      field({ id: "i1", section: "identite", stepGroup: "identite" }),
      field({ id: "m", section: "demande", stepGroup: "motif" }),
      field({ id: "f", section: "situation-familiale", stepGroup: "famille" }),
      field({ id: "a", section: "mes-activites", stepGroup: "activites-revenus" }),
    ];
    const steps = buildMacroSteps(fields, {});
    expect(steps).not.toBeNull();
    expect(steps!.map((s) => s.id)).toEqual(["motif", "identite", "activites-revenus", "famille"]);
  });

  it("sous-groupe par section à l'intérieur d'une macro-étape (sous-titres)", () => {
    const fields = [
      field({ id: "i1", section: "identite", stepGroup: "identite" }),
      field({ id: "p1", section: "mode-paiement", stepGroup: "identite" }),
      field({ id: "i2", section: "identite", stepGroup: "identite" }),
    ];
    const steps = buildMacroSteps(fields, {})!;
    const identite = steps.find((s) => s.id === "identite")!;
    expect(identite.sections.map((sec) => sec.key)).toEqual(["identite", "mode-paiement"]);
    expect(identite.sections[0].fields.map((f) => f.id)).toEqual(["i1", "i2"]);
  });

  it("rattache les champs SANS stepGroup à la dernière macro-étape (advanced)", () => {
    const fields = [
      field({ id: "m", section: "demande", stepGroup: "motif" }),
      field({ id: "final1", section: "divers", stepGroup: "final" }),
      field({ id: "raw1" }),
      field({ id: "raw2", section: undefined }),
    ];
    const steps = buildMacroSteps(fields, {})!;
    expect(steps.map((s) => s.id)).toEqual(["motif", "final"]);
    expect(steps[0].advanced).toEqual([]);
    expect(steps[1].advanced.map((f) => f.id)).toEqual(["raw1", "raw2"]);
  });

  it("exclut les champs invisibles (visibleIf non satisfait) et auto (signature)", () => {
    const fields = [
      field({ id: "m", section: "demande", stepGroup: "motif" }),
      field({ id: "gated", section: "divers", stepGroup: "final", visibleIf: { fieldId: "m", op: "equals", value: "x" } }),
      field({ id: "sig", type: "signature", section: "signature", stepGroup: "final" }),
    ];
    const steps = buildMacroSteps(fields, {})!;
    // "gated" caché (m != x) et "sig" auto → seul "motif" reste, pas de "final".
    expect(steps.map((s) => s.id)).toEqual(["motif"]);
  });
});
