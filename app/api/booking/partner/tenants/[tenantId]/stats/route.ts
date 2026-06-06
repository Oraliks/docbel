import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { brusselsNowParts, isYmd } from "@/lib/booking/dates";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Statistiques agrégées d'un guichet sur une période (D). */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await ctx.params;
  const guard = await guardTenant(tenantId, "view");
  if (!guard.ok) return guard.response;

  const today = brusselsNowParts().ymd;
  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const from = fromParam && isYmd(fromParam) ? fromParam : `${today.slice(0, 7)}-01`;
  const to = toParam && isYmd(toParam) ? toParam : today;

  const where = { tenantId, date: { gte: from, lte: to } };

  const rows = await prisma.booking.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
  const c = (s: BookingStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
  const total = rows.reduce((a, r) => a + r._count._all, 0);
  const noShow = c(BookingStatus.no_show);
  const completed = c(BookingStatus.completed);
  const cancelled =
    c(BookingStatus.cancelled_citizen) + c(BookingStatus.cancelled_partner);

  const byStatus = {
    pending_verification: c(BookingStatus.pending_verification),
    pending_approval: c(BookingStatus.pending_approval),
    confirmed: c(BookingStatus.confirmed),
    completed,
    no_show: noShow,
    rejected: c(BookingStatus.rejected),
    cancelled,
  };

  const handled = noShow + completed;
  const noShowRate = handled > 0 ? Math.round((noShow / handled) * 100) : 0;

  // Délai moyen avant RDV (création → date), sur un échantillon récent.
  const sample = await prisma.booking.findMany({
    where,
    select: { date: true, createdAt: true },
    take: 1000,
    orderBy: { createdAt: "desc" },
  });
  let leadSum = 0;
  let leadN = 0;
  for (const b of sample) {
    const appt = new Date(`${b.date}T00:00:00Z`).getTime();
    const days = (appt - b.createdAt.getTime()) / 86_400_000;
    if (days >= 0 && days < 400) {
      leadSum += days;
      leadN++;
    }
  }
  const avgLeadDays = leadN ? Math.round((leadSum / leadN) * 10) / 10 : null;

  // Services les plus demandés.
  const svc = await prisma.booking.groupBy({
    by: ["serviceCode"],
    where: { ...where, serviceCode: { not: null } },
    _count: { _all: true },
  });
  const topServices = svc
    .map((s) => ({ code: s.serviceCode as string, count: s._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Liste d'attente active (créneaux à venir).
  const waitlistWaiting = await prisma.bookingWaitlist.count({
    where: { tenantId, status: "waiting", date: { gte: today } },
  });

  // Réservations créées ce mois calendaire (facturation / freemium).
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthBookings = await prisma.booking.count({
    where: { tenantId, createdAt: { gte: monthStart } },
  });

  return NextResponse.json(
    {
      from,
      to,
      total,
      byStatus,
      noShowRate,
      avgLeadDays,
      topServices,
      waitlistWaiting,
      monthBookings,
    },
    { headers: json },
  );
}
