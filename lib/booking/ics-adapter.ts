// Pont entre une réservation et l'outil .ics existant (lib/rendez-vous/ics.ts),
// réutilisé tel quel — côté citoyen (1 RDV) comme côté équipe (liste).

import { generateICS, type Appointment } from "@/lib/rendez-vous/ics";
import { combineToUtc } from "./dates";

export interface IcsBooking {
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export function bookingToAppointment(
  b: IcsBooking,
  summary: string,
): Appointment {
  return {
    name: summary,
    start: combineToUtc(b.date, b.startTime),
    end: combineToUtc(b.date, b.endTime),
  };
}

/** .ics d'une seule réservation (email de confirmation + téléchargement citoyen). */
export function icsForBooking(b: IcsBooking, summary: string): string {
  return generateICS([bookingToAppointment(b, summary)]);
}

/** .ics d'une liste de réservations (export agenda équipe). */
export function icsForBookings(
  items: { booking: IcsBooking; summary: string }[],
): string {
  return generateICS(items.map((i) => bookingToAppointment(i.booking, i.summary)));
}

export function icsFilename(date: string): string {
  return `RDV_${date.replace(/-/g, "_")}.ics`;
}
