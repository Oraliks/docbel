import { describe, it, expect } from "vitest";
import {
  deriveWizardResults,
  type WizardCatalog,
} from "../derive-results";
import type { WizardResult } from "../config";

const catalog: WizardCatalog = {
  "chomage-complet": {
    slug: "chomage-complet",
    name: "Chômage complet",
    organism: "ONEM",
    requiredDocuments: ["Carte d'identité", "C4"],
    points: ["Délai de 8 jours"],
    warningLevel: "warning",
    estimatedTime: 20,
    relatedBundles: ["chomage-frontalier"],
    available: true,
  },
  "chomage-frontalier": {
    slug: "chomage-frontalier",
    name: "Chômage frontalier",
    organism: "ONEM",
    requiredDocuments: ["Formulaire U1"],
    points: [],
    warningLevel: null,
    estimatedTime: 30,
    relatedBundles: [],
    available: true,
  },
  prepension: {
    slug: "prepension",
    name: "RCC",
    organism: "ONEM",
    requiredDocuments: [],
    points: [],
    warningLevel: null,
    estimatedTime: null,
    relatedBundles: [],
    available: true,
  },
};

describe("deriveWizardResults", () => {
  it("enrichit le dossier principal depuis le catalogue", () => {
    const result: WizardResult = {
      dossierSlug: "chomage-complet",
      dossierTitle: "Chômage complet",
      rationale: "Vous avez assez travaillé.",
    };
    const { primary } = deriveWizardResults(result, catalog);
    expect(primary.available).toBe(true);
    expect(primary.matchLevel).toBe("recommande");
    expect(primary.organism).toBe("ONEM");
    expect(primary.requiredDocuments).toContain("C4");
    expect(primary.points).toContain("Délai de 8 jours");
    expect(primary.estimatedTime).toBe(20);
  });

  it("résout les dossiers proches (config + relatedBundles du principal)", () => {
    const result: WizardResult = {
      dossierSlug: "chomage-complet",
      dossierTitle: "Chômage complet",
      rationale: "...",
      related: ["prepension"],
    };
    const { related } = deriveWizardResults(result, catalog);
    const slugs = related.map((r) => r.slug);
    // prepension (config) + chomage-frontalier (relatedBundles du principal)
    expect(slugs).toContain("prepension");
    expect(slugs).toContain("chomage-frontalier");
    // jamais le principal lui-même
    expect(slugs).not.toContain("chomage-complet");
    expect(related.every((r) => r.matchLevel === "pertinent")).toBe(true);
  });

  it("ignore les slugs proches absents du catalogue", () => {
    const result: WizardResult = {
      dossierSlug: "chomage-complet",
      dossierTitle: "X",
      rationale: "...",
      related: ["inconnu-xyz"],
    };
    const { related } = deriveWizardResults(result, catalog);
    expect(related.map((r) => r.slug)).not.toContain("inconnu-xyz");
  });

  it("marque non disponible un dossier sans slug (bientôt disponible)", () => {
    const result: WizardResult = {
      dossierSlug: null,
      dossierTitle: "À venir",
      rationale: "...",
    };
    const { primary } = deriveWizardResults(result, catalog);
    expect(primary.available).toBe(false);
    expect(primary.slug).toBeNull();
  });

  it("fonctionne sans catalogue (résultat config seul)", () => {
    const result: WizardResult = {
      dossierSlug: "chomage-complet",
      dossierTitle: "Chômage complet",
      rationale: "...",
    };
    const { primary, related } = deriveWizardResults(result);
    expect(primary.available).toBe(true);
    expect(primary.requiredDocuments).toEqual([]);
    expect(related).toEqual([]);
  });
});
