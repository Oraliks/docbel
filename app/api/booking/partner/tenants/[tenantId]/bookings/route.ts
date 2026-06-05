import { NextRequest, NextResponse } from "next/server";
import { BookingStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { isYmd } from "@/lib/booking/dates";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

const STATUSES = new Set(Object.values(BookingStatus) as string[]);

/** Agenda équipe : réservations filtrables par période / statut / antenne. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await ctx.params;
  const guard = await guardTenant(tenantId, "view");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const locationId = url.searchParams.get("locationId");

  const where: Prisma.BookingWhereInput = { tenantId };
  if (from && to && isYmd(from) && isYmd(to)) where.date = { gte: from, lte: to };
  if (status && STATUSES.has(status)) where.status = status as BookingStatus;
  if (locationId) where.locationId = locationId;

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { location: { select: { name: true } } },
    take: 1000,
  });

  return NextResponse.json(
    {
      bookings: bookings.map((b) => ({
        id: b.id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        serviceCode: b.serviceCode,
        citizenName: b.citizenName,
        citizenEmail: b.citizenEmail,
        citizenPhone: b.citizenPhone,
        citizenNrnLast4: b.citizenNrnLast4,
        citizenPostalCode: b.citizenPostalCode,
        formData: b.formData,
        locationName: b.location.name,
        autoApproved: b.autoApproved,
        rejectionReason: b.rejectionReason,
        cancelReason: b.cancelReason,
        createdAt: b.createdAt,
      })),
    },
    { headers: json },
  );
}
