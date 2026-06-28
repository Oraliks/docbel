import { describe, it, expect } from "vitest";
import {
  calcIndemniteRupture,
  tauxCotisationSpecialeProgressif,
  COEF_ANNUALISATION,
  PREAVIS_MAX_SEMAINES,
  PROTECTION_MOIS,
  type IndemniteInput,
  type IndemniteResult,
  type IndemniteError,
} from "../indemnite-rupture";

/** Récupère un résultat valide ou échoue le test si une erreur est retournée. */
function ok(r: IndemniteResult | IndemniteError): IndemniteResult {
  if ("error" in r) {
    throw new Error(`indemnité inattendue en erreur : ${r.error}`);
  }
  return r;
}

/** Entrée de base réutilisable (préavis non presté, sans option). */
function input(over: Partial<IndemniteInput> = {}): IndemniteInput {
  return {
    salaireBrutMensuel: 3000,
    dureePreavisSemaines: 12,
    avantagesAnnuels: 0,
    inclureAvantages: false,
    precompte: false,
    ...over,
  };
}

describe("calcIndemniteRupture — formule légale (CCT 109 / loi 3 juillet 1978)", () => {
  it("applique l'équivalence 13 semaines = 3 mois pour la rémunération hebdomadaire", () => {
    const r = ok(calcIndemniteRupture(input({ salaireBrutMensuel: 3000 })));
    // hebdo = mensuel × 3 / 13
    expect(r.remunerationMensuelle).toBeCloseTo(3000, 2);
    expect(r.remunerationHebdomadaire).toBeCloseTo((3000 * 3) / 13, 4);
  });

  it("calcule l'indemnité brute = rémunération hebdo × semaines de préavis", () => {
    const r = ok(
      calcIndemniteRupture(
        input({ salaireBrutMensuel: 3000, dureePreavisSemaines: 12 }),
      ),
    );
    expect(r.indemniteBrute).toBeCloseTo((3000 * 3) / 13 * 12, 2);
    // 13 semaines = 3 mois → indemnité = 3 mois de salaire (cas pivot).
    const treize = ok(
      calcIndemniteRupture(
        input({ salaireBrutMensuel: 3000, dureePreavisSemaines: 13 }),
      ),
    );
    expect(treize.indemniteBrute).toBeCloseTo(9000, 6);
  });

  it("mensualise les avantages annuels uniquement si inclureAvantages=true", () => {
    const avec = ok(
      calcIndemniteRupture(
        input({
          salaireBrutMensuel: 3000,
          avantagesAnnuels: 6000,
          inclureAvantages: true,
          dureePreavisSemaines: 13,
        }),
      ),
    );
    // 3000 + 6000/12 = 3500 ; 13 sem = 3 mois → 10 500
    expect(avec.remunerationMensuelle).toBeCloseTo(3500, 2);
    expect(avec.indemniteBrute).toBeCloseTo(10500, 2);

    const sans = ok(
      calcIndemniteRupture(
        input({
          salaireBrutMensuel: 3000,
          avantagesAnnuels: 6000,
          inclureAvantages: false,
          dureePreavisSemaines: 13,
        }),
      ),
    );
    expect(sans.remunerationMensuelle).toBeCloseTo(3000, 2);
    expect(sans.indemniteBrute).toBeCloseTo(9000, 2);
  });
});

describe("calcIndemniteRupture — précompte spécial (barème par tranches)", () => {
  it("ne déduit rien quand precompte=false (net = brut)", () => {
    const r = ok(calcIndemniteRupture(input({ precompte: false })));
    expect(r.indemniteNetEstimee).toBeCloseTo(r.indemniteTotalBrute, 6);
  });

  it("applique le taux de la tranche selon le brut annuel de référence", () => {
    // salaire 3000 → brutAnnuel = 3000 × 13,92 = 41 760 € → tranche 0,418.
    const r = ok(
      calcIndemniteRupture(input({ salaireBrutMensuel: 3000, precompte: true })),
    );
    expect(r.brutAnnuelReference).toBeCloseTo(3000 * COEF_ANNUALISATION, 2);
    expect(r.tauxPrecompteAppliquePourcent).toBeCloseTo(41.8, 4);
    expect(r.indemniteNetEstimee).toBeCloseTo(r.indemniteTotalBrute * 0.582, 2);
  });

  it("sélectionne la bonne tranche du barème pour des salaires croissants", () => {
    // brutAnnuel = salaire × 13,92 ; bornes 17 670 / 21 730 / 30 220 / 65 200.
    const cas: Array<[number, number]> = [
      [1000, 17.16], //  13 920 € → 0,1716
      [1400, 26.75], //  19 488 € → 0,2675
      [1600, 32.3], //  22 272 € → 0,323
      [3000, 41.8], //  41 760 € → 0,418
      [5000, 53.5], //  69 600 € → 0,535
    ];
    for (const [salaire, tauxPct] of cas) {
      const r = ok(
        calcIndemniteRupture(
          input({ salaireBrutMensuel: salaire, precompte: true }),
        ),
      );
      expect(r.tauxPrecompteAppliquePourcent).toBeCloseTo(tauxPct, 4);
    }
  });
});

describe("tauxCotisationSpecialeProgressif — cotisation employeur (ONSS / FFE)", () => {
  it("renvoie 0 sous le premier seuil et le bon taux progressif au-delà", () => {
    expect(tauxCotisationSpecialeProgressif(50_165)).toBe(0);
    expect(tauxCotisationSpecialeProgressif(50_166)).toBeCloseTo(0.01, 6);
    expect(tauxCotisationSpecialeProgressif(61_437)).toBeCloseTo(0.02, 6);
    expect(tauxCotisationSpecialeProgressif(72_707)).toBeCloseTo(0.03, 6);
    expect(tauxCotisationSpecialeProgressif(100_000)).toBeCloseTo(0.03, 6);
  });
});

describe("calcIndemniteRupture — cotisation spéciale employeur", () => {
  it("calcule la cotisation sur l'indemnité de rupture selon la tranche", () => {
    // preavis 13 sem = 3 mois → indemnité = 3 × salaire.
    const cas: Array<[number, number, number]> = [
      // salaire, taux % attendu, cotisation attendue (= 3 × salaire × taux)
      [3000, 0, 0], //  41 760 € < 50 166 → 0
      [4000, 1, 120], //  55 680 € → 1 %  → 12 000 × 1 %
      [4500, 2, 270], //  62 640 € → 2 %  → 13 500 × 2 %
      [5500, 3, 495], //  76 560 € → 3 %  → 16 500 × 3 %
    ];
    for (const [salaire, tauxPct, cotisation] of cas) {
      const r = ok(
        calcIndemniteRupture(
          input({ salaireBrutMensuel: salaire, dureePreavisSemaines: 13 }),
        ),
      );
      expect(r.tauxCotisationSpecialePourcent).toBeCloseTo(tauxPct, 4);
      expect(r.cotisationSpecialeEmployeur).toBeCloseTo(cotisation, 2);
    }
  });

  it("exclut l'indemnité de protection de la base de cotisation", () => {
    // salaire élevé (tranche 3 %) mais préavis 0 → indemnité de rupture = 0.
    const r = ok(
      calcIndemniteRupture(
        input({
          salaireBrutMensuel: 5500,
          dureePreavisSemaines: 0,
          protectionSpeciale: "femme_enceinte",
        }),
      ),
    );
    expect(r.indemniteProtectionSupplement).toBeGreaterThan(0);
    expect(r.tauxCotisationSpecialePourcent).toBeCloseTo(3, 4);
    // La cotisation ne porte que sur indemniteBrute (= 0 ici).
    expect(r.cotisationSpecialeEmployeur).toBe(0);
  });
});

describe("calcIndemniteRupture — indemnité de protection", () => {
  it("ajoute le supplément = mois × rémunération mensuelle, hors précompte", () => {
    const r = ok(
      calcIndemniteRupture(
        input({
          salaireBrutMensuel: 3000,
          dureePreavisSemaines: 12,
          protectionSpeciale: "femme_enceinte",
        }),
      ),
    );
    // 6 mois (loi 16 mars 1971, art. 40) × 3000 = 18 000
    expect(PROTECTION_MOIS.femme_enceinte).toBe(6);
    expect(r.indemniteProtectionSupplement).toBeCloseTo(18000, 2);
    expect(r.indemniteTotalBrute).toBeCloseTo(r.indemniteBrute + 18000, 2);
  });

  it("n'ajoute aucun supplément pour le statut « aucune »", () => {
    const r = ok(calcIndemniteRupture(input({ protectionSpeciale: "aucune" })));
    expect(r.indemniteProtectionSupplement).toBe(0);
    expect(r.indemniteTotalBrute).toBeCloseTo(r.indemniteBrute, 6);
  });

  it("retient les multiplicateurs légaux documentés", () => {
    expect(PROTECTION_MOIS.delegue_syndical).toBe(36);
    expect(PROTECTION_MOIS.travailleur_protege).toBe(9);
  });
});

describe("calcIndemniteRupture — validation des entrées", () => {
  it("rejette un salaire nul, négatif ou irréaliste", () => {
    expect(calcIndemniteRupture(input({ salaireBrutMensuel: 0 }))).toHaveProperty(
      "error",
    );
    expect(
      calcIndemniteRupture(input({ salaireBrutMensuel: -1 })),
    ).toHaveProperty("error");
    expect(
      calcIndemniteRupture(input({ salaireBrutMensuel: 100_001 })),
    ).toHaveProperty("error");
    expect(
      calcIndemniteRupture(input({ salaireBrutMensuel: NaN })),
    ).toHaveProperty("error");
  });

  it("rejette une durée de préavis hors bornes [0, 200]", () => {
    expect(
      calcIndemniteRupture(input({ dureePreavisSemaines: -1 })),
    ).toHaveProperty("error");
    expect(
      calcIndemniteRupture(
        input({ dureePreavisSemaines: PREAVIS_MAX_SEMAINES + 1 }),
      ),
    ).toHaveProperty("error");
  });

  it("accepte un préavis de 0 semaine (indemnité de protection seule)", () => {
    const r = ok(
      calcIndemniteRupture(
        input({
          dureePreavisSemaines: 0,
          protectionSpeciale: "femme_enceinte",
        }),
      ),
    );
    expect(r.indemniteBrute).toBe(0);
    expect(r.indemniteTotalBrute).toBeGreaterThan(0);
  });
});
