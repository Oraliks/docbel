import { NextRequest, NextResponse } from 'next/server'
import { gzipSync } from 'zlib'
import { prisma, withDbRetry } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * Bundle complet du référentiel lookup en un seul JSON (gzippé).
 *
 * Usage type :
 *   curl https://beldoc.../api/lookup/bundle.json --compressed > lookup.json
 *
 * Cache CDN long (24h) car les changements sont rares. ETag basé sur le hash
 * du contenu pour invalidation propre.
 *
 * Query params :
 *   - validOnly=true  (défaut) : exclut les entrées expirées
 *   - includeNotes=true        : inclut les notes admin (sinon exclues)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const validOnly = searchParams.get('validOnly') !== 'false'
  const includeNotes = searchParams.get('includeNotes') === 'true'

  const now = new Date()

  const categories = await withDbRetry(() =>
    prisma.lookupCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        tables: {
          orderBy: [{ group: 'asc' }, { labelFr: 'asc' }],
          select: {
            slug: true,
            prefix: true,
            labelFr: true,
            labelNl: true,
            group: true,
            entriesCount: true,
            lastImportedAt: true,
          },
        },
      },
    })
  )

  // Charger toutes les entrées (filtre valides si demandé)
  const where = validOnly
    ? {
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
        ],
      }
    : {}

  const entries = await withDbRetry(() =>
    prisma.lookupEntry.findMany({
      where,
      orderBy: [{ tableId: 'asc' }, { code: 'asc' }],
      include: { table: { select: { slug: true } } },
    })
  )

  // Grouper par tableSlug
  const entriesByTable: Record<string, unknown[]> = {}
  for (const e of entries) {
    const k = e.table.slug
    if (!entriesByTable[k]) entriesByTable[k] = []
    entriesByTable[k].push({
      code: e.code,
      labelFr: e.labelFr,
      labelNl: e.labelNl,
      labelDe: e.labelDe,
      labelEn: e.labelEn,
      validFrom: e.validFrom,
      validUntil: e.validUntil,
      ...(includeNotes && e.notes ? { notes: e.notes } : {}),
    })
  }

  const bundle = {
    generatedAt: now.toISOString(),
    validOnly,
    counts: {
      categories: categories.length,
      tables: categories.reduce((sum, c) => sum + c.tables.length, 0),
      entries: entries.length,
    },
    categories: categories.map((cat) => ({
      slug: cat.slug,
      labelFr: cat.labelFr,
      labelNl: cat.labelNl,
      order: cat.order,
      tables: cat.tables.map((t) => ({
        slug: t.slug,
        prefix: t.prefix,
        labelFr: t.labelFr,
        labelNl: t.labelNl,
        group: t.group,
        entriesCount: t.entriesCount,
        lastImportedAt: t.lastImportedAt,
        entries: entriesByTable[t.slug] ?? [],
      })),
    })),
  }

  const json = JSON.stringify(bundle)
  // Hash du contenu pour ETag
  const etag = `"bundle-${entries.length}-${categories.length}-${entries[entries.length - 1]?.updatedAt?.getTime() ?? 0}"`
  const ifNoneMatch = req.headers.get('if-none-match')
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag },
    })
  }

  // Si client accepte gzip, on compresse
  const acceptEncoding = req.headers.get('accept-encoding') ?? ''
  if (acceptEncoding.includes('gzip')) {
    const compressed = gzipSync(json)
    return new NextResponse(compressed as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Encoding': 'gzip',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        ETag: etag,
        'X-Bundle-Entries': String(entries.length),
        'X-Bundle-Tables': String(bundle.counts.tables),
      },
    })
  }

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      ETag: etag,
      'X-Bundle-Entries': String(entries.length),
    },
  })
}
