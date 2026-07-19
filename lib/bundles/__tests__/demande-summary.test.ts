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

  it("accepte un résolveur PAR RUN — total/completed = périmètre visible de CE run, index reste global", () => {
    // Deux demandes du même dossier peuvent avoir des périmètres visibles
    // différents (items conditionnels) : le total global (ex. bundle.items.length)
    // ne doit plus être utilisé — chaque run apporte son propre total/completed
    // (ex. issus de computeItemStatuses côté page).
    const out = buildDemandeSummaries(
      [
        R("a", "2026-07-01T10:00:00Z", ["x"]),
        R("b", "2026-07-02T10:00:00Z", ["x", "y"]),
      ],
      (run) =>
        run.id === "a" ? { total: 3, completed: 1 } : { total: 5, completed: 2 },
    );
    const a = out.find((d) => d.runId === "a")!;
    const b = out.find((d) => d.runId === "b")!;
    expect(a.total).toBe(3);
    expect(a.completed).toBe(1);
    expect(b.total).toBe(5);
    expect(b.completed).toBe(2);
    // L'index reste dérivé de l'ordre de création GLOBAL, indépendamment du
    // résolveur de progression par run.
    expect(a.index).toBe(1);
    expect(b.index).toBe(2);
  });
});
