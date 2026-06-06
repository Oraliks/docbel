import { describe, expect, it } from "vitest";

import {
  computeDay,
  computeRange,
  type ExceptionLite,
  type RuleLite,
} from "@/lib/booking/availability";
import { weekdayOf } from "@/lib/booking/dates";

const DATE = "2026-06-08"; // lundi
const WD = weekdayOf(DATE);

function rule(partial: Partial<RuleLite> = {}): RuleLite {
  return {
    weekday: WD,
    startTime: "09:00",
    endTime: "10:00",
    capacity: 4,
    serviceCode: null,
    validFrom: null,
    validUntil: null,
    active: true,
    ...partial,
  };
}

describe("computeDay", () => {
  it("expose la capacité restante (rien de réservé)", () => {
    const day = computeDay(DATE, [rule()], null, {});
    expect(day.slots).toHaveLength(1);
    expect(day.slots[0].remaining).toBe(4);
    expect(day.slots[0].endTime).toBe("10:00");
  });

  it("soustrait les réservations existantes", () => {
    const day = computeDay(DATE, [rule({ capacity: 4 })], null, { "09:00": 3 });
    expect(day.slots[0].remaining).toBe(1);
  });

  it("ne descend jamais sous zéro", () => {
    const day = computeDay(DATE, [rule({ capacity: 2 })], null, { "09:00": 5 });
    expect(day.slots[0].remaining).toBe(0);
  });

  it("ignore les règles d'un autre jour", () => {
    const day = computeDay(DATE, [rule({ weekday: (WD + 1) % 7 })], null, {});
    expect(day.slots).toHaveLength(0);
  });

  it("exception 'closed' ferme la journée", () => {
    const ex: ExceptionLite = { date: DATE, kind: "closed", slots: [] };
    const day = computeDay(DATE, [rule()], ex, {});
    expect(day.slots).toHaveLength(0);
  });

  it("exception 'extra' ajoute des créneaux ponctuels", () => {
    const ex: ExceptionLite = {
      date: DATE,
      kind: "extra",
      slots: [{ startTime: "14:00", endTime: "15:00", capacity: 2 }],
    };
    const day = computeDay(DATE, [rule()], ex, {});
    expect(day.slots.map((s) => s.startTime)).toEqual(["09:00", "14:00"]);
  });

  it("fusionne les capacités de règles de même heure", () => {
    const day = computeDay(DATE, [rule({ capacity: 4 }), rule({ capacity: 3 })], null, {});
    expect(day.slots[0].capacity).toBe(7);
  });

  it("respecte validFrom (règle pas encore active)", () => {
    const day = computeDay(DATE, [rule({ validFrom: new Date("2030-01-01") })], null, {});
    expect(day.slots).toHaveLength(0);
  });

  it("respecte validUntil (règle expirée)", () => {
    const day = computeDay(DATE, [rule({ validUntil: new Date("2020-01-01") })], null, {});
    expect(day.slots).toHaveLength(0);
  });

  it("ferme un jour férié belge (créneaux de règle supprimés)", () => {
    const holiday = "2026-07-21"; // Fête nationale
    const wd = weekdayOf(holiday);
    expect(
      computeDay(holiday, [rule({ weekday: wd })], null, {}).slots,
    ).toHaveLength(0);
  });

  it("autorise un override via exception 'extra' un jour férié", () => {
    const holiday = "2026-07-21";
    const wd = weekdayOf(holiday);
    const ex: ExceptionLite = {
      date: holiday,
      kind: "extra",
      slots: [{ startTime: "10:00", endTime: "11:00", capacity: 2 }],
    };
    const day = computeDay(holiday, [rule({ weekday: wd })], ex, {});
    expect(day.slots.map((s) => s.startTime)).toEqual(["10:00"]);
  });
});

describe("computeRange", () => {
  it("filtre les créneaux complets quand onlyAvailable", () => {
    const days = computeRange({
      from: DATE,
      days: 1,
      rules: [rule({ capacity: 1 })],
      exceptions: {},
      booked: { [DATE]: { "09:00": 1 } },
      onlyAvailable: true,
    });
    expect(days[0].slots).toHaveLength(0);
  });

  it("exclut les créneaux passés via nowParts", () => {
    const days = computeRange({
      from: DATE,
      days: 1,
      rules: [
        rule({ startTime: "08:00", endTime: "09:00" }),
        rule({ startTime: "11:00", endTime: "12:00" }),
      ],
      exceptions: {},
      booked: {},
      nowParts: { ymd: DATE, hm: "10:00" },
    });
    expect(days[0].slots.map((s) => s.startTime)).toEqual(["11:00"]);
  });

  it("couvre toute la fenêtre demandée", () => {
    const days = computeRange({
      from: DATE,
      days: 7,
      rules: [rule()],
      exceptions: {},
      booked: {},
    });
    expect(days).toHaveLength(7);
    // Un seul des 7 jours correspond au weekday de la règle.
    expect(days.filter((d) => d.slots.length > 0)).toHaveLength(1);
  });
});
