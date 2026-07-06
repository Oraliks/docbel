import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
};

/// Résout un code postal belge vers sa/ses commune(s) (données officielles
/// Statbel/BeStAddress déjà en base — cf. Commune/PostalCode). Endpoint
/// public, en lecture seule, données de référence non sensibles — même
/// classe d'exposition que /api/geocode/suggest. Un code postal peut couvrir
/// plusieurs communes (rare, ex. certaines fusions) : on renvoie la liste.
///
/// Input  : ?code=1000
/// Output : { communes: { nameFr: string; nameNl: string | null; region: string }[] }
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`postal-lookup:${ip}`, { windowMs: 60_000, max: 60 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute", communes: [] },
      { status: 429, headers: jsonHeaders }
    );
  }

  const code = req.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json({ communes: [] }, { headers: jsonHeaders });
  }

  const rows = await prisma.postalCode.findMany({
    where: { code },
    include: { commune: { select: { nameFr: true, nameNl: true, region: true } } },
  });

  const communes = rows.map((r) => ({
    nameFr: r.commune.nameFr,
    nameNl: r.commune.nameNl,
    region: r.commune.region,
  }));

  return NextResponse.json({ communes }, { headers: jsonHeaders });
}
