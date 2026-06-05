// Construction du contexte d'email à partir d'une réservation + son tenant +
// son antenne (réutilisé par les crons).

import type { Booking, BookingLocation, BookingTenant } from "@prisma/client";
import { locationAddress } from "./route-bureau";
import type { BookingEmailCtx } from "./emails";

export function emailCtx(
  b: Booking,
  tenant: BookingTenant,
  location: BookingLocation,
): BookingEmailCtx {
  return {
    to: b.citizenEmail ?? "",
    citizenName: b.citizenName,
    tenantName: tenant.name,
    fromName: tenant.emailFromName ?? tenant.name,
    brandColor: tenant.brandColor,
    locationName: location.name,
    locationAddress: locationAddress(location),
    date: b.date,
    startTime: b.startTime,
    token: b.confirmationToken,
  };
}

/** Garde d'authentification des crons (CRON_SECRET via Bearer ou x-cron-secret). */
export function cronAuthError(req: Request): { status: number; message: string } | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { status: 500, message: "CRON_SECRET non configuré" };
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const custom = req.headers.get("x-cron-secret");
  if (bearer !== secret && custom !== secret) return { status: 403, message: "Forbidden" };
  return null;
}
