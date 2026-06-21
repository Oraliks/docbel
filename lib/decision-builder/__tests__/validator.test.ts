import { describe, it, expect } from "vitest";
import { validateDecisionTree } from "../validator";
import type { DecisionTreeContent } from "../types";

function tree(nodes: DecisionTreeContent["nodes"], rootNodeId: string | null): DecisionTreeContent {
  return { version: 1, rootNodeId, nodes };
}

const VALID_BUNDLES = new Set(["chomage-complet", "allocations-insertion"]);

// ── Cas valides ────────────────────────────────────────────────────────────

describe("validateDecisionTree — publishable", () => {
  it("accepts a minimal valid tree (no errors, no warnings)", () => {
    const t = tree(
      {
        q_root: { type: "question", id: "q_root", text: "?", optionIds: ["opt_a"] },
        opt_a: { type: "option", id: "opt_a", label: "A", nextId: "r_a" },
        r_a: {
          type: "result",
          id: "r_a",
          bundleSlug: "chomage-complet",
          title: "T",
          rationale: "R",
          matchLevel: "recommande",
        },
      },
      "q_root",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(r.errors).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
    expect(r.publishable).toBe(true);
  });
});

// ── Erreurs bloquantes ─────────────────────────────────────────────────────

describe("validateDecisionTree — blocking errors", () => {
  it("'no_root' when rootNodeId is null", () => {
    const r = validateDecisionTree(tree({}, null), VALID_BUNDLES);
    expect(r.errors.some((e) => e.code === "no_root")).toBe(true);
    expect(r.publishable).toBe(false);
  });

  it("'missing_root' when rootNodeId points to a non-existent node", () => {
    const r = validateDecisionTree(tree({}, "q_ghost"), VALID_BUNDLES);
    expect(r.errors.some((e) => e.code === "missing_root")).toBe(true);
  });

  it("'wrong_root_type' when root is an option or result", () => {
    const t = tree(
      {
        r_root: {
          type: "result",
          id: "r_root",
          bundleSlug: "chomage-complet",
          title: "T",
          rationale: "R",
          matchLevel: "recommande",
        },
      },
      "r_root",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(r.errors.some((e) => e.code === "wrong_root_type")).toBe(true);
  });

  it("'missing_option' when a question references an unknown option", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["opt_ghost"] },
      },
      "q",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(
      r.errors.some(
        (e) => e.code === "missing_option" && e.meta?.optionId === "opt_ghost",
      ),
    ).toBe(true);
  });

  it("'option_wrong_type' when an optionIds entry points to a non-option node", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["r_fake"] },
        r_fake: {
          type: "result",
          id: "r_fake",
          bundleSlug: "chomage-complet",
          title: "T",
          rationale: "R",
          matchLevel: "recommande",
        },
      },
      "q",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(r.errors.some((e) => e.code === "option_wrong_type")).toBe(true);
  });

  it("'missing_next' when option.nextId is dangling", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["a"] },
        a: { type: "option", id: "a", label: "A", nextId: "r_ghost" },
      },
      "q",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(r.errors.some((e) => e.code === "missing_next")).toBe(true);
  });

  it("'next_must_be_question_or_result' when option points to another option", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["a"] },
        a: { type: "option", id: "a", label: "A", nextId: "b" },
        b: { type: "option", id: "b", label: "B", nextId: "r" },
        r: {
          type: "result",
          id: "r",
          bundleSlug: "chomage-complet",
          title: "T",
          rationale: "R",
          matchLevel: "recommande",
        },
      },
      "q",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(
      r.errors.some((e) => e.code === "next_must_be_question_or_result"),
    ).toBe(true);
  });

  it("'unknown_bundle' when result.bundleSlug isn't in the known set", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["a"] },
        a: { type: "option", id: "a", label: "A", nextId: "r" },
        r: {
          type: "result",
          id: "r",
          bundleSlug: "ghost-bundle",
          title: "T",
          rationale: "R",
          matchLevel: "recommande",
        },
      },
      "q",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(r.errors.some((e) => e.code === "unknown_bundle")).toBe(true);
  });

  it("'condition_unknown_ref' when a condition refers to a missing node", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["a"] },
        a: {
          type: "option",
          id: "a",
          label: "A",
          nextId: "r",
          conditions: {
            type: "and",
            rules: [
              {
                type: "leaf",
                sourceTemplateId: "q_missing",
                fieldId: "value",
                op: "equals",
                value: "x",
              },
            ],
          },
        },
        r: {
          type: "result",
          id: "r",
          bundleSlug: "chomage-complet",
          title: "T",
          rationale: "R",
          matchLevel: "recommande",
        },
      },
      "q",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(r.errors.some((e) => e.code === "condition_unknown_ref")).toBe(true);
  });

  it("'cycle' when option points back to an ancestor (direct loop)", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["a"] },
        a: { type: "option", id: "a", label: "A", nextId: "q" }, // boucle
      },
      "q",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(r.errors.some((e) => e.code === "cycle")).toBe(true);
  });

  it("'cycle' when a longer cycle exists", () => {
    const t = tree(
      {
        q1: { type: "question", id: "q1", text: "?", optionIds: ["a1"] },
        a1: { type: "option", id: "a1", label: "A1", nextId: "q2" },
        q2: { type: "question", id: "q2", text: "?", optionIds: ["a2"] },
        a2: { type: "option", id: "a2", label: "A2", nextId: "q1" }, // boucle
      },
      "q1",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(r.errors.some((e) => e.code === "cycle")).toBe(true);
  });
});

// ── Warnings (non bloquants) ───────────────────────────────────────────────

describe("validateDecisionTree — warnings", () => {
  it("'result_no_bundle' when result.bundleSlug = null (bientôt disponible)", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["a"] },
        a: { type: "option", id: "a", label: "A", nextId: "r" },
        r: {
          type: "result",
          id: "r",
          bundleSlug: null,
          title: "Bientôt",
          rationale: "R",
          matchLevel: "a_verifier",
        },
      },
      "q",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(r.warnings.some((e) => e.code === "result_no_bundle")).toBe(true);
    expect(r.publishable).toBe(true); // warning n'empêche pas la publication
  });

  it("'missing_form' when result targets a bundle without any PdfForm", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["a"] },
        a: { type: "option", id: "a", label: "A", nextId: "r" },
        r: {
          type: "result",
          id: "r",
          bundleSlug: "chomage-complet",
          title: "T",
          rationale: "R",
          matchLevel: "recommande",
        },
      },
      "q",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES, {
      bundlesWithoutForm: new Set(["chomage-complet"]),
    });
    expect(
      r.warnings.some(
        (e) => e.code === "missing_form" && e.nodeId === "r",
      ),
    ).toBe(true);
    // un warning n'empêche pas la publication
    expect(r.publishable).toBe(true);
  });

  it("'unreachable' when a node isn't reachable from root", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["a"] },
        a: { type: "option", id: "a", label: "A", nextId: "r" },
        r: {
          type: "result",
          id: "r",
          bundleSlug: "chomage-complet",
          title: "T",
          rationale: "R",
          matchLevel: "recommande",
        },
        // Nœud orphelin : pas dans le graphe atteignable.
        r_orphan: {
          type: "result",
          id: "r_orphan",
          bundleSlug: "chomage-complet",
          title: "Orphelin",
          rationale: "R",
          matchLevel: "recommande",
        },
      },
      "q",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    expect(
      r.warnings.some(
        (e) => e.code === "unreachable" && e.nodeId === "r_orphan",
      ),
    ).toBe(true);
  });
});

describe("validateDecisionTree — multiple violations", () => {
  it("collects multiple distinct errors in one pass", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["a", "b_ghost"] },
        a: { type: "option", id: "a", label: "A", nextId: "r_ghost" },
      },
      "q",
    );
    const r = validateDecisionTree(t, VALID_BUNDLES);
    const codes = r.errors.map((e) => e.code).sort();
    expect(codes).toContain("missing_option");
    expect(codes).toContain("missing_next");
  });
});
