import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendNoShowFollowUp } from "@/lib/booking/emails";
import { addDaysYmd, brusselsNowParts } from "@/lib/booking/dates";
import { cronAuthError, emailCtx } from "@/lib/booking/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Relance (une seule fois) les citoyens absents des 30 derniers jours. Quotidien. */
async function run(req: NextRequest) {
  const authErr = cronAuthError(req);
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: authErr.status, headers: json });
  }

  const today = brusselsNowParts().ymd;
  const floor = addDaysYmd(today, -30);

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.no_show,
      noShowFollowupSentAt: null,
      citizenEmail: { not: null },
      date: { gte: floor, lte: today },
    },
    include: { tenant: true, location: true },
    take: 300,
  });

  let sent = 0;
  for (const b of bookings) {
    await sendNoShowFollowUp(emailCtx(b, b.tenant, b.location));
    await prisma.booking.update({
      where: { id: b.id },
      data: { noShowFollowupSentAt: new Date() },
    });
    sent++;
  }

  return NextResponse.json({ ok: true, scanned: bookings.length, sent }, { headers: json });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
