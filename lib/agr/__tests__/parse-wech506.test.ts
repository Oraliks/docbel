import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWech506 } from "../parse-wech506";
import { deriverCategorieTravailleur } from "../categorie-travailleur";

const TEXT = readFileSync(
  join(__dirname, "fixtures", "wech506-nait-chrif.txt"),
  "utf8",
);

describe("parseWech506 — DRS réelle (NAIT CHRIF, déc. 2023)", () => {
  const r = parseWech506(TEXT);

  it("extrait l'identité et l'employeur", () => {
    expect(r.moisReference).toEqual({ debut: "01/12/2023", fin: "31/12/2023" });
    expect(r.niss).toBe("770725054-86");
    expect(r.nomTravailleur).toBe("NAIT CHRIF, HASSNA");
    expect(r.employeurOnss).toBe("082921322");
    expect(r.employeurNom).toBe("STAD DILSEN-STOKKEM");
    expect(r.categorieEmployeur).toBe("751");
    expect(r.codeTravailleur).toBe("015");
    expect(r.numeroTicket).toBe("034071K2BBFWZ");
  });

  it("dérive la catégorie travailleur 2P (ouvrier public — cf. AS400 « Ouv.Publ(2P) »)", () => {
    expect(r.categorieTravailleur).toBe("2P");
  });

  it("extrait les données de travail (Q/S, salaires, horaire, interruption)", () => {
    expect(r.q).toBe(19);
    expect(r.s).toBe(38);
    expect(r.ybrut).toBe(1221.38);
    expect(r.salaireTheoriqueMois).toBe(1221.38);
    expect(r.salaireTheoriqueHeure).toBe(0);
    expect(r.schemaTravail).toBe("10");
    expect(r.interruption).toBe(2);
    expect(r.qinfo).toBe(2);
    expect(r.refusOccupation).toBe(0);
  });

  it("agrège la grille : HT = 79,00 h (codes 1 + 2.4), pas d'autre prestation", () => {
    expect(r.grille).toHaveLength(21);
    expect(r.buckets.heures).toBe(79);
    expect(r.buckets.heuresV).toBe(0);
    expect(r.buckets.pw1).toBe(0);
    expect(r.buckets.fermetureTotal).toBe(0);
    expect(r.parCode["1"]).toBe(76);
    expect(r.parCode["2.4"]).toBe(3);
    expect(r.codesAVerifier).toHaveLength(0);
  });
});

describe("deriverCategorieTravailleur", () => {
  it("classe les cas typiques", () => {
    expect(deriverCategorieTravailleur(751, 15)).toBe("2P"); // ouvrier public
    expect(deriverCategorieTravailleur(751, 761)).toBe("2E"); // employé public
    expect(deriverCategorieTravailleur(11, 15)).toBe("1O"); // ouvrier privé
    expect(deriverCategorieTravailleur(11, 490)).toBe("1E"); // employé privé (code ≥ 100, 1er chiffre > 1)
  });
});
