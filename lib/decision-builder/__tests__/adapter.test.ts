import { describe, it, expect } from "vitest";
import { treeContentToWizardSituations } from "../adapter";
import type { DecisionTreeContent } from "../types";

function tree(nodes: DecisionTreeContent["nodes"], rootNodeId: string | null): DecisionTreeContent {
  return { version: 1, rootNodeId, nodes };
}

describe("treeContentToWizardSituations", () => {
  it("returns [] when there is no root", () => {
    expect(treeContentToWizardSituations(tree({}, null))).toEqual([]);
  });

  it("returns [] when the root is not a question", () => {
    const t = tree(
      {
        r: {
          type: "result",
          id: "r",
          bundleSlug: "x",
          title: "T",
          rationale: "R",
          matchLevel: "recommande",
        },
      },
      "r",
    );
    expect(treeContentToWizardSituations(t)).toEqual([]);
  });

  it("maps root options to situations with direct results", () => {
    const t = tree(
      {
        q_root: {
          type: "question",
          id: "q_root",
          text: "Votre situation ?",
          optionIds: ["opt_a"],
        },
        opt_a: {
          type: "option",
          id: "opt_a",
          label: "J'ai perdu mon emploi",
          icon: "UserMinus",
          helpText: "Licenciement",
          nextId: "r_a",
        },
        r_a: {
          type: "result",
          id: "r_a",
          bundleSlug: "chomage-complet",
          title: "Chômage complet",
          rationale: "...",
          matchLevel: "recommande",
        },
      },
      "q_root",
    );
    const sits = treeContentToWizardSituations(t);
    expect(sits).toHaveLength(1);
    expect(sits[0].value).toBe("opt_a");
    expect(sits[0].label).toBe("J'ai perdu mon emploi");
    expect(sits[0].icon).toBe("UserMinus");
    expect(sits[0].description).toBe("Licenciement");
    expect(sits[0].result?.dossierSlug).toBe("chomage-complet");
    expect(sits[0].subQuestion).toBeUndefined();
  });

  it("defaults icon to HelpCircle when option has none", () => {
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
        },
      },
      "q",
    );
    expect(treeContentToWizardSituations(t)[0].icon).toBe("HelpCircle");
  });

  it("maps a 3-level tree (situation → subQuestion → refineQuestion → result)", () => {
    const t = tree(
      {
        q_root: { type: "question", id: "q_root", text: "?", optionIds: ["s1"] },
        s1: { type: "option", id: "s1", label: "Perte d'emploi", nextId: "q_sub" },
        q_sub: {
          type: "question",
          id: "q_sub",
          text: "Quel parcours ?",
          optionIds: ["sub1"],
        },
        sub1: { type: "option", id: "sub1", label: "Belgique", nextId: "q_ref" },
        q_ref: {
          type: "question",
          id: "q_ref",
          text: "Première demande ?",
          optionIds: ["ref1"],
        },
        ref1: { type: "option", id: "ref1", label: "Oui", nextId: "r_final" },
        r_final: {
          type: "result",
          id: "r_final",
          bundleSlug: "chomage-complet",
          title: "Chômage complet — première",
          rationale: "...",
          matchLevel: "recommande",
        },
      },
      "q_root",
    );
    const sits = treeContentToWizardSituations(t);
    expect(sits[0].subQuestion?.question).toBe("Quel parcours ?");
    const sub = sits[0].subQuestion!.options[0];
    expect(sub.refineQuestion?.question).toBe("Première demande ?");
    expect(sub.refineQuestion!.options[0].result.dossierSlug).toBe(
      "chomage-complet",
    );
  });

  it("collapses a >3-level branch to the first reachable result (graceful)", () => {
    // refineOption pointe vers une QUESTION (4e niveau) → collapse au 1er result.
    const t = tree(
      {
        q_root: { type: "question", id: "q_root", text: "?", optionIds: ["s1"] },
        s1: { type: "option", id: "s1", label: "S1", nextId: "q_sub" },
        q_sub: { type: "question", id: "q_sub", text: "?", optionIds: ["sub1"] },
        sub1: { type: "option", id: "sub1", label: "Sub1", nextId: "q_ref" },
        q_ref: { type: "question", id: "q_ref", text: "?", optionIds: ["ref1"] },
        // ref1 mène à une question (trop profond pour le wizard 3-niveaux).
        ref1: { type: "option", id: "ref1", label: "Ref1", nextId: "q_deep" },
        q_deep: { type: "question", id: "q_deep", text: "?", optionIds: ["d1"] },
        d1: { type: "option", id: "d1", label: "D1", nextId: "r_deep" },
        r_deep: {
          type: "result",
          id: "r_deep",
          bundleSlug: "deep-bundle",
          title: "Deep",
          rationale: "...",
          matchLevel: "recommande",
        },
      },
      "q_root",
    );
    const sits = treeContentToWizardSituations(t);
    const refOpt = sits[0].subQuestion!.options[0].refineQuestion!.options[0];
    // Le 4e niveau est collapsé vers le premier résultat atteignable.
    expect(refOpt.result.dossierSlug).toBe("deep-bundle");
  });
});
