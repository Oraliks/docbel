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
    /** Bureau OP attitré quand le user a précisé son organisme (?org=capac…) */
    organismePaiement: SerializedBureau | null;
    /** Les 4 OPs compétents pour la commune (1 par organisme). Utilisé sur
     * /outils/bureaux pour que l'utilisateur choisisse via tabs. */
    organismesPaiement: SerializedBureau[];
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
const OP_CODES = ["capac", "fgtb", "csc", "cgslb"] as const;

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
  const paiementsRows: BureauWithRelations[] = [];
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
  }

  // Fallback ONEM via lookup officiel parametres-onem-cp si pas de commune
  // ou si aucun BureauAssignment ne match. Source : ONEM (1298 CP → BC officiels).
  if (!onemRow) {
    onemRow = await findOnemViaLookupCP(postalCode);
    if (onemRow) {
      warnings.push("Bureau ONEM trouvé via le mapping officiel ONEM (CP → BC)");
    }
  }

  if (commune) {
    // Reprise du bloc pour les autres services (paiement / mutuelle) après le fallback ONEM

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

    // Liste des 4 OPs compétents pour la commune (1 bureau par organisme).
    // Sert au public où l'utilisateur n'a pas précisé son OP : on affiche les
    // 4 cards en tabs pour qu'il choisisse celui où il est affilié.
    //
    // On exclut les sièges centraux (Bruxelles) du calcul de proximité — sinon
    // ils gagnent toujours pour les CP bruxellois alors qu'il existe une
    // antenne locale plus pertinente pour les chômeurs.
    if (paiementsRows.length === 0) {
      // Filtre dès Prisma sur les 4 OP_CODES au lieu de charger tous
      // les SYNDICAT et filtrer côté JS — gain réseau + parse JSON
      // (était la requête la plus lourde du resolver).
      const allSyndicats = await withDbRetry(() =>
        prisma.bureau.findMany({
          where: {
            active: true,
            type: "SYNDICAT",
            organisme: { code: { in: [...OP_CODES] } },
          },
          include: { organisme: true, commune: true },
        })
      );
      for (const code of OP_CODES) {
        const candidats = allSyndicats.filter((b) => b.organisme?.code === code);
        if (candidats.length === 0) continue;
        // 1. Match direct par commune (antenne locale exacte)
        const direct = candidats.find((b) => b.communeId === commune.id);
        if (direct) {
          paiementsRows.push(direct);
          continue;
        }
        // 2. Proche par proximité, en excluant les sièges centraux
        const locaux = candidats.filter((b) => !isCentralHQ(b));
        const nearestLocal = nearestBureau(locaux, commune.lat, commune.lng);
        if (nearestLocal) {
          paiementsRows.push(nearestLocal);
          continue;
        }
        // 3. Dernier recours : n'importe quel bureau du même organisme
        const fallback = nearestBureau(candidats, commune.lat, commune.lng);
        if (fallback) paiementsRows.push(fallback);
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
          const coords = getBureauCoords(b);
          const dist =
            refLat !== null && refLng !== null && coords
              ? haversineKm({ lat: refLat, lng: refLng }, coords)
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
    const coords = getBureauCoords(b);
    const distance =
      refLat !== null && refLng !== null && coords
        ? haversineKm({ lat: refLat, lng: refLng }, coords)
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
      organismesPaiement: paiementsRows.map(serializeBureau),
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
    attitre: { cpas: null, commune: null, onem: null, organismePaiement: null, organismesPaiement: [], mutuelle: null },
    sectoriel: { commissionRelated: [] },
    proximite: { syndicats: [], permanences: [], autres: [] },
    warnings,
  };
}

/**
 * Cherche le bureau ONEM compétent pour un code postal en passant par la table
 * lookup officielle ONEM `parametres-onem-cp` (1298 mappings CP → numéro de BC).
 * Utile quand le PostalCode n'est pas dans notre seed mais qu'on a quand même
 * envie de proposer un bureau au user.
 */
async function findOnemViaLookupCP(
  postalCode: string
): Promise<BureauWithRelations | null> {
  const entry = await withDbRetry(() =>
    prisma.lookupEntry.findFirst({
      where: { table: { slug: "parametres-onem-cp" }, code: postalCode },
      select: { metadata: true },
    })
  ).catch(() => null);
  if (!entry?.metadata) return null;
  const meta = entry.metadata as { BC?: string };
  const numeroOnem = meta.BC?.split("-")[0]?.trim();
  if (!numeroOnem) return null;
  return withDbRetry(() =>
    prisma.bureau.findFirst({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { type: "ONEM", active: true, numeroOnem } as any,
      include: { organisme: true, commune: true },
    })
  ).catch(() => null);
}

/**
 * Détecte un siège central (HQ) à exclure du calcul de proximité pour les
 * organismes de paiement. Heuristique sur le nom : "siège", "central", "national".
 */
function isCentralHQ(bureau: BureauWithRelations): boolean {
  const name = bureau.name.toLowerCase();
  return /si[èe]ge|central|national|h[eé]ad\s*office/i.test(name);
}

/**
 * Coords effectives d'un bureau : lat/lng direct si présent, sinon ceux de sa
 * commune via communeId. Indispensable pour les bureaux OP scrapés où on n'a
 * pas géocodé chaque adresse (les bureaux ont communeId résolu via postalCode
 * mais lat/lng restent NULL).
 */
function getBureauCoords(b: BureauWithRelations): { lat: number; lng: number } | null {
  if (b.lat !== null && b.lng !== null) return { lat: b.lat, lng: b.lng };
  if (b.commune?.lat != null && b.commune?.lng != null) {
    return { lat: b.commune.lat, lng: b.commune.lng };
  }
  return null;
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
    const coords = getBureauCoords(b);
    if (!coords) continue;
    const d = haversineKm({ lat, lng }, coords);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  // Si aucun bureau n'a de coords du tout, on retourne null plutôt que
  // bureaus[0] (qui serait arbitraire et donne une mauvaise réponse au user).
  return best;
}
