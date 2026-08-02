import { describe, expect, it } from "vitest";
import { FAITS_PAR_DEFAUT, faitsPourDocument } from "../registry";
import { OP_CODES, isOpCode, PRUDENCE } from "../model";

describe("registry feuille de route", () => {
  it("le C1-Partenaire se signe à deux, en 3 exemplaires", () => {
    const faits = faitsPourDocument("c1-partenaire");
    expect(faits.exemplaires).toBe(3);
    expect(faits.signatures).toMatch(/partenaire/i);
  });

  it("un document inconnu reçoit les faits par défaut", () => {
    expect(faitsPourDocument("document-inconnu")).toEqual(FAITS_PAR_DEFAUT);
  });

  it("les 4 codes OP sont reconnus, le reste refusé", () => {
    for (const code of OP_CODES) expect(isOpCode(code)).toBe(true);
    expect(isOpCode("cgslb")).toBe(false); // le code du parc bureaux pour l'OP libéral est "synova"
    expect(isOpCode(null)).toBe(false);
  });

  it("la phrase de prudence cite l'ONEM et l'organisme de paiement", () => {
    expect(PRUDENCE).toMatch(/ONEM/);
    expect(PRUDENCE).toMatch(/organisme de paiement/);
  });
});
