import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWech505, isWech505 } from "../parse-wech505";

const TEXT505 = readFileSync(
  join(__dirname, "fixtures", "wech505-specimen.txt"),
  "utf8",
);
const TEXT506 = readFileSync(
  join(__dirname, "fixtures", "wech506-specimen.txt"),
  "utf8",
);

describe("parseWech505 — WECH 505 spécimen (CT, mai 2026, anonymisé)", () => {
  const r = parseWech505(TEXT505);

  it("reconnaît le formulaire comme un WECH 505 (et pas un 506)", () => {
    expect(isWech505(TEXT505)).toBe(true);
    expect(isWech505(TEXT506)).toBe(false);
  });

  it("extrait l'identité et l'employeur (clé de rapprochement)", () => {
    expect(r.moisReference).toEqual({ debut: "01/05/2026", fin: "31/05/2026" });
    expect(r.niss).toBe("000000000-00");
    expect(r.nomTravailleur).toBe("SPECIMEN, EXEMPLE");
    expect(r.employeurOnss).toBe("000000000");
    expect(r.employeurNom).toBe("EXEMPLE SA");
  });

  it("extrait les données de travail (Q/S, dates)", () => {
    expect(r.q).toBe(18.5);
    expect(r.s).toBe(36.5);
    expect(r.dateDebut).toBe("01/05/2026");
    expect(r.dateFin).toBe("31/05/2026");
  });

  it("agrège la grille CT : 3,75 h de code 5.1 → PW", () => {
    expect(r.grille).toEqual([{ jour: "15/05", code: "5.1", heures: 3.75 }]);
    expect(r.buckets.pw1).toBe(3.75);
    expect(r.buckets.fermetureTotal).toBe(0);
    expect(r.codesAVerifier).toHaveLength(0);
  });
});
