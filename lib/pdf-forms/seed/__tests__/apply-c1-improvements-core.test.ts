import { describe, expect, it } from "vitest";
import { C1_IMPROVEMENT_TARGETS } from "../apply-c1-improvements-core";
import { C1_TRIGGERS } from "../c1-fields-improvements";

describe("C1_IMPROVEMENT_TARGETS — c1-changement-situation", () => {
  it("est présent, réutilise C1_TRIGGERS, et force le motif par défaut sur 'modification'", () => {
    const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === "c1-changement-situation");
    expect(target).toBeDefined();
    expect(target?.triggers).toBe(C1_TRIGGERS);

    const improved = target!.improve([]);
    const motif = improved.find((f) => f.id === "motifIntroduction");
    expect(motif?.defaultValue).toBe("modification");
  });

  it("n'affecte pas le defaultValue de motifIntroduction pour c1 / c1-insertion", () => {
    for (const slug of ["c1", "c1-insertion"]) {
      const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === slug);
      expect(target).toBeDefined();
      const improved = target!.improve([]);
      const motif = improved.find((f) => f.id === "motifIntroduction");
      expect(motif?.defaultValue).toBeUndefined();
    }
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
