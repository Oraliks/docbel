import { describe, it, expect } from "vitest";
import {
  evaluateCondition,
  describeCondition,
  normalizeCondition,
  countLeaves,
  isFlatAndCondition,
  isConditionGroup,
  isConditionLeaf,
  type BundleCondition,
  type CollectedPayloads,
  type ConditionGroup,
  type BundleConditionRule,
} from "../conditions";

const payloads: CollectedPayloads = {
  tplA: { firstQuestion: "yes", age: 25, city: "Bruxelles" },
  tplB: { sameEmployer: "true", changedHours: "yes" },
};

describe("evaluateCondition — backward compatibility (V1 legacy array)", () => {
  it("returns true when condition is null", () => {
    expect(evaluateCondition(null, payloads)).toBe(true);
  });

  it("returns true when condition is empty array", () => {
    expect(evaluateCondition([], payloads)).toBe(true);
  });

  it("evaluates legacy AND array — all rules pass", () => {
    const cond: BundleConditionRule[] = [
      { sourceTemplateId: "tplA", fieldId: "firstQuestion", op: "equals", value: "yes" },
      { sourceTemplateId: "tplA", fieldId: "city", op: "equals", value: "Bruxelles" },
    ];
    expect(evaluateCondition(cond, payloads)).toBe(true);
  });

  it("evaluates legacy AND array — one rule fails", () => {
    const cond: BundleConditionRule[] = [
      { sourceTemplateId: "tplA", fieldId: "firstQuestion", op: "equals", value: "yes" },
      { sourceTemplateId: "tplA", fieldId: "city", op: "equals", value: "Liège" },
    ];
    expect(evaluateCondition(cond, payloads)).toBe(false);
  });

  it("returns pending when legacy rule references missing payload", () => {
    const cond: BundleConditionRule[] = [
      { sourceTemplateId: "tplC", fieldId: "x", op: "equals", value: "y" },
    ];
    expect(evaluateCondition(cond, payloads)).toBe("pending");
  });
});

describe("evaluateCondition — V2 groups", () => {
  it("evaluates AND group with two passing leaves", () => {
    const cond: ConditionGroup = {
      type: "and",
      rules: [
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "firstQuestion", op: "equals", value: "yes" },
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "age", op: "gte", value: 18 },
      ],
    };
    expect(evaluateCondition(cond, payloads)).toBe(true);
  });

  it("evaluates OR group — first leaf true", () => {
    const cond: ConditionGroup = {
      type: "or",
      rules: [
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "firstQuestion", op: "equals", value: "yes" },
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "firstQuestion", op: "equals", value: "no" },
      ],
    };
    expect(evaluateCondition(cond, payloads)).toBe(true);
  });

  it("evaluates OR group — neither leaf true", () => {
    const cond: ConditionGroup = {
      type: "or",
      rules: [
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "firstQuestion", op: "equals", value: "no" },
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "city", op: "equals", value: "Anvers" },
      ],
    };
    expect(evaluateCondition(cond, payloads)).toBe(false);
  });

  it("evaluates nested (premièreDemande) OR (mêmeEmployeur AND horaireChangé)", () => {
    // Cas typique chômage temporaire :
    // Document supplémentaire requis SI :
    //   première demande
    //   OU (même employeur ET changement d'horaire)
    const cond: ConditionGroup = {
      type: "or",
      rules: [
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "firstQuestion", op: "equals", value: "yes" },
        {
          type: "and",
          rules: [
            { type: "leaf", sourceTemplateId: "tplB", fieldId: "sameEmployer", op: "truthy" },
            { type: "leaf", sourceTemplateId: "tplB", fieldId: "changedHours", op: "equals", value: "yes" },
          ],
        },
      ],
    };
    expect(evaluateCondition(cond, payloads)).toBe(true);

    // Première fausse, l'autre branche AND décide
    const payloads2: CollectedPayloads = {
      tplA: { firstQuestion: "no" },
      tplB: { sameEmployer: "true", changedHours: "yes" },
    };
    expect(evaluateCondition(cond, payloads2)).toBe(true);

    // Première fausse, AND avec un faux
    const payloads3: CollectedPayloads = {
      tplA: { firstQuestion: "no" },
      tplB: { sameEmployer: "true", changedHours: "no" },
    };
    expect(evaluateCondition(cond, payloads3)).toBe(false);
  });

  it("AND with one pending and one false → false (short-circuit on false)", () => {
    const cond: ConditionGroup = {
      type: "and",
      rules: [
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "city", op: "equals", value: "Liège" }, // false
        { type: "leaf", sourceTemplateId: "tplMissing", fieldId: "x", op: "equals", value: "y" }, // pending
      ],
    };
    expect(evaluateCondition(cond, payloads)).toBe(false);
  });

  it("AND with one pending and one true → pending", () => {
    const cond: ConditionGroup = {
      type: "and",
      rules: [
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "city", op: "equals", value: "Bruxelles" }, // true
        { type: "leaf", sourceTemplateId: "tplMissing", fieldId: "x", op: "equals", value: "y" }, // pending
      ],
    };
    expect(evaluateCondition(cond, payloads)).toBe("pending");
  });

  it("OR with one pending and one true → true", () => {
    const cond: ConditionGroup = {
      type: "or",
      rules: [
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "city", op: "equals", value: "Bruxelles" }, // true
        { type: "leaf", sourceTemplateId: "tplMissing", fieldId: "x", op: "equals", value: "y" }, // pending
      ],
    };
    expect(evaluateCondition(cond, payloads)).toBe(true);
  });

  it("OR with one pending and one false → pending", () => {
    const cond: ConditionGroup = {
      type: "or",
      rules: [
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "city", op: "equals", value: "Liège" }, // false
        { type: "leaf", sourceTemplateId: "tplMissing", fieldId: "x", op: "equals", value: "y" }, // pending
      ],
    };
    expect(evaluateCondition(cond, payloads)).toBe("pending");
  });
});

describe("operators", () => {
  it("gt / gte / lt / lte", () => {
    const make = (op: "gt" | "gte" | "lt" | "lte", value: number): BundleCondition => [
      { sourceTemplateId: "tplA", fieldId: "age", op, value },
    ];
    expect(evaluateCondition(make("gt", 20), payloads)).toBe(true);
    expect(evaluateCondition(make("gt", 25), payloads)).toBe(false);
    expect(evaluateCondition(make("gte", 25), payloads)).toBe(true);
    expect(evaluateCondition(make("lt", 30), payloads)).toBe(true);
    expect(evaluateCondition(make("lte", 25), payloads)).toBe(true);
  });

  it("in / notIn", () => {
    const cond: BundleCondition = [
      { sourceTemplateId: "tplA", fieldId: "city", op: "in", value: ["Bruxelles", "Anvers"] },
    ];
    expect(evaluateCondition(cond, payloads)).toBe(true);

    const cond2: BundleCondition = [
      { sourceTemplateId: "tplA", fieldId: "city", op: "notIn", value: ["Liège", "Mons"] },
    ];
    expect(evaluateCondition(cond2, payloads)).toBe(true);
  });

  it("contains", () => {
    const cond: BundleCondition = [
      { sourceTemplateId: "tplA", fieldId: "city", op: "contains", value: "ruxell" },
    ];
    expect(evaluateCondition(cond, payloads)).toBe(true);
  });

  it("truthy / falsy", () => {
    const truthyCond: BundleCondition = [
      { sourceTemplateId: "tplB", fieldId: "sameEmployer", op: "truthy" },
    ];
    expect(evaluateCondition(truthyCond, payloads)).toBe(true);

    const falsyCond: BundleCondition = [
      { sourceTemplateId: "tplA", fieldId: "firstQuestion", op: "falsy" },
    ];
    expect(evaluateCondition(falsyCond, payloads)).toBe(false);
  });

  it("isEmpty / isNotEmpty", () => {
    const p: CollectedPayloads = {
      tpl: { filled: "value", empty: "", spaces: "   ", undef: undefined as unknown as string },
    };
    const isEmpty = (fieldId: string): BundleCondition => [
      { sourceTemplateId: "tpl", fieldId, op: "isEmpty" },
    ];
    expect(evaluateCondition(isEmpty("empty"), p)).toBe(true);
    expect(evaluateCondition(isEmpty("spaces"), p)).toBe(true);
    expect(evaluateCondition(isEmpty("undef"), p)).toBe(true);
    expect(evaluateCondition(isEmpty("filled"), p)).toBe(false);
  });
});

describe("describeCondition", () => {
  const templateNames = { tplA: "Document A", tplB: "Document B" };
  const fieldLabels = {
    "tplA::firstQuestion": "Première demande ?",
    "tplA::age": "Âge",
    "tplB::sameEmployer": "Même employeur",
    "tplB::changedHours": "Changement d'horaire",
  };

  it("describes a legacy AND array", () => {
    const cond: BundleCondition = [
      { sourceTemplateId: "tplA", fieldId: "firstQuestion", op: "equals", value: "yes" },
      { sourceTemplateId: "tplA", fieldId: "age", op: "gte", value: 18 },
    ];
    const desc = describeCondition(cond, templateNames, fieldLabels);
    expect(desc).toContain("ET");
    expect(desc).toContain("Première demande");
    expect(desc).toContain("Âge");
  });

  it("describes a nested OR-of-ANDs with parentheses", () => {
    const cond: ConditionGroup = {
      type: "or",
      rules: [
        { type: "leaf", sourceTemplateId: "tplA", fieldId: "firstQuestion", op: "equals", value: "yes" },
        {
          type: "and",
          rules: [
            { type: "leaf", sourceTemplateId: "tplB", fieldId: "sameEmployer", op: "truthy" },
            { type: "leaf", sourceTemplateId: "tplB", fieldId: "changedHours", op: "equals", value: "yes" },
          ],
        },
      ],
    };
    const desc = describeCondition(cond, templateNames, fieldLabels);
    expect(desc).toContain("OU");
    expect(desc).toContain("(");
    expect(desc).toContain("ET");
  });
});

describe("helpers", () => {
  it("isConditionGroup / isConditionLeaf", () => {
    expect(isConditionGroup({ type: "and", rules: [] })).toBe(true);
    expect(isConditionGroup({ type: "or", rules: [] })).toBe(true);
    expect(isConditionGroup({ type: "leaf" })).toBe(false);
    expect(isConditionGroup(null)).toBe(false);
    expect(isConditionGroup([])).toBe(false);
    expect(isConditionLeaf({ type: "leaf", sourceTemplateId: "x", fieldId: "y", op: "equals" })).toBe(true);
    expect(isConditionLeaf({ type: "and", rules: [] })).toBe(false);
  });

  it("normalizeCondition converts legacy to V2 group", () => {
    const legacy: BundleConditionRule[] = [
      { sourceTemplateId: "tplA", fieldId: "x", op: "equals", value: "y" },
    ];
    const normalized = normalizeCondition(legacy);
    expect(normalized).toEqual({
      type: "and",
      rules: [{ type: "leaf", sourceTemplateId: "tplA", fieldId: "x", op: "equals", value: "y" }],
    });
  });

  it("normalizeCondition returns null for null/empty", () => {
    expect(normalizeCondition(null)).toBeNull();
    expect(normalizeCondition([])).toBeNull();
  });

  it("countLeaves counts deeply nested leaves", () => {
    const cond: ConditionGroup = {
      type: "or",
      rules: [
        { type: "leaf", sourceTemplateId: "a", fieldId: "x", op: "equals", value: "y" },
        {
          type: "and",
          rules: [
            { type: "leaf", sourceTemplateId: "b", fieldId: "x", op: "equals", value: "y" },
            { type: "leaf", sourceTemplateId: "c", fieldId: "x", op: "equals", value: "y" },
          ],
        },
      ],
    };
    expect(countLeaves(cond)).toBe(3);
    expect(countLeaves(null)).toBe(0);
    expect(countLeaves([])).toBe(0);
  });

  it("isFlatAndCondition", () => {
    expect(isFlatAndCondition(null)).toBe(true);
    expect(isFlatAndCondition([])).toBe(true);
    expect(
      isFlatAndCondition([
        { sourceTemplateId: "a", fieldId: "x", op: "equals", value: "y" },
      ])
    ).toBe(true);
    expect(
      isFlatAndCondition({
        type: "and",
        rules: [{ type: "leaf", sourceTemplateId: "a", fieldId: "x", op: "equals", value: "y" }],
      })
    ).toBe(true);
    expect(
      isFlatAndCondition({
        type: "or",
        rules: [{ type: "leaf", sourceTemplateId: "a", fieldId: "x", op: "equals", value: "y" }],
      })
    ).toBe(false);
    expect(
      isFlatAndCondition({
        type: "and",
        rules: [
          {
            type: "or",
            rules: [{ type: "leaf", sourceTemplateId: "a", fieldId: "x", op: "equals", value: "y" }],
          },
        ],
      })
    ).toBe(false);
  });
});
