import { describe, expect, it } from "vitest";
import {
  belgianDay,
  computeDelta,
  computeRate,
  parsePeriod,
  periodBounds,
  stepConversions,
  zeroFillDays,
} from "../dashboard-stats-helpers";

describe("parsePeriod", () => {
  it("accepte 7d et 90d", () => {
    expect(parsePeriod("7d")).toBe("7d");
    expect(parsePeriod("90d")).toBe("90d");
  });
  it("retombe sur 30d pour tout le reste", () => {
    expect(parsePeriod("30d")).toBe("30d");
    expect(parsePeriod(undefined)).toBe("30d");
    expect(parsePeriod("x")).toBe("30d");
    expect(parsePeriod(null)).toBe("30d");
  });
});

describe("periodBounds", () => {
  it("calcule start / prevStart / days", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const b = periodBounds("7d", now);
    expect(b.days).toBe(7);
    expect(b.end).toEqual(now);
    expect(b.start).toEqual(new Date("2026-07-03T12:00:00Z"));
    expect(b.prevStart).toEqual(new Date("2026-06-26T12:00:00Z"));
  });
});

describe("computeDelta", () => {
  it("delta % arrondi", () => {
    expect(computeDelta(110, 100)).toBe(10);
    expect(computeDelta(90, 100)).toBe(-10);
    expect(computeDelta(1, 3)).toBe(-67);
  });
  it("null si précédent nul et courant non nul (non significatif)", () => {
    expect(computeDelta(5, 0)).toBeNull();
  });
  it("0 si tout est nul", () => {
    expect(computeDelta(0, 0)).toBe(0);
  });
});

describe("computeRate", () => {
  it("taux % arrondi", () => {
    expect(computeRate(187, 342)).toBe(55);
  });
  it("0 si dénominateur nul", () => {
    expect(computeRate(5, 0)).toBe(0);
  });
});

describe("belgianDay", () => {
  it("format YYYY-MM-DD en Europe/Brussels", () => {
    // 23:30 UTC le 9 = 01:30 le 10 à Bruxelles (été, UTC+2)
    expect(belgianDay(new Date("2026-07-09T23:30:00Z"))).toBe("2026-07-10");
    expect(belgianDay(new Date("2026-07-09T12:00:00Z"))).toBe("2026-07-09");
  });
});

describe("zeroFillDays", () => {
  it("complète les jours vides jusqu'à aujourd'hui inclus", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const out = zeroFillDays([{ day: "2026-07-09", count: 3 }], 3, now);
    expect(out).toEqual([
      { day: "2026-07-08", count: 0 },
      { day: "2026-07-09", count: 3 },
      { day: "2026-07-10", count: 0 },
    ]);
  });
});

describe("stepConversions", () => {
  it("conversion % entre étapes consécutives", () => {
    expect(stepConversions([1240, 610, 342, 187])).toEqual([49, 56, 55]);
  });
  it("null quand l'étape précédente est vide", () => {
    expect(stepConversions([0, 5])).toEqual([null]);
  });
});
