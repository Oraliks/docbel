import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requirePartnerOrAdminAuth } from '@/lib/auth-check'
import { checkRateLimit, getClientIp } from '@/lib/utils/rate-limit'
import { tooManyRequests } from '@/lib/api/rate-limit-response'
import { privateLookupError, projectPublicLookupSearch } from '@/lib/lookup/projections'
import { PUBLIC_LOOKUP_TABLES } from '@/lib/lookup/projections'
import { parseLookupCivilDate } from '@/lib/lookup/getLookupEntry'
import { z } from 'zod'

export const runtime = 'nodejs'
const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
}
const publicJsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
}
const searchParamsSchema = z.object({
  q: z.string().trim().max(120).default(''),
  validOnly: z.enum(['true', 'false']).default('true'),
  categorySlug: z.string().trim().min(1).max(100).optional(),
  tableSlug: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  asOf: z.string().optional(),
})

interface SearchResultRow {
  id: string
  code: string
  labelFr: string
  labelNl: string
  labelDe: string | null
  labelEn: string | null
  validFrom: Date | null
  validUntil: Date | null
  notes?: string | null
  metadata?: Record<string, string> | null
  table: {
    slug: string
    labelFr: string
    labelNl: string
    prefix: string
    publishedRevision: number
    lastImportedAt: Date | null
    lastImportSource: string | null
    category: { slug: string; labelFr: string; labelNl: string }
  }
  similarity_score: number
}

/**
 * Recherche transverse fuzzy dans toutes les tables de lookup via pg_trgm.
 *
 * Performant grâce aux index GIN sur code/labelFr/labelNl/labelDe/labelEn.
 * Tolère les fautes de frappe et les variantes orthographiques.
 *
 * Query params :
 *   - q              : terme de recherche (min 2 chars)
 *   - validOnly      : "true" (défaut) pour filtrer les entrées valides aujourd'hui
 *   - categorySlug   : filtrer par catégorie (signaletic, dispo, …)
 *   - tableSlug      : filtrer par table spécifique
 *   - lang           : "fr"|"nl"|"de"|"en" — biaiser le ranking sur cette langue
 *   - limit          : max résultats (défaut 50, max 200)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const parsed = searchParamsSchema.safeParse(Object.fromEntries(searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres de recherche invalides' }, {
      status: 400, headers: publicJsonHeaders,
    })
  }
  const { q, categorySlug, tableSlug, asOf } = parsed.data
  const validOnly = parsed.data.validOnly !== 'false'
  const limit = parsed.data.limit
  if (asOf && !isValidDateOnly(asOf)) {
    return NextResponse.json({ error: 'asOf doit être une date ISO valide (AAAA-MM-JJ)' }, {
      status: 400, headers: publicJsonHeaders,
    })
  }

  const isPublicStreetLookup = !!tableSlug && PUBLIC_LOOKUP_TABLES.has(tableSlug) &&
    (!categorySlug || categorySlug.length <= 100)
  let isAdmin = false
  if (!isPublicStreetLookup) {
    const auth = await requirePartnerOrAdminAuth()
    if (!auth.isAuthorized) return privateLookupError(auth.error)
    isAdmin = auth.user.isAdmin
  } else {
    const ip = getClientIp(req)
    const rateLimit = await checkRateLimit(`lookup-public-search:${ip}`, { windowMs: 60_000, max: 60 })
    if (!rateLimit.ok) return tooManyRequests({ limit: 60, resetAt: rateLimit.resetAt })
  }
  const responseHeaders = isPublicStreetLookup ? publicJsonHeaders : jsonHeaders

  // Mode "browse par module" : si pas de query mais une table sélectionnée,
  // on retourne toutes les entrées de cette table (sans scoring). Permet au
  // partenaire de parcourir un module entier sans avoir à taper quelque chose.
  if (!q || q.length < 2) {
    if (!tableSlug) {
      return NextResponse.json({ results: [], total: 0 }, { headers: responseHeaders })
    }
    try {
      const result = await browseByTable({ tableSlug, validOnly, limit, asOf, isAdmin })
      return isPublicStreetLookup ? sanitizePublicSearchResponse(result) : result
    } catch (error) {
      console.error('[lookup/search browse] error:', error)
      return NextResponse.json({ error: 'Service Lookup indisponible' }, { status: 503, headers: { ...responseHeaders, 'Cache-Control': 'no-store' } })
    }
  }

  // Requête combinée pg_trgm + ILIKE pour balance précision/rappel :
  //  - Match EXACT sur code → boost x10 (toujours en haut)
  //  - Préfixe sur code (code commence par q) → boost x5
  //  - Préfixe sur label (label commence par q) → boost x3
  //  - ILIKE %q% sur n'importe quel champ → match substring (assure le rappel)
  //  - Similarité pg_trgm avec seuil 0.3 → fuzzy match (tolère fautes)
  //
  // On élimine les matches de très faible pertinence (score final < 0.3 après boost).
  const { date: now, day: effectiveDate } = parseLookupCivilDate(asOf)
  const validClause = validOnly
    ? `AND (e."validFrom" IS NULL OR e."validFrom" <= $2::timestamp)
       AND (e."validUntil" IS NULL OR e."validUntil" >= $2::timestamp)`
    : ''
  const categoryClause = categorySlug ? `AND c.slug = $3` : ''
  const tableClause = tableSlug ? `AND t.slug = $${categorySlug ? 4 : 3}` : ''
  const adminFields = isAdmin ? ', e.notes, e.metadata' : ''

  const params: unknown[] = [q, now]
  if (categorySlug) params.push(categorySlug)
  if (tableSlug) params.push(tableSlug)
  params.push(limit)

  const sql = `
    WITH scored AS (
      SELECT
        e.id, e.code, e."labelFr", e."labelNl", e."labelDe", e."labelEn",
        e."validFrom", e."validUntil"${adminFields},
        t.slug AS "tableSlug", t."labelFr" AS "tableLabelFr", t."labelNl" AS "tableLabelNl",
        t.prefix AS "tablePrefix",
        t."publishedRevision" AS "tableRevision", t."lastImportedAt" AS "tablePublishedAt",
        ${isAdmin ? 't."lastImportSource" AS "tableImportSource",' : ''}
        c.slug AS "categorySlug", c."labelFr" AS "categoryLabelFr", c."labelNl" AS "categoryLabelNl",
        -- Match exact code → boost maximal
        CASE WHEN LOWER(e.code) = LOWER($1) THEN 10.0
             -- Préfixe code
             WHEN LOWER(e.code) LIKE LOWER($1) || '%' THEN 5.0
             -- Préfixe label FR/NL
             WHEN LOWER(e."labelFr") LIKE LOWER($1) || '%' THEN 3.0
             WHEN LOWER(e."labelNl") LIKE LOWER($1) || '%' THEN 3.0
             -- Substring sur n'importe quel champ
             WHEN e.code ILIKE '%' || $1 || '%'
               OR e."labelFr" ILIKE '%' || $1 || '%'
               OR e."labelNl" ILIKE '%' || $1 || '%'
               OR (e."labelDe" IS NOT NULL AND e."labelDe" ILIKE '%' || $1 || '%')
               OR (e."labelEn" IS NOT NULL AND e."labelEn" ILIKE '%' || $1 || '%')
             THEN 1.5
             -- Similarité fuzzy (tolère fautes de frappe)
             ELSE GREATEST(
               similarity(e.code, $1) * 1.5,
               similarity(e."labelFr", $1),
               similarity(e."labelNl", $1),
               similarity(COALESCE(e."labelDe", ''), $1),
               similarity(COALESCE(e."labelEn", ''), $1)
             )
        END AS similarity_score
      FROM "LookupEntry" e
      INNER JOIN "LookupTable" t ON t.id = e."tableId"
      INNER JOIN "LookupCategory" c ON c.id = t."categoryId"
      WHERE (
        -- pg_trgm pour tolérer fautes (utilise les index GIN)
        e.code % $1
        OR e."labelFr" % $1
        OR e."labelNl" % $1
        OR (e."labelDe" IS NOT NULL AND e."labelDe" % $1)
        OR (e."labelEn" IS NOT NULL AND e."labelEn" % $1)
        -- Substring direct (récupère les cas où pg_trgm rate)
        OR e.code ILIKE '%' || $1 || '%'
        OR e."labelFr" ILIKE '%' || $1 || '%'
        OR e."labelNl" ILIKE '%' || $1 || '%'
      )
      ${validClause}
      ${categoryClause}
      ${tableClause}
    )
    SELECT * FROM scored
    WHERE similarity_score >= 0.3
    ORDER BY similarity_score DESC, code ASC
    LIMIT $${params.length}
  `

  // Cache mémoire 60s par combinaison de params : la recherche fuzzy
  // pg_trgm + scoring est lourde, et les lookups changent rarement (seed
  // officiel). Le HTTP Cache-Control est déjà posé mais peut être bypass
  // par cache: 'no-store' côté client — ce cache mémoire couvre ce cas.
  let rows: SearchResultRow[]
  try {
    rows = await withDbRetry(() => prisma.$queryRawUnsafe<SearchResultRow[]>(sql, ...params))
  } catch (error) {
    console.error('[lookup/search] error:', error)
    return NextResponse.json({ error: 'Service Lookup indisponible' }, { status: 503, headers: { ...responseHeaders, 'Cache-Control': 'no-store' } })
  }

  // Reshape pour matcher le format d'avant
  const results = rows.map((r) => ({
    id: r.id,
    code: r.code,
    labelFr: r.labelFr,
    labelNl: r.labelNl,
    labelDe: r.labelDe,
    labelEn: r.labelEn,
    validFrom: r.validFrom,
    validUntil: r.validUntil,
    ...(isAdmin ? { notes: r.notes, metadata: r.metadata } : {}),
    similarity: r.similarity_score,
    table: {
      slug: (r as unknown as { tableSlug: string }).tableSlug,
      labelFr: (r as unknown as { tableLabelFr: string }).tableLabelFr,
      labelNl: (r as unknown as { tableLabelNl: string }).tableLabelNl,
      prefix: (r as unknown as { tablePrefix: string }).tablePrefix,
      publishedRevision: (r as unknown as { tableRevision: number }).tableRevision,
      publishedAt: (r as unknown as { tablePublishedAt: Date | null }).tablePublishedAt,
      ...(isAdmin ? { importSource: (r as unknown as { tableImportSource: string | null }).tableImportSource } : {}),
      category: {
        slug: (r as unknown as { categorySlug: string }).categorySlug,
        labelFr: (r as unknown as { categoryLabelFr: string }).categoryLabelFr,
        labelNl: (r as unknown as { categoryLabelNl: string }).categoryLabelNl,
      },
    },
  }))

  return NextResponse.json(
    { results, total: results.length, truncated: results.length >= limit, ...(validOnly ? { asOf: effectiveDate } : {}) },
    { headers: responseHeaders }
  )
}

/**
 * Mode browse : retourne toutes les entrées d'une table, triées par code.
 * Pas de scoring (toutes ont similarity = 1).
 */
async function browseByTable({
  tableSlug,
  validOnly,
  limit,
  asOf,
  isAdmin,
}: {
  tableSlug: string
  validOnly: boolean
  limit: number
  asOf?: string
  isAdmin: boolean
}) {
  const { date: now, day: effectiveDate } = parseLookupCivilDate(asOf)
  const validFilter = validOnly
    ? {
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
        ],
      }
    : {}
  const entries = await withDbRetry(() =>
    prisma.lookupEntry.findMany({
      where: { table: { slug: tableSlug }, ...validFilter },
      select: {
        id: true, code: true, labelFr: true, labelNl: true, labelDe: true,
        labelEn: true, validFrom: true, validUntil: true,
        ...(isAdmin ? { notes: true, metadata: true } : {}),
        table: {
          select: {
            slug: true, labelFr: true, labelNl: true, prefix: true,
            publishedRevision: true, lastImportedAt: true,
            ...(isAdmin ? { lastImportSource: true } : {}),
            category: { select: { slug: true, labelFr: true, labelNl: true } },
          },
        },
      },
      orderBy: { code: 'asc' },
      take: limit,
    })
  )
  const total = await withDbRetry(() =>
    prisma.lookupEntry.count({
      where: { table: { slug: tableSlug }, ...validFilter },
    })
  )
  const results = entries.map((e) => ({
    id: e.id,
    code: e.code,
    labelFr: e.labelFr,
    labelNl: e.labelNl,
    labelDe: e.labelDe,
    labelEn: e.labelEn,
    validFrom: e.validFrom,
    validUntil: e.validUntil,
    ...(isAdmin ? { notes: e.notes, metadata: e.metadata as Record<string, string> | null } : {}),
    similarity: 1,
    table: {
      slug: e.table.slug,
      labelFr: e.table.labelFr,
      labelNl: e.table.labelNl,
      prefix: e.table.prefix,
      publishedRevision: e.table.publishedRevision,
      publishedAt: e.table.lastImportedAt,
      ...(isAdmin ? { importSource: e.table.lastImportSource } : {}),
      category: {
        slug: e.table.category.slug,
        labelFr: e.table.category.labelFr,
        labelNl: e.table.category.labelNl,
      },
    },
  }))
  return NextResponse.json(
    { results, total, truncated: total > limit, ...(validOnly ? { asOf: effectiveDate } : {}) },
    { headers: jsonHeaders }
  )
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = parseDateOnly(value)
  return date.toISOString().slice(0, 10) === value
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

async function sanitizePublicSearchResponse(response: NextResponse): Promise<NextResponse> {
  const body = await response.json()
  return NextResponse.json({
    ...body,
    ...projectPublicLookupSearch(body),
  }, { headers: publicJsonHeaders, status: response.status })
}
