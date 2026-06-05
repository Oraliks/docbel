import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendBookingReminder } from "@/lib/booking/emails";
import { addDaysYmd, brusselsNowParts } from "@/lib/booking/dates";
import { cronAuthError, emailCtx } from "@/lib/booking/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Rappel J-1 des rendez-vous confirmés. Quotidien (le soir). */
async function run(req: NextRequest) {
  const authErr = cronAuthError(req);
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: authErr.status, headers: json });
  }

  const tomorrow = addDaysYmd(brusselsNowParts().ymd, 1);

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.confirmed,
      date: tomorrow,
      reminderSentAt: null,
      citizenEmail: { not: null },
    },
    include: { tenant: true, location: true },
    take: 500,
  });

  let sent = 0;
  for (const b of bookings) {
    await sendBookingReminder(emailCtx(b, b.tenant, b.location));
    await prisma.booking.update({
      where: { id: b.id },
      data: { reminderSentAt: new Date() },
    });
    sent++;
  }

  return NextResponse.json({ ok: true, date: tomorrow, sent }, { headers: json });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
