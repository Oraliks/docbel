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

function gatedItem(overrides: Partial<BundleItem>): BundleItem {
  return {
    id: overrides.id ?? "item-1",
    templateId: null,
    pdfFormId: overrides.pdfFormId ?? "form-1",
    order: overrides.order ?? 0,
    required: overrides.required ?? true,
    condition: overrides.condition ?? null,
    template: null,
    triggered: overrides.triggered,
    pdfForm: overrides.pdfForm ?? {
      id: overrides.pdfFormId ?? "form-1",
      slug: overrides.id ?? "item-1",
      title: "Doc",
      description: null,
      issuer: null,
    },
  };
}

describe("computeItemStatuses — locked (gatedByRestOfDossier)", () => {
  const c1 = gatedItem({ id: "c1", pdfFormId: "form-c1" });
  const diplome = gatedItem({ id: "c109-36-diplome", pdfFormId: "form-diplome" });
  const demande = gatedItem({ id: "c109-36-demande", pdfFormId: "form-demande" });
  const items = [c1, diplome, demande];

  it("verrouillé si les questions d'aiguillage n'ont pas de réponse, même si tout le reste est fait", () => {
    const { itemStatuses } = computeItemStatuses(
      items,
      ["form-c1", "form-diplome"],
      {},
      ["c1", "c109-36-diplome", "c109-36-demande"],
      { eligibilityAnswersComplete: false, gatedSlugs: ["c109-36-demande"] },
    );
    const demandeStatus = itemStatuses.find((s) => s.item.id === "c109-36-demande")!;
    expect(demandeStatus.locked).toBe(true);
  });

  it("verrouillé si le document de branche applicable n'est pas complété", () => {
    const { itemStatuses } = computeItemStatuses(
      items,
      ["form-c1"], // diplôme pas encore fait
      {},
      ["c1", "c109-36-diplome", "c109-36-demande"],
      { eligibilityAnswersComplete: true, gatedSlugs: ["c109-36-demande"] },
    );
    const demandeStatus = itemStatuses.find((s) => s.item.id === "c109-36-demande")!;
    expect(demandeStatus.locked).toBe(true);
  });

  it("déverrouillé quand C1 + document de branche sont tous les deux complétés et les questions répondues", () => {
    const { itemStatuses } = computeItemStatuses(
      items,
      ["form-c1", "form-diplome"],
      {},
      ["c1", "c109-36-diplome", "c109-36-demande"],
      { eligibilityAnswersComplete: true, gatedSlugs: ["c109-36-demande"] },
    );
    const demandeStatus = itemStatuses.find((s) => s.item.id === "c109-36-demande")!;
    expect(demandeStatus.locked).toBe(false);
  });

  it("un document non marqué gatedByRestOfDossier n'est jamais verrouillé", () => {
    const { itemStatuses } = computeItemStatuses(
      items,
      [],
      {},
      ["c1", "c109-36-diplome", "c109-36-demande"],
      { eligibilityAnswersComplete: false, gatedSlugs: ["c109-36-demande"] },
    );
    const c1Status = itemStatuses.find((s) => s.item.id === "c1")!;
    expect(c1Status.locked).toBe(false);
  });

  it("sans opts (dossiers non concernés), locked est toujours false — comportement inchangé", () => {
    const { itemStatuses } = computeItemStatuses(items, [], {}, null);
    expect(itemStatuses.every((s) => s.locked === false)).toBe(true);
  });
});
