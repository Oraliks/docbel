// Construction de la réponse de disponibilité publique (résolution antenne +
// créneaux libres). Partagé entre la route API (navigation semaine côté client)
// et la page serveur (1er rendu en SSR, sans flash de chargement).

import { loadDayRange } from "./availability-data";
import {
  locationAddress,
  resolveLocation,
  type ResolvedLocation,
} from "./route-bureau";
import type { DayAvailability } from "./types";

export interface PublicLocation extends ResolvedLocation {
  address: string;
}

export interface PublicAvailability {
  location: PublicLocation | null;
  allLocations: PublicLocation[];
  communeName: string | null;
  days: DayAvailability[];
}

export async function loadPublicAvailability(opts: {
  tenantId: string;
  cp?: string | null;
  locationId?: string | null;
  from: string;
  days: number;
  now?: Date;
}): Promise<PublicAvailability> {
  const resolved = await resolveLocation(opts.tenantId, opts.cp ?? null);

  let location = resolved.location;
  if (opts.locationId) {
    const explicit = resolved.all.find((l) => l.id === opts.locationId);
    if (explicit) location = explicit;
  }

  const allLocations = resolved.all.map((l) => ({
    ...l,
    address: locationAddress(l),
  }));

  if (!location) {
    return {
      location: null,
      allLocations,
      communeName: resolved.communeName,
      days: [],
    };
  }

  const days = await loadDayRange({
    locationId: location.id,
    from: opts.from,
    days: opts.days,
    onlyAvailable: true,
    now: opts.now,
  });

  return {
    location: { ...location, address: locationAddress(location) },
    allLocations,
    communeName: resolved.communeName,
    days,
  };
}
