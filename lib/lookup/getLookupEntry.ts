import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'

export interface ResolvedLookupEntry {
  id: string
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
  effectiveDate: string
  publishedRevision: number
  publishedAt: Date | null
  importSource: string | null
}

export type LookupResolution =
  | { status: 'resolved'; entry: ResolvedLookupEntry }
  | { status: 'absent'; entry: null; effectiveDate: string; publishedRevision: number }
  | { status: 'ambiguous'; entry: null; effectiveDate: string; publishedRevision: number; candidates: number }

export function parseLookupCivilDate(value?: string | Date | null): { date: Date; day: string } {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('Date Lookup invalide')
    const day = value.toISOString().slice(0, 10)
    return { date: new Date(`${day}T00:00:00.000Z`), day }
  }
  if (value == null) {
    const day = new Date().toISOString().slice(0, 10)
    return { date: new Date(`${day}T00:00:00.000Z`), day }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date Lookup invalide (AAAA-MM-JJ attendu)')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Date Lookup invalide')
  return { date, day: value }
}

// Cache mémoire 5 min — invalidé après chaque édition/import
interface CacheEntry {
  data: LookupResolution
  cachedAt: number
}
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, CacheEntry>()

function cacheKey(tableSlug: string, tableId: string, code: string, day: string, revision: number): string {
  return `${tableSlug}::${tableId}::${code}::${day}::${revision}`
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
  options: { force?: boolean; asOf?: string | Date | null } = {}
): Promise<ResolvedLookupEntry | null> {
  const result = await resolveLookupEntry(tableSlug, code, options)
  return result.status === 'resolved' ? result.entry : null
}

export async function resolveLookupEntry(
  tableSlug: string,
  code: string,
  options: { force?: boolean; asOf?: string | Date | null } = {},
): Promise<LookupResolution> {
  const { date, day } = parseLookupCivilDate(options.asOf)
  const table = await withDbRetry(() => prisma.lookupTable.findUnique({
    where: { slug: tableSlug },
    select: { id: true, slug: true, labelFr: true, publishedRevision: true, lastImportedAt: true, lastImportSource: true, category: { select: { slug: true } } },
  }))
  if (!table) return { status: 'absent', entry: null, effectiveDate: day, publishedRevision: 0 }
  const key = cacheKey(tableSlug, table.id, code, day, table.publishedRevision)
  if (!options.force) {
    const cached = cache.get(key)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.data
    }
  }

  const entries = await withDbRetry(() =>
    prisma.lookupEntry.findMany({
      where: {
        code,
        tableId: table.id,
        AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: date } }] }, { OR: [{ validUntil: null }, { validUntil: { gte: date } }] }],
      },
      orderBy: [{ validFrom: 'desc' }, { id: 'asc' }],
      take: 3,
      select: { id: true, code: true, labelFr: true, labelNl: true, labelDe: true, labelEn: true, validFrom: true, validUntil: true, notes: true },
    })
  )
  const data: LookupResolution = entries.length > 1
    ? { status: 'ambiguous', entry: null, effectiveDate: day, publishedRevision: table.publishedRevision, candidates: entries.length }
    : entries.length === 0
      ? { status: 'absent', entry: null, effectiveDate: day, publishedRevision: table.publishedRevision }
      : { status: 'resolved', entry: {
          ...entries[0], tableSlug: table.slug, tableLabelFr: table.labelFr, categorySlug: table.category.slug,
          effectiveDate: day, publishedRevision: table.publishedRevision, publishedAt: table.lastImportedAt, importSource: table.lastImportSource,
        } }
  cache.set(key, { data, cachedAt: Date.now() })
  return data
}

/**
 * Récupère plusieurs codes en une seule requête. Optimisé pour les lookups en lot
 * (ex: enrichir une liste de BaremeAmount avec les définitions de leur code).
 */
export async function getLookupEntriesByCodes(
  tableSlug: string,
  codes: string[],
  options: { asOf?: string | Date | null } = {},
): Promise<Map<string, ResolvedLookupEntry>> {
  const outcomes = await resolveLookupEntriesByCodes(tableSlug, codes, options)
  return new Map([...outcomes].flatMap(([code, result]) => result.status === 'resolved' ? [[code, result.entry] as const] : []))
}

export async function resolveLookupEntriesByCodes(
  tableSlug: string,
  codes: string[],
  options: { asOf?: string | Date | null } = {},
): Promise<Map<string, LookupResolution>> {
  const { date, day } = parseLookupCivilDate(options.asOf)
  if (codes.length === 0) return new Map()
  return withDbRetry(() => prisma.$transaction(async (tx) => {
    const table = await tx.lookupTable.findUnique({
      where: { slug: tableSlug },
      select: { id: true, slug: true, labelFr: true, publishedRevision: true, lastImportedAt: true, lastImportSource: true, category: { select: { slug: true } } },
    })
    if (!table) return new Map(codes.map((code) => [code, { status: 'absent' as const, entry: null, effectiveDate: day, publishedRevision: 0 }]))

    const where = {
      code: { in: codes },
      tableId: table.id,
      AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: date } }] }, { OR: [{ validUntil: null }, { validUntil: { gte: date } }] }],
    }
    // Count per code first: a global findMany(take) can let one code's historical
    // overlaps hide all following codes and turn them into false absences.
    const counts = await tx.lookupEntry.groupBy({ by: ['code'], where, _count: { _all: true }, take: codes.length })
    const countByCode = new Map(counts.map((item) => [item.code, item._count._all]))
    const uniqueCodes = counts.filter((item) => item._count._all === 1).map((item) => item.code)
    const entries = uniqueCodes.length === 0 ? [] : await tx.lookupEntry.findMany({
      where: { ...where, code: { in: uniqueCodes } },
      orderBy: [{ validFrom: 'desc' }, { id: 'asc' }],
      take: uniqueCodes.length,
      select: { id: true, code: true, labelFr: true, labelNl: true, labelDe: true, labelEn: true, validFrom: true, validUntil: true, notes: true },
    })
    const entryByCode = new Map(entries.map((entry) => [entry.code, entry]))
    const map = new Map<string, LookupResolution>()
    for (const code of codes) {
      const count = countByCode.get(code) ?? 0
      const entry = entryByCode.get(code)
      map.set(code, count > 1
        ? { status: 'ambiguous', entry: null, effectiveDate: day, publishedRevision: table.publishedRevision, candidates: count }
        : !entry
          ? { status: 'absent', entry: null, effectiveDate: day, publishedRevision: table.publishedRevision }
          : { status: 'resolved', entry: { ...entry, tableSlug: table.slug, tableLabelFr: table.labelFr, categorySlug: table.category.slug, effectiveDate: day, publishedRevision: table.publishedRevision, publishedAt: table.lastImportedAt, importSource: table.lastImportSource } })
    }
    return map
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }))
}
