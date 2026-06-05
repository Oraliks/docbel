import { describe, expect, it } from "vitest";

import {
  addDaysYmd,
  combineToUtc,
  frenchDateShort,
  isHm,
  isSlotPast,
  isYmd,
  weekdayOf,
} from "@/lib/booking/dates";

describe("dates", () => {
  it("valide les formats", () => {
    expect(isYmd("2026-06-08")).toBe(true);
    expect(isYmd("2026/06/08")).toBe(false);
    expect(isHm("09:30")).toBe(true);
    expect(isHm("9:30")).toBe(false);
    expect(isHm("24:00")).toBe(false);
  });

  it("ajoute des jours en passant les bornes de mois/année", () => {
    expect(addDaysYmd("2026-06-08", 1)).toBe("2026-06-09");
    expect(addDaysYmd("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDaysYmd("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysYmd("2026-06-08", 0)).toBe("2026-06-08");
  });

  it("formate en court FR", () => {
    expect(frenchDateShort("2026-06-08")).toBe("08/06/2026");
  });

  it("combine date + heure en heure murale (champs UTC)", () => {
    const d = combineToUtc("2026-06-08", "09:30");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(5);
    expect(d.getUTCDate()).toBe(8);
    expect(d.getUTCHours()).toBe(9);
    expect(d.getUTCMinutes()).toBe(30);
  });

  it("détecte les créneaux passés (heure murale)", () => {
    const now = { ymd: "2026-06-08", hm: "09:30" };
    expect(isSlotPast("2026-06-08", "09:00", now)).toBe(true);
    expect(isSlotPast("2026-06-08", "09:30", now)).toBe(true); // l'instant courant est passé
    expect(isSlotPast("2026-06-08", "10:00", now)).toBe(false);
    expect(isSlotPast("2026-06-07", "23:00", now)).toBe(true);
    expect(isSlotPast("2026-06-09", "08:00", now)).toBe(false);
  });

  it("weekdayOf est déterministe (dimanche = 0)", () => {
    // 2026-06-07 est un dimanche.
    expect(weekdayOf("2026-06-07")).toBe(0);
    expect(weekdayOf("2026-06-08")).toBe(1);
  });
});
