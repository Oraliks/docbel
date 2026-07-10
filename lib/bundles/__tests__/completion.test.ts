import { describe, expect, it } from "vitest";
import { deriveMissingDocs } from "../completion";
import type { BundleItem } from "@/components/docbel/bundle-runner/compute";

function item(overrides: Partial<BundleItem> & { id: string }): BundleItem {
  return {
    id: overrides.id,
    templateId: null,
    pdfFormId: overrides.pdfFormId ?? `form-${overrides.id}`,
    order: overrides.order ?? 0,
    required: overrides.required ?? true,
    condition: overrides.condition ?? null,
    template: null,
    triggered: overrides.triggered,
    pdfForm: overrides.pdfForm ?? {
      id: overrides.pdfFormId ?? `form-${overrides.id}`,
      slug: overrides.id,
      title: `Doc ${overrides.id}`,
      description: null,
      issuer: null,
    },
  };
}

describe("deriveMissingDocs", () => {
  it("dossier complet : allRequiredDone=true, missing=[]", () => {
    const items = [item({ id: "c1" }), item({ id: "c1c", triggered: true })];
    const result = deriveMissingDocs(items, ["form-c1", "form-c1c"], {}, null);
    expect(result).toEqual({ allRequiredDone: true, missing: [] });
  });

  it("un document déclenché non complété bloque tout, y compris le document d'origine déjà rempli", () => {
    const items = [item({ id: "c1" }), item({ id: "c1c", triggered: true })];
    // Le C1 est complété mais PAS le C1C qu'il a déclenché : le dossier
    // reste incomplet (verrou dossier entier, pas juste le C1C).
    const result = deriveMissingDocs(items, ["form-c1"], {}, null);
    expect(result.allRequiredDone).toBe(false);
    expect(result.missing).toEqual([{ slug: "c1c", title: "Doc c1c" }]);
  });

  it("un document non requis manquant ne bloque pas", () => {
    const items = [
      item({ id: "c1" }),
      item({ id: "optionnel", required: false }),
    ];
    const result = deriveMissingDocs(items, ["form-c1"], {}, null);
    expect(result).toEqual({ allRequiredDone: true, missing: [] });
  });

  it("un document hors dossier (applicableSlugs) n'est jamais compté manquant", () => {
    const items = [item({ id: "c1" }), item({ id: "c109-36-etranger" })];
    const result = deriveMissingDocs(items, ["form-c1"], {}, ["c1"]);
    expect(result).toEqual({ allRequiredDone: true, missing: [] });
  });
});
