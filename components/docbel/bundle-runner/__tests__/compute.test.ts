import { describe, it, expect } from "vitest";
import {
  computeItemStatuses,
  resolveTargetForm,
  type BundleItem,
  type ItemStatus,
} from "../compute";

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

/// Construit un ItemStatus à partir d'un item + son état, pour tester le
/// résolveur d'auto-ouverture sans passer par computeItemStatuses.
function status(
  p: Parameters<typeof item>[0],
  s: { completed?: boolean; eligibility?: ItemStatus["eligibility"] } = {},
): ItemStatus {
  return {
    item: item(p),
    completed: s.completed ?? false,
    eligibility: s.eligibility ?? true,
  };
}

describe("resolveTargetForm", () => {
  it("retourne le premier item applicable, incomplet et remplissable (le principal)", () => {
    const target = resolveTargetForm([
      status({ id: "c1", slug: "c1" }),
      status({ id: "annexe", slug: "c1-annexe" }),
    ]);
    expect(target?.pdfForm?.slug).toBe("c1");
  });

  it("saute les items déjà complétés et rend le prochain à remplir (reprise)", () => {
    const target = resolveTargetForm([
      status({ id: "c1", slug: "c1" }, { completed: true }),
      status({ id: "annexe", slug: "c1-annexe" }, { completed: false }),
    ]);
    expect(target?.pdfForm?.slug).toBe("c1-annexe");
  });

  it("ignore les items en attente d'autres réponses (eligibility 'pending')", () => {
    const target = resolveTargetForm([
      status({ id: "c1", slug: "c1" }, { eligibility: "pending" }),
      status({ id: "c4", slug: "c4" }, { eligibility: true }),
    ]);
    expect(target?.pdfForm?.slug).toBe("c4");
  });

  it("ignore les items sans formulaire remplissable (pdfForm nul)", () => {
    const external: ItemStatus = {
      item: { ...item({ id: "ext", slug: "ext" }), pdfForm: null },
      completed: false,
      eligibility: true,
    };
    const target = resolveTargetForm([
      external,
      status({ id: "c1", slug: "c1" }),
    ]);
    expect(target?.pdfForm?.slug).toBe("c1");
  });

  it("retourne null quand tous les documents applicables sont complétés", () => {
    const target = resolveTargetForm([
      status({ id: "c1", slug: "c1" }, { completed: true }),
      status({ id: "annexe", slug: "c1-annexe" }, { completed: true }),
    ]);
    expect(target).toBeNull();
  });

  it("retourne null pour une liste vide", () => {
    expect(resolveTargetForm([])).toBeNull();
  });
});
