import { describe, it, expect } from "vitest";
import { computeTreeDiff, hasUnpublishedTreeChanges } from "../diff";
import type { DecisionTreeContent } from "../types";

function tree(nodes: DecisionTreeContent["nodes"]): DecisionTreeContent {
  return { version: 1, rootNodeId: "q", nodes };
}

const q = (id: string, text: string): DecisionTreeContent["nodes"][string] => ({
  type: "question",
  id,
  text,
  optionIds: ["o"],
});

describe("computeTreeDiff", () => {
  it("treats every node as added when prev is null (first publish)", () => {
    const next = tree({ q: q("q", "?"), q2: q("q2", "?") });
    const d = computeTreeDiff(null, next);
    expect(d.added.sort()).toEqual(["q", "q2"]);
    expect(d.removed).toEqual([]);
    expect(d.modified).toEqual([]);
  });

  it("detects added nodes", () => {
    const prev = tree({ q: q("q", "?") });
    const next = tree({ q: q("q", "?"), q2: q("q2", "?") });
    expect(computeTreeDiff(prev, next).added).toEqual(["q2"]);
  });

  it("detects removed nodes", () => {
    const prev = tree({ q: q("q", "?"), q2: q("q2", "?") });
    const next = tree({ q: q("q", "?") });
    expect(computeTreeDiff(prev, next).removed).toEqual(["q2"]);
  });

  it("detects modified nodes (content changed)", () => {
    const prev = tree({ q: q("q", "Ancien texte") });
    const next = tree({ q: q("q", "Nouveau texte") });
    const d = computeTreeDiff(prev, next);
    expect(d.modified).toEqual(["q"]);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it("is insensitive to property order (stable stringify)", () => {
    const prev = tree({
      q: { type: "question", id: "q", text: "?", optionIds: ["o"] },
    });
    const next = tree({
      // mêmes données, ordre des clés différent
      q: { optionIds: ["o"], text: "?", id: "q", type: "question" } as never,
    });
    expect(computeTreeDiff(prev, next).modified).toEqual([]);
  });

  it("returns empty diff for identical content", () => {
    const t = tree({ q: q("q", "?") });
    const d = computeTreeDiff(t, t);
    expect(d).toEqual({ added: [], removed: [], modified: [] });
  });
});

describe("hasUnpublishedTreeChanges", () => {
  it("returns false when the complete contents are identical", () => {
    const content = tree({ q: q("q", "?") });
    expect(hasUnpublishedTreeChanges(content, content)).toBe(false);
  });

  it("detects a node content change", () => {
    const published = tree({ q: q("q", "Ancien texte") });
    const draft = tree({ q: q("q", "Nouveau texte") });
    expect(hasUnpublishedTreeChanges(draft, published)).toBe(true);
  });

  it("detects layout-only changes", () => {
    const published = tree({ q: q("q", "?") });
    const draft = { ...published, positions: { q: { x: 80, y: 40 } } };
    expect(hasUnpublishedTreeChanges(draft, published)).toBe(true);
  });

  it("treats a non-empty first draft as unpublished", () => {
    const draft = tree({ q: q("q", "?") });
    expect(hasUnpublishedTreeChanges(draft, null)).toBe(true);
  });
});
