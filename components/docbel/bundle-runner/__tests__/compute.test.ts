import { describe, it, expect } from "vitest";
import { computeItemStatuses, type BundleItem } from "../compute";

function item(p: {
  id: string;
  slug: string;
  pdfFormId?: string;
  required?: boolean;
}): BundleItem {
  return {
    id: p.id,
    templateId: null,
    pdfFormId: p.pdfFormId ?? p.id,
    order: 0,
    required: p.required ?? true,
    // Condition nulle = toujours applicable (evaluateCondition → true).
    condition: null as unknown as BundleItem["condition"],
    template: null,
    pdfForm: {
      id: p.id,
      slug: p.slug,
      title: p.slug,
      description: null,
      issuer: null,
    },
  };
}

describe("computeItemStatuses", () => {
  const items = [
    item({ id: "a", slug: "doc-a", required: true }),
    item({ id: "b", slug: "doc-b", required: false }),
  ];

  it("rend les items à condition nulle visibles et compte les complétés", () => {
    const r = computeItemStatuses(items, ["a"], {}, null);
    expect(r.visibleItems.length).toBe(2);
    expect(r.completedCount).toBe(1);
    // Seul 'a' est requis et il est complété → tous les requis sont faits.
    expect(r.allRequiredDone).toBe(true);
  });

  it("allRequiredDone est faux tant qu'un requis n'est pas complété", () => {
    const r = computeItemStatuses(items, [], {}, null);
    expect(r.allRequiredDone).toBe(false);
  });

  it("applicableSlugs cache les items hors dossier", () => {
    const r = computeItemStatuses(items, [], {}, ["doc-a"]);
    expect(r.visibleItems.map((s) => s.item.id)).toEqual(["a"]);
    expect(r.hiddenItems.map((s) => s.item.id)).toEqual(["b"]);
  });

  it("itemSourceId privilégie pdfFormId pour la complétion", () => {
    const it = [item({ id: "i1", slug: "doc", pdfFormId: "pf1" })];
    const done = computeItemStatuses(it, ["pf1"], {}, null);
    expect(done.completedCount).toBe(1);
    const notDone = computeItemStatuses(it, ["i1"], {}, null);
    expect(notDone.completedCount).toBe(0);
  });
});
