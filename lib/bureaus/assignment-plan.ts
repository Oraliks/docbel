// Logique PURE de planification des BureauAssignment (compétence territoriale).
//
//  - `planChomageAssignments` : à partir des mappings CP→BC (lookup ONEM
//    parametres-onem-cp), résout CP→commune (via PostalCode, à jour post-fusion
//    2025) puis BC→bureau ONEM (via numeroOnem), et déduplique par commune.
//    Remplace le mapping par code INS périmé du sync historique.
//  - `planNearestAssignments` : pour les organismes de paiement (CAPAC/FGTB/
//    CSC/SYNOVA), assigne chaque commune à la section la PLUS PROCHE de sa
//    région (jamais inter-région). Rend le résolveur déterministe au lieu du
//    fallback "estimé par proximité".

import { haversineKm } from "./types";

export type CpMapping = { postalCode: string; bcCode: string | null };
export type Assignment = { bureauId: string; communeId: string };

/**
 * UN SEUL assignment chômage par commune. Quand les CP d'une commune pointent
 * vers des BC différents (rare, quirk de données), on retient le bureau
 * majoritaire ; à égalité, le bureauId lexicographiquement le plus petit
 * (déterministe). Garantit un résolveur non ambigu (findFirst déterministe).
 */
export function planChomageAssignments(
  cpMappings: CpMapping[],
  cpToCommune: Map<string, string>,
  bureauByNumero: Map<string, string>
): Assignment[] {
  // commune → (bureauId → nombre de CP qui pointent dessus)
  const votes = new Map<string, Map<string, number>>();
  for (const { postalCode, bcCode } of cpMappings) {
    if (!bcCode) continue;
    const bureauId = bureauByNumero.get(bcCode.trim());
    if (!bureauId) continue;
    const communeId = cpToCommune.get(postalCode.trim());
    if (!communeId) continue;
    if (!votes.has(communeId)) votes.set(communeId, new Map());
    const m = votes.get(communeId)!;
    m.set(bureauId, (m.get(bureauId) ?? 0) + 1);
  }

  const out: Assignment[] = [];
  for (const [communeId, m] of votes) {
    let best: string | null = null;
    let bestCount = -1;
    for (const [bureauId, count] of m) {
      if (count > bestCount || (count === bestCount && best != null && bureauId < best)) {
        best = bureauId;
        bestCount = count;
      }
    }
    if (best) out.push({ bureauId: best, communeId });
  }
  return out;
}

export type CommuneGeo = {
  communeId: string;
  region: string;
  lat: number | null;
  lng: number | null;
};
export type SectionGeo = {
  bureauId: string;
  region: string;
  lat: number;
  lng: number;
};

/**
 * Assigne chaque commune (avec coordonnées) à la section la plus proche DANS SA
 * RÉGION. Une commune sans coordonnées, ou sans aucune section dans sa région,
 * n'est pas assignée (le résolveur gardera son fallback proximité).
 */
export function planNearestAssignments(
  communes: CommuneGeo[],
  sections: SectionGeo[]
): Assignment[] {
  const sectionsByRegion = new Map<string, SectionGeo[]>();
  for (const s of sections) {
    if (!sectionsByRegion.has(s.region)) sectionsByRegion.set(s.region, []);
    sectionsByRegion.get(s.region)!.push(s);
  }

  const out: Assignment[] = [];
  for (const c of communes) {
    if (c.lat == null || c.lng == null) continue;
    const pool = sectionsByRegion.get(c.region);
    if (!pool || pool.length === 0) continue;
    let best: SectionGeo | null = null;
    let bestDist = Infinity;
    for (const s of pool) {
      const d = haversineKm({ lat: c.lat, lng: c.lng }, { lat: s.lat, lng: s.lng });
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    if (best) out.push({ bureauId: best.bureauId, communeId: c.communeId });
  }
  return out;
}
