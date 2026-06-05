import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { guardTenant } from "@/lib/booking/partner-guard";
import { bookingActionSchema } from "@/lib/booking/schemas";
import { icsForBooking } from "@/lib/booking/ics-adapter";
import { locationAddress } from "@/lib/booking/route-bureau";
import {
  sendBookingCancelled,
  sendBookingConfirmed,
} from "@/lib/booking/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Action équipe sur une réservation : approve / reject / cancel / no_show / complete. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; bookingId: string }> },
) {
  const { tenantId, bookingId } = await ctx.params;
  const guard = await guardTenant(tenantId, "approve");
  if (!guard.ok) return guard.response;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    include: { tenant: true, location: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404, headers: json });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }
  const parsed = bookingActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Action invalide" },
      { status: 400, headers: json },
    );
  }
  const action = parsed.data;

  const wrongState = (msg: string) =>
    NextResponse.json({ error: msg }, { status: 400, headers: json });

  const emailCtx = {
    to: booking.citizenEmail ?? "",
    citizenName: booking.citizenName,
    tenantName: booking.tenant.name,
    fromName: booking.tenant.emailFromName ?? booking.tenant.name,
    brandColor: booking.tenant.brandColor,
    locationName: booking.location.name,
    locationAddress: locationAddress({
      id: booking.location.id,
      name: booking.location.name,
      street: booking.location.street,
      postalCode: booking.location.postalCode,
      city: booking.location.city,
      lat: booking.location.lat,
      lng: booking.location.lng,
    }),
    date: booking.date,
    startTime: booking.startTime,
    token: booking.confirmationToken,
  };
  const hasEmail = !!booking.citizenEmail;

  switch (action.action) {
    case "approve": {
      if (booking.status !== BookingStatus.pending_approval) {
        return wrongState("Seule une demande en attente peut être approuvée");
      }
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.confirmed,
          confirmedAt: new Date(),
          approvedById: guard.userId,
          approvedAt: new Date(),
        },
      });
      if (hasEmail) {
        const ics = icsForBooking(
          { date: booking.date, startTime: booking.startTime, endTime: booking.endTime },
          `${booking.tenant.name} — Rendez-vous`,
        );
        await sendBookingConfirmed({ ...emailCtx, icsContent: ics });
      }
      break;
    }
    case "reject": {
      if (booking.status !== BookingStatus.pending_approval) {
        return wrongState("Seule une demande en attente peut être refusée");
      }
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.rejected,
          rejectedById: guard.userId,
          rejectionReason: action.reason,
        },
      });
      if (hasEmail) await sendBookingCancelled({ ...emailCtx, reason: action.reason, byPartner: false });
      break;
    }
    case "cancel": {
      if (booking.status !== BookingStatus.confirmed) {
        return wrongState("Seul un rendez-vous confirmé peut être annulé");
      }
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.cancelled_partner,
          cancelledAt: new Date(),
          cancelReason: action.reason,
        },
      });
      if (hasEmail) await sendBookingCancelled({ ...emailCtx, reason: action.reason, byPartner: true });
      break;
    }
    case "no_show": {
      if (booking.status !== BookingStatus.confirmed) {
        return wrongState("Seul un rendez-vous confirmé peut être marqué absent");
      }
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.no_show },
      });
      break;
    }
    case "complete": {
      if (booking.status !== BookingStatus.confirmed) {
        return wrongState("Seul un rendez-vous confirmé peut être marqué honoré");
      }
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.completed },
      });
      break;
    }
  }

  await logActivity(
    guard.userName,
    "updated",
    "booking",
    booking.citizenName ?? bookingId,
    bookingId,
    `Action: ${action.action}`,
  );
  return NextResponse.json({ ok: true }, { headers: json });
}
