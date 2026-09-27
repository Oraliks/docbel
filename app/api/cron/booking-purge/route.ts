import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { addDaysYmd, brusselsNowParts } from "@/lib/booking/dates";
import { cronAuthError } from "@/lib/booking/notify";
import { apiError, apiOk } from "@/lib/api/response";
import {
  parseWaitlistRetentionConfig,
  runWaitlistRetention,
} from "@/lib/booking/waitlist-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rétention RGPD : on minimise les données nominatives 6 mois après le RDV,
// puis on supprime complètement après 24 mois.
const RETAIN_PII_DAYS = 180;
const HARD_DELETE_DAYS = 730;

/** Purge RGPD des réservations passées. Quotidien (nuit). */
async function run(req: NextRequest) {
  const authErr = cronAuthError(req);
  if (authErr) {
    return apiError(authErr.status, authErr.message);
  }

  let waitlistConfig;
  try {
    waitlistConfig = parseWaitlistRetentionConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Configuration invalide";
    return apiError(500, `Rétention BookingWaitlist refusée : ${message}`, {
      code: "WAITLIST_RETENTION_CONFIG_INVALID",
    });
  }

  const today = brusselsNowParts().ymd;
  const piiCutoff = addDaysYmd(today, -RETAIN_PII_DAYS);
  const deleteCutoff = addDaysYmd(today, -HARD_DELETE_DAYS);

  // Le traitement Waitlist est indépendant de la politique Booking existante.
  // Il reste inactif sans opt-in et inventorie avant toute éventuelle écriture.
  const waitlistRetention = await runWaitlistRetention(
    prisma.bookingWaitlist,
    waitlistConfig,
    today,
  );

  const deleted = await prisma.booking.deleteMany({
    where: { date: { lt: deleteCutoff } },
  });

  const anonymized = await prisma.booking.updateMany({
    where: {
      date: { lt: piiCutoff },
      OR: [
        { citizenName: { not: null } }, { citizenNameNormalized: { not: null } },
        { citizenEmail: { not: null } }, { citizenPhone: { not: null } },
        { citizenNrnHash: { not: null } }, { citizenNrnLast4: { not: null } },
        { citizenNrnEnc: { not: null } }, { citizenPostalCode: { not: null } },
        { citizenCommuneId: { not: null } }, { userId: { not: null } },
        { internalNote: { not: null } }, { cancelReason: { not: null } },
        { rejectionReason: { not: null } }, { formData: { not: {} } },
      ],
    },
    data: {
      citizenName: null,
      citizenNameNormalized: null,
      citizenEmail: null,
      citizenPhone: null,
      citizenNrnHash: null,
      citizenNrnLast4: null,
      citizenNrnEnc: null,
      citizenPostalCode: null,
      citizenCommuneId: null,
      userId: null,
      internalNote: null,
      cancelReason: null,
      rejectionReason: null,
      formData: {},
    },
  });

  return apiOk({
    ok: true,
    deleted: deleted.count,
    anonymized: anonymized.count,
    waitlistRetention,
  });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
