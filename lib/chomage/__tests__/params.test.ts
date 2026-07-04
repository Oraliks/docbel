import { describe, expect, it } from "vitest";

import {
  CHOMAGE_PARAM_SETS,
  INSERTION_PARAM_SETS,
  getChomageParams,
  getInsertionParams,
  mensuelBrut,
} from "../params";
import { CHOMAGE_PHASES, SITUATIONS_FAMILIALES } from "../categories";

describe("getChomageParams — résolution par date", () => {
  it("résout le jeu 'Réforme 2026' pour aujourd'hui (défaut)", () => {
    const set = getChomageParams();
    expect(set.validFrom).toBe("2026-03-01");
  });

  it("inclut la date d'entrée en vigueur (validFrom = jour couvert)", () => {
    const set = getChomageParams(new Date(2026, 2, 1)); // 1er mars 2026
    expect(set.validFrom).toBe("2026-03-01");
  });

  it("couvre les dates futures tant qu'aucun validTo n'est posé", () => {
    const set = getChomageParams(new Date(2030, 0, 15));
    expect(set.validFrom).toBe("2026-03-01");
  });

  it("échoue BRUYAMMENT pour une date qu'aucun jeu ne couvre", () => {
    // 28 février 2026 : veille de la réforme, aucun jeu historique encodé.
    expect(() => getChomageParams(new Date(2026, 1, 28))).toThrow(
      /Aucun jeu de paramètres chômage ne couvre la date 2026-02-28/,
    );
  });
});

describe("CHOMAGE_PARAM_SETS — garde-fous des montants (réforme 2026)", () => {
  const reforme2026 = getChomageParams(new Date(2026, 2, 1)).values;

  it("plafonds salariaux par phase proportionnelle", () => {
    expect(reforme2026.plafonds).toEqual({
      "1A": 4265.98,
      "1B": 4010.98,
      "2A": 3262.99,
      "2B": 3262.99,
    });
  });

  it("taux 65 % (1A) puis 60 %", () => {
    expect(reforme2026.taux).toEqual({ "1A": 0.65, autres: 0.6 });
  });

  it("forfaits min/max et forfaitaires 2C/3 par situation familiale", () => {
    expect(reforme2026.forfaitMin).toEqual({
      chef_menage: 1500,
      isole: 1260,
      cohabitant: 1015,
    });
    expect(reforme2026.forfaitMax).toEqual({
      chef_menage: 2200,
      isole: 1850,
      cohabitant: 1500,
    });
    expect(reforme2026.forfait2C).toEqual({
      chef_menage: 1700,
      isole: 1400,
      cohabitant: 800,
    });
    expect(reforme2026.forfait3).toEqual({
      chef_menage: 1500,
      isole: 1260,
      cohabitant: 670,
    });
  });
});

describe("INSERTION_PARAM_SETS — garde-fous des montants (site ONEM 01/03/2026)", () => {
  const { montantsJour } = getInsertionParams(new Date(2026, 2, 1)).values;

  it("montants journaliers = page officielle ONEM allocation d'insertion", () => {
    expect(montantsJour).toEqual({
      chargeFamille: 69.26,
      isole: { moins18: 18.93, de18a20: 29.76, aPartirDe21: 51.56 },
      cohabitantPrivilegie: { moins18: 17.67, aPartirDe18: 28.38 },
      cohabitant: { moins18: 15.61, aPartirDe18: 24.88 },
    });
  });

  it("mensuel = journalier × 26, identique aux mensuels affichés par l'ONEM", () => {
    // Croisement avec les montants MENSUELS publiés sur la même page.
    expect(mensuelBrut(montantsJour.chargeFamille)).toBe(1800.76);
    expect(mensuelBrut(montantsJour.isole.aPartirDe21)).toBe(1340.56);
    expect(mensuelBrut(montantsJour.isole.de18a20)).toBe(773.76);
    expect(mensuelBrut(montantsJour.isole.moins18)).toBe(492.18);
    expect(mensuelBrut(montantsJour.cohabitantPrivilegie.aPartirDe18)).toBe(737.88);
    expect(mensuelBrut(montantsJour.cohabitantPrivilegie.moins18)).toBe(459.42);
    expect(mensuelBrut(montantsJour.cohabitant.aPartirDe18)).toBe(646.88);
    expect(mensuelBrut(montantsJour.cohabitant.moins18)).toBe(405.86);
  });

  it("échoue bruyamment avant la réforme (aucun jeu historique encodé)", () => {
    expect(() => getInsertionParams(new Date(2026, 1, 28))).toThrow(
      /Aucun jeu de paramètres insertion/,
    );
  });
});

describe("Jeux de paramètres — invariants structurels (chômage + insertion)", () => {
  const FAMILIES = [
    { name: "chomage", sets: CHOMAGE_PARAM_SETS },
    { name: "insertion", sets: INSERTION_PARAM_SETS },
  ] as const;

  it("chaque jeu a des dates ISO valides et une source datée", () => {
    const ISO = /^\d{4}-\d{2}-\d{2}$/;
    for (const { sets } of FAMILIES) {
      for (const set of sets) {
        expect(set.validFrom).toMatch(ISO);
        if (set.validTo) expect(set.validTo).toMatch(ISO);
        expect(set.label.length).toBeGreaterThan(0);
        expect(set.source.label.length).toBeGreaterThan(0);
        expect(set.source.verifiedAt).toMatch(ISO);
      }
    }
  });

  it("les périodes ne se chevauchent pas (au plus un jeu par date, par famille)", () => {
    // Sonde chaque borne validFrom/validTo : une seule période doit matcher.
    for (const { sets } of FAMILIES) {
      const probes = sets.flatMap((s) =>
        [s.validFrom, s.validTo].filter((d): d is string => Boolean(d)),
      );
      for (const iso of probes) {
        const matching = sets.filter(
          (s) => s.validFrom <= iso && (!s.validTo || iso < s.validTo),
        );
        expect(matching.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("les catégories canoniques sont complètes (3 situations, 6 phases)", () => {
    expect(SITUATIONS_FAMILIALES).toEqual([
      "chef_menage",
      "isole",
      "cohabitant",
    ]);
    expect(CHOMAGE_PHASES).toEqual(["1A", "1B", "2A", "2B", "2C", "3"]);
  });
});
