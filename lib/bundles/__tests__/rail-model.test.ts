import { describe, it, expect } from "vitest";
import { buildDemarcheRailModel } from "../rail-model";
import type { BundleItem } from "@/components/docbel/bundle-runner/compute";

function item(p: { id: string; slug: string; required?: boolean; triggered?: boolean }): BundleItem {
  return {
    id: p.id,
    templateId: null,
    pdfFormId: p.id,
    order: 0,
    required: p.required ?? true,
    condition: null as unknown as BundleItem["condition"],
    template: null,
    triggered: p.triggered,
    pdfForm: { id: p.id, slug: p.slug, title: p.slug, description: null, issuer: null },
  };
}

const base = {
  payloads: {},
  applicableSlugs: null,
  hasEligibilityQuestions: true,
  eligibilityCompleted: true,
};

describe("buildDemarcheRailModel", () => {
  const items = [item({ id: "a", slug: "doc-a" }), item({ id: "b", slug: "doc-b", required: false })];

  it("étape 1 'current' tant que la pré-qualification n'est pas complète", () => {
    const m = buildDemarcheRailModel({ ...base, items, completedTemplateIds: [], eligibilityCompleted: false });
    expect(m.situation.state).toBe("current");
    expect(m.documents.state).toBe("upcoming");
    expect(m.retrieve.state).toBe("locked");
  });

  it("sans questions d'éligibilité, l'étape 1 est directement 'done'", () => {
    const m = buildDemarcheRailModel({ ...base, items, completedTemplateIds: [], hasEligibilityQuestions: false, eligibilityCompleted: false });
    expect(m.situation.state).toBe("done");
    expect(m.documents.state).toBe("current");
  });

  it("compteur = documents remplissables visibles, états done/todo", () => {
    const m = buildDemarcheRailModel({ ...base, items, completedTemplateIds: ["a"] });
    expect(m.documents.totalCount).toBe(2);
    expect(m.documents.completedCount).toBe(1);
    expect(m.documents.docs.map((d) => d.state)).toEqual(["done", "todo"]);
  });

  it("verrou : requiredCount/remainingCount comptent le requis, l'optionnel ne bloque pas", () => {
    const m = buildDemarcheRailModel({ ...base, items, completedTemplateIds: ["a"] });
    expect(m.retrieve.requiredCount).toBe(1);
    expect(m.retrieve.remainingCount).toBe(0);
    expect(m.retrieve.state).toBe("current");
    expect(m.allRequiredDone).toBe(true);
  });

  it("un compagnon déclenché non complété maintient le verrou (parité 409)", () => {
    const withCompanion = [...items, item({ id: "triggered-c", slug: "doc-c", triggered: true })];
    const m = buildDemarcheRailModel({ ...base, items: withCompanion, completedTemplateIds: ["a"] });
    expect(m.retrieve.state).toBe("locked");
    expect(m.retrieve.requiredCount).toBe(2);
    expect(m.retrieve.remainingCount).toBe(1);
    expect(m.documents.docs.find((d) => d.key === "triggered-c")?.triggered).toBe(true);
  });

  it("applicableSlugs masque les documents hors dossier", () => {
    const m = buildDemarcheRailModel({ ...base, items, completedTemplateIds: [], applicableSlugs: ["doc-a"] });
    expect(m.documents.docs.map((d) => d.slug)).toEqual(["doc-a"]);
  });
});
