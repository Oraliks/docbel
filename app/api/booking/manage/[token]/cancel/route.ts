import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { brusselsNowParts, isSlotPast } from "@/lib/booking/dates";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Annulation par le citoyen via son token. */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: token },
    select: { id: true, status: true, date: true, startTime: true, tenantId: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404, headers: json });
  }

  const cancellable =
    (booking.status === BookingStatus.pending_approval ||
      booking.status === BookingStatus.confirmed) &&
    !isSlotPast(booking.date, booking.startTime, brusselsNowParts());
  if (!cancellable) {
    return NextResponse.json(
      { error: "Ce rendez-vous ne peut plus être annulé" },
      { status: 400, headers: json },
    );
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.cancelled_citizen,
      cancelledAt: new Date(),
      cancelReason: "Annulé par le citoyen",
    },
  });

  await logActivity(
    "Citoyen",
    "updated",
    "booking",
    booking.id,
    booking.id,
    `RDV annulé par le citoyen (${booking.date} ${booking.startTime})`,
  );

  return NextResponse.json({ ok: true }, { headers: json });
}
