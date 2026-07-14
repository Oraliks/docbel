import { describe, it, expect } from "vitest";
import {
  buildParcoursModel,
  interactionConversions,
  zeroParcoursCounts,
  classifyPdfDelivery,
  INTERACTION_STAGE_DEFS,
  ENTITY_METRIC_DEFS,
  type ParcoursCounts,
} from "@/lib/admin/parcours-funnel-core";

const SAMPLE: ParcoursCounts = {
  search: 100,
  wizardStarted: 80,
  resultShown: 60,
  opened: 40,
  runCreated: 20,
  pdfGenerated: 12,
  dossiersComplets: 7,
  documentsRetrieved: 3,
};

describe("buildParcoursModel — interactionStages", () => {
  it("maps the 5 event-unit stages in canonical order", () => {
    const { interactionStages } = buildParcoursModel(SAMPLE);
    expect(interactionStages.map((s) => s.key)).toEqual([
      "search",
      "wizardStarted",
      "resultShown",
      "opened",
      "runCreated",
    ]);
    expect(interactionStages.map((s) => s.count)).toEqual([100, 80, 60, 40, 20]);
  });

  it("attaches label + phase from the defs", () => {
    const { interactionStages } = buildParcoursModel(SAMPLE);
    expect(interactionStages[0]).toMatchObject({
      label: "Recherches (interactions)",
      phase: "orientation",
    });
    expect(interactionStages[4]).toMatchObject({
      label: "Dossiers démarrés",
      phase: "dossier",
    });
  });

  it("only ever contains interaction phases (orientation → dossier), never entity units", () => {
    const { interactionStages } = buildParcoursModel(SAMPLE);
    const phases = new Set(interactionStages.map((s) => s.phase));
    expect([...phases]).toEqual(["orientation", "dossier"]);
  });
});

describe("buildParcoursModel — entityMetrics", () => {
  it("exposes THREE unit-tagged rows, each with its own unit", () => {
    const { entityMetrics } = buildParcoursModel(SAMPLE);
    expect(entityMetrics.map((m) => [m.key, m.unit, m.count])).toEqual([
      ["pdfGenerated", "pdf", 12],
      ["dossiersComplets", "dossiers", 7],
      ["documentsRetrieved", "retraits", 3],
    ]);
  });

  it("uses the agreed FR labels", () => {
    const { entityMetrics } = buildParcoursModel(SAMPLE);
    expect(entityMetrics.map((m) => m.label)).toEqual([
      "PDF générés",
      "Dossiers complets",
      "Documents récupérés (zip/e-mail)",
    ]);
  });

  it("never appears inside interactionStages (units are not mixed into the funnel)", () => {
    const { interactionStages } = buildParcoursModel(SAMPLE);
    const stageKeys = new Set(interactionStages.map((s) => s.key));
    for (const def of ENTITY_METRIC_DEFS) {
      expect(stageKeys.has(def.key as never)).toBe(false);
    }
  });
});

describe("§17 regression — three incompatible units are de-conflated", () => {
  // Le bug historique : la colonne terminale « Documents obtenus » comptait
  // `documents_downloaded` (zip/e-mail) et restait à 0 alors que 3 PDF unitaires
  // avaient été générés et 2 dossiers complétés — trois unités écrasées en une.
  const counts: ParcoursCounts = {
    ...zeroParcoursCounts(),
    documentsRetrieved: 0,
    pdfGenerated: 3,
    dossiersComplets: 2,
  };

  it("surfaces three distinct, non-conflicting numbers", () => {
    const { entityMetrics } = buildParcoursModel(counts);
    const byKey = Object.fromEntries(entityMetrics.map((m) => [m.key, m.count]));
    expect(byKey.pdfGenerated).toBe(3);
    expect(byKey.dossiersComplets).toBe(2);
    expect(byKey.documentsRetrieved).toBe(0);
    // Trois nombres distincts, jamais fusionnés.
    expect(new Set(entityMetrics.map((m) => m.unit)).size).toBe(3);
  });

  it("has NO single terminal 'Documents obtenus' stage that would read 0", () => {
    const { interactionStages } = buildParcoursModel(counts);
    // La dernière étape du funnel est « Dossiers démarrés », PAS une colonne
    // « documents » trompeuse à 0.
    expect(interactionStages.at(-1)?.key).toBe("runCreated");
    expect(interactionStages.some((s) => s.key === ("documents" as never))).toBe(
      false,
    );
    expect(
      interactionStages.some((s) => s.label.toLowerCase().includes("document")),
    ).toBe(false);
  });
});

describe("interactionConversions", () => {
  it("computes rounded % between consecutive interaction stages only", () => {
    const conv = interactionConversions(
      buildParcoursModel(SAMPLE).interactionStages,
    );
    expect(conv).toEqual([80, 75, 67, 50]); // 80/100, 60/80, 40/60, 20/40
  });

  it("never spans units: length is exactly interactionStages - 1", () => {
    const { interactionStages } = buildParcoursModel(SAMPLE);
    const conv = interactionConversions(interactionStages);
    expect(conv).toHaveLength(interactionStages.length - 1);
    expect(conv).toHaveLength(INTERACTION_STAGE_DEFS.length - 1);
  });

  it("returns null when the previous stage is zero", () => {
    const conv = interactionConversions(
      buildParcoursModel(zeroParcoursCounts()).interactionStages,
    );
    expect(conv).toEqual([null, null, null, null]);
  });
});

describe("classifyPdfDelivery", () => {
  it("download & doccle are generated PDFs", () => {
    expect(classifyPdfDelivery("download")).toBe("generated");
    expect(classifyPdfDelivery("doccle")).toBe("generated");
  });

  it("a save row is NEVER a generated PDF (it is persisted, no PDF produced)", () => {
    expect(classifyPdfDelivery("save")).toBe("saved");
    expect(classifyPdfDelivery("save")).not.toBe("generated");
  });

  it("anything else is 'other'", () => {
    expect(classifyPdfDelivery("")).toBe("other");
    expect(classifyPdfDelivery("unknown")).toBe("other");
  });
});

describe("zeroParcoursCounts", () => {
  it("drives a fully-empty but VALID model (5 stages + 3 metrics, all zero)", () => {
    const model = buildParcoursModel(zeroParcoursCounts());
    expect(model.interactionStages).toHaveLength(INTERACTION_STAGE_DEFS.length);
    expect(model.entityMetrics).toHaveLength(ENTITY_METRIC_DEFS.length);
    expect(model.interactionStages.every((s) => s.count === 0)).toBe(true);
    expect(model.entityMetrics.every((m) => m.count === 0)).toBe(true);
  });
});
