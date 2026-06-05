import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { icsForBooking } from "@/lib/booking/ics-adapter";
import { sendBookingConfirmed } from "@/lib/booking/emails";
import { cronAuthError, emailCtx } from "@/lib/booking/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Auto-approbation des demandes non traitées : si une demande reste en attente
 * au-delà de `autoApproveAfterHours`, on la confirme automatiquement (décision
 * produit : ne jamais laisser un citoyen sans réponse). Horaire.
 */
async function run(req: NextRequest) {
  const authErr = cronAuthError(req);
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: authErr.status, headers: json });
  }

  const candidates = await prisma.booking.findMany({
    where: { status: BookingStatus.pending_approval, tenant: { requireApproval: true } },
    include: { tenant: true, location: true },
    take: 300,
  });

  const now = Date.now();
  let approved = 0;
  for (const b of candidates) {
    const dueMs = b.createdAt.getTime() + b.tenant.autoApproveAfterHours * 3_600_000;
    if (now < dueMs) continue;

    await prisma.booking.update({
      where: { id: b.id },
      data: {
        status: BookingStatus.confirmed,
        autoApproved: true,
        confirmedAt: new Date(),
        approvedAt: new Date(),
      },
    });
    approved++;

    if (b.citizenEmail) {
      const ics = icsForBooking(
        { date: b.date, startTime: b.startTime, endTime: b.endTime },
        `${b.tenant.name} — Rendez-vous`,
      );
      await sendBookingConfirmed({ ...emailCtx(b, b.tenant, b.location), icsContent: ics });
    }
  }

  return NextResponse.json({ ok: true, scanned: candidates.length, approved }, { headers: json });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
