import { describe, it, expect } from "vitest";
import { resolveForceNewAction, MAX_EDITABLE_RUNS_PER_BUNDLE } from "../run-creation";

describe("resolveForceNewAction", () => {
  it("aucun run éditable → create", () => {
    expect(resolveForceNewAction([])).toEqual({ kind: "create" });
  });
  it("un run vide existe → reuse (pas de doublon vide)", () => {
    expect(resolveForceNewAction([{ id: "r1", hasProgress: false }])).toEqual({
      kind: "reuse",
      runId: "r1",
    });
  });
  it("que des runs avec progression → create", () => {
    expect(resolveForceNewAction([{ id: "r1", hasProgress: true }])).toEqual({ kind: "create" });
  });
  it("au-delà du cap → too_many", () => {
    const full = Array.from({ length: MAX_EDITABLE_RUNS_PER_BUNDLE }, (_, i) => ({
      id: `r${i}`,
      hasProgress: true,
    }));
    expect(resolveForceNewAction(full)).toEqual({ kind: "too_many" });
  });
  it("reuse-empty prime sur le cap", () => {
    const full = Array.from({ length: MAX_EDITABLE_RUNS_PER_BUNDLE }, (_, i) => ({
      id: `r${i}`,
      hasProgress: i !== 0,
    }));
    expect(resolveForceNewAction(full)).toEqual({ kind: "reuse", runId: "r0" });
  });
});
