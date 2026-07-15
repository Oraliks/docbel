import { describe, expect, it } from "vitest";
import {
  DecisionTreeImportError,
  decisionTreeFileName,
  parseDecisionTreeJson,
  serializeDecisionTree,
  type DecisionTreeImportErrorCode,
} from "../json-transfer";
import type { DecisionTreeContent } from "../types";

const content: DecisionTreeContent = {
  version: 1,
  rootNodeId: "q",
  nodes: {
    q: { type: "question", id: "q", text: "Situation ?", optionIds: [] },
  },
};

describe("transfert JSON des arbres", () => {
  it("exporte une enveloppe versionnée réimportable", () => {
    const json = serializeDecisionTree(
      { slug: "chomage-orientation", title: "Orientation", segment: "chomage" },
      content,
      new Date("2026-07-15T12:00:00.000Z"),
    );
    expect(JSON.parse(json)).toMatchObject({
      format: "docbel.decision-tree",
      formatVersion: 1,
      exportedAt: "2026-07-15T12:00:00.000Z",
    });
    expect(parseDecisionTreeJson(json)).toEqual(content);
  });

  it("accepte aussi un contenu brut historique", () => {
    expect(parseDecisionTreeJson(JSON.stringify(content))).toEqual(content);
  });

  it.each<[string, DecisionTreeImportErrorCode]>([
    ["{", "invalid_json"],
    [JSON.stringify({ format: "autre", formatVersion: 1, content }), "unsupported_format"],
    [JSON.stringify({ version: 1, nodes: {} }), "invalid_tree"],
  ])("refuse un fichier invalide", (json, code) => {
    expect(() => parseDecisionTreeJson(json)).toThrowError(
      expect.objectContaining<Partial<DecisionTreeImportError>>({ code }),
    );
  });

  it("normalise le nom du fichier", () => {
    expect(decisionTreeFileName(" Orientation Chômage ")).toBe(
      "orientation-chomage.json",
    );
  });
});
