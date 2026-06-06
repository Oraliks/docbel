import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { findSlot } from "@/lib/booking/availability-data";
import { brusselsNowParts, isHm, isSlotPast, isYmd } from "@/lib/booking/dates";
import { icsForBooking } from "@/lib/booking/ics-adapter";
import { locationAddress } from "@/lib/booking/route-bureau";
import { sendBookingConfirmed, sendBookingReceived } from "@/lib/booking/emails";
import { notifyNextWaiter } from "@/lib/booking/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Reprogrammation par le citoyen vers un autre créneau (même antenne). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }
  const date = (body as { date?: unknown }).date;
  const startTime = (body as { startTime?: unknown }).startTime;
  if (typeof date !== "string" || !isYmd(date) || typeof startTime !== "string" || !isHm(startTime)) {
    return NextResponse.json({ error: "Créneau invalide" }, { status: 400, headers: json });
  }

  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: token },
    include: { tenant: true, location: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404, headers: json });
  }

  const now = brusselsNowParts();
  const reschedulable =
    (booking.status === BookingStatus.pending_approval ||
      booking.status === BookingStatus.confirmed) &&
    !isSlotPast(booking.date, booking.startTime, now);
  if (!reschedulable) {
    return NextResponse.json(
      { error: "Ce rendez-vous ne peut plus être modifié" },
      { status: 400, headers: json },
    );
  }
  if (isSlotPast(date, startTime, now)) {
    return NextResponse.json({ error: "Ce créneau est déjà passé" }, { status: 400, headers: json });
  }

  const slot = await findSlot(booking.locationId, date, startTime);
  if (!slot) {
    return NextResponse.json({ error: "Créneau indisponible" }, { status: 400, headers: json });
  }

  try {
    const ok = await prisma.$transaction(async (tx) => {
      const count = await tx.booking.count({
        where: {
          locationId: booking.locationId,
          date,
          startTime,
          status: { in: [BookingStatus.pending_approval, BookingStatus.confirmed] },
          id: { not: booking.id },
        },
      });
      if (count >= slot.capacity) return false;
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          date,
          startTime,
          endTime: slot.endTime,
          serviceCode: slot.serviceCode ?? null,
        },
      });
      return true;
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Ce créneau vient d'être complété — choisissez-en un autre" },
        { status: 409, headers: json },
      );
    }
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Vous avez déjà un rendez-vous sur ce créneau" },
        { status: 409, headers: json },
      );
    }
    throw e;
  }

  // L'ancien créneau se libère → prévenir le 1er en liste d'attente.
  await notifyNextWaiter(booking.locationId, booking.date, booking.startTime);

  if (booking.citizenEmail) {
    const ctxEmail = {
      to: booking.citizenEmail,
      citizenName: booking.citizenName,
      tenantName: booking.tenant.name,
      fromName: booking.tenant.emailFromName ?? booking.tenant.name,
      brandColor: booking.tenant.brandColor,
      locationName: booking.location.name,
      locationAddress: locationAddress(booking.location),
      date,
      startTime,
      token,
      locale: booking.locale,
    };
    if (booking.status === BookingStatus.confirmed) {
      const ics = icsForBooking(
        { date, startTime, endTime: slot.endTime },
        `${booking.tenant.name} — Rendez-vous`,
      );
      await sendBookingConfirmed({ ...ctxEmail, icsContent: ics });
    } else {
      await sendBookingReceived(ctxEmail);
    }
  }

  return NextResponse.json(
    { ok: true, date, startTime, endTime: slot.endTime },
    { headers: json },
  );
}
