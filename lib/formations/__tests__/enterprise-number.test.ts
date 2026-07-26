import { describe, it, expect } from "vitest";
import {
  normalizeEnterpriseNumber,
  isValidEnterpriseChecksum,
  parseEnterpriseNumber,
  formatEnterpriseNumber,
} from "@/lib/formations/enterprise-number";

// Numéro valide construit selon la règle mod-97 :
// base 01234567 → 1234567 % 97 = 48 → check = 97 - 48 = 49 → 0123456749
const VALID = "0123456749";

describe("normalizeEnterpriseNumber", () => {
  it("accepte les séparateurs et le préfixe BE", () => {
    expect(normalizeEnterpriseNumber("0123.456.749")).toBe(VALID);
    expect(normalizeEnterpriseNumber("BE0123456749")).toBe(VALID);
    expect(normalizeEnterpriseNumber("BE 0123.456.749")).toBe(VALID);
    expect(normalizeEnterpriseNumber(" 0123 456 749 ")).toBe(VALID);
  });
  it("complète l'ancien format à 9 chiffres", () => {
    expect(normalizeEnterpriseNumber("123456749")).toBe(VALID);
  });
  it("rejette vide / longueur invalide", () => {
    expect(normalizeEnterpriseNumber("")).toBeNull();
    expect(normalizeEnterpriseNumber(null)).toBeNull();
    expect(normalizeEnterpriseNumber("12345")).toBeNull();
    expect(normalizeEnterpriseNumber("01234567491")).toBeNull();
  });
});

describe("isValidEnterpriseChecksum", () => {
  it("valide un numéro correct", () => {
    expect(isValidEnterpriseChecksum(VALID)).toBe(true);
  });
  it("rejette un checksum faux", () => {
    expect(isValidEnterpriseChecksum("0123456789")).toBe(false);
  });
  it("rejette un format non numérique", () => {
    expect(isValidEnterpriseChecksum("01234567AB")).toBe(false);
  });
});

describe("parseEnterpriseNumber", () => {
  it("renvoie les formes canoniques pour un numéro valide", () => {
    const r = parseEnterpriseNumber("0123.456.749");
    expect(r.ok).toBe(true);
    expect(r.normalized).toBe(VALID);
    expect(r.formatted).toBe("0123.456.749");
    expect(r.vat).toBe("BE0123456749");
  });
  it("signale un checksum invalide sans perdre la normalisation", () => {
    const r = parseEnterpriseNumber("0123456789");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("checksum");
    expect(r.normalized).toBe("0123456789");
  });
  it("distingue vide et longueur", () => {
    expect(parseEnterpriseNumber("").reason).toBe("empty");
    expect(parseEnterpriseNumber("12345").reason).toBe("length");
  });
});

describe("formatEnterpriseNumber", () => {
  it("formate en 4.3.3", () => {
    expect(formatEnterpriseNumber(VALID)).toBe("0123.456.749");
  });
  it("laisse passer une entrée non conforme", () => {
    expect(formatEnterpriseNumber("abc")).toBe("abc");
  });
});
