import { NextRequest, NextResponse } from 'next/server'
import { gzipSync } from 'zlib'
import { prisma, withDbRetry } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/utils/rate-limit'
import { tooManyRequests } from '@/lib/api/rate-limit-response'
import { lookupRepresentationEtag } from '@/lib/lookup/projections'

export const runtime = 'nodejs'

/**
 * Bundle complet du référentiel lookup en un seul JSON (gzippé).
 *
 * Usage type :
 *   curl https://beldoc.../api/lookup/bundle.json --compressed > lookup.json
 *
 * Export public des seules définitions et périodes publiables. Les notes et
 * métadonnées libres ne sont jamais incluses dans ce bundle.
 *
 * Query params :
 *   - validOnly=true  (défaut) : exclut les entrées expirées
 *   - includeNotes=true        : rejeté (les notes admin ne sont jamais publiques)
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rateLimit = await checkRateLimit(`lookup-bundle:${ip}`, { windowMs: 60_000, max: 10 })
  if (!rateLimit.ok) return tooManyRequests({ limit: 10, resetAt: rateLimit.resetAt })

  const { searchParams } = new URL(req.url)
  const validOnly = searchParams.get('validOnly') !== 'false'
  if (searchParams.get('includeNotes') === 'true') {
    return NextResponse.json({ error: 'Les notes internes ne sont pas exportables' }, {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const now = new Date()

  const categories = await withDbRetry(() =>
    prisma.lookupCategory.findMany({
      orderBy: { order: 'asc' },
      take: 100,
      include: {
        tables: {
          orderBy: [{ group: 'asc' }, { labelFr: 'asc' }],
          take: 500,
          select: {
            slug: true,
            prefix: true,
            labelFr: true,
            labelNl: true,
            group: true,
            entriesCount: true,
            updatedLabel: true,
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

  const entries: Array<{
    code: string; labelFr: string; labelNl: string; labelDe: string | null;
    labelEn: string | null; validFrom: Date | null; validUntil: Date | null;
    table: { slug: string };
  }> = []
  let cursor: string | undefined
  while (true) {
    const chunk = await withDbRetry(() => prisma.lookupEntry.findMany({
      where,
      orderBy: { id: 'asc' },
      take: 1000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, code: true, labelFr: true, labelNl: true, labelDe: true,
        labelEn: true, validFrom: true, validUntil: true,
        table: { select: { slug: true } },
      },
    }))
    if (chunk.length === 0) break
    entries.push(...chunk)
    cursor = chunk[chunk.length - 1].id
    if (chunk.length < 1000) break
  }

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
    })
  }

  const bundle = {
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
        updatedLabel: t.updatedLabel,
        entries: entriesByTable[t.slug] ?? [],
      })),
    })),
  }

  // The validator covers the exact public representation, including variants.
  const json = JSON.stringify(bundle)
  const etag = lookupRepresentationEtag(json)
  const ifNoneMatch = req.headers.get('if-none-match')
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        Vary: 'Accept-Encoding',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
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
        'Cache-Control': 'public, max-age=0, must-revalidate',
        Vary: 'Accept-Encoding',
        ETag: etag,
        'X-Bundle-Entries': String(entries.length),
        'X-Bundle-Tables': String(bundle.counts.tables),
      },
    })
  }

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      Vary: 'Accept-Encoding',
      ETag: etag,
      'X-Bundle-Entries': String(entries.length),
    },
  })
}
