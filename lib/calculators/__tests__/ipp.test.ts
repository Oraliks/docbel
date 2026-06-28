import { describe, it, expect } from "vitest";
import {
  calcIPP,
  TRANCHES_IPP_2026,
  QUOTITE_BASE_2026,
  SUPPLEMENT_ENFANTS,
  SUPPLEMENT_ENFANT_AU_DELA_5,
  SUPPLEMENT_AUTRE_PERSONNE,
  SUPPLEMENT_PARENT_ISOLE,
  CSS_PLAFOND_ANNUEL,
  type IPPInput,
  type IPPResult,
  type IPPError,
} from "../ipp";

/** Récupère un résultat valide ou échoue le test si une erreur est retournée. */
function ok(r: IPPResult | IPPError): IPPResult {
  if ("error" in r) {
    throw new Error(`IPP inattendu en erreur : ${r.error}`);
  }
  return r;
}

/** Entrée de base : isolé, sans charge, sans additionnel, sans réduction. */
function input(over: Partial<IPPInput> = {}): IPPInput {
  return {
    revenuAnnuelImposable: 30000,
    statut: "isole",
    enfants: 0,
    autresPersonnesACharge: 0,
    additionnelCommunal: 0,
    ...over,
  };
}

describe("calcIPP — barème fédéral progressif EI 2026", () => {
  it("applique le barème par tranches (25/40/45/50 %) sur un revenu de 30 000 €", () => {
    const r = ok(calcIPP(input({ revenuAnnuelImposable: 30000 })));
    // bareme(30000) = 16320×25% + 12480×40% + 1200×45% = 4080 + 4992 + 540
    // quotité 10 910 → réduction 10 910×25% = 2 727,5
    // impôt fédéral = 9 612 − 2 727,5 = 6 884,5
    expect(r.quotiteExemptee).toBe(QUOTITE_BASE_2026);
    expect(r.reductionQuotite).toBeCloseTo(2727.5, 2);
    expect(r.impotBrutFederal).toBeCloseTo(6884.5, 2);
  });

  it("expose le taux marginal de la tranche du dernier euro", () => {
    expect(ok(calcIPP(input({ revenuAnnuelImposable: 10000 }))).tauxMarginal).toBeCloseTo(
      25,
      4,
    );
    expect(ok(calcIPP(input({ revenuAnnuelImposable: 20000 }))).tauxMarginal).toBeCloseTo(
      40,
      4,
    );
    expect(ok(calcIPP(input({ revenuAnnuelImposable: 40000 }))).tauxMarginal).toBeCloseTo(
      45,
      4,
    );
    expect(ok(calcIPP(input({ revenuAnnuelImposable: 80000 }))).tauxMarginal).toBeCloseTo(
      50,
      4,
    );
  });

  it("renvoie un impôt et un taux moyen nuls pour un revenu de 0 €", () => {
    const r = ok(calcIPP(input({ revenuAnnuelImposable: 0 })));
    expect(r.impotTotal).toBe(0);
    expect(r.tauxMoyen).toBe(0);
    expect(r.revenuNetApresImpot).toBe(0);
  });

  it("garde les bornes du barème inchangées (garde-fou montants légaux)", () => {
    expect(TRANCHES_IPP_2026.map((t) => t.max)).toEqual([
      16320,
      28800,
      49840,
      Infinity,
    ]);
    expect(TRANCHES_IPP_2026.map((t) => t.taux)).toEqual([0.25, 0.4, 0.45, 0.5]);
  });
});

describe("calcIPP — quotité exemptée selon la situation familiale", () => {
  it("ajoute les suppléments enfants cumulatifs (art. 132 CIR 92)", () => {
    expect(
      ok(calcIPP(input({ enfants: 2 }))).quotiteExemptee,
    ).toBe(QUOTITE_BASE_2026 + SUPPLEMENT_ENFANTS[2]);
    expect(SUPPLEMENT_ENFANTS[2]).toBe(5110);
  });

  it("extrapole au-delà de 5 enfants (+7 070 € par enfant supplémentaire)", () => {
    // 7 enfants : base + supplément 5 enfants + 2 × 7 070.
    const attendu =
      QUOTITE_BASE_2026 + SUPPLEMENT_ENFANTS[5] + 2 * SUPPLEMENT_ENFANT_AU_DELA_5;
    expect(ok(calcIPP(input({ enfants: 7 }))).quotiteExemptee).toBe(attendu);
  });

  it("ajoute le supplément par autre personne à charge", () => {
    expect(
      ok(calcIPP(input({ autresPersonnesACharge: 2 }))).quotiteExemptee,
    ).toBe(QUOTITE_BASE_2026 + 2 * SUPPLEMENT_AUTRE_PERSONNE);
  });

  it("ajoute le supplément parent isolé seulement avec ≥ 1 enfant", () => {
    const sansEnfant = ok(
      calcIPP(input({ parentIsole: true, enfants: 0 })),
    );
    expect(sansEnfant.quotiteExemptee).toBe(QUOTITE_BASE_2026);

    const avecEnfant = ok(
      calcIPP(input({ parentIsole: true, enfants: 1 })),
    );
    expect(avecEnfant.quotiteExemptee).toBe(
      QUOTITE_BASE_2026 + SUPPLEMENT_ENFANTS[1] + SUPPLEMENT_PARENT_ISOLE,
    );
  });
});

describe("calcIPP — additionnel communal", () => {
  it("applique l'additionnel communal sur l'impôt après crédits", () => {
    const r = ok(calcIPP(input({ revenuAnnuelImposable: 30000, additionnelCommunal: 7.5 })));
    // 6 884,5 × 7,5 % = 516,3375
    expect(r.additionnelCommunalEur).toBeCloseTo(516.3375, 3);
    expect(r.impotTotal).toBeCloseTo(
      r.impotBrutApresCredits + r.additionnelCommunalEur + r.cotisationSpecialeSecu,
      4,
    );
  });
});

describe("calcIPP — quotient conjugal (marié un seul revenu)", () => {
  it("réduit l'impôt et expose l'allègement, plafonné au transfert légal", () => {
    const r = ok(
      calcIPP(input({ revenuAnnuelImposable: 40000, statut: "marie_un_revenu" })),
    );
    // baseTransfert = min(40000−16320, 13460) = 13460 → allègement 25 % = 3365
    expect(r.allegementQuotientConjugal).toBeCloseTo(3365, 2);

    const isole = ok(calcIPP(input({ revenuAnnuelImposable: 40000, statut: "isole" })));
    expect(isole.allegementQuotientConjugal).toBe(0);
    expect(r.impotBrutFederal).toBeCloseTo(isole.impotBrutFederal - 3365, 2);
  });

  it("n'applique pas le quotient conjugal aux deux revenus", () => {
    const r = ok(
      calcIPP(input({ revenuAnnuelImposable: 40000, statut: "marie_deux_revenus" })),
    );
    expect(r.allegementQuotientConjugal).toBe(0);
  });
});

describe("calcIPP — réductions d'impôt", () => {
  it("cumule les réductions plafonnées (épargne, titres, dons, prêt, garde)", () => {
    const r = ok(
      calcIPP(
        input({
          revenuAnnuelImposable: 30000,
          epargnePension: 1000,
          titresServices: 1000,
          dons: 100,
          pretHypothecaire: 2000,
          gardeEnfants: 1000,
        }),
      ),
    );
    // 1000×30% + 1000×15% + 100×45% + 2000×30% + 1000×45%
    // = 300 + 150 + 45 + 600 + 450 = 1545
    expect(r.reductionsTotales).toBeCloseTo(1545, 2);
    expect(r.impotBrutApresCredits).toBeCloseTo(r.impotBrutFederal - 1545, 2);
  });

  it("plafonne l'épargne pension au panier de base (1 050 € × 30 %)", () => {
    const r = ok(calcIPP(input({ epargnePension: 2000 })));
    expect(r.reductionsTotales).toBeCloseTo(1050 * 0.3, 2);
  });

  it("ignore les dons sous le minimum de 40 €", () => {
    expect(ok(calcIPP(input({ dons: 30 }))).reductionsTotales).toBe(0);
    expect(ok(calcIPP(input({ dons: 40 }))).reductionsTotales).toBeCloseTo(18, 2);
  });
});

describe("calcIPP — cotisation spéciale sécurité sociale", () => {
  it("est nulle sous le seuil bas (≤ 18 592 €)", () => {
    expect(ok(calcIPP(input({ revenuAnnuelImposable: 15000 }))).cotisationSpecialeSecu).toBe(
      0,
    );
  });

  it("applique 9 % dans la première tranche (18 592 → 21 070 €)", () => {
    const r = ok(calcIPP(input({ revenuAnnuelImposable: 20000 })));
    // (20000 − 18592) × 9 % = 126,72
    expect(r.cotisationSpecialeSecu).toBeCloseTo(126.72, 2);
  });

  it("plafonne la cotisation au montant annuel légal (731 €) pour les hauts revenus", () => {
    const r = ok(calcIPP(input({ revenuAnnuelImposable: 100000 })));
    expect(r.cotisationSpecialeSecu).toBe(CSS_PLAFOND_ANNUEL);
  });
});

describe("calcIPP — cohérence de l'impôt total et du net", () => {
  it("compose impôt total = fédéral après crédits + additionnel + CSS", () => {
    const r = ok(
      calcIPP(input({ revenuAnnuelImposable: 30000, additionnelCommunal: 7.5 })),
    );
    expect(r.impotTotal).toBeCloseTo(
      r.impotBrutApresCredits + r.additionnelCommunalEur + r.cotisationSpecialeSecu,
      4,
    );
    expect(r.revenuNetApresImpot).toBeCloseTo(30000 - r.impotTotal, 4);
    expect(r.tauxMoyen).toBeCloseTo((r.impotTotal / 30000) * 100, 4);
  });
});

describe("calcIPP — validation des entrées", () => {
  it("rejette un revenu négatif ou hors plafond", () => {
    expect(calcIPP(input({ revenuAnnuelImposable: -1 }))).toHaveProperty("error");
    expect(
      calcIPP(input({ revenuAnnuelImposable: 10_000_001 })),
    ).toHaveProperty("error");
    expect(calcIPP(input({ revenuAnnuelImposable: NaN }))).toHaveProperty("error");
  });

  it("rejette un nombre d'enfants invalide (non entier, négatif, > 10)", () => {
    expect(calcIPP(input({ enfants: 1.5 }))).toHaveProperty("error");
    expect(calcIPP(input({ enfants: -1 }))).toHaveProperty("error");
    expect(calcIPP(input({ enfants: 11 }))).toHaveProperty("error");
  });

  it("rejette les autres personnes à charge et l'additionnel hors bornes", () => {
    expect(calcIPP(input({ autresPersonnesACharge: 6 }))).toHaveProperty("error");
    expect(calcIPP(input({ additionnelCommunal: -1 }))).toHaveProperty("error");
    expect(calcIPP(input({ additionnelCommunal: 16 }))).toHaveProperty("error");
  });

  it("rejette les réductions hors plafond de saisie", () => {
    expect(calcIPP(input({ epargnePension: 5001 }))).toHaveProperty("error");
    expect(calcIPP(input({ titresServices: 5001 }))).toHaveProperty("error");
    expect(calcIPP(input({ dons: 100_001 }))).toHaveProperty("error");
    expect(calcIPP(input({ pretHypothecaire: 50_001 }))).toHaveProperty("error");
    expect(calcIPP(input({ gardeEnfants: 50_001 }))).toHaveProperty("error");
  });
});
