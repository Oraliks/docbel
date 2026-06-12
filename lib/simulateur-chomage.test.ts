import { describe, it, expect } from "vitest";
import {
  ANCIENNETE_OPTIONS,
  BAREME_2026,
  estimerAllocation,
  type CategorieFamiliale,
  type SimulationInput,
} from "./simulateur-chomage";

/**
 * Les valeurs attendues sont dérivées à la main des barèmes du moteur central
 * `lib/calculators/chomage.ts` (plafonds 4265,98 / 4010,98 / 3262,99 €,
 * forfaits min 1500/1260/1015 €, max 2200/1850/1500 €, mensuel → /26) : ce
 * fichier verrouille donc à la fois l'adaptateur ET la parité avec /outils.
 */

/** Entrée de base (ne renseigner que l'utile), façon tests AGR. */
function sim(p: Partial<SimulationInput>): SimulationInput {
  return { categorie: "isole", brutMensuel: 2850, moisDeChomage: 1, ...p };
}

describe("estimerAllocation — plafonnements", () => {
  it("plafond salarial de la période (mois 7-12) : 5000 € → base 3262,99 €", () => {
    // chef_menage, mois 8 → phase 2A : min(5000 ; 3262,99) × 60 % = 1957,79 €/mois.
    const res = estimerAllocation(
      sim({ categorie: "chef_menage", brutMensuel: 5000, moisDeChomage: 8 }),
    );
    expect(res.parMois).toBe(1957.79);
    expect(res.parJour).toBe(75.3); // 1957,79 / 26
    expect(res.tauxPct).toBe(60);
    expect(res.plafondApplique).toBe(true);
    expect(res.periodeLabel).toMatch(/mois 7-12/);
    expect(res.caveats.join(" ")).toMatch(/plafonné/i);
  });

  it("forfait maximum de la catégorie : 4000 € (sous le plafond salarial) → 2200 €/mois", () => {
    // chef_menage, mois 1 → 4000 × 65 % = 2600 > forfait max 2200 → 84,62 €/jour.
    const res = estimerAllocation(
      sim({ categorie: "chef_menage", brutMensuel: 4000, moisDeChomage: 1 }),
    );
    expect(res.parMois).toBe(2200);
    expect(res.parJour).toBe(84.62);
    expect(res.plafondApplique).toBe(true);
    expect(res.caveats.join(" ")).toMatch(/forfait maximum/i);
  });

  it("aucun plafonnement : 2850 € chef de ménage au mois 3 → 65 % pleins", () => {
    const res = estimerAllocation(
      sim({ categorie: "chef_menage", brutMensuel: 2850, moisDeChomage: 3 }),
    );
    expect(res.parMois).toBe(1852.5); // 2850 × 0,65, dans [1500 ; 2200]
    expect(res.parJour).toBe(71.25);
    expect(res.plafondApplique).toBe(false);
  });
});

describe("estimerAllocation — planchers (forfaits minimum)", () => {
  it("petit salaire relevé au forfait minimum (cohabitant : 1015 €/mois)", () => {
    // 200 × 65 % = 130 → remonté à 1015 → 39,04 €/jour.
    const res = estimerAllocation(
      sim({ categorie: "cohabitant", brutMensuel: 200, moisDeChomage: 2 }),
    );
    expect(res.parMois).toBe(1015);
    expect(res.parJour).toBe(39.04);
    expect(res.plafondApplique).toBe(false); // plancher ≠ plafonnement
    expect(res.caveats.join(" ")).toMatch(/forfait minimum/i);
  });

  it("en plancher, les trois catégories donnent trois montants distincts", () => {
    const parJour = (categorie: CategorieFamiliale) =>
      estimerAllocation(sim({ categorie, brutMensuel: 300, moisDeChomage: 1 }))
        .parJour;
    // Forfaits min : chef 1500, isolé 1260, cohabitant 1015 (€/mois, /26).
    expect(parJour("chef_menage")).toBe(57.69);
    expect(parJour("isole")).toBe(48.46);
    expect(parJour("cohabitant")).toBe(39.04);
  });
});

describe("estimerAllocation — bascule 65 % → 60 % au 4ᵉ mois", () => {
  it("même profil, mois 3 puis mois 4 : le taux et le montant baissent", () => {
    const mois3 = estimerAllocation(
      sim({ categorie: "chef_menage", brutMensuel: 2850, moisDeChomage: 3 }),
    );
    const mois4 = estimerAllocation(
      sim({ categorie: "chef_menage", brutMensuel: 2850, moisDeChomage: 4 }),
    );
    expect(mois3.tauxPct).toBe(65);
    expect(mois4.tauxPct).toBe(60);
    expect(mois3.parJour).toBe(71.25); // 2850 × 0,65 / 26
    expect(mois4.parJour).toBe(65.77); // 2850 × 0,60 / 26
    expect(mois4.parJour).toBeLessThan(mois3.parJour);
    expect(mois3.periodeLabel).toMatch(/mois 1-3/);
    expect(mois4.periodeLabel).toMatch(/mois 4-6/);
  });
});

describe("estimerAllocation — périmètre & cohérence", () => {
  it("parMois reste ≈ parJour × 26 (écart d'arrondi < 0,20 €)", () => {
    for (const brutMensuel of [200, 1800, 2850, 5000]) {
      const res = estimerAllocation(sim({ brutMensuel, moisDeChomage: 5 }));
      expect(
        Math.abs(res.parMois - res.parJour * BAREME_2026.joursIndemnisablesParMois),
      ).toBeLessThan(0.2);
    }
  });

  it("prévient les hauts salaires que le plafond diminue dès le 7ᵉ mois", () => {
    // chef_menage 5000 €, mois 5 (1B) : 84,62 €/jour ; en 2A il tombera à 75,30.
    const res = estimerAllocation(
      sim({ categorie: "chef_menage", brutMensuel: 5000, moisDeChomage: 5 }),
    );
    expect(res.caveats.join(" ")).toMatch(/7ᵉ mois/);
  });

  it("ne le prévient pas quand le montant ne changera pas (salaire sous plafond)", () => {
    const res = estimerAllocation(
      sim({ categorie: "chef_menage", brutMensuel: 2000, moisDeChomage: 5 }),
    );
    expect(res.caveats.join(" ")).not.toMatch(/7ᵉ mois/);
  });

  it("au-delà de 12 mois : clamp à la fin de 1ʳᵉ période + caveat dégressivité", () => {
    const mois12 = estimerAllocation(sim({ moisDeChomage: 12 }));
    const mois24 = estimerAllocation(sim({ moisDeChomage: 24 }));
    expect(mois24.parJour).toBe(mois12.parJour);
    expect(mois24.caveats.join(" ")).toMatch(/dégressivité/i);
    expect(mois24.caveats.join(" ")).toMatch(/surestimé/i);
  });

  it("toujours des caveats honnêtes (« indicative », « ONEM fait foi »)", () => {
    const res = estimerAllocation(sim({}));
    expect(res.caveats.join(" ")).toMatch(/indicative/i);
    expect(res.caveats.join(" ")).toMatch(/ONEM fait foi/i);
  });

  it("mois 0 (tout début) est accepté et traité comme la tranche 1-3", () => {
    expect(estimerAllocation(sim({ moisDeChomage: 0 })).tauxPct).toBe(65);
  });

  it("les options d'ancienneté du formulaire tombent dans les bonnes tranches", () => {
    const [debut, suite] = ANCIENNETE_OPTIONS;
    expect(
      estimerAllocation(sim({ moisDeChomage: debut.moisRepresentatif })).tauxPct,
    ).toBe(65);
    expect(
      estimerAllocation(sim({ moisDeChomage: suite.moisRepresentatif })).tauxPct,
    ).toBe(60);
  });
});

describe("estimerAllocation — entrées aberrantes (politique : throw, sauf mois > 12)", () => {
  it("salaire négatif, non numérique, infini ou ≤ 100 € → RangeError", () => {
    expect(() => estimerAllocation(sim({ brutMensuel: -1 }))).toThrow(RangeError);
    expect(() => estimerAllocation(sim({ brutMensuel: Number.NaN }))).toThrow(
      RangeError,
    );
    expect(() =>
      estimerAllocation(sim({ brutMensuel: Number.POSITIVE_INFINITY })),
    ).toThrow(RangeError);
    // Seuil aligné sur la garde du moteur central (salaire ≤ 100 € refusé).
    expect(() => estimerAllocation(sim({ brutMensuel: 100 }))).toThrow(
      RangeError,
    );
  });

  it("mois négatif ou non numérique → RangeError", () => {
    expect(() => estimerAllocation(sim({ moisDeChomage: -1 }))).toThrow(
      RangeError,
    );
    expect(() => estimerAllocation(sim({ moisDeChomage: Number.NaN }))).toThrow(
      RangeError,
    );
  });

  it("catégorie inconnue → RangeError", () => {
    expect(() =>
      estimerAllocation(
        sim({ categorie: "colocataire" as CategorieFamiliale }),
      ),
    ).toThrow(RangeError);
  });
});
