// Routage commune → antenne : à partir du code postal du citoyen, on choisit
// l'antenne active du tenant la plus proche (haversine sur le centroïde de la
// commune). Réutilise la table Commune/PostalCode et haversineKm existants.

import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/bureaus/types";

export interface ResolvedLocation {
  id: string;
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

function serialize(l: {
  id: string;
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}): ResolvedLocation {
  return {
    id: l.id,
    name: l.name,
    street: l.street,
    postalCode: l.postalCode,
    city: l.city,
    lat: l.lat,
    lng: l.lng,
  };
}

export function locationAddress(l: ResolvedLocation): string {
  return [l.street, [l.postalCode, l.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

export interface RouteResult {
  location: ResolvedLocation | null;
  all: ResolvedLocation[];
  communeName: string | null;
  communeId: string | null;
}

export async function resolveLocation(
  tenantId: string,
  postalCode?: string | null,
): Promise<RouteResult> {
  const locations = await prisma.bookingLocation.findMany({
    where: { tenantId, active: true },
    orderBy: { name: "asc" },
  });
  const all = locations.map(serialize);

  if (all.length === 0) {
    return { location: null, all, communeName: null, communeId: null };
  }

  let communeName: string | null = null;
  let communeId: string | null = null;

  if (postalCode && /^\d{4}$/.test(postalCode)) {
    const pc = await prisma.postalCode.findUnique({
      where: { code: postalCode },
      include: { commune: true },
    });
    const commune = pc?.commune ?? null;
    if (commune) {
      communeName = commune.nameFr;
      communeId = commune.id;
      if (commune.lat != null && commune.lng != null && all.length > 1) {
        const origin = { lat: commune.lat, lng: commune.lng };
        const withGeo = all.filter((l) => l.lat != null && l.lng != null);
        if (withGeo.length > 0) {
          const nearest = withGeo
            .map((l) => ({
              l,
              d: haversineKm(origin, { lat: l.lat!, lng: l.lng! }),
            }))
            .sort((a, b) => a.d - b.d)[0];
          return { location: nearest.l, all, communeName, communeId };
        }
      }
    }
  }

  // Une seule antenne, ou pas de géoloc exploitable → première antenne.
  return { location: all[0], all, communeName, communeId };
}
