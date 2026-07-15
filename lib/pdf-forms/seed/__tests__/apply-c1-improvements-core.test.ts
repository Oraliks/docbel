import { describe, expect, it } from "vitest";
import { C1_IMPROVEMENT_TARGETS } from "../apply-c1-improvements-core";
import { C1_TRIGGERS } from "../c1-fields-improvements";
import { C1_FR_TRIGGERS } from "../c1-fr-fields";
import type { AcroFieldRaw } from "../../types";

describe("C1_IMPROVEMENT_TARGETS — c1-changement-situation", () => {
  it("est présent, réutilise C1_TRIGGERS, et force le motif par défaut sur 'modification'", () => {
    const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === "c1-changement-situation");
    expect(target).toBeDefined();
    expect(target?.triggers).toBe(C1_TRIGGERS);

    const improved = target!.improve([]);
    const motif = improved.find((f) => f.id === "motifIntroduction");
    expect(motif?.defaultValue).toBe("modification");
  });

  it("applique le parcours C1 standard aux PDF récents", () => {
    for (const slug of ["c1", "c1-insertion"]) {
      const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === slug);
      expect(target).toBeDefined();
      expect(target?.triggers).toBe(C1_TRIGGERS);
      const improved = target!.improve([]);
      const motif = improved.find((f) => f.id === "motifIntroduction");
      expect(motif?.defaultValue).toBeUndefined();
      expect(improved.some((f) => f.canonicalKey === "identity.niss")).toBe(true);
    }
  });

  it("adapte c1-fr uniquement aux ancres prouvées de son PDF historique", () => {
    const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === "c1-fr");
    const technical = [
      { pdfFieldName: "Nom", acroType: "text", page: 0 },
      { pdfFieldName: "Prénom", acroType: "text", page: 0 },
      { pdfFieldName: "NISS", acroType: "text", page: 0 },
      { pdfFieldName: "oui_2", acroType: "checkbox", page: 1 },
      { pdfFieldName: "non_2", acroType: "checkbox", page: 1 },
    ] satisfies AcroFieldRaw[];

    expect(target?.triggers).toBe(C1_FR_TRIGGERS);
    const improved = target!.improve([], { technicalSchema: technical });
    expect(improved.find((field) => field.id === "pr_nom")?.pdfFieldName).toBe(
      "Prénom",
    );
    expect(
      improved.find((field) => field.id === "etudesPleinExercice")
        ?.pdfFieldName,
    ).toBe("oui_2|non_2");
    expect(improved.every((field) => field.pdfFieldName !== "Prenom")).toBe(true);
  });

  it("ajoute le 5e chip transfereOrganismePaiement, réservé à c1-changement-situation", () => {
    const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === "c1-changement-situation");
    const improved = target!.improve([]);
    expect(improved.find((f) => f.id === "transfereOrganismePaiement")).toBeDefined();

    for (const slug of ["c1", "c1-insertion"]) {
      const other = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === slug);
      const improvedOther = other!.improve([]);
      expect(improvedOther.find((f) => f.id === "transfereOrganismePaiement")).toBeUndefined();
      // motifIntroduction garde ses 4 options d'origine, intactes, pour c1/c1-insertion.
      const motif = improvedOther.find((f) => f.id === "motifIntroduction");
      expect(motif?.options).toHaveLength(4);
    }
  });
});
