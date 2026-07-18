import { describe, it, expect } from "vitest";
import { buildDemandeSummaries } from "../demande-summary";

const R = (
  id: string,
  startedAt: string,
  completed: string[] = [],
  status = "in_progress",
  completedAt: string | null = null,
) => ({ id, startedAt, completedTemplateIds: completed, status, completedAt });

describe("buildDemandeSummaries", () => {
  it("numérote par ordre de création (startedAt) et renvoie récent→ancien", () => {
    const out = buildDemandeSummaries(
      [
        R("b", "2026-07-02T10:00:00Z"),
        R("a", "2026-07-01T10:00:00Z"),
        R("c", "2026-07-03T10:00:00Z"),
      ],
      5,
    );
    expect(out.map((d) => [d.runId, d.index])).toEqual([
      ["c", 3],
      ["b", 2],
      ["a", 1],
    ]);
  });
  it("clampe la progression au total et calcule le lifecycle", () => {
    const out = buildDemandeSummaries(
      [R("a", "2026-07-01T10:00:00Z", ["x", "y", "z"], "completed", "2026-07-01T12:00:00Z")],
      2,
    );
    expect(out[0].completed).toBe(2);
    expect(out[0].total).toBe(2);
    expect(out[0].lifecycle).toBe("completed_editable");
  });
});
