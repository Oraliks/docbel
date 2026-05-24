import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Dashboard santé des données bureaux.
 *
 * Retourne en une seule requête tout ce qui est utile pour repérer
 * où sont les trous :
 *   - Volume par type
 *   - Bureaux sans lat/lng (manquent sur la map du finder)
 *   - Bureaux sans téléphone / sans site (info incomplète côté user)
 *   - Bureaux non vérifiés (verified=false → flagged dans l'UI admin)
 *   - Bureaux stub (street commence par "Adresse à confirmer" ou similaire)
 *   - Communes sans CPAS / sans MAISON COMMUNALE liée
 *   - Signalements pending
 *   - Couverture par région
 *
 * Volontairement read-only, calculs côté DB. Agrégations rapides via
 * groupBy + count, pas de N+1.
 */
export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  // 1) Volume par type
  const byType = await withDbRetry(() =>
    prisma.bureau.groupBy({
      by: ["type"],
      where: { active: true },
      _count: { _all: true },
    })
  );

  // 2) Trous data par type (lat/lng, phone, website, verified)
  const missingLatLng = await withDbRetry(() =>
    prisma.bureau.groupBy({
      by: ["type"],
      where: { active: true, lat: null },
      _count: { _all: true },
    })
  );
  const missingPhone = await withDbRetry(() =>
    prisma.bureau.groupBy({
      by: ["type"],
      where: { active: true, OR: [{ phone: null }, { phone: "" }] },
      _count: { _all: true },
    })
  );
  const missingWebsite = await withDbRetry(() =>
    prisma.bureau.groupBy({
      by: ["type"],
      where: { active: true, OR: [{ website: null }, { website: "" }] },
      _count: { _all: true },
    })
  );
  const notVerified = await withDbRetry(() =>
    prisma.bureau.groupBy({
      by: ["type"],
      where: { active: true, verified: false },
      _count: { _all: true },
    })
  );

  // 3) Bureaux stub (adresse placeholder)
  const stubs = await withDbRetry(() =>
    prisma.bureau.findMany({
      where: {
        active: true,
        OR: [
          { street: { contains: "confirmer", mode: "insensitive" } },
          { street: { contains: "stub", mode: "insensitive" } },
          { street: { contains: "TODO", mode: "insensitive" } },
          { postalCode: "0000" },
        ],
      },
      select: { id: true, type: true, name: true, city: true, postalCode: true },
      take: 50,
    })
  );

  // 4) Couverture territoriale : communes sans CPAS / sans COMMUNE liés
  const totalCommunes = await withDbRetry(() => prisma.commune.count());
  const communesWithCpas = await withDbRetry(() =>
    prisma.bureau.findMany({
      where: { active: true, type: "CPAS", communeId: { not: null } },
      select: { communeId: true },
      distinct: ["communeId"],
    })
  );
  const communesWithCommune = await withDbRetry(() =>
    prisma.bureau.findMany({
      where: { active: true, type: "COMMUNE", communeId: { not: null } },
      select: { communeId: true },
      distinct: ["communeId"],
    })
  );

  // 5) Signalements pending
  const reportsPending = await withDbRetry(() =>
    prisma.bureauReport.count({ where: { status: "pending" } })
  );
  const reportsTotal = await withDbRetry(() => prisma.bureauReport.count());

  // 6) Répartition par région (via la commune liée)
  const byRegion = await withDbRetry(() =>
    prisma.bureau.findMany({
      where: { active: true },
      select: { type: true, commune: { select: { region: true } } },
    })
  );
  const regionMap: Record<string, Record<string, number>> = {};
  for (const b of byRegion) {
    const r = b.commune?.region ?? "unknown";
    regionMap[r] ??= {};
    regionMap[r][b.type] = (regionMap[r][b.type] ?? 0) + 1;
  }

  // Helper : transforme groupBy[] → Record<type, count>
  function toRecord(items: { type: string; _count: { _all: number } }[]) {
    return Object.fromEntries(items.map((i) => [i.type, i._count._all]));
  }

  return NextResponse.json(
    {
      total: byType.reduce((s, x) => s + x._count._all, 0),
      byType: toRecord(byType),
      missing: {
        latLng: toRecord(missingLatLng),
        phone: toRecord(missingPhone),
        website: toRecord(missingWebsite),
      },
      verification: {
        notVerified: toRecord(notVerified),
      },
      stubs: {
        count: stubs.length,
        sample: stubs,
      },
      coverage: {
        totalCommunes,
        communesWithCpas: communesWithCpas.length,
        communesWithCommune: communesWithCommune.length,
        missingCpas: Math.max(0, totalCommunes - communesWithCpas.length),
        missingCommune: Math.max(0, totalCommunes - communesWithCommune.length),
      },
      reports: {
        pending: reportsPending,
        total: reportsTotal,
      },
      byRegion: regionMap,
    },
    { headers: jsonHeaders }
  );
}
