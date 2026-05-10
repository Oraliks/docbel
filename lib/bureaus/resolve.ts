import { prisma, withDbRetry } from "@/lib/prisma";
import {
  haversineKm,
  serializeBureau,
  type SerializedBureau,
  type BureauWithRelations,
} from "./types";

export type CommuneSummary = {
  id: string;
  insCode: string;
  nameFr: string;
  nameNl: string | null;
  nameDe: string | null;
  region: string;
  province: string | null;
  lat: number | null;
  lng: number | null;
};

export type ResolveResult = {
  query: { postalCode: string };
  commune: CommuneSummary | null;
  attitre: {
    cpas: SerializedBureau | null;
    commune: SerializedBureau | null;
    onem: SerializedBureau | null;
  };
  proximite: {
    syndicats: SerializedBureauWithDistance[];
    permanences: SerializedBureauWithDistance[];
    autres: SerializedBureauWithDistance[];
  };
  warnings: string[];
};

export type SerializedBureauWithDistance = SerializedBureau & {
  distanceKm: number | null;
};

const NEAR_LIMIT = 12;

/**
 * Résolveur principal : à partir d'un code postal, retourne :
 *  - les bureaux ATTITRÉS (CPAS, Commune, ONEM compétent)
 *  - les bureaux à PROXIMITÉ (syndicats, permanences) triés par distance
 */
export async function resolveBureausForPostalCode(rawCp: string): Promise<ResolveResult> {
  const postalCode = rawCp.trim();
  const warnings: string[] = [];

  if (!/^\d{4}$/.test(postalCode)) {
    return {
      query: { postalCode },
      commune: null,
      attitre: { cpas: null, commune: null, onem: null },
      proximite: { syndicats: [], permanences: [], autres: [] },
      warnings: ["Code postal invalide (4 chiffres attendus)"],
    };
  }

  // 1) CP → commune (si on a la mapping)
  const pc = await withDbRetry(() =>
    prisma.postalCode.findUnique({
      where: { code: postalCode },
      include: { commune: true },
    })
  ).catch(() => null);

  const commune = pc?.commune ?? null;

  if (!commune) {
    warnings.push(
      `Code postal ${postalCode} pas encore référencé. Les bureaux affichés sont triés sur le CP, sans bureau attitré.`
    );
  }

  // 2) Bureaux attitrés (CPAS + COMMUNE = 1-1 par communeId)
  let cpasRow: BureauWithRelations | null = null;
  let communeRow: BureauWithRelations | null = null;
  let onemRow: BureauWithRelations | null = null;

  if (commune) {
    const direct = await withDbRetry(() =>
      prisma.bureau.findMany({
        where: { active: true, communeId: commune.id, type: { in: ["CPAS", "COMMUNE"] } },
        include: { organisme: true, commune: true },
        take: 5,
      })
    );
    cpasRow = direct.find((b) => b.type === "CPAS") ?? null;
    communeRow = direct.find((b) => b.type === "COMMUNE") ?? null;

    // ONEM compétent = via assignment
    const onemAssign = await withDbRetry(() =>
      prisma.bureauAssignment.findFirst({
        where: { communeId: commune.id, serviceType: "chomage" },
        include: {
          bureau: { include: { organisme: true, commune: true } },
        },
      })
    );
    onemRow = onemAssign?.bureau ?? null;

    // Fallback : si pas d'assignment, prendre le bureau ONEM le plus proche
    if (!onemRow) {
      const allOnem = await withDbRetry(() =>
        prisma.bureau.findMany({
          where: { active: true, type: "ONEM" },
          include: { organisme: true, commune: true },
        })
      );
      onemRow = nearestBureau(allOnem, commune.lat, commune.lng);
      if (onemRow) {
        warnings.push(
          "Bureau ONEM compétent estimé par proximité (assignment officielle non saisie)"
        );
      }
    }
  }

  // 3) Bureaux à proximité — syndicats / permanences / autres
  const refLat = commune?.lat ?? null;
  const refLng = commune?.lng ?? null;

  const nearbyRaw = await withDbRetry(() =>
    prisma.bureau.findMany({
      where: {
        active: true,
        type: { in: ["SYNDICAT", "PERMANENCE", "AUTRE"] },
      },
      include: { organisme: true, commune: true },
      take: 200,
    })
  );

  const withDistance = nearbyRaw.map((b) => {
    const distance =
      refLat !== null && refLng !== null && b.lat !== null && b.lng !== null
        ? haversineKm({ lat: refLat, lng: refLng }, { lat: b.lat, lng: b.lng })
        : null;
    return { bureau: b, distance };
  });

  // Si on a une référence géo, trier par distance ; sinon tri par CP partiel.
  withDistance.sort((a, b) => {
    if (a.distance === null && b.distance === null) return 0;
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });

  const syndicats: SerializedBureauWithDistance[] = [];
  const permanences: SerializedBureauWithDistance[] = [];
  const autres: SerializedBureauWithDistance[] = [];

  for (const item of withDistance) {
    const ser: SerializedBureauWithDistance = {
      ...serializeBureau(item.bureau),
      distanceKm: item.distance,
    };
    if (item.bureau.type === "SYNDICAT" && syndicats.length < NEAR_LIMIT) syndicats.push(ser);
    else if (item.bureau.type === "PERMANENCE" && permanences.length < NEAR_LIMIT)
      permanences.push(ser);
    else if (item.bureau.type === "AUTRE" && autres.length < NEAR_LIMIT) autres.push(ser);
  }

  return {
    query: { postalCode },
    commune: commune
      ? {
          id: commune.id,
          insCode: commune.insCode,
          nameFr: commune.nameFr,
          nameNl: commune.nameNl,
          nameDe: commune.nameDe,
          region: commune.region,
          province: commune.province,
          lat: commune.lat,
          lng: commune.lng,
        }
      : null,
    attitre: {
      cpas: cpasRow ? serializeBureau(cpasRow) : null,
      commune: communeRow ? serializeBureau(communeRow) : null,
      onem: onemRow ? serializeBureau(onemRow) : null,
    },
    proximite: { syndicats, permanences, autres },
    warnings,
  };
}

function nearestBureau(
  bureaus: BureauWithRelations[],
  lat: number | null,
  lng: number | null
): BureauWithRelations | null {
  if (lat === null || lng === null) return bureaus[0] ?? null;
  let best: BureauWithRelations | null = null;
  let bestD = Infinity;
  for (const b of bureaus) {
    if (b.lat === null || b.lng === null) continue;
    const d = haversineKm({ lat, lng }, { lat: b.lat, lng: b.lng });
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best ?? bureaus[0] ?? null;
}
