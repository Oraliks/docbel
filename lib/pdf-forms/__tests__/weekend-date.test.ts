import { describe, expect, it } from "vitest";
import { isWeekendISO, validateFieldFormat, buildValidator } from "../validation";

describe("règle week-end sur les dates d'effet (#7b)", () => {
  it("isWeekendISO : samedi + dimanche → true, semaine → false", () => {
    expect(isWeekendISO("2026-07-11")).toBe(true); // samedi
    expect(isWeekendISO("2026-07-12")).toBe(true); // dimanche
    expect(isWeekendISO("2026-07-13")).toBe(false); // lundi
    expect(isWeekendISO("2026-07-10")).toBe(false); // vendredi
    expect(isWeekendISO("pas-une-date")).toBe(false);
  });

  it("validateFieldFormat : date week-end refusée SEULEMENT si noWeekend", () => {
    const plain = { type: "date" as const };
    const noWk = { type: "date" as const, noWeekend: true };
    expect(validateFieldFormat(plain, "2026-07-11", "fr")).toBeNull(); // samedi mais pas noWeekend
    expect(validateFieldFormat(noWk, "2026-07-11", "fr")).toBeTruthy(); // samedi + noWeekend → erreur
    expect(validateFieldFormat(noWk, "2026-07-13", "fr")).toBeNull(); // lundi ok
  });

  it("buildValidator : bloque une date d'effet en week-end", () => {
    const v = buildValidator(
      [{ id: "d", type: "date", required: false, pdfFieldName: "", label: { fr: "x" }, noWeekend: true } as never],
      "fr",
    );
    expect(v.safeParse({ d: "2026-07-11" }).success).toBe(false); // samedi
    expect(v.safeParse({ d: "2026-07-13" }).success).toBe(true); // lundi
    expect(v.safeParse({ d: "" }).success).toBe(true); // vide non bloquant
  });
});
