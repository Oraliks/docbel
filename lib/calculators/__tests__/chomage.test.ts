import { describe, it, expect } from "vitest";
import {
  calcChomage,
  phaseFromMonths,
  BAREME_VERSION,
  PHASES_INFO,
  type ChomageInput,
  type ChomageEstimation,
} from "../chomage";

/** Variante « estimée » de la sortie (1ʳᵉ période chiffrée). */
type ChomageEstime = Extract<ChomageEstimation, { statut: "estime" }>;

/** Récupère une estimation chiffrée ou échoue le test si autre chose est renvoyé. */
function estime(r: ChomageEstimation): ChomageEstime {
  if ("error" in r) {
    throw new Error(`Chômage inattendu en erreur : ${r.error}`);
  }
  if (r.statut !== "estime") {
    throw new Error(`Attendu une estimation chiffrée, reçu statut « ${r.statut} ».`);
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

describe("calcChomage — 1ʳᵉ période, phases proportionnelles (1A → 2A)", () => {
  it("phase 1A : 65 % du salaire sous le plafond A, dans les bornes forfaitaires", () => {
    const r = estime(calcChomage(input({ salaireBrut: 3000 })));
    // 3000 × 65 % = 1950, dans [1500, 2200] → 1950.
    expect(r.allocationMensuelle).toBe(1950);
    expect(r.tauxApplique).toBe(0.65);
    expect(r.plafondApplique).toBe(4265.98); // garde-fou : PLAFOND_A
    expect(r.salairePlafonne).toBe(3000);
    expect(r.phaseLabel).toBe("Mois 1-3 (1A)");
    expect(r.situationLabel).toBe("Chef de ménage");
  });

  it("phase 1A : plafonne le salaire au plafond A puis borne au forfait maximum", () => {
    const r = estime(calcChomage(input({ salaireBrut: 5000 })));
    // Salaire plafonné à 4265.98 ; 4265.98 × 65 % = 2772,89 → borné à 2200 (max chef).
    expect(r.salairePlafonne).toBe(4265.98);
    expect(r.allocationMensuelle).toBe(2200); // garde-fou : FORFAIT_MAX chef_menage
    expect(r.allocationJournaliere).toBe(84.62); // round(2200/26, 2)
  });

  it("phase 1A : remonte une petite allocation au forfait minimum (cohabitant)", () => {
    const r = estime(
      calcChomage(input({ salaireBrut: 1000, situationFamiliale: "cohabitant" })),
    );
    // 1000 × 65 % = 650 → remonté au plancher cohabitant 1015.
    expect(r.allocationMensuelle).toBe(1015);
  });

  it("phase 1B : taux 60 % sur le plafond A bis (mois 4-6)", () => {
    const r = estime(calcChomage(input({ salaireBrut: 3000, phase: "1B" })));
    expect(r.tauxApplique).toBe(0.6);
    expect(r.plafondApplique).toBe(4010.98); // PLAFOND_A_BIS
  });

  it("phase 2A : plafond B intermédiaire, taux 60 %", () => {
    const r = estime(calcChomage(input({ salaireBrut: 5000, phase: "2A" })));
    expect(r.plafondApplique).toBe(3262.99); // PLAFOND_B
    expect(r.salairePlafonne).toBe(3262.99);
    // 3262.99 × 60 % = 1957,794 → 1957,79 (dans [1500, 2200]).
    expect(r.allocationMensuelle).toBe(1957.79);
  });
});

describe("calcChomage — 2ᵉ période (2B) : forfait familial, montant à vérifier", () => {
  it("phase 2B : ne chiffre PAS, renvoie un statut « forfait_a_verifier »", () => {
    const r = calcChomage(input({ salaireBrut: 3000, phase: "2B" }));
    expect("statut" in r && r.statut).toBe("forfait_a_verifier");
    // Aucun montant chiffré ne doit fuiter dans cette variante.
    expect(r).not.toHaveProperty("allocationMensuelle");
  });

  it("phase 2B : indépendante du salaire (haut ou bas → même statut à vérifier)", () => {
    const haut = calcChomage(input({ salaireBrut: 6000, phase: "2B", situationFamiliale: "isole" }));
    const bas = calcChomage(input({ salaireBrut: 200, phase: "2B", situationFamiliale: "isole" }));
    expect("statut" in haut && haut.statut).toBe("forfait_a_verifier");
    expect("statut" in bas && bas.statut).toBe("forfait_a_verifier");
  });

  it("phase 2B : expose la situation et la période pour l'affichage", () => {
    const r = calcChomage(input({ phase: "2B", situationFamiliale: "chef_menage" }));
    if (!("statut" in r) || r.statut !== "forfait_a_verifier") {
      throw new Error("Attendu un statut forfait_a_verifier en phase 2B.");
    }
    expect(r.situationLabel).toBe("Chef de ménage");
    expect(r.phaseLabel).toBe("Mois 13-24 (2B)");
  });
});

describe("phaseFromMonths — bornage à 24 mois (réforme 2026)", () => {
  it("mappe les mois de la 1ʳᵉ et 2ᵉ période", () => {
    expect(phaseFromMonths(1)).toBe("1A");
    expect(phaseFromMonths(3)).toBe("1A");
    expect(phaseFromMonths(4)).toBe("1B");
    expect(phaseFromMonths(6)).toBe("1B");
    expect(phaseFromMonths(7)).toBe("2A");
    expect(phaseFromMonths(12)).toBe("2A");
    expect(phaseFromMonths(13)).toBe("2B");
    expect(phaseFromMonths(24)).toBe("2B");
  });

  it("au-delà de 24 mois : fin de droit (limitation réforme 2026)", () => {
    expect(phaseFromMonths(25)).toBe("fin_de_droit");
    expect(phaseFromMonths(36)).toBe("fin_de_droit");
    expect(phaseFromMonths(120)).toBe("fin_de_droit");
  });

  it("mois ≤ 0 ou non fini : traité comme le mois 1 (1A)", () => {
    expect(phaseFromMonths(0)).toBe("1A");
    expect(phaseFromMonths(-5)).toBe("1A");
    expect(phaseFromMonths(NaN)).toBe("1A");
  });
});

describe("calcChomage — situations familiales (plancher, phase 1A)", () => {
  it("applique le bon plancher selon la situation (salaire proche de zéro)", () => {
    expect(
      estime(calcChomage(input({ salaireBrut: 200, situationFamiliale: "chef_menage" }))).allocationMensuelle,
    ).toBe(1500);
    expect(
      estime(calcChomage(input({ salaireBrut: 200, situationFamiliale: "isole" }))).allocationMensuelle,
    ).toBe(1260);
    expect(
      estime(calcChomage(input({ salaireBrut: 200, situationFamiliale: "cohabitant" }))).allocationMensuelle,
    ).toBe(1015);
  });
});

describe("calcChomage — validation des entrées", () => {
  it("rejette un salaire trop bas, non fini ou négatif (phases chiffrées)", () => {
    expect(calcChomage(input({ salaireBrut: 100 }))).toHaveProperty("error");
    expect(calcChomage(input({ salaireBrut: 0 }))).toHaveProperty("error");
    expect(calcChomage(input({ salaireBrut: -500 }))).toHaveProperty("error");
    expect(calcChomage(input({ salaireBrut: NaN }))).toHaveProperty("error");
  });

  it("rejette une situation familiale invalide", () => {
    expect(
      calcChomage(input({ situationFamiliale: "inconnu" as ChomageInput["situationFamiliale"] })),
    ).toHaveProperty("error");
  });
});

describe("PHASES_INFO / BAREME_VERSION — métadonnées", () => {
  it("ne couvre que les phases post-réforme (1A, 1B, 2A, 2B)", () => {
    expect(PHASES_INFO.map((p) => p.id)).toEqual(["1A", "1B", "2A", "2B"]);
  });

  it("expose la version du barème en vigueur", () => {
    expect(BAREME_VERSION).toBe("2026-03-01");
  });
});
