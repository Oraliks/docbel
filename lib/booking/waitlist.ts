// Liste d'attente : quand une place se libère sur un créneau, prévenir le
// prochain citoyen en attente. Toutes les fonctions sont « fail-soft » : elles
// n'échouent jamais la requête appelante (annulation, reprogrammation…).

import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { sendWaitlistOpening } from "./emails";
import { locationAddress } from "./route-bureau";

/**
 * Notifie le 1er citoyen en attente (status "waiting") sur ce créneau qu'une
 * place s'est libérée, et marque son entrée comme "notified".
 */
export async function notifyNextWaiter(
  locationId: string,
  date: string,
  startTime: string,
): Promise<boolean> {
  try {
    const next = await prisma.bookingWaitlist.findFirst({
      where: {
        locationId,
        date,
        startTime,
        status: "waiting",
        citizenEmail: { not: null },
      },
      orderBy: { createdAt: "asc" },
    });
    if (!next?.citizenEmail) return false;

    const [tenant, location] = await Promise.all([
      prisma.bookingTenant.findUnique({ where: { id: next.tenantId } }),
      prisma.bookingLocation.findUnique({ where: { id: locationId } }),
    ]);
    if (!tenant || !location) return false;

    const notifyToken = randomBytes(24).toString("base64url");
    await prisma.bookingWaitlist.update({
      where: { id: next.id },
      data: { status: "notified", notifiedAt: new Date(), notifyToken },
    });

    await sendWaitlistOpening({
      to: next.citizenEmail,
      citizenName: next.citizenName,
      tenantName: tenant.name,
      fromName: tenant.emailFromName ?? tenant.name,
      brandColor: tenant.brandColor,
      locationName: location.name,
      locationAddress: locationAddress(location),
      slug: tenant.slug,
      date,
      startTime,
    });
    return true;
  } catch (e) {
    console.error("[booking] notifyNextWaiter échec:", e);
    return false;
  }
}
