import { describe, expect, it } from "vitest";
import { deriveDossierDiscoveryMetadata } from "../discovery";
import type { DossierDefinition } from "../types";

const codeDossier = {
  slug: "chomage-complet",
  title: "Chômage complet",
  description: "Description",
  category: "emploi",
  icon: "💼",
  color: "#000000",
  vocabularyTags: ["chômage", "C1"],
  types: [],
  questions: [],
  warnings: [],
  documents: [
    {
      slug: "formulaire-onem",
      title: "Formulaire ONEM",
      issuer: "ONEM",
      required: true,
      fields: [],
    },
    {
      slug: "c4-employeur",
      title: "C4 — Certificat de chômage",
      issuer: "Employeur",
      responsibility: "employer",
      required: true,
      fields: [],
    },
  ],
} satisfies DossierDefinition;

describe("deriveDossierDiscoveryMetadata", () => {
  it("enrichit un ancien bundle vide depuis sa définition code-driven", () => {
    const result = deriveDossierDiscoveryMetadata(
      {
        organism: null,
        vocabularyTags: [],
        requiredDocuments: [],
        items: [
          {
            required: true,
            pdfForm: {
              slug: "formulaire-onem",
              title: "Formulaire ONEM",
              issuer: "ONEM",
              status: "published",
              active: true,
            },
          },
        ],
      },
      codeDossier,
    );

    expect(result.organism).toBe("ONEM");
    expect(result.documentCount).toBe(2);
    expect(result.requiredDocuments).toEqual([
      "Formulaire ONEM",
      "C4 — Certificat de chômage",
    ]);
    expect(result.vocabularyTags).toEqual(
      expect.arrayContaining(["chômage", "C1", "formulaire-onem", "c4-employeur"]),
    );
  });

  it("conserve les métadonnées DB et fusionne les documents sans doublon", () => {
    const result = deriveDossierDiscoveryMetadata(
      {
        organism: "CAPAC ou syndicat",
        vocabularyTags: ["allocation"],
        requiredDocuments: ["Carte d'identité", "Formulaire ONEM"],
        items: [],
      },
      codeDossier,
    );

    expect(result.organism).toBe("CAPAC ou syndicat");
    expect(result.requiredDocuments).toEqual([
      "Carte d'identité",
      "Formulaire ONEM",
      "C4 — Certificat de chômage",
    ]);
  });

  it("retombe sur les PdfForms publiés pour un dossier no-code", () => {
    const result = deriveDossierDiscoveryMetadata(
      {
        organism: null,
        vocabularyTags: [],
        requiredDocuments: [],
        items: [
          {
            required: true,
            pdfForm: {
              slug: "formulaire-actif",
              title: "Formulaire actif",
              issuer: "SPF",
              status: "published",
              active: true,
            },
          },
          {
            required: true,
            pdfForm: {
              slug: "formulaire-pause",
              title: "Formulaire en pause",
              issuer: "SPF",
              status: "published",
              active: false,
            },
          },
        ],
      },
      null,
    );

    expect(result).toMatchObject({
      organism: "SPF",
      requiredDocuments: ["Formulaire actif"],
      documentCount: 1,
    });
  });
});
