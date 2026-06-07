import { describe, it, expect } from "vitest";
import { calculerAgr } from "../calcul";
import type { AgrGlobalInput, OccupationInput } from "../types";

/** Occupation vierge (tous les champs à zéro) pour ne renseigner que l'utile. */
function occ(p: Partial<OccupationInput>): OccupationInput {
  return {
    qinfo: 2, q: 0, s: 0, categorieTravailleur: "1O",
    ybrut: 0, salaireTheoriqueHeure: 0, salaireTheoriqueMois: 0,
    heures: 0, heuresV: 0, heuresA: 0, requalifier: false,
    soldeS32: 0, soldeQ4: 0, pw1: 0, pw2: 0, pr: 0,
    fermetureTotal: 0, joursNI: 0, ...p,
  };
}

function global(p: Partial<AgrGlobalInput>): AgrGlobalInput {
  return {
    allocationJournaliere: 0, demiAllocation: 0, categorieFamiliale: "A",
    ageAuMoins21: true, soldeJ: 0, moisDecembre: false, cumulTempsPartiel: false,
    joursCC: 0, incapaciteOuSanctionTotalite: false, bareme: "010426",
    occupations: [], ...p,
  };
}

describe("calculerAgr — exemple principal de la formation (avril 2024, p.4-8)", () => {
  // Employé (1E), Q=19/S=38, Ybrut = salaire théo mensuel = 1450,23, HT = 82,27.
  const res = calculerAgr(
    global({
      allocationJournaliere: 66.31,
      categorieFamiliale: "A",
      occupations: [
        occ({
          qinfo: 2, q: 19, s: 38, categorieTravailleur: "1E",
          ybrut: 1450.23, salaireTheoriqueMois: 1450.23, heures: 82.27,
        }),
      ],
    }),
  );
  const o0 = res.intermediaires.occupations[0];

  // Ces intermédiaires sont INDÉPENDANTS du barème → doivent matcher l'Excel.
  it("F6 = 17,6142 (salaire mensuel / (4,3333 × Q))", () => {
    expect(o0.f6).toBe(17.6142);
  });
  it("F8 = 82,27 ((HT + …) × 38/S)", () => {
    expect(o0.f8).toBe(82.27);
  });
  it("VTL = 2900,45 (F6 × S × 4,3333, arrondi B)", () => {
    expect(o0.vtl).toBe(2900.45);
  });
  it("F1 = 26 (aucune déduction) et F2 = 66,31 (allocation journalière)", () => {
    expect(res.intermediaires.f1).toBe(26);
    expect(res.intermediaires.f2).toBe(66.31);
  });
  it("une seule occupation", () => {
    expect(res.intermediaires.nombreOccupations).toBe(1);
  });

  // Régression bout-en-bout (barème AVRIL 2026). Valeurs vérifiées à la main,
  // étape par étape. NB : la formation documente 599,61 € pour ce cas car elle
  // utilise le barème AVRIL 2024 (F3 = 8,81 ; F4 = 3,87 ; bonus différents) ;
  // l'algorithme est identique, seules les constantes du barème changent.
  it("pipeline complet 2026 : bonus, précompte, sélection de formule", () => {
    expect(o0.bonusFt).toBe(119.53);
    expect(o0.bonusPt).toBe(59.77);
    expect(res.intermediaires.totalSalaireImposable).toBe(1320.46);
    expect(res.intermediaires.totalRetenues).toBe(0);
    expect(res.intermediaires.formule1A).toBe(573.25);
    expect(res.intermediaires.formule1B).toBe(1369.07);
    expect(res.intermediaires.formule2A).toBe(719.28);
    expect(res.intermediaires.formule2B).toBe(1725.79);
    expect(res.bareme57).toBe(573.25); // min(1A, 1B)
    expect(res.bareme05).toBe(719.28); // max(57, min(2A, 2B))
  });
});

describe("calculerAgr — garde-fous", () => {
  it("signale un salaire théorique manquant", () => {
    const res = calculerAgr(
      global({
        allocationJournaliere: 66.31,
        occupations: [occ({ q: 19, s: 38, categorieTravailleur: "1E", ybrut: 1450.23 })],
      }),
    );
    expect(res.bareme57).toBeNull();
    expect(res.erreur).toMatch(/salaire/i);
  });

  it("AGR = 0 si incapacité/sanction toute la période", () => {
    const res = calculerAgr(
      global({
        allocationJournaliere: 66.31,
        incapaciteOuSanctionTotalite: true,
        occupations: [
          occ({ q: 19, s: 38, categorieTravailleur: "1E", ybrut: 1450.23, salaireTheoriqueMois: 1450.23, heures: 82.27 }),
        ],
      }),
    );
    expect(res.bareme57).toBe(0);
  });
});

/**
 * Validation croisée avec l'Excel FGTB recalculé (Excel COM, barème avril 2026).
 * Chaque valeur attendue a été lue dans le classeur officiel avec les mêmes
 * entrées → garantit la parité au centime sur les chemins vacances et cumul.
 */
describe("calculerAgr — parité avec l'Excel réel (Excel COM)", () => {
  it("vacances + requalification (cat. familiale B1)", () => {
    const res = calculerAgr(
      global({
        allocationJournaliere: 70.96, categorieFamiliale: "B1", soldeJ: 11,
        occupations: [
          occ({
            q: 20, s: 38, categorieTravailleur: "1E", ybrut: 1121.61,
            salaireTheoriqueMois: 1319.54, heures: 68, heuresA: 12,
            requalifier: true, soldeS32: 41.6,
          }),
        ],
      }),
    );
    expect(res.bareme57).toBe(585.84);
    expect(res.bareme05).toBe(634.06);
    expect(res.intermediaires.formule1B).toBe(923.06);
  });

  it("deux occupations simultanées (cumul, cat. familiale B2)", () => {
    const res = calculerAgr(
      global({
        allocationJournaliere: 39.14, categorieFamiliale: "B2",
        occupations: [
          occ({ q: 2, s: 24, categorieTravailleur: "2E", ybrut: 264.7, salaireTheoriqueMois: 264.7, heures: 9.2 }),
          occ({ q: 4, s: 22, categorieTravailleur: "2E", ybrut: 577.51, salaireTheoriqueMois: 577.51, heures: 18.4 }),
        ],
      }),
    );
    expect(res.bareme57).toBe(304.58);
    expect(res.bareme05).toBe(466.81);
    expect(res.intermediaires.nombreOccupations).toBe(2);
    // 1B reproduit la coquille AI13 de l'Excel pour le bonus total cat. 2.
    expect(res.intermediaires.formule1B).toBe(1803.25);
  });
});
