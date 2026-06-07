import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractWechText } from "../extract-pdf-text";
import { parseWech506 } from "../parse-wech506";
import { calculerAgr } from "../calcul";
import type { OccupationInput } from "../types";

const PDF = readFileSync(join(__dirname, "fixtures", "wech506-nait-chrif.pdf"));

/**
 * Bout-en-bout depuis le VRAI PDF WECH 506 (NAIT CHRIF, déc. 2023) :
 * extraction pdfjs → parseur → moteur. Le résultat est validé contre l'Excel
 * FGTB recalculé (Excel COM) avec les mêmes entrées et le barème avril 2026.
 */
describe("Intégration : PDF réel → extraction → parse → calcul", () => {
  it("extrait la DRS et calcule l'AGR (identique à l'Excel : 689,77 / 850,71)", async () => {
    const text = await extractWechText(new Uint8Array(PDF));
    const p = parseWech506(text);

    expect(p.q).toBe(19);
    expect(p.s).toBe(38);
    expect(p.categorieTravailleur).toBe("2P");
    expect(p.ybrut).toBe(1221.38);
    expect(p.salaireTheoriqueMois).toBe(1221.38);
    expect(p.buckets.heures).toBe(79);

    const occ: OccupationInput = {
      qinfo: p.qinfo, q: p.q, s: p.s,
      categorieTravailleur: p.categorieTravailleur ?? "1O",
      ybrut: p.ybrut,
      salaireTheoriqueHeure: p.salaireTheoriqueHeure,
      salaireTheoriqueMois: p.salaireTheoriqueMois,
      heures: p.buckets.heures, heuresV: p.buckets.heuresV, heuresA: p.buckets.heuresA,
      requalifier: false, soldeS32: 0, soldeQ4: 0,
      pw1: p.buckets.pw1, pw2: 0, pr: p.buckets.pr,
      fermetureTotal: p.buckets.fermetureTotal, joursNI: 0,
    };
    const res = calculerAgr({
      allocationJournaliere: 65.58, demiAllocation: 0, categorieFamiliale: "A",
      ageAuMoins21: true, soldeJ: 0, moisDecembre: false, cumulTempsPartiel: true,
      joursCC: 0, incapaciteOuSanctionTotalite: false, bareme: "010426",
      occupations: [occ],
    });

    expect(res.bareme57).toBe(689.77);
    expect(res.bareme05).toBe(850.71);
    expect(res.intermediaires.formule1A).toBe(689.77);
    expect(res.intermediaires.formule1B).toBe(1316.09);
  }, 30000);
});
