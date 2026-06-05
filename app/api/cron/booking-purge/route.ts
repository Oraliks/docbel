import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { addDaysYmd, brusselsNowParts } from "@/lib/booking/dates";
import { cronAuthError } from "@/lib/booking/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

// Rétention RGPD : on minimise les données nominatives 6 mois après le RDV,
// puis on supprime complètement après 24 mois.
const RETAIN_PII_DAYS = 180;
const HARD_DELETE_DAYS = 730;

/** Purge RGPD des réservations passées. Quotidien (nuit). */
async function run(req: NextRequest) {
  const authErr = cronAuthError(req);
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: authErr.status, headers: json });
  }

  const today = brusselsNowParts().ymd;
  const piiCutoff = addDaysYmd(today, -RETAIN_PII_DAYS);
  const deleteCutoff = addDaysYmd(today, -HARD_DELETE_DAYS);

  const deleted = await prisma.booking.deleteMany({
    where: { date: { lt: deleteCutoff } },
  });

  const anonymized = await prisma.booking.updateMany({
    where: { date: { lt: piiCutoff }, citizenName: { not: null } },
    data: {
      citizenName: null,
      citizenNameNormalized: null,
      citizenEmail: null,
      citizenPhone: null,
      citizenNrnHash: null,
      citizenNrnLast4: null,
      citizenPostalCode: null,
      citizenCommuneId: null,
      formData: {},
    },
  });

  return NextResponse.json(
    { ok: true, deleted: deleted.count, anonymized: anonymized.count },
    { headers: json },
  );
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
