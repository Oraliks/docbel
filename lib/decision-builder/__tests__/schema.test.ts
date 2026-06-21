import { describe, it, expect } from "vitest";
import {
  BundleConditionSchema,
  ConditionGroupSchema,
  DecisionTreeContentSchema,
  emptyTreeContent,
  OptionNodeSchema,
  parseTreeContent,
  QuestionNodeSchema,
  ResultNodeSchema,
  safeParseTreeContent,
} from "../schema";

// ── Helpers ────────────────────────────────────────────────────────────────

const validQuestion = {
  type: "question",
  id: "q_root",
  text: "Quelle est votre situation ?",
  optionIds: ["opt_a", "opt_b"],
};

const validOption = {
  type: "option",
  id: "opt_a",
  label: "J'ai perdu mon emploi",
  nextId: "r_complet",
};

const validResult = {
  type: "result",
  id: "r_complet",
  bundleSlug: "chomage-complet",
  title: "Chômage complet",
  rationale: "Vous avez perdu votre emploi.",
  matchLevel: "recommande",
};

// ── DecisionTreeContent — cas valides ──────────────────────────────────────

describe("DecisionTreeContentSchema — valid", () => {
  it("accepts empty tree (no rootNodeId, no nodes)", () => {
    expect(() => parseTreeContent(emptyTreeContent())).not.toThrow();
  });

  it("accepts a minimal tree with 1 question + 1 option + 1 result", () => {
    const tree = {
      version: 1,
      rootNodeId: "q_root",
      nodes: {
        q_root: validQuestion,
        opt_a: validOption,
        r_complet: validResult,
      },
    };
    expect(() => parseTreeContent(tree)).not.toThrow();
  });

  it("accepts a question with empty optionIds (draft en cours d'édition)", () => {
    expect(() =>
      QuestionNodeSchema.parse({ ...validQuestion, optionIds: [] }),
    ).not.toThrow();
  });

  it("accepts a result with bundleSlug = null (bientôt disponible)", () => {
    const r = ResultNodeSchema.safeParse({
      ...validResult,
      bundleSlug: null,
    });
    expect(r.success).toBe(true);
  });

  it("defaults matchLevel to 'recommande' when omitted", () => {
    const r = ResultNodeSchema.parse({
      type: "result",
      id: "r1",
      bundleSlug: "x",
      title: "T",
      rationale: "R",
    });
    expect(r.matchLevel).toBe("recommande");
  });

  it("accepts an option with conditions (V2 group AND)", () => {
    const opt = {
      ...validOption,
      conditions: {
        type: "and",
        rules: [
          {
            type: "leaf",
            sourceTemplateId: "q_root",
            fieldId: "value",
            op: "equals",
            value: "perdu_emploi",
          },
        ],
      },
    };
    expect(() => OptionNodeSchema.parse(opt)).not.toThrow();
  });
});

// ── DecisionTreeContent — cas invalides ────────────────────────────────────

describe("DecisionTreeContentSchema — invalid", () => {
  it("rejects unknown version", () => {
    expect(() =>
      parseTreeContent({ version: 99, rootNodeId: null, nodes: {} }),
    ).toThrow();
  });

  it("rejects missing nodes record", () => {
    expect(() =>
      parseTreeContent({ version: 1, rootNodeId: null }),
    ).toThrow();
  });

  it("rejects a question without text", () => {
    expect(() =>
      QuestionNodeSchema.parse({ ...validQuestion, text: "" }),
    ).toThrow();
  });

  it("rejects an option without nextId", () => {
    const { nextId: _omit, ...rest } = validOption;
    void _omit;
    expect(() => OptionNodeSchema.parse(rest)).toThrow();
  });

  it("rejects a result without rationale", () => {
    const { rationale: _omit, ...rest } = validResult;
    void _omit;
    expect(() => ResultNodeSchema.parse(rest)).toThrow();
  });

  it("rejects an unknown matchLevel", () => {
    expect(() =>
      ResultNodeSchema.parse({ ...validResult, matchLevel: "magic" }),
    ).toThrow();
  });

  it("rejects an unknown node type via discriminated union", () => {
    expect(() =>
      parseTreeContent({
        version: 1,
        rootNodeId: "x",
        nodes: { x: { type: "unknown_node", id: "x" } },
      }),
    ).toThrow();
  });
});

// ── BundleCondition — réutilisation lib/bundles ────────────────────────────

describe("BundleConditionSchema", () => {
  it("accepts null", () => {
    expect(BundleConditionSchema.parse(null)).toBeNull();
  });

  it("accepts legacy V1 array (implicitly ANDed)", () => {
    const v1 = [
      {
        sourceTemplateId: "q1",
        fieldId: "value",
        op: "equals" as const,
        value: "yes",
      },
    ];
    expect(() => BundleConditionSchema.parse(v1)).not.toThrow();
  });

  it("accepts V2 nested OR group", () => {
    const v2 = {
      type: "or",
      rules: [
        {
          type: "leaf",
          sourceTemplateId: "q1",
          fieldId: "value",
          op: "equals",
          value: "a",
        },
        {
          type: "and",
          rules: [
            {
              type: "leaf",
              sourceTemplateId: "q2",
              fieldId: "value",
              op: "in",
              value: ["b", "c"],
            },
          ],
        },
      ],
    };
    expect(() => ConditionGroupSchema.parse(v2)).not.toThrow();
  });

  it("rejects an unknown operator", () => {
    expect(() =>
      BundleConditionSchema.parse([
        {
          sourceTemplateId: "q",
          fieldId: "f",
          op: "weird_op",
        },
      ]),
    ).toThrow();
  });
});

// ── safeParseTreeContent — fallback silencieux pour le loader runtime ──────

describe("safeParseTreeContent (runtime fallback)", () => {
  it("returns the parsed content when valid", () => {
    const r = safeParseTreeContent(emptyTreeContent());
    expect(r).not.toBeNull();
    expect(r?.version).toBe(1);
  });

  it("returns null when invalid (no throw — fallback silencieux)", () => {
    const r = safeParseTreeContent({ garbage: true });
    expect(r).toBeNull();
  });

  it("returns null when given a string", () => {
    expect(safeParseTreeContent("nope")).toBeNull();
  });
});
