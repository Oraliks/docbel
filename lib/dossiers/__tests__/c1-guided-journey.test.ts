import { describe, expect, it } from "vitest";
import { chomageComplet } from "../chomage-complet";
import {
  dossierQuestionsToEligibility,
  selectDocuments,
} from "../types";
import { mapOnem2026ToWizardSituations } from "@/prisma/seeds/data/onem-2026-tree";
import { wizardSituationsToTreeContent } from "@/lib/decision-builder/from-wizard";
import { applyOnem2026CanonicalTags } from "@/lib/decision-builder/onem-canonical";
import {
  collectCanonicalFacts,
  prefillEligibilityAnswers,
} from "@/lib/parcours/canonical-facts";

const content = applyOnem2026CanonicalTags(
  wizardSituationsToTreeContent(mapOnem2026ToWizardSituations()),
);
const questions = dossierQuestionsToEligibility(chomageComplet.questions);

function prefill(optionIds: string[]) {
  const options = optionIds.map((id) => {
    const node = content.nodes[id];
    if (!node || node.type !== "option") throw new Error(`Option absente : ${id}`);
    return node;
  });
  return prefillEligibilityAnswers(questions, collectCanonicalFacts(options));
}

describe("parcours guidé arbre ONEM → chômage complet → C1", () => {
  it("explique le parcours avant d'ouvrir le questionnaire", () => {
    expect(chomageComplet.journeyCtaLabelKey).toBe("complet.journeyCtaLabel");
    expect(chomageComplet.journey).toHaveLength(4);
    expect(chomageComplet.journey?.map((step) => step.order)).toEqual([1, 2, 3, 4]);
    expect(chomageComplet.journey?.[1].title).toContain("C1");
    expect(chomageComplet.journey?.[2].title).toContain("C4");
  });

  it("préremplit une première demande après emploi sans masquer le C1 réel", () => {
    const answers = prefill([
      "opt_perte-emploi-fin-contrat",
      "opt_perte-emploi-fin-contrat_premiere-demande-apres-emploi",
    ]);

    expect(answers).toMatchObject({
      statut: "salarie",
      aDejaTouche: "false",
    });
    expect(selectDocuments(chomageComplet, answers).map((doc) => doc.slug)).toContain(
      "c1-fr",
    );
  });

  it("préremplit une redemande comme déjà indemnisée", () => {
    const answers = prefill([
      "opt_perte-emploi-fin-contrat",
      "opt_perte-emploi-fin-contrat_redemande-apres-interruption",
    ]);

    expect(answers).toMatchObject({
      statut: "salarie",
      aDejaTouche: "true",
    });
  });

  it("ne déduit que le fait explicitement connu après les études", () => {
    const answers = prefill([
      "opt_sortie-etudes-jeune_jeune-a-travaille-apres-etudes",
    ]);

    expect(answers).toEqual({ statut: "salarie" });
  });
});
