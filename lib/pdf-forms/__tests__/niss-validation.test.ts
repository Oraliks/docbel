import { describe, expect, it } from "vitest";
import { diagnoseNISS, isValidNISS, nissBlocking } from "../validators";
import { validateFieldFormat, validateFieldWarning } from "../validation";

/// Construit un NISS de checksum VALIDE à partir des 9 premiers chiffres
/// (date YYMMDD + rang) — checksum pré-2000 = 97 - base%97.
function withValidChecksum(base9: string): string {
  const check = 97 - (parseInt(base9, 10) % 97);
  return base9 + String(check).padStart(2, "0");
}

const nissField = { type: "niss" as const };

describe("diagnoseNISS — cohérence date + checksum (#4)", () => {
  it("NISS complet valide → ok", () => {
    expect(diagnoseNISS(withValidChecksum("900101123")).ok).toBe(true);
  });

  it("date de naissance NON déclarée (mois 00 / jour 00) → valide, PAS bloquant", () => {
    const niss = withValidChecksum("900000123");
    expect(diagnoseNISS(niss).ok).toBe(true);
    expect(nissBlocking(niss)).toBe(false);
  });

  it("numéro bis (mois +20, ex. 25 = mai) → accepté", () => {
    expect(diagnoseNISS(withValidChecksum("902501123")).reason).not.toBe("date");
  });

  it("date IMPOSSIBLE (mois 15) → reason 'date' → BLOQUANT (confusion année/mois/jour)", () => {
    const niss = "90150112300";
    expect(diagnoseNISS(niss).reason).toBe("date");
    expect(nissBlocking(niss)).toBe(true);
  });

  it("jour impossible (40) → reason 'date' → bloquant", () => {
    expect(diagnoseNISS("90014012300").reason).toBe("date");
    expect(nissBlocking("90014012300")).toBe(true);
  });

  it("checksum faux mais date cohérente → reason 'checksum' → NON bloquant", () => {
    const niss = "90010112399"; // date ok (90/01/01), checksum volontairement faux
    expect(diagnoseNISS(niss).reason).toBe("checksum");
    expect(isValidNISS(niss)).toBe(false);
    expect(nissBlocking(niss)).toBe(false);
  });

  it("mauvaise longueur → bloquant", () => {
    expect(nissBlocking("123")).toBe(true);
  });

  it("vide → jamais bloquant", () => {
    expect(nissBlocking("")).toBe(false);
  });
});

describe("affichage NISS : erreur (rouge) vs avertissement (ambre) (#4)", () => {
  it("checksum faux → PAS d'erreur bloquante, mais un avertissement", () => {
    const niss = "90010112399";
    expect(validateFieldFormat(nissField, niss, "fr")).toBeNull();
    expect(validateFieldWarning(nissField, niss, "fr")).toBeTruthy();
  });

  it("date impossible → erreur bloquante, pas seulement un avertissement", () => {
    const niss = "90150112300";
    expect(validateFieldFormat(nissField, niss, "fr")).toBeTruthy();
    expect(validateFieldWarning(nissField, niss, "fr")).toBeNull();
  });

  it("NISS valide → ni erreur ni avertissement", () => {
    const niss = withValidChecksum("900101123");
    expect(validateFieldFormat(nissField, niss, "fr")).toBeNull();
    expect(validateFieldWarning(nissField, niss, "fr")).toBeNull();
  });
});
