import { describe, it, expect } from "vitest";
import { hashResumeCode, safeEqualHash } from "../resume-code-hash";

describe("hashResumeCode", () => {
  it("est déterministe et normalise (casse, espaces, tirets)", () => {
    const a = hashResumeCode("BELDOC-AB23-CD45");
    const b = hashResumeCode("beldoc ab23 cd45");
    const c = hashResumeCode("BELDOCAB23CD45");
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produit des hash différents pour des codes différents", () => {
    expect(hashResumeCode("BELDOC-AB23-CD45")).not.toBe(
      hashResumeCode("BELDOC-AB23-CD46"),
    );
  });

  it("ne contient jamais le code en clair", () => {
    const code = "BELDOC-AB23-CD45";
    expect(hashResumeCode(code)).not.toContain("AB23");
  });

  it("safeEqualHash compare à temps constant", () => {
    const h = hashResumeCode("BELDOC-AB23-CD45");
    expect(safeEqualHash(h, h)).toBe(true);
    expect(safeEqualHash(h, "court")).toBe(false);
    expect(safeEqualHash(h, hashResumeCode("BELDOC-ZZ99-ZZ99"))).toBe(false);
  });
});
