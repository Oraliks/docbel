import { describe, expect, it } from "vitest";

import { decryptNrn, encryptNrn, formatNrn } from "@/lib/booking/crypto-nrn";

const NRN = "85051512383";

describe("crypto-nrn", () => {
  it("chiffre puis déchiffre (round-trip)", () => {
    const enc = encryptNrn(NRN);
    expect(enc).not.toBe(NRN);
    expect(decryptNrn(enc)).toBe(NRN);
  });

  it("produit un chiffré différent à chaque fois (IV aléatoire)", () => {
    expect(encryptNrn(NRN)).not.toBe(encryptNrn(NRN));
  });

  it("renvoie null sur entrée invalide/vide", () => {
    expect(decryptNrn(null)).toBeNull();
    expect(decryptNrn("")).toBeNull();
    expect(decryptNrn("pas-du-base64-valide!!")).toBeNull();
  });

  it("formate un NRN belge", () => {
    expect(formatNrn(NRN)).toBe("85.05.15-123.83");
  });
});
