import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'
import { memoCache } from '@/lib/memo-cache'

export const runtime = 'nodejs'
const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
}

interface SearchResultRow {
  id: string
  code: string
  labelFr: string
  labelNl: string
  labelDe: string | null
  labelEn: string | null
  validFrom: Date | null
  validUntil: Date | null
  notes: string | null
  metadata: Record<string, string> | null
  table: {
    slug: string
    labelFr: string
    labelNl: string
    prefix: string
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
  const q = searchParams.get('q')?.trim() ?? ''
  const validOnly = searchParams.get('validOnly') !== 'false'
  const categorySlug = searchParams.get('categorySlug')?.trim()
  const tableSlug = searchParams.get('tableSlug')?.trim()
  const limit = Math.min(
    200,
    parseInt(searchParams.get('limit') ?? '50', 10) || 50
  )

  // Mode "browse par module" : si pas de query mais une table sélectionnée,
  // on retourne toutes les entrées de cette table (sans scoring). Permet au
  // partenaire de parcourir un module entier sans avoir à taper quelque chose.
  if (!q || q.length < 2) {
    if (!tableSlug) {
      return NextResponse.json({ results: [], total: 0 }, { headers: jsonHeaders })
    }
    return browseByTable({ tableSlug, validOnly, limit })
  }

  // Requête combinée pg_trgm + ILIKE pour balance précision/rappel :
  //  - Match EXACT sur code → boost x10 (toujours en haut)
  //  - Préfixe sur code (code commence par q) → boost x5
  //  - Préfixe sur label (label commence par q) → boost x3
  //  - ILIKE %q% sur n'importe quel champ → match substring (assure le rappel)
  //  - Similarité pg_trgm avec seuil 0.3 → fuzzy match (tolère fautes)
  //
  // On élimine les matches de très faible pertinence (score final < 0.3 après boost).
  const now = new Date()
  const validClause = validOnly
    ? `AND (e."validFrom" IS NULL OR e."validFrom" <= $2::timestamp)
       AND (e."validUntil" IS NULL OR e."validUntil" >= $2::timestamp)`
    : ''
  const categoryClause = categorySlug ? `AND c.slug = $3` : ''
  const tableClause = tableSlug ? `AND t.slug = $${categorySlug ? 4 : 3}` : ''

  const params: unknown[] = [q, now]
  if (categorySlug) params.push(categorySlug)
  if (tableSlug) params.push(tableSlug)
  params.push(limit)

  const sql = `
    WITH scored AS (
      SELECT
        e.id, e.code, e."labelFr", e."labelNl", e."labelDe", e."labelEn",
        e."validFrom", e."validUntil", e.notes, e.metadata,
        t.slug AS "tableSlug", t."labelFr" AS "tableLabelFr", t."labelNl" AS "tableLabelNl",
        t.prefix AS "tablePrefix",
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
  const cacheKey = `lookup:search:${q}:${validOnly}:${categorySlug ?? ''}:${tableSlug ?? ''}:${limit}`
  const rows = await memoCache(cacheKey, 60_000, () =>
    withDbRetry(() => prisma.$queryRawUnsafe<SearchResultRow[]>(sql, ...params))
  )

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
    notes: r.notes,
    metadata: r.metadata,
    similarity: r.similarity_score,
    table: {
      slug: (r as unknown as { tableSlug: string }).tableSlug,
      labelFr: (r as unknown as { tableLabelFr: string }).tableLabelFr,
      labelNl: (r as unknown as { tableLabelNl: string }).tableLabelNl,
      prefix: (r as unknown as { tablePrefix: string }).tablePrefix,
      category: {
        slug: (r as unknown as { categorySlug: string }).categorySlug,
        labelFr: (r as unknown as { categoryLabelFr: string }).categoryLabelFr,
        labelNl: (r as unknown as { categoryLabelNl: string }).categoryLabelNl,
      },
    },
  }))

  return NextResponse.json(
    { results, total: results.length, truncated: results.length >= limit },
    { headers: jsonHeaders }
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
}: {
  tableSlug: string
  validOnly: boolean
  limit: number
}) {
  const now = new Date()
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
      include: {
        table: { include: { category: true } },
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
    notes: e.notes,
    metadata: e.metadata as Record<string, string> | null,
    similarity: 1,
    table: {
      slug: e.table.slug,
      labelFr: e.table.labelFr,
      labelNl: e.table.labelNl,
      prefix: e.table.prefix,
      category: {
        slug: e.table.category.slug,
        labelFr: e.table.category.labelFr,
        labelNl: e.table.category.labelNl,
      },
    },
  }))
  return NextResponse.json(
    { results, total, truncated: total > limit },
    { headers: jsonHeaders }
  )
}
