import { describe, expect, it } from "vitest";
import { chomageComplet } from "../chomage-complet";
import { selectDocuments } from "../types";

describe("parcours guidé arbre ONEM → chômage complet → C1", () => {
  it("explique le parcours avant d'ouvrir directement le C1", () => {
    expect(chomageComplet.journeyCtaLabelKey).toBe("complet.journeyCtaLabel");
    expect(chomageComplet.journey).toHaveLength(4);
    expect(chomageComplet.journey?.map((step) => step.order)).toEqual([1, 2, 3, 4]);
    expect(chomageComplet.journey?.[0].title).toContain("C1");
    expect(chomageComplet.journey?.[1].title).toContain("C1");
    expect(chomageComplet.journey?.[2].title).toContain("C4");
  });

  it("enrichit l'assistant avant le Form Runner officiel", () => {
    expect(chomageComplet.questions.map((q) => q.id)).toEqual([
      "famille_situation",
      "famille_colocation",
      "famille_charge",
      "famille_enfants",
      "famille_pension",
      "famille_garde_alternee",
      "famille_premier_revenu_enfant",
    ]);
    expect(selectDocuments(chomageComplet, {}).map((doc) => doc.slug)).toEqual([
      "c1-fr",
      "c4-employeur",
    ]);
  });
});
