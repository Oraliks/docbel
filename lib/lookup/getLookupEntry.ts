import { prisma, withDbRetry } from '@/lib/prisma'

export interface ResolvedLookupEntry {
  code: string
  labelFr: string
  labelNl: string
  labelDe: string | null
  labelEn: string | null
  tableSlug: string
  tableLabelFr: string
  categorySlug: string
  validFrom: Date | null
  validUntil: Date | null
  notes: string | null
}

// Cache mémoire 5 min — invalidé après chaque édition/import
interface CacheEntry {
  data: ResolvedLookupEntry | null
  cachedAt: number
}
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, CacheEntry>()

function cacheKey(tableSlug: string, code: string): string {
  return `${tableSlug}::${code}`
}

export function invalidateLookupCache(tableSlug?: string) {
  if (!tableSlug) {
    cache.clear()
    return
  }
  for (const k of [...cache.keys()]) {
    if (k.startsWith(`${tableSlug}::`)) cache.delete(k)
  }
}

/**
 * Récupère l'entrée valide aujourd'hui pour un code dans une table donnée.
 * Si plusieurs entrées matchent (historique), retourne la plus récente.
 *
 * Retourne null si aucune entrée n'existe ou si toutes sont expirées.
 */
export async function getLookupEntry(
  tableSlug: string,
  code: string,
  options: { force?: boolean } = {}
): Promise<ResolvedLookupEntry | null> {
  const key = cacheKey(tableSlug, code)
  if (!options.force) {
    const cached = cache.get(key)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.data
    }
  }

  const now = new Date()
  const entry = await withDbRetry(() =>
    prisma.lookupEntry.findFirst({
      where: {
        code,
        table: { slug: tableSlug },
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
        ],
      },
      orderBy: [{ validFrom: 'desc' }],
      include: {
        table: { include: { category: true } },
      },
    })
  )

  const resolved: ResolvedLookupEntry | null = entry
    ? {
        code: entry.code,
        labelFr: entry.labelFr,
        labelNl: entry.labelNl,
        labelDe: entry.labelDe,
        labelEn: entry.labelEn,
        tableSlug: entry.table.slug,
        tableLabelFr: entry.table.labelFr,
        categorySlug: entry.table.category.slug,
        validFrom: entry.validFrom,
        validUntil: entry.validUntil,
        notes: entry.notes,
      }
    : null

  cache.set(key, { data: resolved, cachedAt: Date.now() })
  return resolved
}

/**
 * Récupère plusieurs codes en une seule requête. Optimisé pour les lookups en lot
 * (ex: enrichir une liste de BaremeAmount avec les définitions de leur code).
 */
export async function getLookupEntriesByCodes(
  tableSlug: string,
  codes: string[]
): Promise<Map<string, ResolvedLookupEntry>> {
  if (codes.length === 0) return new Map()
  const now = new Date()
  const entries = await withDbRetry(() =>
    prisma.lookupEntry.findMany({
      where: {
        code: { in: codes },
        table: { slug: tableSlug },
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
        ],
      },
      orderBy: [{ validFrom: 'desc' }],
      include: { table: { include: { category: true } } },
    })
  )

  // Dédupliquer par code : si plusieurs versions, on garde la première (la plus récente
  // grâce à l'orderBy desc)
  const map = new Map<string, ResolvedLookupEntry>()
  for (const e of entries) {
    if (map.has(e.code)) continue
    map.set(e.code, {
      code: e.code,
      labelFr: e.labelFr,
      labelNl: e.labelNl,
      labelDe: e.labelDe,
      labelEn: e.labelEn,
      tableSlug: e.table.slug,
      tableLabelFr: e.table.labelFr,
      categorySlug: e.table.category.slug,
      validFrom: e.validFrom,
      validUntil: e.validUntil,
      notes: e.notes,
    })
  }
  return map
}
