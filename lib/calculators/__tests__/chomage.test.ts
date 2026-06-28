import { describe, it, expect } from "vitest";
import {
  calcChomage,
  phaseFromMonths,
  BAREME_VERSION,
  PHASES_INFO,
  type ChomageInput,
  type ChomageResult,
} from "../chomage";

/** Récupère un résultat valide ou échoue le test si une erreur est retournée. */
function ok(r: ChomageResult | { error: string }): ChomageResult {
  if ("error" in r) {
    throw new Error(`Chômage inattendu en erreur : ${r.error}`);
  }
  return r;
}

/** Entrée de base : chef de ménage, phase 1A, salaire 3 000 €. */
function input(over: Partial<ChomageInput> = {}): ChomageInput {
  return {
    salaireBrut: 3000,
    situationFamiliale: "chef_menage",
    phase: "1A",
    ...over,
  };
}

describe("calcChomage — phases proportionnelles (1A → 2B)", () => {
  it("phase 1A : 65 % du salaire sous le plafond A, dans les bornes forfaitaires", () => {
    const r = ok(calcChomage(input({ salaireBrut: 3000 })));
    // 3000 × 65 % = 1950, dans [1500, 2200] → 1950.
    expect(r.allocationMensuelle).toBe(1950);
    expect(r.allocationJournaliere).toBe(75); // 1950 / 26
    expect(r.tauxApplique).toBe(0.65);
    expect(r.plafondApplique).toBe(4265.98); // garde-fou : PLAFOND_A
    expect(r.salairePlafonne).toBe(3000);
    expect(r.phaseLabel).toBe("Mois 1-3 (1A)");
    expect(r.situationLabel).toBe("Chef de ménage");
  });

  it("phase 1A : plafonne le salaire au plafond A puis borne au forfait maximum", () => {
    const r = ok(calcChomage(input({ salaireBrut: 5000 })));
    // Salaire plafonné à 4265.98 ; 4265.98 × 65 % = 2772,89 → borné à 2200 (max chef).
    expect(r.salairePlafonne).toBe(4265.98);
    expect(r.allocationMensuelle).toBe(2200); // garde-fou : FORFAIT_MAX chef_menage
    expect(r.allocationJournaliere).toBe(84.62); // round(2200/26, 2)
  });

  it("phase 1A : remonte une petite allocation au forfait minimum (cohabitant)", () => {
    const r = ok(
      calcChomage(input({ salaireBrut: 1000, situationFamiliale: "cohabitant" })),
    );
    // 1000 × 65 % = 650 → remonté au plancher cohabitant 1015.
    expect(r.allocationMensuelle).toBe(1015); // garde-fou : FORFAIT_MIN cohabitant
  });

  it("phase 1B : taux 60 % sur le plafond A bis (mois 4-6)", () => {
    const r = ok(calcChomage(input({ salaireBrut: 3000, phase: "1B" })));
    expect(r.tauxApplique).toBe(0.6);
    expect(r.plafondApplique).toBe(4010.98); // PLAFOND_A_BIS
    expect(r.allocationMensuelle).toBe(1800); // 3000 × 60 %
  });

  it("phase 2A : plafond B intermédiaire, taux 60 %", () => {
    const r = ok(calcChomage(input({ salaireBrut: 5000, phase: "2A" })));
    expect(r.plafondApplique).toBe(3262.99); // PLAFOND_B
    expect(r.salairePlafonne).toBe(3262.99);
    // 3262.99 × 60 % = 1957,794 → 1957,79 (dans [1500, 2200]).
    expect(r.allocationMensuelle).toBe(1957.79);
  });

  it("phase 2B : plafond C (aligné sur B après la réforme 2026)", () => {
    const r = ok(calcChomage(input({ salaireBrut: 5000, phase: "2B" })));
    expect(r.plafondApplique).toBe(3262.99); // PLAFOND_C
    expect(r.allocationMensuelle).toBe(1957.79);
  });
});

describe("calcChomage — phases forfaitaires (2C, 3)", () => {
  it("phase 2C : forfait dégressif, indépendant du salaire et non re-borné", () => {
    const haut = ok(calcChomage(input({ salaireBrut: 5000, phase: "2C", situationFamiliale: "isole" })));
    const bas = ok(calcChomage(input({ salaireBrut: 200, phase: "2C", situationFamiliale: "isole" })));
    // FORFAIT_2C isolé = 1400, quel que soit le salaire.
    expect(haut.allocationMensuelle).toBe(1400);
    expect(bas.allocationMensuelle).toBe(1400);
  });

  it("phase 3 : forfait minimal, sous le plancher général pour les cohabitants", () => {
    const r = ok(calcChomage(input({ salaireBrut: 3000, phase: "3", situationFamiliale: "cohabitant" })));
    // FORFAIT_3 cohabitant = 670 — volontairement sous FORFAIT_MIN (1015) :
    // confirme que les phases forfaitaires ne sont PAS re-bornées.
    expect(r.allocationMensuelle).toBe(670);
    expect(r.allocationJournaliere).toBe(25.77); // round(670/26, 2)
  });
});

describe("calcChomage — situations familiales", () => {
  it("applique le bon plancher selon la situation (phase 1A, salaire 1 €/proche zéro)", () => {
    // Salaire 200 € → 130 calculé, remonté au plancher de chaque catégorie.
    expect(
      ok(calcChomage(input({ salaireBrut: 200, situationFamiliale: "chef_menage" }))).allocationMensuelle,
    ).toBe(1500);
    expect(
      ok(calcChomage(input({ salaireBrut: 200, situationFamiliale: "isole" }))).allocationMensuelle,
    ).toBe(1260);
    expect(
      ok(calcChomage(input({ salaireBrut: 200, situationFamiliale: "cohabitant" }))).allocationMensuelle,
    ).toBe(1015);
  });
});

describe("calcChomage — validation des entrées", () => {
  it("rejette un salaire trop bas, non fini ou négatif", () => {
    expect(calcChomage(input({ salaireBrut: 100 }))).toHaveProperty("error");
    expect(calcChomage(input({ salaireBrut: 0 }))).toHaveProperty("error");
    expect(calcChomage(input({ salaireBrut: -500 }))).toHaveProperty("error");
    expect(calcChomage(input({ salaireBrut: NaN }))).toHaveProperty("error");
  });

  it("rejette une situation familiale ou une phase inconnue", () => {
    expect(
      calcChomage(input({ situationFamiliale: "inconnu" as ChomageInput["situationFamiliale"] })),
    ).toHaveProperty("error");
    expect(
      calcChomage(input({ phase: "9Z" as ChomageInput["phase"] })),
    ).toHaveProperty("error");
  });
});

describe("phaseFromMonths — déduction de la phase par ancienneté", () => {
  it("mappe chaque tranche de mois sur la bonne phase", () => {
    expect(phaseFromMonths(1)).toBe("1A");
    expect(phaseFromMonths(3)).toBe("1A");
    expect(phaseFromMonths(4)).toBe("1B");
    expect(phaseFromMonths(6)).toBe("1B");
    expect(phaseFromMonths(7)).toBe("2A");
    expect(phaseFromMonths(12)).toBe("2A");
    expect(phaseFromMonths(13)).toBe("2B");
    expect(phaseFromMonths(24)).toBe("2B");
    expect(phaseFromMonths(25)).toBe("2C");
    expect(phaseFromMonths(36)).toBe("2C");
    expect(phaseFromMonths(37)).toBe("3");
    expect(phaseFromMonths(120)).toBe("3");
  });

  it("traite un mois ≤ 0, fractionnaire ou non fini comme le mois 1 (1A)", () => {
    expect(phaseFromMonths(0)).toBe("1A");
    expect(phaseFromMonths(-5)).toBe("1A");
    expect(phaseFromMonths(NaN)).toBe("1A");
    expect(phaseFromMonths(2.9)).toBe("1A"); // plancher → mois 2
    expect(phaseFromMonths(6.9)).toBe("1B"); // plancher → mois 6
  });
});

describe("calcChomage — métadonnées de barème", () => {
  it("expose une version de barème au format date ISO", () => {
    expect(BAREME_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("garde les 6 phases de dégressivité documentées", () => {
    expect(PHASES_INFO.map((p) => p.id)).toEqual([
      "1A",
      "1B",
      "2A",
      "2B",
      "2C",
      "3",
    ]);
  });
});
