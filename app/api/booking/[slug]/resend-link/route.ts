import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { locationAddress } from "@/lib/booking/route-bureau";
import { sendManagementLink } from "@/lib/booking/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Statuts « actifs » : on ne renvoie le lien que pour un RDV encore gérable.
const ACTIVE = [BookingStatus.pending_approval, BookingStatus.confirmed];

/**
 * Renvoi du lien de gestion à l'adresse enregistrée — permet au citoyen bloqué
 * par l'anti-doublon d'aller déplacer/annuler son RDV existant.
 *
 * Réponse TOUJOURS générique ({ ok: true }) : jamais d'énumération d'emails.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`booking-resend:${ip}`, { windowMs: 60_000, max: 5 }).ok) {
    return NextResponse.json({ ok: true }, { headers: json });
  }

  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true }, { headers: json });
  }
  const raw = (body as { email?: unknown }).email;
  const email = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: true }, { headers: json });
  }

  const tenant = await prisma.bookingTenant.findFirst({ where: { slug, active: true } });
  if (!tenant) return NextResponse.json({ ok: true }, { headers: json });

  const booking = await prisma.booking.findFirst({
    where: { tenantId: tenant.id, citizenEmail: email, status: { in: ACTIVE } },
    orderBy: { createdAt: "desc" },
    include: { location: true },
  });

  if (booking?.citizenEmail) {
    await sendManagementLink({
      to: booking.citizenEmail,
      citizenName: booking.citizenName,
      tenantName: tenant.name,
      fromName: tenant.emailFromName ?? tenant.name,
      brandColor: tenant.brandColor,
      locationName: booking.location.name,
      locationAddress: locationAddress(booking.location),
      date: booking.date,
      startTime: booking.startTime,
      token: booking.confirmationToken,
    });
  }

  return NextResponse.json({ ok: true }, { headers: json });
}
