import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { icsFilename, icsForBooking } from "@/lib/booking/ics-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Téléchargement .ics d'un rendez-vous confirmé (via token citoyen). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: token },
    include: { tenant: { select: { name: true } } },
  });
  if (!booking || booking.status !== BookingStatus.confirmed) {
    return NextResponse.json(
      { error: "Rendez-vous non confirmé" },
      { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  const ics = icsForBooking(
    { date: booking.date, startTime: booking.startTime, endTime: booking.endTime },
    `${booking.tenant.name} — Rendez-vous`,
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(booking.date)}"`,
    },
  });
}
