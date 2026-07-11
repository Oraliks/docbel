import { describe, it, expect } from "vitest";
import {
  assembleParcoursStages,
  stageConversions,
  zeroParcoursCounts,
  PARCOURS_STAGE_DEFS,
  type ParcoursCounts,
} from "@/lib/admin/parcours-funnel-core";

const SAMPLE: ParcoursCounts = {
  search: 100,
  wizardStarted: 80,
  resultShown: 60,
  opened: 40,
  runCreated: 20,
  documents: 5,
};

describe("assembleParcoursStages", () => {
  it("maps counts to stages in the canonical order", () => {
    const stages = assembleParcoursStages(SAMPLE);
    expect(stages.map((s) => s.key)).toEqual([
      "search",
      "wizardStarted",
      "resultShown",
      "opened",
      "runCreated",
      "documents",
    ]);
    expect(stages.map((s) => s.count)).toEqual([100, 80, 60, 40, 20, 5]);
  });

  it("attaches label + phase from the defs", () => {
    const stages = assembleParcoursStages(SAMPLE);
    expect(stages[0]).toMatchObject({
      label: "Recherches",
      phase: "orientation",
    });
    expect(stages[5]).toMatchObject({
      label: "Documents obtenus",
      phase: "documents",
    });
  });

  it("groups phases in a single contiguous run (orientation → dossier → documents)", () => {
    const phases = assembleParcoursStages(SAMPLE).map((s) => s.phase);
    // aucune phase ne réapparaît après avoir changé (funnel linéaire)
    const seen = new Set<string>();
    let current = "";
    for (const p of phases) {
      if (p !== current) {
        expect(seen.has(p)).toBe(false);
        seen.add(p);
        current = p;
      }
    }
    expect([...seen]).toEqual(["orientation", "dossier", "documents"]);
  });
});

describe("stageConversions", () => {
  it("computes rounded % between consecutive stages", () => {
    const conv = stageConversions(assembleParcoursStages(SAMPLE));
    expect(conv).toEqual([80, 75, 67, 50, 25]); // 80/100, 60/80, 40/60, 20/40, 5/20
    expect(conv).toHaveLength(5);
  });

  it("returns null when the previous stage is zero", () => {
    const conv = stageConversions(assembleParcoursStages(zeroParcoursCounts()));
    expect(conv).toEqual([null, null, null, null, null]);
  });
});

describe("zeroParcoursCounts", () => {
  it("is all zeros and drives a fully-empty funnel", () => {
    const stages = assembleParcoursStages(zeroParcoursCounts());
    expect(stages.every((s) => s.count === 0)).toBe(true);
    expect(stages).toHaveLength(PARCOURS_STAGE_DEFS.length);
  });
});
