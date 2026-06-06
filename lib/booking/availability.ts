// Calcul de disponibilité — module PUR (aucune dépendance Prisma), testable.
// Résout : règles hebdo ∪ exceptions − réservations actives → créneaux libres.

import type { AvailableSlot, DayAvailability, SlotDef } from "./types";
import { addDaysYmd, isSlotPast, weekdayOf } from "./dates";
import { getBelgianHolidayName } from "@/lib/bureaus/holidays";

/** Vrai si la date (heure murale) est un jour férié belge légal. */
function isBelgianHolidayYmd(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  return getBelgianHolidayName(new Date(y, m - 1, d)) !== null;
}

export interface RuleLite {
  weekday: number;
  startTime: string;
  endTime: string;
  capacity: number;
  serviceCode: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  active: boolean;
}

export interface ExceptionLite {
  date: string;
  kind: "closed" | "extra";
  slots: SlotDef[];
}

function dayInRange(ymd: string, from: Date | null, until: Date | null): boolean {
  if (from && ymd < from.toISOString().slice(0, 10)) return false;
  if (until && ymd > until.toISOString().slice(0, 10)) return false;
  return true;
}

/** Créneaux d'un jour donné, avec capacité restante. */
export function computeDay(
  ymd: string,
  rules: RuleLite[],
  exception: ExceptionLite | null,
  booked: Record<string, number>,
): DayAvailability {
  const weekday = weekdayOf(ymd);
  if (exception?.kind === "closed") return { date: ymd, weekday, slots: [] };

  // Jours fériés belges : les créneaux récurrents sont supprimés. Un admin peut
  // tout de même ouvrir via une exception 'extra' (override explicite).
  let defs: SlotDef[] = isBelgianHolidayYmd(ymd)
    ? []
    : rules
        .filter(
          (r) =>
            r.active &&
            r.weekday === weekday &&
            dayInRange(ymd, r.validFrom, r.validUntil),
        )
        .map((r) => ({
          startTime: r.startTime,
          endTime: r.endTime,
          capacity: r.capacity,
          serviceCode: r.serviceCode,
        }));

  if (exception?.kind === "extra") defs = defs.concat(exception.slots);

  // Fusionne les définitions de même heure de début (capacités additionnées).
  const byStart = new Map<string, SlotDef>();
  for (const d of defs) {
    const existing = byStart.get(d.startTime);
    if (existing) existing.capacity += d.capacity;
    else byStart.set(d.startTime, { ...d });
  }

  const slots: AvailableSlot[] = [...byStart.values()]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((d) => ({
      ...d,
      remaining: Math.max(0, d.capacity - (booked[d.startTime] ?? 0)),
    }));

  return { date: ymd, weekday, slots };
}

export interface RangeParams {
  from: string; // "YYYY-MM-DD"
  days: number;
  rules: RuleLite[];
  exceptions: Record<string, ExceptionLite>; // par date
  booked: Record<string, Record<string, number>>; // date → startTime → nb
  /** Exclut les créneaux passés (heure murale Bruxelles). */
  nowParts?: { ymd: string; hm: string };
  /** Ne garde que les créneaux avec des places (vue citoyen). */
  onlyAvailable?: boolean;
}

export function computeRange(params: RangeParams): DayAvailability[] {
  const out: DayAvailability[] = [];
  for (let i = 0; i < params.days; i++) {
    const ymd = addDaysYmd(params.from, i);
    let slots = computeDay(
      ymd,
      params.rules,
      params.exceptions[ymd] ?? null,
      params.booked[ymd] ?? {},
    ).slots;
    if (params.nowParts) {
      const now = params.nowParts;
      slots = slots.filter((s) => !isSlotPast(ymd, s.startTime, now));
    }
    if (params.onlyAvailable) slots = slots.filter((s) => s.remaining > 0);
    out.push({ date: ymd, weekday: weekdayOf(ymd), slots });
  }
  return out;
}
