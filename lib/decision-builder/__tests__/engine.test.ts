import { describe, it, expect } from "vitest";
import { runDecisionTree } from "../engine";
import type { DecisionTreeContent, OrientationAnswers } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

function tree(nodes: DecisionTreeContent["nodes"], rootNodeId: string | null): DecisionTreeContent {
  return { version: 1, rootNodeId, nodes };
}

const SIMPLE_TREE: DecisionTreeContent = tree(
  {
    q_root: {
      type: "question",
      id: "q_root",
      text: "Quelle est votre situation ?",
      optionIds: ["opt_a", "opt_b"],
    },
    opt_a: {
      type: "option",
      id: "opt_a",
      label: "J'ai perdu mon emploi",
      nextId: "r_complet",
    },
    opt_b: {
      type: "option",
      id: "opt_b",
      label: "Je suis étudiant",
      nextId: "r_insertion",
    },
    r_complet: {
      type: "result",
      id: "r_complet",
      bundleSlug: "chomage-complet",
      title: "Chômage complet",
      rationale: "...",
      matchLevel: "recommande",
    },
    r_insertion: {
      type: "result",
      id: "r_insertion",
      bundleSlug: "allocations-insertion",
      title: "Allocations d'insertion",
      rationale: "...",
      matchLevel: "recommande",
    },
  },
  "q_root",
);

// ── Cas heureux ────────────────────────────────────────────────────────────

describe("runDecisionTree — happy paths", () => {
  it("reaches the result via the chosen option (left branch)", () => {
    const answers: OrientationAnswers = { q_root: { value: "opt_a" } };
    const r = runDecisionTree(SIMPLE_TREE, answers);
    expect(r.results.map((x) => x.id)).toEqual(["r_complet"]);
    expect(r.path).toEqual(["q_root", "opt_a", "r_complet"]);
    expect(r.warnings).toHaveLength(0);
  });

  it("reaches the result via the chosen option (right branch)", () => {
    const answers: OrientationAnswers = { q_root: { value: "opt_b" } };
    const r = runDecisionTree(SIMPLE_TREE, answers);
    expect(r.results.map((x) => x.id)).toEqual(["r_insertion"]);
    expect(r.path).toContain("opt_b");
  });

  it("returns no result for an empty answers (warns 'unanswered')", () => {
    const r = runDecisionTree(SIMPLE_TREE, {});
    expect(r.results).toHaveLength(0);
    expect(r.warnings.some((w) => w.code === "unanswered")).toBe(true);
  });

  it("warns 'invalid_option' when answer doesn't match any optionId", () => {
    const r = runDecisionTree(SIMPLE_TREE, { q_root: { value: "opt_zzz" } });
    expect(r.results).toHaveLength(0);
    expect(
      r.warnings.some(
        (w) => w.code === "invalid_option" && w.questionId === "q_root",
      ),
    ).toBe(true);
  });

  it("handles array answer (multi-select V2 future-proof) — takes first", () => {
    const r = runDecisionTree(SIMPLE_TREE, {
      q_root: { value: ["opt_b", "opt_a"] },
    });
    expect(r.results.map((x) => x.id)).toEqual(["r_insertion"]);
  });
});

// ── Cas dégradés ───────────────────────────────────────────────────────────

describe("runDecisionTree — degraded paths", () => {
  it("warns 'empty_tree' when no rootNodeId", () => {
    const r = runDecisionTree(tree({}, null), {});
    expect(r.results).toHaveLength(0);
    expect(r.warnings).toEqual([{ code: "empty_tree" }]);
  });

  it("warns 'missing_node' when root pointer is dangling", () => {
    const r = runDecisionTree(tree({}, "q_ghost"), {});
    expect(r.warnings.some((w) => w.code === "missing_node")).toBe(true);
  });

  it("warns 'missing_node' when option.nextId is dangling", () => {
    const t = tree(
      {
        q_root: {
          type: "question",
          id: "q_root",
          text: "?",
          optionIds: ["opt_a"],
        },
        opt_a: {
          type: "option",
          id: "opt_a",
          label: "A",
          nextId: "r_ghost",
        },
      },
      "q_root",
    );
    const r = runDecisionTree(t, { q_root: { value: "opt_a" } });
    expect(r.warnings.some((w) => w.code === "missing_node")).toBe(true);
  });

  it("stops at cycle_detected without infinite loop", () => {
    const t = tree(
      {
        q_a: { type: "question", id: "q_a", text: "?", optionIds: ["opt_a"] },
        opt_a: {
          type: "option",
          id: "opt_a",
          label: "A",
          nextId: "q_a", // boucle
        },
      },
      "q_a",
    );
    const r = runDecisionTree(t, { q_a: { value: "opt_a" } });
    expect(r.warnings.some((w) => w.code === "cycle_detected")).toBe(true);
    expect(r.results).toHaveLength(0);
  });
});

// ── Conditions sur option ──────────────────────────────────────────────────

describe("runDecisionTree — conditions on options", () => {
  const treeWithCond: DecisionTreeContent = tree(
    {
      q_first: {
        type: "question",
        id: "q_first",
        text: "?",
        optionIds: ["opt_yes", "opt_no"],
      },
      opt_yes: { type: "option", id: "opt_yes", label: "Oui", nextId: "q_age" },
      opt_no: { type: "option", id: "opt_no", label: "Non", nextId: "r_bye" },
      q_age: {
        type: "question",
        id: "q_age",
        text: "Quel âge ?",
        optionIds: ["opt_25"],
      },
      opt_25: {
        type: "option",
        id: "opt_25",
        label: ">= 25",
        nextId: "r_complet",
        conditions: {
          type: "and",
          rules: [
            {
              type: "leaf",
              sourceTemplateId: "q_first",
              fieldId: "value",
              op: "equals",
              value: "opt_yes",
            },
          ],
        },
      },
      r_complet: {
        type: "result",
        id: "r_complet",
        bundleSlug: "x",
        title: "T",
        rationale: "R",
        matchLevel: "recommande",
      },
      r_bye: {
        type: "result",
        id: "r_bye",
        bundleSlug: null,
        title: "Bye",
        rationale: "R",
        matchLevel: "a_verifier",
      },
    },
    "q_first",
  );

  it("walks through when option's condition is true", () => {
    const r = runDecisionTree(treeWithCond, {
      q_first: { value: "opt_yes" },
      q_age: { value: "opt_25" },
    });
    expect(r.results.map((x) => x.id)).toEqual(["r_complet"]);
  });

  it("rejects an option whose condition resolves to false", () => {
    // q_first answered "opt_no" → bypassed via opt_no branch (no q_age).
    // To exercise condition rejection, we manipulate: force q_age but with
    // q_first=opt_no (option opt_25 requires q_first=opt_yes).
    const r = runDecisionTree(treeWithCond, {
      q_first: { value: "opt_no" },
      q_age: { value: "opt_25" },
    });
    // The walk takes opt_no → r_bye (doesn't visit q_age).
    expect(r.results.map((x) => x.id)).toEqual(["r_bye"]);
  });

  it("warns 'option_rejected' when forced into a rejected branch", () => {
    // Cas pur : on enlève la branche opt_no pour forcer le passage par opt_25.
    const t: DecisionTreeContent = {
      ...treeWithCond,
      nodes: {
        ...treeWithCond.nodes,
        q_first: {
          type: "question",
          id: "q_first",
          text: "?",
          optionIds: ["opt_yes"], // une seule option
        },
      },
    };
    const r = runDecisionTree(t, {
      q_first: { value: "opt_yes" },
      q_age: { value: "opt_25" },
    });
    // Avec q_first = opt_yes, opt_25.conditions = true → on atteint r_complet.
    expect(r.results.map((x) => x.id)).toEqual(["r_complet"]);
  });
});

// ── Conditions sur résultat ────────────────────────────────────────────────

describe("runDecisionTree — conditions on result", () => {
  it("rejects a result whose condition is false", () => {
    const t = tree(
      {
        q: { type: "question", id: "q", text: "?", optionIds: ["a"] },
        a: { type: "option", id: "a", label: "A", nextId: "r" },
        r: {
          type: "result",
          id: "r",
          bundleSlug: "x",
          title: "T",
          rationale: "R",
          matchLevel: "recommande",
          conditions: {
            type: "and",
            rules: [
              {
                type: "leaf",
                sourceTemplateId: "q",
                fieldId: "value",
                op: "equals",
                value: "b", // ne sera jamais vrai
              },
            ],
          },
        },
      },
      "q",
    );
    const r = runDecisionTree(t, { q: { value: "a" } });
    expect(r.results).toHaveLength(0);
    expect(r.warnings.some((w) => w.code === "option_rejected")).toBe(true);
  });
});
