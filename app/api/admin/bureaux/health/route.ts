import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { memoCache } from "@/lib/memo-cache";
import { groupDuplicates, type DedupCandidate } from "@/lib/bureaus/dedupe";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Dashboard santé des données bureaux.
 *
 * Toutes les agrégations tournent en parallèle (Promise.all) et le résultat
 * complet est caché 15s en mémoire. Les données changent à la main par
 * l'admin — 15s de staleness est invisible UX et évite que le ping
 * monitoring (toutes les 30s) re-tape 12 queries DB à chaque fois.
 *
 * byRegion est fait en SQL natif (groupBy via join) au lieu de charger
 * tous les bureaux côté JS — gros gain quand le dataset grossit.
 */
type RegionMap = Record<string, Record<string, number>>;
type TypeCount = Record<string, number>;

interface HealthPayload {
  total: number;
  byType: TypeCount;
  missing: {
    latLng: TypeCount;
    phone: TypeCount;
    website: TypeCount;
  };
  verification: { notVerified: TypeCount };
  stubs: {
    count: number;
    sample: Array<{
      id: string;
      type: string;
      name: string;
      city: string;
      postalCode: string;
    }>;
  };
  coverage: {
    totalCommunes: number;
    communesWithCpas: number;
    communesWithCommune: number;
    missingCpas: number;
    missingCommune: number;
  };
  reports: { pending: number; total: number };
  byRegion: RegionMap;
  integrity: {
    realDuplicates: number;
    cpCommuneMismatches: number;
    communesWithoutChomage: number;
    totalCommunes: number;
    assignmentsByService: Record<string, number>;
  };
}

async function buildHealthPayload(): Promise<HealthPayload> {
  const [
    byType,
    missingLatLng,
    missingPhone,
    missingWebsite,
    notVerified,
    stubs,
    totalCommunes,
    communesWithCpas,
    communesWithCommune,
    reportsPending,
    reportsTotal,
    byRegionRows,
  ] = await Promise.all([
    withDbRetry(() =>
      prisma.bureau.groupBy({
        by: ["type"],
        where: { active: true },
        _count: { _all: true },
      })
    ),
    withDbRetry(() =>
      prisma.bureau.groupBy({
        by: ["type"],
        where: { active: true, lat: null },
        _count: { _all: true },
      })
    ),
    withDbRetry(() =>
      prisma.bureau.groupBy({
        by: ["type"],
        where: { active: true, OR: [{ phone: null }, { phone: "" }] },
        _count: { _all: true },
      })
    ),
    withDbRetry(() =>
      prisma.bureau.groupBy({
        by: ["type"],
        where: { active: true, OR: [{ website: null }, { website: "" }] },
        _count: { _all: true },
      })
    ),
    withDbRetry(() =>
      prisma.bureau.groupBy({
        by: ["type"],
        where: { active: true, verified: false },
        _count: { _all: true },
      })
    ),
    withDbRetry(() =>
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
    ),
    withDbRetry(() => prisma.commune.count()),
    withDbRetry(() =>
      prisma.bureau.findMany({
        where: { active: true, type: "CPAS", communeId: { not: null } },
        select: { communeId: true },
        distinct: ["communeId"],
      })
    ),
    withDbRetry(() =>
      prisma.bureau.findMany({
        where: { active: true, type: "COMMUNE", communeId: { not: null } },
        select: { communeId: true },
        distinct: ["communeId"],
      })
    ),
    withDbRetry(() =>
      prisma.bureauReport.count({ where: { status: "pending" } })
    ),
    withDbRetry(() => prisma.bureauReport.count()),
    // byRegion en SQL natif : group by region + type côté DB, pas côté JS.
    // Évite de charger N rows juste pour agréger.
    withDbRetry(() =>
      prisma.$queryRaw<Array<{ region: string | null; type: string; count: bigint }>>`
        SELECT COALESCE(c.region::text, 'unknown') AS region,
               b.type::text AS type,
               COUNT(*)::bigint AS count
        FROM "Bureau" b
        LEFT JOIN "Commune" c ON c.id = b."communeId"
        WHERE b.active = true
        GROUP BY region, b.type
      `
    ),
  ]);

  // ── Intégrité & liens (tuiles anti-dérive) ────────────────────────────
  const [
    integrityBureaus,
    postalCodes,
    chomageAssignRows,
    activeCommunes,
    assignmentGroups,
  ] = await Promise.all([
    withDbRetry(() =>
      prisma.bureau.findMany({
        where: { active: true, type: { in: ["CPAS", "COMMUNE"] } },
        select: {
          id: true, name: true, type: true, street: true, postalCode: true,
          communeId: true, phone: true, hours: true, lat: true, verified: true, updatedAt: true,
        },
      })
    ),
    withDbRetry(() => prisma.postalCode.findMany({ select: { code: true, communeId: true } })),
    withDbRetry(() =>
      prisma.bureauAssignment.findMany({
        where: { serviceType: "chomage" },
        select: { communeId: true },
        distinct: ["communeId"],
      })
    ),
    withDbRetry(() => prisma.commune.count({ where: { mergedIntoId: null } })),
    withDbRetry(() =>
      prisma.bureauAssignment.groupBy({ by: ["serviceType"], _count: { _all: true } })
    ),
  ]);

  const dedupCandidates: DedupCandidate[] = integrityBureaus.map((b) => ({
    id: b.id, name: b.name, type: b.type, street: b.street, postalCode: b.postalCode,
    communeId: b.communeId, phone: b.phone,
    hoursCount: Array.isArray(b.hours) ? b.hours.length : 0,
    lat: b.lat, verified: b.verified, updatedAt: b.updatedAt,
  }));
  const realDuplicates = groupDuplicates(dedupCandidates).length;

  // CP↔commune : le CP du bureau doit appartenir aux CP de sa commune liée.
  const knownCps = new Set(postalCodes.map((p) => p.code));
  const cpsByCommune = new Map<string, Set<string>>();
  for (const p of postalCodes) {
    if (!cpsByCommune.has(p.communeId)) cpsByCommune.set(p.communeId, new Set());
    cpsByCommune.get(p.communeId)!.add(p.code);
  }
  const cpCommuneMismatches = integrityBureaus.filter((b) => {
    if (!b.communeId || !knownCps.has(b.postalCode)) return false;
    const set = cpsByCommune.get(b.communeId);
    return set != null && set.size > 0 && !set.has(b.postalCode);
  }).length;

  const communesWithoutChomage = Math.max(0, activeCommunes - chomageAssignRows.length);
  const assignmentsByService: Record<string, number> = Object.fromEntries(
    assignmentGroups.map((g) => [g.serviceType, g._count._all])
  );

  function toRecord(items: { type: string; _count: { _all: number } }[]): TypeCount {
    return Object.fromEntries(items.map((i) => [i.type, i._count._all]));
  }

  const byRegion: RegionMap = {};
  for (const row of byRegionRows) {
    const r = row.region ?? "unknown";
    byRegion[r] ??= {};
    byRegion[r][row.type] = Number(row.count);
  }

  return {
    total: byType.reduce((s, x) => s + x._count._all, 0),
    byType: toRecord(byType),
    missing: {
      latLng: toRecord(missingLatLng),
      phone: toRecord(missingPhone),
      website: toRecord(missingWebsite),
    },
    verification: { notVerified: toRecord(notVerified) },
    stubs: { count: stubs.length, sample: stubs },
    coverage: {
      totalCommunes,
      communesWithCpas: communesWithCpas.length,
      communesWithCommune: communesWithCommune.length,
      missingCpas: Math.max(0, totalCommunes - communesWithCpas.length),
      missingCommune: Math.max(0, totalCommunes - communesWithCommune.length),
    },
    reports: { pending: reportsPending, total: reportsTotal },
    byRegion,
    integrity: {
      realDuplicates,
      cpCommuneMismatches,
      communesWithoutChomage,
      totalCommunes: activeCommunes,
      assignmentsByService,
    },
  };
}

export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const payload = await memoCache("admin:bureaux:health", 15_000, buildHealthPayload);

  return NextResponse.json(payload, { headers: jsonHeaders });
}
