// Chargement des données de disponibilité depuis Prisma puis délégation au
// module pur availability.ts. Séparé pour garder availability.ts testable sans
// base de données.

import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeDay,
  computeRange,
  type ExceptionLite,
  type RuleLite,
} from "./availability";
import { addDaysYmd, brusselsNowParts } from "./dates";
import type { DayAvailability, SlotDef } from "./types";

// Une réservation "occupe" une place dès la demande (pending) pour éviter le
// surbooking pendant la validation, et tant qu'elle est confirmée.
const OCCUPYING: BookingStatus[] = [
  BookingStatus.pending_approval,
  BookingStatus.confirmed,
];

function parseExceptionSlots(json: unknown): SlotDef[] {
  if (!Array.isArray(json)) return [];
  const out: SlotDef[] = [];
  for (const s of json) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const startTime = typeof o.startTime === "string" ? o.startTime : "";
    const endTime = typeof o.endTime === "string" ? o.endTime : "";
    const capacity = typeof o.capacity === "number" ? o.capacity : 1;
    if (/^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime)) {
      out.push({ startTime, endTime, capacity: Math.max(1, capacity) });
    }
  }
  return out;
}

function toRuleLite(r: {
  weekday: number;
  startTime: string;
  endTime: string;
  capacity: number;
  serviceCode: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  active: boolean;
}): RuleLite {
  return {
    weekday: r.weekday,
    startTime: r.startTime,
    endTime: r.endTime,
    capacity: r.capacity,
    serviceCode: r.serviceCode,
    validFrom: r.validFrom,
    validUntil: r.validUntil,
    active: r.active,
  };
}

/** Disponibilité d'une antenne sur une fenêtre de jours. */
export async function loadDayRange(opts: {
  locationId: string;
  from: string;
  days: number;
  onlyAvailable?: boolean;
  now?: Date;
}): Promise<DayAvailability[]> {
  const { locationId, from, days, onlyAvailable } = opts;
  const to = addDaysYmd(from, days - 1);

  const [rules, exceptions, bookings] = await Promise.all([
    prisma.bookingSlotRule.findMany({ where: { locationId, active: true } }),
    prisma.bookingException.findMany({
      where: { locationId, date: { gte: from, lte: to } },
    }),
    prisma.booking.findMany({
      where: { locationId, date: { gte: from, lte: to }, status: { in: OCCUPYING } },
      select: { date: true, startTime: true },
    }),
  ]);

  const exMap: Record<string, ExceptionLite> = {};
  for (const e of exceptions) {
    exMap[e.date] = {
      date: e.date,
      kind: e.kind as "closed" | "extra",
      slots: parseExceptionSlots(e.slots),
    };
  }

  const booked: Record<string, Record<string, number>> = {};
  for (const b of bookings) {
    (booked[b.date] ??= {})[b.startTime] =
      (booked[b.date]?.[b.startTime] ?? 0) + 1;
  }

  return computeRange({
    from,
    days,
    rules: rules.map(toRuleLite),
    exceptions: exMap,
    booked,
    nowParts: brusselsNowParts(opts.now),
    onlyAvailable,
  });
}

/** Retrouve un créneau précis (capacité + fin), ou null s'il n'existe pas ce jour. */
export async function findSlot(
  locationId: string,
  date: string,
  startTime: string,
): Promise<SlotDef | null> {
  const [rules, exception] = await Promise.all([
    prisma.bookingSlotRule.findMany({ where: { locationId, active: true } }),
    prisma.bookingException.findFirst({ where: { locationId, date } }),
  ]);
  const exLite: ExceptionLite | null = exception
    ? {
        date,
        kind: exception.kind as "closed" | "extra",
        slots: parseExceptionSlots(exception.slots),
      }
    : null;
  const day = computeDay(date, rules.map(toRuleLite), exLite, {});
  const slot = day.slots.find((s) => s.startTime === startTime);
  return slot
    ? {
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        serviceCode: slot.serviceCode ?? null,
      }
    : null;
}

/** Nombre de réservations occupant déjà ce créneau. */
export function countActiveOnSlot(
  locationId: string,
  date: string,
  startTime: string,
) {
  return prisma.booking.count({
    where: { locationId, date, startTime, status: { in: OCCUPYING } },
  });
}
