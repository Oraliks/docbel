import { describe, it, expect } from "vitest";
import { WIZARD_SITUATIONS } from "@/lib/dossier-wizard/config";
import type {
  WizardResult,
  WizardSituation,
} from "@/lib/dossier-wizard/config";
import { wizardSituationsToTreeContent } from "../from-wizard";
import { treeContentToWizardSituations } from "../adapter";
import { parseTreeContent } from "../schema";
import { validateDecisionTree } from "../validator";
import { mapOnem2026ToWizardSituations } from "@/prisma/seeds/data/onem-2026-tree";

/// Projection comparable d'une situation : on ignore les `value` (identifiants
/// opaques, renommés par l'aller-retour) et on normalise les champs optionnels
/// des résultats (matchLevel défaut "recommande", etc.). Ce qui compte pour la
/// non-régression : labels, icônes, descriptions, structure, et résultats
/// (slug/titre/rationale/niveau/estimation/proches) atteignables aux mêmes
/// positions.

function normResult(r: WizardResult) {
  return {
    dossierSlug: r.dossierSlug,
    dossierTitle: r.dossierTitle,
    rationale: r.rationale,
    matchLevel: r.matchLevel ?? "recommande",
    allocationEstimate: !!r.allocationEstimate,
    related: r.related ?? [],
  };
}

function normSituations(situations: WizardSituation[]) {
  return situations.map((s) => ({
    label: s.label,
    icon: s.icon,
    description: s.description ?? null,
    result: s.result ? normResult(s.result) : null,
    subQuestion: s.subQuestion
      ? {
          question: s.subQuestion.question,
          helpText: s.subQuestion.helpText ?? null,
          options: s.subQuestion.options.map((o) => ({
            label: o.label,
            helpText: o.helpText ?? null,
            result: o.result ? normResult(o.result) : null,
            refineQuestion: o.refineQuestion
              ? {
                  question: o.refineQuestion.question,
                  helpText: o.refineQuestion.helpText ?? null,
                  options: o.refineQuestion.options.map((r) => ({
                    label: r.label,
                    helpText: r.helpText ?? null,
                    result: normResult(r.result),
                  })),
                }
              : null,
          })),
        }
      : null,
  }));
}

describe("seed parity — WIZARD_SITUATIONS round-trip via DB tree content", () => {
  const content = wizardSituationsToTreeContent(WIZARD_SITUATIONS);

  it("produces a schema-valid content", () => {
    expect(() => parseTreeContent(content)).not.toThrow();
  });

  it("produces a structurally valid tree (no blocking errors except unknown_bundle)", () => {
    // On ne connaît pas les slugs en test → on autorise tous ceux référencés.
    const slugs = new Set(
      Object.values(content.nodes)
        .filter((n) => n.type === "result")
        .map((n) => (n as { bundleSlug: string | null }).bundleSlug)
        .filter((s): s is string => !!s),
    );
    const report = validateDecisionTree(content, slugs);
    expect(report.errors).toEqual([]);
  });

  it("round-trips to the SAME user-facing structure (zéro régression)", () => {
    const roundTripped = treeContentToWizardSituations(content);
    expect(normSituations(roundTripped)).toEqual(normSituations(WIZARD_SITUATIONS));
  });

  it("keeps the same number of situations", () => {
    const roundTripped = treeContentToWizardSituations(content);
    expect(roundTripped).toHaveLength(WIZARD_SITUATIONS.length);
  });
});

describe("seed ONEM 2026 — branche C1 changement de situation", () => {
  const situations = mapOnem2026ToWizardSituations();
  const content = wizardSituationsToTreeContent(situations);

  it("expose les cinq situations guidées du C1", () => {
    const c1 = situations.find(
      (situation) => situation.value === "changement-situation-personnelle",
    );
    expect(c1?.subQuestion?.options.map((option) => option.value)).toEqual([
      "situation-familiale-assistant",
      "adresse",
      "situation-personnelle-menage",
      "permis-sejour-travail",
      "compte-bancaire",
      "organisme-paiement",
    ]);
    expect(
      c1?.subQuestion?.options.every(
        (option) =>
          option.result?.dossierSlug === "changement-situation-personnelle" &&
          option.result.availability === "disponible",
      ),
    ).toBe(true);
  });

  it("produit un arbre valide avec une porte racine C1", () => {
    expect(() => parseTreeContent(content)).not.toThrow();
    const rootId = content.rootNodeId;
    expect(rootId).not.toBeNull();
    if (!rootId) throw new Error("Racine ONEM absente");
    const root = content.nodes[rootId];
    expect(root?.type).toBe("question");
    expect(
      root?.type === "question"
        ? root.optionIds.includes("opt_changement-situation-personnelle")
        : false,
    ).toBe(true);
  });
});
