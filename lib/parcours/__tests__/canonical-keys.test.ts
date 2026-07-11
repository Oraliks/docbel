import { describe, it, expect } from "vitest";
import {
  CANONICAL_KEYS,
  getCanonicalKey,
  canonicalValues,
  isValidCanonicalPair,
} from "@/lib/parcours/canonical-keys";

describe("canonical-keys registry", () => {
  it("has unique keys", () => {
    const keys = CANONICAL_KEYS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has unique values within each key", () => {
    for (const def of CANONICAL_KEYS) {
      const vals = def.values.map((v) => v.value);
      expect(new Set(vals).size, `clé ${def.key}`).toBe(vals.length);
    }
  });

  it("seeds the starter keys", () => {
    expect(getCanonicalKey("age_bracket")).toBeDefined();
    expect(getCanonicalKey("situation_familiale")).toBeDefined();
    expect(getCanonicalKey("a_deja_travaille")).toBeDefined();
    expect(getCanonicalKey("inconnue")).toBeUndefined();
  });

  it("canonicalValues returns the key's values or [] for unknown", () => {
    expect(canonicalValues("age_bracket").map((v) => v.value)).toEqual([
      "under_25",
      "25_plus",
    ]);
    expect(canonicalValues("inconnue")).toEqual([]);
  });

  it("isValidCanonicalPair validates key+value", () => {
    expect(isValidCanonicalPair("age_bracket", "under_25")).toBe(true);
    expect(isValidCanonicalPair("age_bracket", "bogus")).toBe(false);
    expect(isValidCanonicalPair("inconnue", "x")).toBe(false);
  });
});
