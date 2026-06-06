import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { brusselsNowParts, isYmd } from "@/lib/booking/dates";
import { loadPublicAvailability } from "@/lib/booking/public-availability";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Disponibilité publique d'un tenant (navigation semaine côté client). Le 1er
 * rendu est fait en SSR par la page ; cette route sert les semaines suivantes.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`booking-availability:${ip}`, { windowMs: 60_000, max: 60 }).ok) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429, headers: json });
  }

  const { slug } = await ctx.params;
  const tenant = await prisma.bookingTenant.findFirst({
    where: { slug, active: true },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Organisation introuvable" }, { status: 404, headers: json });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || brusselsNowParts().ymd;
  if (!isYmd(from)) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400, headers: json });
  }
  const days = Math.min(42, Math.max(1, Number(url.searchParams.get("days")) || 28));

  const result = await loadPublicAvailability({
    tenantId: tenant.id,
    cp: url.searchParams.get("cp"),
    locationId: url.searchParams.get("locationId"),
    from,
    days,
  });

  return NextResponse.json(result, { headers: json });
}
