import type { Bureau } from "@prisma/client";

const TRACKED_FIELDS = [
  "organismeId",
  "type",
  "name",
  "nameNl",
  "nameDe",
  "street",
  "streetNum",
  "postalCode",
  "city",
  "lat",
  "lng",
  "communeId",
  "phone",
  "email",
  "website",
  "appointmentUrl",
  "hours",
  "hoursNotes",
  "services",
  "active",
  "notes",
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

export type BureauDiff = {
  changed: TrackedField[];
  previous: Partial<Record<TrackedField, unknown>>;
  current: Partial<Record<TrackedField, unknown>>;
};

/**
 * Calcule un diff entre deux versions d'un bureau (champs trackés uniquement).
 * Pour les arrays/objects, compare via JSON.stringify.
 */
export function diffBureau(
  before: Bureau,
  after: Partial<Bureau>
): BureauDiff {
  const changed: TrackedField[] = [];
  const previous: Partial<Record<TrackedField, unknown>> = {};
  const current: Partial<Record<TrackedField, unknown>> = {};

  for (const field of TRACKED_FIELDS) {
    if (!(field in after)) continue;
    const prev = (before as Record<string, unknown>)[field];
    const next = (after as Record<string, unknown>)[field];
    if (!isEqual(prev, next)) {
      changed.push(field);
      previous[field] = prev;
      current[field] = next;
    }
  }

  return { changed, previous, current };
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * Snapshot léger d'un bureau (sans relations) — pour stockage en JSON.
 */
export function snapshotBureau(b: Bureau): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const f of TRACKED_FIELDS) {
    snapshot[f] = (b as Record<string, unknown>)[f];
  }
  snapshot.id = b.id;
  snapshot.snapshotAt = new Date().toISOString();
  return snapshot;
}
