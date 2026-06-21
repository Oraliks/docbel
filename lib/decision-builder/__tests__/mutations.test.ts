import { describe, it, expect } from "vitest";
import {
  addOption,
  addRootQuestion,
  branchOptionToNewQuestion,
  branchOptionToNewResult,
  buildConditionSchemas,
  deleteNode,
  listQuestions,
  patchNode,
  setNodeConditions,
  setOptionNext,
  type IdGen,
} from "../mutations";
import { emptyTreeContent } from "../schema";
import { validateDecisionTree } from "../validator";
import type { DecisionTreeContent, OptionNode, QuestionNode } from "../types";

// Générateur d'IDs déterministe pour les tests.
function seqGen(): IdGen {
  let n = 0;
  return (prefix) => `${prefix}${++n}`;
}

describe("addRootQuestion", () => {
  it("creates a question and sets it as root", () => {
    const gen = seqGen();
    const { content, id } = addRootQuestion(emptyTreeContent(), "Situation ?", gen);
    expect(content.rootNodeId).toBe(id);
    expect(content.nodes[id].type).toBe("question");
    expect((content.nodes[id] as QuestionNode).text).toBe("Situation ?");
  });

  it("does not overwrite an existing root", () => {
    const gen = seqGen();
    const a = addRootQuestion(emptyTreeContent(), "A", gen);
    const b = addRootQuestion(a.content, "B", gen);
    expect(b.content.rootNodeId).toBe(a.id);
  });
});

describe("addOption", () => {
  it("appends an option + a placeholder result, staying schema-valid", () => {
    const gen = seqGen();
    const { content: c1, id: qId } = addRootQuestion(emptyTreeContent(), "?", gen);
    const res = addOption(c1, qId, "Réponse A", gen);
    expect(res).not.toBeNull();
    const { content, optionId, resultId } = res!;
    const q = content.nodes[qId] as QuestionNode;
    expect(q.optionIds).toContain(optionId);
    expect((content.nodes[optionId] as OptionNode).nextId).toBe(resultId);
    expect(content.nodes[resultId].type).toBe("result");
    // Pas d'erreur bloquante de structure (le placeholder result a bundleSlug=null).
    const report = validateDecisionTree(content, new Set());
    expect(report.errors).toHaveLength(0);
  });

  it("returns null for a non-question target", () => {
    const gen = seqGen();
    const { content: c1, id: qId } = addRootQuestion(emptyTreeContent(), "?", gen);
    const { content, optionId } = addOption(c1, qId, "A", gen)!;
    expect(addOption(content, optionId, "x", gen)).toBeNull();
  });
});

describe("patchNode", () => {
  it("merges a patch into a node", () => {
    const gen = seqGen();
    const { content, id } = addRootQuestion(emptyTreeContent(), "Ancien", gen);
    const next = patchNode(content, id, { text: "Nouveau", helpText: "Aide" });
    expect((next.nodes[id] as QuestionNode).text).toBe("Nouveau");
    expect((next.nodes[id] as QuestionNode).helpText).toBe("Aide");
  });

  it("is a no-op for an unknown id", () => {
    const c = emptyTreeContent();
    expect(patchNode(c, "ghost", { text: "x" })).toBe(c);
  });

  it("does not mutate the input (immutability)", () => {
    const gen = seqGen();
    const { content, id } = addRootQuestion(emptyTreeContent(), "X", gen);
    const before = JSON.stringify(content);
    patchNode(content, id, { text: "Y" });
    expect(JSON.stringify(content)).toBe(before);
  });
});

describe("branchOptionToNewQuestion / NewResult", () => {
  function withOption(): { content: DecisionTreeContent; optionId: string; gen: IdGen } {
    const gen = seqGen();
    const { content: c1, id: qId } = addRootQuestion(emptyTreeContent(), "?", gen);
    const { content, optionId } = addOption(c1, qId, "A", gen)!;
    return { content, optionId, gen };
  }

  it("branches an option to a fresh question", () => {
    const { content, optionId, gen } = withOption();
    const r = branchOptionToNewQuestion(content, optionId, "Sous-question", gen)!;
    expect(r.content.nodes[r.questionId].type).toBe("question");
    expect((r.content.nodes[optionId] as OptionNode).nextId).toBe(r.questionId);
  });

  it("branches an option to a fresh result", () => {
    const { content, optionId, gen } = withOption();
    const r = branchOptionToNewResult(content, optionId, gen)!;
    expect(r.content.nodes[r.resultId].type).toBe("result");
    expect((r.content.nodes[optionId] as OptionNode).nextId).toBe(r.resultId);
  });
});

describe("setOptionNext", () => {
  it("repoints an option to an existing node", () => {
    const gen = seqGen();
    const { content: c1, id: qId } = addRootQuestion(emptyTreeContent(), "?", gen);
    const a = addOption(c1, qId, "A", gen)!;
    const b = addOption(a.content, qId, "B", gen)!;
    // Repointe l'option A vers le résultat de B.
    const next = setOptionNext(b.content, a.optionId, b.resultId);
    expect((next.nodes[a.optionId] as OptionNode).nextId).toBe(b.resultId);
  });

  it("ignores an unknown target", () => {
    const gen = seqGen();
    const { content: c1, id: qId } = addRootQuestion(emptyTreeContent(), "?", gen);
    const a = addOption(c1, qId, "A", gen)!;
    expect(setOptionNext(a.content, a.optionId, "ghost")).toBe(a.content);
  });
});

describe("deleteNode", () => {
  it("removes a node and cleans optionIds references", () => {
    const gen = seqGen();
    const { content: c1, id: qId } = addRootQuestion(emptyTreeContent(), "?", gen);
    const a = addOption(c1, qId, "A", gen)!;
    const next = deleteNode(a.content, a.optionId);
    expect(next.nodes[a.optionId]).toBeUndefined();
    expect((next.nodes[qId] as QuestionNode).optionIds).not.toContain(a.optionId);
  });

  it("nulls rootNodeId when the root is deleted", () => {
    const gen = seqGen();
    const { content, id } = addRootQuestion(emptyTreeContent(), "?", gen);
    expect(deleteNode(content, id).rootNodeId).toBeNull();
  });
});

describe("buildConditionSchemas", () => {
  it("exposes each question's options as selectable values", () => {
    const gen = seqGen();
    const { content: c1, id: qId } = addRootQuestion(emptyTreeContent(), "?", gen);
    const a = addOption(c1, qId, "Réponse A", gen)!;
    const schemas = buildConditionSchemas(a.content);
    expect(schemas[qId]).toHaveLength(1);
    expect(schemas[qId][0].id).toBe("value");
    expect(schemas[qId][0].options).toEqual([
      { value: a.optionId, label: "Réponse A" },
    ]);
  });

  it("listQuestions returns only question nodes", () => {
    const gen = seqGen();
    const { content: c1, id: qId } = addRootQuestion(emptyTreeContent(), "?", gen);
    const a = addOption(c1, qId, "A", gen)!;
    expect(listQuestions(a.content).map((q) => q.id)).toEqual([qId]);
  });
});

describe("setNodeConditions", () => {
  it("sets conditions on an option", () => {
    const gen = seqGen();
    const { content: c1, id: qId } = addRootQuestion(emptyTreeContent(), "?", gen);
    const a = addOption(c1, qId, "A", gen)!;
    const cond = {
      type: "and" as const,
      rules: [
        {
          type: "leaf" as const,
          sourceTemplateId: qId,
          fieldId: "value",
          op: "equals" as const,
          value: a.optionId,
        },
      ],
    };
    const next = setNodeConditions(a.content, a.optionId, cond);
    expect((next.nodes[a.optionId] as OptionNode).conditions).toEqual(cond);
  });

  it("ignores conditions on a question node", () => {
    const gen = seqGen();
    const { content, id } = addRootQuestion(emptyTreeContent(), "?", gen);
    expect(setNodeConditions(content, id, null)).toBe(content);
  });
});
