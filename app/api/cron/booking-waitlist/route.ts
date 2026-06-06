import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { brusselsNowParts } from "@/lib/booking/dates";
import { cronAuthError } from "@/lib/booking/notify";
import { findSlot } from "@/lib/booking/availability-data";
import { notifyNextWaiter } from "@/lib/booking/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

const H = 3_600_000;

/**
 * Maintenance liste d'attente (C). Quotidien (ou plusieurs fois/jour) :
 *  1. expire les notifications restées sans suite (> 48 h) ;
 *  2. purge les entrées dont le créneau est passé ;
 *  3. relance le prochain en attente sur les créneaux redevenus libres
 *     (sans re-notifier si une notification de moins de 24 h existe déjà).
 */
async function run(req: NextRequest) {
  const authErr = cronAuthError(req);
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: authErr.status, headers: json });
  }

  const today = brusselsNowParts().ymd;
  const nowMs = Date.now();

  // 1) Expirer les notifications de plus de 48 h.
  const notifs = await prisma.bookingWaitlist.findMany({
    where: { status: "notified" },
    select: { id: true, notifiedAt: true },
    take: 1000,
  });
  let expired = 0;
  for (const w of notifs) {
    if (w.notifiedAt && nowMs - w.notifiedAt.getTime() > 48 * H) {
      await prisma.bookingWaitlist.update({ where: { id: w.id }, data: { status: "expired" } });
      expired++;
    }
  }

  // 2) Purger les créneaux passés.
  const purged = await prisma.bookingWaitlist.updateMany({
    where: { status: { in: ["waiting", "notified"] }, date: { lt: today } },
    data: { status: "expired" },
  });

  // 3) Relancer le prochain sur les créneaux encore en attente et libres.
  const slots = await prisma.bookingWaitlist.groupBy({
    by: ["locationId", "date", "startTime"],
    where: { status: "waiting", date: { gte: today } },
  });
  let notified = 0;
  for (const s of slots) {
    const recent = await prisma.bookingWaitlist.findFirst({
      where: {
        locationId: s.locationId,
        date: s.date,
        startTime: s.startTime,
        status: "notified",
      },
      select: { notifiedAt: true },
      orderBy: { notifiedAt: "desc" },
    });
    if (recent?.notifiedAt && nowMs - recent.notifiedAt.getTime() < 24 * H) continue;

    const slot = await findSlot(s.locationId, s.date, s.startTime);
    if (!slot) continue;
    const count = await prisma.booking.count({
      where: {
        locationId: s.locationId,
        date: s.date,
        startTime: s.startTime,
        status: { in: [BookingStatus.pending_approval, BookingStatus.confirmed] },
      },
    });
    if (count >= slot.capacity) continue;
    if (await notifyNextWaiter(s.locationId, s.date, s.startTime)) notified++;
  }

  return NextResponse.json(
    { ok: true, expired, purged: purged.count, notified },
    { headers: json },
  );
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
