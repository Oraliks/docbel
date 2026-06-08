import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWech505 } from "../parse-wech505";
import { planCtMerge, ctEntriesOf, type CtOccupationRef } from "../merge-ct";
import type { GrilleEntry } from "../parse-wech506";

const SPECIMEN = parseWech505(
  readFileSync(join(__dirname, "fixtures", "wech505-specimen.txt"), "utf8"),
);

/** Occupation correspondant au spécimen 505 (même NISS / nom / ONSS / mois). */
function matchingOcc(ctEntries: GrilleEntry[]): CtOccupationRef {
  return {
    niss: "000000000-00",
    nom: "SPECIMEN, EXEMPLE",
    employeurOnss: "000000000",
    moisDebut: "01/05/2026",
    moisFin: "31/05/2026",
    ctEntries,
  };
}

describe("planCtMerge — rapprochement & déduplication du CT", () => {
  it("déduplique : si le 506 contient déjà le CT, on n'ajoute rien", () => {
    // L'occupation a déjà l'entrée CT (cas réel : la grille du 506 contient 5.1).
    const occ = matchingOcc([{ jour: "15/05", code: "5.1", heures: 3.75 }]);
    const plan = planCtMerge(SPECIMEN, [occ]);
    expect(plan.status).toBe("duplicate");
    expect(plan.addPw).toBe(0);
    expect(plan.newEntries).toHaveLength(0);
  });

  it("ajoute le CT quand il est absent de l'occupation (506 sans CT)", () => {
    const occ = matchingOcc([]); // 506 sans heures CT
    const plan = planCtMerge(SPECIMEN, [occ]);
    expect(plan.status).toBe("merged");
    expect(plan.matchedIndex).toBe(0);
    expect(plan.addPw).toBe(3.75);
    expect(plan.addFermeture).toBe(0);
    expect(plan.newEntries).toEqual([{ jour: "15/05", code: "5.1", heures: 3.75 }]);
  });

  it("refuse si aucune occupation ne correspond (NISS différent)", () => {
    const other = { ...matchingOcc([]), niss: "111111111-11" };
    const plan = planCtMerge(SPECIMEN, [other]);
    expect(plan.status).toBe("no-match");
    expect(plan.matchedIndex).toBeNull();
  });

  it("refuse si l'identité correspond mais le mois diffère", () => {
    const other = { ...matchingOcc([]), moisDebut: "01/04/2026", moisFin: "30/04/2026" };
    const plan = planCtMerge(SPECIMEN, [other]);
    expect(plan.status).toBe("month-mismatch");
    expect(plan.matchedIndex).toBeNull();
  });

  it("ne recompte pas en aveugle un même jour/code aux heures différentes (conflit)", () => {
    const occ = matchingOcc([{ jour: "15/05", code: "5.1", heures: 4.0 }]);
    const plan = planCtMerge(SPECIMEN, [occ]);
    expect(plan.status).toBe("duplicate");
    expect(plan.addPw).toBe(0);
    expect(plan.conflicts).toHaveLength(1);
  });

  it("cible la bonne occupation parmi plusieurs (double emploi)", () => {
    const autre = { ...matchingOcc([]), niss: "222222222-22", nom: "AUTRE, PERSONNE" };
    const occ = matchingOcc([]);
    const plan = planCtMerge(SPECIMEN, [autre, occ]);
    expect(plan.status).toBe("merged");
    expect(plan.matchedIndex).toBe(1);
  });
});

describe("ctEntriesOf — filtre les entrées de chômage temporaire", () => {
  it("ne garde que les codes 5.x", () => {
    const grille: GrilleEntry[] = [
      { jour: "01/05", code: "1", heures: 7.6 },
      { jour: "15/05", code: "5.1", heures: 3.75 },
      { jour: "20/05", code: "5.6", heures: 7.6 },
      { jour: "21/05", code: "3.1", heures: 7.6 },
    ];
    expect(ctEntriesOf(grille)).toEqual([
      { jour: "15/05", code: "5.1", heures: 3.75 },
      { jour: "20/05", code: "5.6", heures: 7.6 },
    ]);
  });
});
