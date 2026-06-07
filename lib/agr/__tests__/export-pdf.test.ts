import { describe, it, expect } from "vitest";
import { buildAgrPdf } from "../export-pdf";
import { calculerAgr } from "../calcul";
import type { AgrGlobalInput, OccupationInput } from "../types";

function occ(p: Partial<OccupationInput>): OccupationInput {
  return {
    qinfo: 2, q: 0, s: 0, categorieTravailleur: "1O", ybrut: 0,
    salaireTheoriqueHeure: 0, salaireTheoriqueMois: 0, heures: 0, heuresV: 0,
    heuresA: 0, requalifier: false, soldeS32: 0, soldeQ4: 0, pw1: 0, pw2: 0,
    pr: 0, fermetureTotal: 0, joursNI: 0, ...p,
  };
}

describe("export-pdf — buildAgrPdf", () => {
  it("génère un PDF valide contenant les infos, le résultat et le pied Docbel", async () => {
    const global: Omit<AgrGlobalInput, "occupations"> = {
      allocationJournaliere: 65.58, demiAllocation: 0, categorieFamiliale: "A",
      ageAuMoins21: true, soldeJ: 0, moisDecembre: false, cumulTempsPartiel: true,
      joursCC: 0, incapaciteOuSanctionTotalite: false, bareme: "010426",
    };
    const occupations = [
      occ({ q: 19, s: 38, categorieTravailleur: "2P", ybrut: 1221.38, salaireTheoriqueMois: 1221.38, heures: 79 }),
    ];
    const result = calculerAgr({ ...global, occupations });

    const doc = await buildAgrPdf({ global, occupations, metas: [{}], result });
    const bytes = new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);

    // En-tête PDF valide.
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });

    expect(text).toContain("DOCBEL");
    expect(text).toContain("Calcul AGR");
    expect(text).toContain("https://www.docbel.be"); // site (en-tête + pied)
    expect(text).toContain("Docbel ©"); // « fameux » pied de page
    expect(text).toContain("689,77"); // AGR barème 57 (cf. Excel)
    expect(text).toContain("850,71"); // AGR barème 05
  }, 30000);
});
