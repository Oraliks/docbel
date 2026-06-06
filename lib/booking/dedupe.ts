// Anti-doublon : empêche un citoyen de reprendre un rendez-vous chez le même
// tenant avant la fin de la fenêtre (ex : 1 RDV / 30 jours). La clé de
// comparaison est configurable (email / nom / NRN).

import { createHmac } from "node:crypto";
import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CitizenIdentity } from "./types";

export type DedupeField = "email" | "name" | "nrn" | "none";

// HMAC déterministe → le NRN n'est jamais stocké en clair mais reste indexable
// pour le dedupe. Le secret dérive de la config Better Auth existante.
const NRN_SECRET =
  process.env.BOOKING_NRN_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  "docbel-booking-nrn-fallback";

export function hashNrn(nrnDigits: string): string {
  return createHmac("sha256", NRN_SECRET).update(nrnDigits).digest("hex");
}

export function nrnLast4(nrnDigits: string): string {
  return nrnDigits.slice(-4);
}

// Statuts qui "consomment" le quota anti-doublon (un refus/annulation libère).
const COUNTED: BookingStatus[] = [
  BookingStatus.pending_approval,
  BookingStatus.confirmed,
  BookingStatus.completed,
  BookingStatus.no_show,
];

export interface RecentBooking {
  id: string;
  date: string;
  startTime: string;
  locationId: string;
  userId: string | null;
  confirmationToken: string;
}

/** Renvoie la réservation récente bloquante, ou null si la voie est libre. */
export async function findRecentBooking(opts: {
  tenantId: string;
  field: DedupeField;
  windowDays: number;
  identity: CitizenIdentity;
}): Promise<RecentBooking | null> {
  const { tenantId, field, windowDays, identity } = opts;
  if (field === "none") return null;

  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const where: Prisma.BookingWhereInput = {
    tenantId,
    status: { in: COUNTED },
    createdAt: { gte: cutoff },
  };

  if (field === "email") {
    if (!identity.email) return null;
    where.citizenEmail = identity.email;
  } else if (field === "name") {
    if (!identity.nameNormalized) return null;
    where.citizenNameNormalized = identity.nameNormalized;
  } else if (field === "nrn") {
    if (!identity.nrn) return null;
    where.citizenNrnHash = hashNrn(identity.nrn);
  }

  return prisma.booking.findFirst({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      date: true,
      startTime: true,
      locationId: true,
      userId: true,
      confirmationToken: true,
    },
  });
}
