/**
 * TEST DE PARITÉ — lib/chomage/params.ts ↔ dernier barème ONEM publié.
 *
 * Le fixture lib/chomage/__fixtures__/bareme-publie.json est un extrait du
 * BaremeFile "published" (workflow admin 4 yeux), régénéré via :
 *   pnpm exec dotenv -e .env.local -- tsx scripts/export-bareme-parity-fixture.ts
 *
 * Objectif : si l'ONEM publie une indexation/réforme (nouvel import publié
 * puis fixture régénéré), ce test ÉCHOUE tant que lib/chomage/params.ts n'a
 * pas reçu un nouveau jeu daté. C'est le pont voulu entre la base barèmes
 * (consultation) et le code de calcul — cf. audit
 * docs/audits/AUDIT_ARCHITECTURE_CHOMAGE_2026-07-04.md (lot 2).
 *
 * ⚠️ QUESTION MÉTIER OUVERTE (à trancher par Oraliks, PAS par ce test) :
 * le barème publié expose 6 plafonds art. 111 (A1, A2, B, C, AX, AZ). Le
 * code mappe 1A→A1, 1B→A2, 2A→B et suppose 2B "aligné sur B" (3262.99),
 * alors qu'un Loongrens C distinct existe à 3500.99. Le test vérifie donc
 * l'ÉGALITÉ sur A1/A2/B (non ambigus) et l'APPARTENANCE de chaque plafond
 * du code à la liste officielle — sans trancher le mapping de 2B.
 */
import { describe, expect, it } from "vitest";

import fixture from "../__fixtures__/bareme-publie.json";
import { getChomageParams } from "../params";

interface PlafondRow {
  comparisonKey: string;
  labelNl: string | null;
  amount: number;
}

const plafondsOfficiels = fixture.plafondsArt111Monthly as PlafondRow[];

/** Retrouve un plafond officiel par préfixe de libellé NL (ex. "Loongrens A1"). */
function officiel(labelPrefix: string): PlafondRow {
  const row = plafondsOfficiels.find((p) =>
    (p.labelNl ?? "").startsWith(labelPrefix),
  );
  if (!row) {
    throw new Error(
      `Plafond "${labelPrefix}" introuvable dans le fixture — régénérer via scripts/export-bareme-parity-fixture.ts`,
    );
  }
  return row;
}

describe("parité code ↔ barème publié — couverture temporelle", () => {
  it("le fixture référence bien un fichier publié daté", () => {
    expect(fixture.file.name.length).toBeGreaterThan(0);
    expect(fixture.file.validFrom).toBeTruthy();
    expect(plafondsOfficiels.length).toBeGreaterThanOrEqual(3);
  });

  it("un jeu de paramètres code couvre la date d'effet du barème publié", () => {
    const validFrom = new Date(fixture.file.validFrom as string);
    // Doit résoudre sans throw : sinon, ajouter un jeu daté dans params.ts.
    const set = getChomageParams(validFrom);
    expect(set.validFrom <= (fixture.file.validFrom as string).slice(0, 10)).toBe(
      true,
    );
  });
});

describe("parité code ↔ barème publié — plafonds salariaux (art. 111, al. 2)", () => {
  const { values } = getChomageParams(
    new Date(fixture.file.validFrom as string),
  );

  it("phase 1A = Loongrens A1 (égalité exacte)", () => {
    expect(values.plafonds["1A"]).toBe(officiel("Loongrens A1").amount);
  });

  it("phase 1B = Loongrens A2 (égalité exacte)", () => {
    expect(values.plafonds["1B"]).toBe(officiel("Loongrens A2").amount);
  });

  it("phase 2A = Loongrens B (égalité exacte)", () => {
    expect(values.plafonds["2A"]).toBe(officiel("Loongrens B").amount);
  });

  it("chaque plafond du code existe dans la liste officielle publiée", () => {
    const officielAmounts = new Set(plafondsOfficiels.map((p) => p.amount));
    for (const [phase, montant] of Object.entries(values.plafonds)) {
      expect(
        officielAmounts.has(montant),
        `plafond ${phase} = ${montant} absent du barème publié ${fixture.file.name} — indexation ONEM ? Ajouter un jeu daté dans lib/chomage/params.ts puis régénérer le fixture.`,
      ).toBe(true);
    }
  });
});
