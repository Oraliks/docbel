import { describe, it, expect } from "vitest";
import { buildItemDrafts, pickCategory, type ItemDraft } from "../generate";
import { evaluateRules } from "../../rules/engine";
import { STARTER_RULES } from "../../data/starter-rules";

const has = (drafts: ItemDraft[], needle: string) =>
  drafts.some((d) => d.title.toLowerCase().includes(needle.toLowerCase()));

describe("génération de checklist", () => {
  it("pickCategory : pas de personnel → premier_engagement", () => {
    expect(pickCategory({ hasEmployees: false })).toBe("premier_engagement");
    expect(pickCategory({ hasEmployees: null })).toBe("premier_engagement");
    expect(pickCategory({ hasEmployees: true })).toBe("engagement_classique");
  });

  it("Critère 1 — premier engagement : la checklist complète contient tous les items requis", () => {
    const engine = evaluateRules(
      { hasEmployees: false, hasOnssNumber: false },
      {
        workerType: "employe",
        contractType: "cdi",
        plannedStartDate: new Date("2026-09-01"),
        jointCommitteeNumber: "200",
      },
      STARTER_RULES
    );
    const drafts = buildItemDrafts("premier_engagement", engine.items);

    expect(has(drafts, "wide")).toBe(true); // identification ONSS/WIDE (règle)
    expect(has(drafts, "dimona")).toBe(true); // règle
    expect(has(drafts, "type de contrat")).toBe(true); // modèle
    expect(has(drafts, "commission paritaire")).toBe(true); // CP (modèle)
    expect(has(drafts, "salaire minimum")).toBe(true); // barème (modèle)
    expect(has(drafts, "règlement de travail")).toBe(true); // modèle
    expect(has(drafts, "assurance accidents")).toBe(true); // modèle
    expect(has(drafts, "dossier")).toBe(true); // dossier travailleur (modèle)

    // Tous les items obligatoires portent une source (Critère 7 / affichage source).
    for (const d of drafts.filter((x) => x.priority === "obligatoire")) {
      expect(d.sourceCode, `item sans source: ${d.title}`).toBeTruthy();
    }

    // Items obligatoires triés en tête.
    const firstOptionalIdx = drafts.findIndex((d) => d.priority !== "obligatoire");
    const lastObligatoireIdx = drafts.map((d) => d.priority).lastIndexOf("obligatoire");
    expect(lastObligatoireIdx).toBeLessThan(firstOptionalIdx === -1 ? Infinity : firstOptionalIdx);
  });

  it("dédoublonnage : un item présent dans le modèle ET émis par une règle n'apparaît qu'une fois", () => {
    const dupItem = {
      title: "Vérifier la commission paritaire",
      priority: "obligatoire" as const,
      ruleCode: "x",
    };
    const drafts = buildItemDrafts("engagement_classique", [dupItem]);
    const matches = drafts.filter(
      (d) => d.title.toLowerCase() === "vérifier la commission paritaire"
    );
    expect(matches).toHaveLength(1);
    // La 1re occurrence (modèle) gagne → ruleCode null.
    expect(matches[0]?.ruleCode).toBeNull();
  });
});
