import { describe, it, expect } from "vitest";
import { isStaleWrite, STALE_WRITE_CODE } from "../concurrency";

const NOW = new Date("2026-06-21T10:00:00.000Z");
const NOW_MS = NOW.getTime();

describe("isStaleWrite", () => {
  it("renvoie false quand la précondition est absente (undefined) — rétrocompat", () => {
    expect(isStaleWrite(undefined, NOW_MS)).toBe(false);
  });

  it("renvoie false quand la précondition est null — rétrocompat", () => {
    expect(isStaleWrite(null, NOW_MS)).toBe(false);
  });

  it("renvoie false quand la précondition est une chaîne vide — rétrocompat", () => {
    expect(isStaleWrite("", NOW_MS)).toBe(false);
  });

  it("renvoie false quand le timestamp attendu == le timestamp courant", () => {
    expect(isStaleWrite(NOW.toISOString(), NOW_MS)).toBe(false);
  });

  it("compare par timestamp et non par string brute (formats différents, même instant)", () => {
    // ISO avec offset +00:00 décrit le même instant que le Z.
    expect(isStaleWrite("2026-06-21T10:00:00+00:00", NOW_MS)).toBe(false);
  });

  it("renvoie true quand le timestamp attendu diffère du courant — conflit", () => {
    const older = new Date(NOW_MS - 1000).toISOString();
    expect(isStaleWrite(older, NOW_MS)).toBe(true);
  });

  it("renvoie true quand la date attendue est invalide (fail-safe)", () => {
    expect(isStaleWrite("pas-une-date", NOW_MS)).toBe(true);
  });

  it("expose un code machine stable pour le corps 409", () => {
    expect(STALE_WRITE_CODE).toBe("stale_write");
  });
});
