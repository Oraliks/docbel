import { describe, expect, it } from "vitest";
import { applyMotifTransferOverride } from "../c1-motif-transfer";

describe("applyMotifTransferOverride", () => {
  it("no-op si transfereOrganismePaiement absent (formulaires sans ce champ, ex. c1-insertion)", () => {
    const values = { motifIntroduction: "modification" as const };
    expect(applyMotifTransferOverride(values)).toBe(values);
  });

  it("no-op si transfereOrganismePaiement = false", () => {
    const values = { motifIntroduction: "modification" as const, transfereOrganismePaiement: false };
    expect(applyMotifTransferOverride(values)).toBe(values);
  });

  it("bascule motifIntroduction sur changement-op si transfereOrganismePaiement = true", () => {
    const values = { motifIntroduction: "modification" as const, transfereOrganismePaiement: true };
    const result = applyMotifTransferOverride(values);
    expect(result.motifIntroduction).toBe("changement-op");
    expect(result).not.toBe(values); // nouvel objet, pas de mutation
    expect(values.motifIntroduction).toBe("modification"); // l'original reste intact
  });

  it("préserve les autres champs du payload lors de la bascule", () => {
    const values = {
      motifIntroduction: "modification" as const,
      transfereOrganismePaiement: true,
      modificationAdresse: true,
      niss: "12345678901",
    };
    const result = applyMotifTransferOverride(values);
    expect(result.modificationAdresse).toBe(true);
    expect(result.niss).toBe("12345678901");
  });
});
