import { describe, it, expect } from "vitest";
import { contentReferencesBundle } from "@/lib/decision-builder/references-core";

function result(
  id: string,
  bundleSlug: string | null,
  related?: string[],
) {
  return {
    type: "result" as const,
    id,
    bundleSlug,
    title: "Résultat",
    rationale: "Parce que.",
    ...(related ? { related } : {}),
  };
}

function tree(nodes: Record<string, unknown>) {
  const ids = Object.keys(nodes);
  return { version: 1, rootNodeId: ids[0] ?? null, nodes };
}

describe("contentReferencesBundle", () => {
  it("detects a primary reference (result.bundleSlug)", () => {
    const c = tree({ r1: result("r1", "aide-insertion") });
    expect(contentReferencesBundle(c, "aide-insertion")).toEqual({
      primary: true,
      related: false,
    });
  });

  it("detects a related reference (result.related[])", () => {
    const c = tree({ r1: result("r1", "autre-dossier", ["aide-insertion"]) });
    expect(contentReferencesBundle(c, "aide-insertion")).toEqual({
      primary: false,
      related: true,
    });
  });

  it("detects primary AND related across nodes", () => {
    const c = tree({
      r1: result("r1", "aide-insertion"),
      r2: result("r2", "autre", ["aide-insertion"]),
    });
    expect(contentReferencesBundle(c, "aide-insertion")).toEqual({
      primary: true,
      related: true,
    });
  });

  it("returns false when the slug is not referenced", () => {
    const c = tree({ r1: result("r1", "autre-dossier") });
    expect(contentReferencesBundle(c, "aide-insertion")).toEqual({
      primary: false,
      related: false,
    });
  });

  it("ignores result nodes with a null bundleSlug (bientôt disponible)", () => {
    const c = tree({ r1: result("r1", null) });
    expect(contentReferencesBundle(c, "aide-insertion")).toEqual({
      primary: false,
      related: false,
    });
  });

  it("returns false on invalid or empty content", () => {
    expect(contentReferencesBundle(null, "x")).toEqual({
      primary: false,
      related: false,
    });
    expect(contentReferencesBundle({ garbage: 1 }, "x")).toEqual({
      primary: false,
      related: false,
    });
    expect(contentReferencesBundle(tree({}), "x")).toEqual({
      primary: false,
      related: false,
    });
  });

  it("returns false for an empty slug", () => {
    const c = tree({ r1: result("r1", "aide-insertion") });
    expect(contentReferencesBundle(c, "")).toEqual({
      primary: false,
      related: false,
    });
  });
});
