import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { loadDayRange } from "@/lib/booking/availability-data";
import { resolveLocation, locationAddress } from "@/lib/booking/route-bureau";
import { brusselsNowParts, isYmd } from "@/lib/booking/dates";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Disponibilité publique d'un tenant. Résout l'antenne à partir du code postal
 * (`cp`) ou d'un `locationId` explicite, puis renvoie les créneaux libres.
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
  const cp = url.searchParams.get("cp");
  const locationId = url.searchParams.get("locationId");
  const from = url.searchParams.get("from") || brusselsNowParts().ymd;
  if (!isYmd(from)) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400, headers: json });
  }
  const days = Math.min(42, Math.max(1, Number(url.searchParams.get("days")) || 28));

  const resolved = await resolveLocation(tenant.id, cp);
  let location = resolved.location;
  if (locationId) {
    const explicit = resolved.all.find((l) => l.id === locationId);
    if (explicit) location = explicit;
  }

  const allLocations = resolved.all.map((l) => ({ ...l, address: locationAddress(l) }));

  if (!location) {
    return NextResponse.json(
      { location: null, allLocations, communeName: resolved.communeName, days: [] },
      { headers: json },
    );
  }

  const daysData = await loadDayRange({
    locationId: location.id,
    from,
    days,
    onlyAvailable: true,
  });

  return NextResponse.json(
    {
      location: { ...location, address: locationAddress(location) },
      allLocations,
      communeName: resolved.communeName,
      days: daysData,
    },
    { headers: json },
  );
}
