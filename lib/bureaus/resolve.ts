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
  query: {
    postalCode: string;
    organismePaiement: string | null;
    commissionCode: string | null;
    mutuelleCode: string | null;
  };
  commune: CommuneSummary | null;
  attitre: {
    cpas: SerializedBureau | null;
    commune: SerializedBureau | null;
    onem: SerializedBureau | null;
    organismePaiement: SerializedBureau | null;
    mutuelle: SerializedBureau | null;
  };
  sectoriel: {
    /** Bureaux liés à la commission paritaire (le syndicat sectoriel du user) */
    commissionRelated: SerializedBureauWithDistance[];
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

export type ResolveOptions = {
  /** Code organisme de paiement choisi par le user ("capac" | "fgtb" | "csc" | "cgslb") */
  organismePaiement?: string | null;
  /** Code commission paritaire (ex: "124") */
  commissionCode?: string | null;
  /** Code mutuelle ("solidaris" | "mc" | ...) */
  mutuelleCode?: string | null;
};

/**
 * Résolveur principal. À partir d'un CP (et préférences user), retourne :
 *   - les bureaux ATTITRÉS pour CHAQUE service (CPAS, Commune, ONEM, Paiement, Mutuelle)
 *   - les bureaux SECTORIELS liés à la CP du user
 *   - les bureaux à PROXIMITÉ pour libre choix
 */
export async function resolveBureausForPostalCode(
  rawCp: string,
  options: ResolveOptions = {}
): Promise<ResolveResult> {
  const postalCode = rawCp.trim();
  const warnings: string[] = [];
  const organismePaiement = options.organismePaiement?.toLowerCase() ?? null;
  const commissionCode = options.commissionCode?.trim() ?? null;
  const mutuelleCode = options.mutuelleCode?.toLowerCase() ?? null;

  if (!/^\d{4}$/.test(postalCode)) {
    return emptyResult(postalCode, organismePaiement, commissionCode, mutuelleCode, [
      "Code postal invalide (4 chiffres attendus)",
    ]);
  }

  // 1) CP → commune
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

  // 2) Bureaux attitrés
  let cpasRow: BureauWithRelations | null = null;
  let communeRow: BureauWithRelations | null = null;
  let onemRow: BureauWithRelations | null = null;
  let paiementRow: BureauWithRelations | null = null;
  let mutuelleRow: BureauWithRelations | null = null;

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

    // ONEM compétent
    const onemAssign = await withDbRetry(() =>
      prisma.bureauAssignment.findFirst({
        where: { communeId: commune.id, serviceType: "chomage" },
        include: { bureau: { include: { organisme: true, commune: true } } },
      })
    );
    onemRow = onemAssign?.bureau ?? null;

    // Fallback ONEM proximité
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

    // Organisme de paiement attitré (selon préférence user)
    if (organismePaiement) {
      const serviceType = `paiement_${organismePaiement}`;
      const paiementAssign = await withDbRetry(() =>
        prisma.bureauAssignment.findFirst({
          where: { communeId: commune.id, serviceType },
          include: { bureau: { include: { organisme: true, commune: true } } },
        })
      );
      paiementRow = paiementAssign?.bureau ?? null;

      // Fallback proximité dans le bon organisme
      if (!paiementRow) {
        const candidats = await withDbRetry(() =>
          prisma.bureau.findMany({
            where: {
              active: true,
              type: "SYNDICAT",
              organisme: { code: organismePaiement },
            },
            include: { organisme: true, commune: true },
          })
        );
        paiementRow = nearestBureau(candidats, commune.lat, commune.lng);
        if (paiementRow) {
          warnings.push(
            `Bureau ${organismePaiement.toUpperCase()} compétent estimé par proximité`
          );
        }
      }
    }

    // Mutuelle attitrée
    if (mutuelleCode) {
      const serviceType = `mutuelle_${mutuelleCode}`;
      const mutAssign = await withDbRetry(() =>
        prisma.bureauAssignment.findFirst({
          where: { communeId: commune.id, serviceType },
          include: { bureau: { include: { organisme: true, commune: true } } },
        })
      );
      mutuelleRow = mutAssign?.bureau ?? null;
    }
  }

  // 3) Bureaux sectoriels (selon commission paritaire)
  let sectorielBureaus: SerializedBureauWithDistance[] = [];
  if (commissionCode) {
    // Recherche flexible : code exact OU numero/numeroOfficiel "200"
    const commission = await withDbRetry(() =>
      prisma.commissionParitaire.findFirst({
        where: {
          OR: [
            { code: commissionCode },
            { numero: commissionCode },
            { numeroOfficiel: commissionCode },
          ],
        },
      })
    );
    if (commission) {
      const bcs = await withDbRetry(() =>
        prisma.bureauCommission.findMany({
          where: { commissionId: commission.id, bureau: { active: true } },
          include: { bureau: { include: { organisme: true, commune: true } } },
          take: 30,
        })
      );
      const refLat = commune?.lat ?? null;
      const refLng = commune?.lng ?? null;
      sectorielBureaus = bcs
        .map((bc) => {
          const b = bc.bureau;
          const dist =
            refLat !== null && refLng !== null && b.lat !== null && b.lng !== null
              ? haversineKm({ lat: refLat, lng: refLng }, { lat: b.lat, lng: b.lng })
              : null;
          return { ...serializeBureau(b), distanceKm: dist };
        })
        .sort((a, b) => {
          if (a.distanceKm === null && b.distanceKm === null) return 0;
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        })
        .slice(0, 8);
    } else {
      warnings.push(`Commission paritaire ${commissionCode} introuvable`);
    }
  }

  // 4) Proximité — syndicats / permanences / autres
  const refLat = commune?.lat ?? null;
  const refLng = commune?.lng ?? null;

  const nearbyRaw = await withDbRetry(() =>
    prisma.bureau.findMany({
      where: {
        active: true,
        type: { in: ["SYNDICAT", "PERMANENCE", "AUTRE"] },
        // Si organisme paiement précisé, on filtre les syndicats à ce seul org
        ...(organismePaiement
          ? {
              OR: [
                { type: { in: ["PERMANENCE", "AUTRE"] } },
                { type: "SYNDICAT", organisme: { code: organismePaiement } },
              ],
            }
          : {}),
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
    query: { postalCode, organismePaiement, commissionCode, mutuelleCode },
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
      organismePaiement: paiementRow ? serializeBureau(paiementRow) : null,
      mutuelle: mutuelleRow ? serializeBureau(mutuelleRow) : null,
    },
    sectoriel: { commissionRelated: sectorielBureaus },
    proximite: { syndicats, permanences, autres },
    warnings,
  };
}

function emptyResult(
  postalCode: string,
  org: string | null,
  cp: string | null,
  mut: string | null,
  warnings: string[]
): ResolveResult {
  return {
    query: { postalCode, organismePaiement: org, commissionCode: cp, mutuelleCode: mut },
    commune: null,
    attitre: { cpas: null, commune: null, onem: null, organismePaiement: null, mutuelle: null },
    sectoriel: { commissionRelated: [] },
    proximite: { syndicats: [], permanences: [], autres: [] },
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
