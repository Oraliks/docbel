import { describe, it, expect } from "vitest";
import { isBelgianHoliday, getBelgianHolidayName } from "../holidays";

describe("isBelgianHoliday", () => {
  it("reconnaît les jours fériés fixes", () => {
    expect(isBelgianHoliday(new Date(2026, 0, 1))).toBe(true); // Jour de l'an
    expect(isBelgianHoliday(new Date(2026, 4, 1))).toBe(true); // 1er mai
    expect(isBelgianHoliday(new Date(2026, 6, 21))).toBe(true); // Fête nationale
    expect(isBelgianHoliday(new Date(2026, 7, 15))).toBe(true); // Assomption
    expect(isBelgianHoliday(new Date(2026, 10, 1))).toBe(true); // Toussaint
    expect(isBelgianHoliday(new Date(2026, 10, 11))).toBe(true); // Armistice
    expect(isBelgianHoliday(new Date(2026, 11, 25))).toBe(true); // Noël
  });

  it("reconnaît les jours mobiles (Pâques 2026 = 5 avril)", () => {
    // Pâques 2026 = 5 avril → Lundi de Pâques = 6 avril
    expect(isBelgianHoliday(new Date(2026, 3, 6))).toBe(true);
    // Ascension 2026 = 14 mai (jeudi, 39 jours après Pâques)
    expect(isBelgianHoliday(new Date(2026, 4, 14))).toBe(true);
    // Lundi de Pentecôte 2026 = 25 mai (50 jours après Pâques)
    expect(isBelgianHoliday(new Date(2026, 4, 25))).toBe(true);
  });

  it("reconnaît les jours mobiles (Pâques 2025 = 20 avril)", () => {
    expect(isBelgianHoliday(new Date(2025, 3, 21))).toBe(true); // Lundi de Pâques
    expect(isBelgianHoliday(new Date(2025, 4, 29))).toBe(true); // Ascension
    expect(isBelgianHoliday(new Date(2025, 5, 9))).toBe(true); // Lundi de Pentecôte
  });

  it("ne reconnaît pas les jours ouvrables", () => {
    expect(isBelgianHoliday(new Date(2026, 5, 15))).toBe(false); // 15 juin = lundi normal
    expect(isBelgianHoliday(new Date(2026, 8, 1))).toBe(false); // 1er septembre
    expect(isBelgianHoliday(new Date(2026, 11, 24))).toBe(false); // 24 décembre
  });

  it("différencie les années", () => {
    // Pâques 2024 = 31 mars → Lundi de Pâques = 1er avril
    expect(isBelgianHoliday(new Date(2024, 3, 1))).toBe(true);
    // 1er avril 2025 ≠ Lundi de Pâques (qui est le 21 avril)
    expect(isBelgianHoliday(new Date(2025, 3, 1))).toBe(false);
  });
});

describe("getBelgianHolidayName", () => {
  it("renvoie le nom correct des fériés fixes", () => {
    expect(getBelgianHolidayName(new Date(2026, 0, 1))).toBe("Jour de l'an");
    expect(getBelgianHolidayName(new Date(2026, 6, 21))).toBe("Fête nationale");
    expect(getBelgianHolidayName(new Date(2026, 11, 25))).toBe("Noël");
  });

  it("renvoie le nom correct des fériés mobiles", () => {
    expect(getBelgianHolidayName(new Date(2026, 3, 6))).toBe("Lundi de Pâques");
    expect(getBelgianHolidayName(new Date(2026, 4, 14))).toBe("Ascension");
    expect(getBelgianHolidayName(new Date(2026, 4, 25))).toBe("Lundi de Pentecôte");
  });

  it("renvoie null hors fériés", () => {
    expect(getBelgianHolidayName(new Date(2026, 5, 15))).toBeNull();
  });
});
