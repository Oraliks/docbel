import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { icsForBookings } from "@/lib/booking/ics-adapter";
import { isYmd, brusselsNowParts, addDaysYmd } from "@/lib/booking/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Export .ics de l'agenda équipe (Outlook/Google) sur une période. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await ctx.params;
  const guard = await guardTenant(tenantId, "view");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || brusselsNowParts().ymd;
  const to = url.searchParams.get("to") || addDaysYmd(from, 7);
  if (!isYmd(from) || !isYmd(to)) {
    return NextResponse.json({ error: "Dates invalides" }, { status: 400, headers: json });
  }
  const locationId = url.searchParams.get("locationId") || undefined;

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: from, lte: to },
      status: { in: [BookingStatus.pending_approval, BookingStatus.confirmed] },
      ...(locationId ? { locationId } : {}),
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 2000,
  });

  if (bookings.length === 0) {
    return NextResponse.json(
      { error: "Aucun rendez-vous sur cette période" },
      { status: 404, headers: json },
    );
  }

  const ics = icsForBookings(
    bookings.map((b) => ({
      booking: { date: b.date, startTime: b.startTime, endTime: b.endTime },
      summary: `${b.citizenName ?? "RDV"}${b.status === BookingStatus.pending_approval ? " (à valider)" : ""}`,
    })),
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="agenda_${from}_${to}.ics"`,
    },
  });
}
