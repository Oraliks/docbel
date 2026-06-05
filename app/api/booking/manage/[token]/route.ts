import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { brusselsNowParts, isSlotPast } from "@/lib/booking/dates";
import { locationAddress } from "@/lib/booking/route-bureau";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Détail d'une réservation via son token (gestion citoyen, sans compte). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: token },
    include: { tenant: true, location: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404, headers: json });
  }

  const cancellable =
    (booking.status === BookingStatus.pending_approval ||
      booking.status === BookingStatus.confirmed) &&
    !isSlotPast(booking.date, booking.startTime, brusselsNowParts());

  return NextResponse.json(
    {
      status: booking.status,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      citizenName: booking.citizenName,
      rejectionReason: booking.rejectionReason,
      cancelReason: booking.cancelReason,
      tenant: { name: booking.tenant.name, brandColor: booking.tenant.brandColor },
      location: {
        name: booking.location.name,
        address: locationAddress({
          id: booking.location.id,
          name: booking.location.name,
          street: booking.location.street,
          postalCode: booking.location.postalCode,
          city: booking.location.city,
          lat: booking.location.lat,
          lng: booking.location.lng,
        }),
      },
      canCancel: cancellable,
      canDownloadIcs: booking.status === BookingStatus.confirmed,
    },
    { headers: json },
  );
}
