import { describe, expect, it } from "vitest";
import { isGeneratingBlocked } from "../generate-lock";
import type { DossierDefinition } from "@/lib/dossiers/types";

const dossier: DossierDefinition = {
  slug: "test-dossier",
  title: "Test",
  description: "",
  category: "emploi",
  icon: "🎓",
  color: "#000",
  vocabularyTags: [],
  types: [],
  questions: [
    {
      id: "parcoursEtudes",
      label: { fr: "Parcours" },
      type: "select",
      options: [
        { value: "secondaire-belge", label: { fr: "Secondaire" } },
        { value: "superieur-belge", label: { fr: "Supérieur" } },
      ],
    },
  ],
  warnings: [],
  documents: [
    { slug: "demande", title: "Demande", issuer: "ONEM", required: true, gatedByRestOfDossier: true, fields: [] },
    { slug: "c1", title: "C1", issuer: "ONEM", required: true, fields: [] },
    {
      slug: "diplome",
      title: "Diplôme",
      issuer: "École",
      required: true,
      includeWhen: (a) => a.parcoursEtudes === "secondaire-belge",
      fields: [],
    },
  ],
};

describe("isGeneratingBlocked", () => {
  it("bloque DEMANDE si les questions d'aiguillage n'ont pas de réponse", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: {},
      completedSlugs: ["c1"],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(true);
  });

  it("bloque DEMANDE si le document de branche applicable n'est pas complété", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: { parcoursEtudes: "secondaire-belge" },
      completedSlugs: ["c1"], // diplome manquant
      triggeredSlugs: [],
    });
    expect(blocked).toBe(true);
  });

  it("bloque DEMANDE si un document déclenché n'est pas complété", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: { parcoursEtudes: "superieur-belge" },
      completedSlugs: ["c1"],
      triggeredSlugs: ["c1a"],
    });
    expect(blocked).toBe(true);
  });

  it("ne bloque pas DEMANDE quand tout l'applicable est complété", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: { parcoursEtudes: "superieur-belge" },
      completedSlugs: ["c1"],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(false);
  });

  it("ne bloque jamais un document non gated (ex. C1 lui-même)", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "c1",
      answers: {},
      completedSlugs: [],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(false);
  });

  it("ne bloque rien quand le dossier n'a pas de document gated", () => {
    const noGate: DossierDefinition = { ...dossier, documents: dossier.documents.map((d) => ({ ...d, gatedByRestOfDossier: false })) };
    const blocked = isGeneratingBlocked({
      dossier: noGate,
      targetSlug: "demande",
      answers: {},
      completedSlugs: [],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(false);
  });
});
