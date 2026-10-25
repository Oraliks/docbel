/**
 * Safe Lookup response shapes. Imported metadata and notes are internal unless
 * a route explicitly serves them to an administrator.
 */
export const PUBLIC_LOOKUP_TABLES = new Set(["code-rue"]);

export function privateLookupError(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie, Authorization");
  return response;
}

export function projectPublicLookupSearch(payload: Record<string, unknown>) {
  const results = Array.isArray(payload.results)
    ? payload.results.map((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return value
        const row = value as Record<string, unknown>
        const projected = Object.fromEntries(
          Object.entries(row).filter(([key]) => !['notes', 'metadata', 'importSource'].includes(key)),
        )
        if (row.table && typeof row.table === 'object' && !Array.isArray(row.table)) {
          projected.table = Object.fromEntries(
            Object.entries(row.table as Record<string, unknown>).filter(([key]) => key !== 'importSource'),
          )
        }
        return projected
      })
    : []
  return { ...payload, results }
}

export function toLookupEntryProjection<T extends {
  id: string;
  code: string;
  labelFr: string;
  labelNl: string;
  labelDe?: string | null;
  labelEn?: string | null;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
}>(entry: T) {
  return {
    id: entry.id,
    code: entry.code,
    labelFr: entry.labelFr,
    labelNl: entry.labelNl,
    labelDe: entry.labelDe ?? null,
    labelEn: entry.labelEn ?? null,
    validFrom: entry.validFrom ?? null,
    validUntil: entry.validUntil ?? null,
  };
}

export function toLookupTableProjection<T extends {
  id: string;
  slug: string;
  prefix: string;
  labelFr: string;
  labelNl: string;
  group?: string | null;
  sourcePath?: string | null;
  entriesCount: number;
  updatedLabel?: string | null;
  category: { slug: string; labelFr: string; labelNl?: string };
}>(table: T) {
  return {
    id: table.id,
    slug: table.slug,
    prefix: table.prefix,
    labelFr: table.labelFr,
    labelNl: table.labelNl,
    group: table.group ?? null,
    sourcePath: table.sourcePath ?? null,
    entriesCount: table.entriesCount,
    updatedLabel: table.updatedLabel ?? null,
    category: {
      slug: table.category.slug,
      labelFr: table.category.labelFr,
      labelNl: table.category.labelNl ?? "",
    },
  };
}
