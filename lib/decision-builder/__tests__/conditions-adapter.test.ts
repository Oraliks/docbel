import { describe, it, expect } from "vitest";
import { evaluateCondition } from "@/lib/bundles/conditions";
import { buildContextFromNodeResponses } from "../conditions-adapter";
import type { OrientationAnswers } from "../types";

describe("buildContextFromNodeResponses", () => {
  it("maps each nodeId to { value } for evaluateCondition", () => {
    const answers: OrientationAnswers = {
      q_root: { value: "opt_a" },
      q_sub: { value: "opt_b" },
    };
    const ctx = buildContextFromNodeResponses(answers);
    expect(ctx).toEqual({
      q_root: { value: "opt_a" },
      q_sub: { value: "opt_b" },
    });
  });

  it("preserves array values for multi-select", () => {
    const answers: OrientationAnswers = {
      q_multi: { value: ["a", "b"] },
    };
    const ctx = buildContextFromNodeResponses(answers);
    expect(ctx.q_multi.value).toEqual(["a", "b"]);
  });

  it("returns empty context for empty answers", () => {
    expect(buildContextFromNodeResponses({})).toEqual({});
  });

  it("plugs into evaluateCondition (V2 leaf equals)", () => {
    const answers: OrientationAnswers = { q1: { value: "yes" } };
    const ctx = buildContextFromNodeResponses(answers);
    const cond = {
      type: "and" as const,
      rules: [
        {
          type: "leaf" as const,
          sourceTemplateId: "q1",
          fieldId: "value",
          op: "equals" as const,
          value: "yes",
        },
      ],
    };
    expect(evaluateCondition(cond, ctx)).toBe(true);
  });

  it("returns 'pending' when the answer referenced is missing", () => {
    const ctx = buildContextFromNodeResponses({});
    const cond = {
      type: "and" as const,
      rules: [
        {
          type: "leaf" as const,
          sourceTemplateId: "q_missing",
          fieldId: "value",
          op: "equals" as const,
          value: "x",
        },
      ],
    };
    expect(evaluateCondition(cond, ctx)).toBe("pending");
  });
});
