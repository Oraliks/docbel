import { describe, it, expect } from "vitest";
import { precompteMensuel } from "../precompte";
import { getBareme } from "../baremes";

const P = getBareme("010426").precompte;

describe("precompteMensuel", () => {
  it("retourne 0 pour un revenu nul ou faible (sous le seuil imposable)", () => {
    expect(precompteMensuel(0, true, P)).toBe(0);
    expect(precompteMensuel(1320.46, true, P)).toBe(0); // chef de ménage, AGR temps partiel
  });

  it("calcule le précompte d'un chef de ménage (cat. A) sur 2641 €/mois", () => {
    // annuel 31692 → frais 6070 → net 25622 → part conjoint 7686,60
    // impôt total 7050,57 − 2×2987,98 = 1074,61 → /12 = 89,55
    expect(precompteMensuel(2641, true, P)).toBe(89.55);
  });

  it("calcule le précompte d'un isolé/cohabitant (cat. N/B) sur 2641 €/mois", () => {
    // net 25622 → impôt 8284,27 − 2987,98 = 5296,29 → /12 = 441,36
    expect(precompteMensuel(2641, false, P)).toBe(441.36);
  });
});
