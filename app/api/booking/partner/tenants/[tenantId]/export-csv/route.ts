import { NextRequest, NextResponse } from "next/server";
import { BookingStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { isYmd } from "@/lib/booking/dates";
import { STATUS_LABELS } from "@/lib/booking/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };
const STATUSES = new Set(Object.values(BookingStatus) as string[]);

/** Échappe une cellule CSV (séparateur point-virgule, compatible Excel FR/BE). */
function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Export CSV de l'agenda — RÉSERVÉ AUX ADMINS (données nominatives).
 * Le bouton n'est affiché qu'aux admins ; l'accès est re-vérifié ici.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await ctx.params;
  const guard = await guardTenant(tenantId, "view");
  if (!guard.ok) return guard.response;
  if (guard.userRole !== "admin") {
    return NextResponse.json(
      { error: "Export réservé aux administrateurs" },
      { status: 403, headers: json },
    );
  }

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
    take: 5000,
  });

  const headers = [
    "Date",
    "Début",
    "Fin",
    "Statut",
    "Nom",
    "Email",
    "Téléphone",
    "Code postal",
    "NRN (4 derniers)",
    "Antenne",
    "Service",
    "Auto-approuvé",
    "Créé le",
  ];

  const rows = bookings.map((b) =>
    [
      b.date,
      b.startTime,
      b.endTime,
      STATUS_LABELS[b.status] ?? b.status,
      b.citizenName ?? "",
      b.citizenEmail ?? "",
      b.citizenPhone ?? "",
      b.citizenPostalCode ?? "",
      b.citizenNrnLast4 ? `***${b.citizenNrnLast4}` : "",
      b.location.name,
      b.serviceCode ?? "",
      b.autoApproved ? "oui" : "non",
      b.createdAt.toISOString(),
    ]
      .map(cell)
      .join(";"),
  );

  // BOM UTF-8 pour qu'Excel affiche correctement les accents.
  const csv = "﻿" + [headers.join(";"), ...rows].join("\r\n") + "\r\n";
  const span = from && to ? `${from}_${to}` : "tous";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rdv_${guard.tenant.slug}_${span}.csv"`,
    },
  });
}
