import { describe, expect, it } from "vitest";
import { mergeSeedTreeContent } from "../merge-seed";
import type { DecisionTreeContent } from "../types";

function content(
  rootOptions: string[],
  nodes: DecisionTreeContent["nodes"],
): DecisionTreeContent {
  return {
    version: 1,
    rootNodeId: "root",
    nodes: {
      root: { type: "question", id: "root", text: "Situation ?", optionIds: rootOptions },
      ...nodes,
    },
  };
}

const option = (id: string, label: string, nextId: string) => ({
  type: "option" as const,
  id,
  label,
  nextId,
});

const result = (id: string) => ({
  type: "result" as const,
  id,
  bundleSlug: "dossier",
  title: "Dossier",
  rationale: "Pourquoi",
  matchLevel: "recommande" as const,
});

describe("mergeSeedTreeContent", () => {
  it("ajoute une branche avant la porte de secours selon l'ordre du seed", () => {
    const current = content(["a", "fallback"], {
      a: option("a", "A", "ra"),
      ra: result("ra"),
      fallback: option("fallback", "Je ne sais pas", "rf"),
      rf: result("rf"),
    });
    const desired = content(["a", "c1", "fallback"], {
      a: option("a", "A", "ra"),
      ra: result("ra"),
      fallback: option("fallback", "Je ne sais pas", "rf"),
      rf: result("rf"),
      c1: option("c1", "Ma situation a changé", "rc1"),
      rc1: result("rc1"),
    });

    const merged = mergeSeedTreeContent(current, desired);
    expect(
      merged.content.nodes.root.type === "question"
        ? merged.content.nodes.root.optionIds
        : [],
    ).toEqual(["a", "c1", "fallback"]);
    expect(merged.addedNodeIds).toEqual(["c1", "rc1"]);
    expect(merged.addedRootOptionIds).toEqual(["c1"]);
  });

  it("préserve les textes admin et les positions existantes", () => {
    const current = {
      ...content(["a"], {
        a: option("a", "Libellé admin", "ra"),
        ra: result("ra"),
      }),
      positions: { a: { x: 42, y: 84 } },
    };
    const desired = content(["a"], {
      a: option("a", "Libellé du seed", "ra"),
      ra: result("ra"),
    });

    const merged = mergeSeedTreeContent(current, desired);
    expect(merged.content.nodes.a).toEqual(current.nodes.a);
    expect(merged.content.positions).toEqual(current.positions);
    expect(merged.preservedConflictIds).toContain("a");
  });

  it("est idempotent", () => {
    const desired = content(["c1"], {
      c1: option("c1", "Ma situation a changé", "rc1"),
      rc1: result("rc1"),
    });
    const first = mergeSeedTreeContent(content([], {}), desired);
    const second = mergeSeedTreeContent(first.content, desired);

    expect(second.content).toEqual(first.content);
    expect(second.addedNodeIds).toEqual([]);
    expect(second.addedRootOptionIds).toEqual([]);
  });
});
