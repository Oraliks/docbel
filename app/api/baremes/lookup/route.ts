import { NextRequest, NextResponse } from 'next/server'
import { getActiveBaremeData } from '@/lib/baremes/getActiveBaremeData'
import type { BaremeCategory } from '@/lib/baremes/types'

export const runtime = 'nodejs'
// Re-vérifie après 60s côté Next.js fetch cache
export const revalidate = 60

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  // Côté client/CDN : 5 min de cache "vivant" + 1h de stale-while-revalidate
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
}

/**
 * Endpoint de lookup public des barèmes officiels.
 *
 * Query params (tous optionnels — combinables) :
 *  - key            : comparisonKey exact (le plus précis)
 *  - category       : filtre par catégorie
 *  - allocationCode : filtre par code d'allocation
 *  - salaryCode     : filtre par code de tranche salariale
 *  - article        : filtre par article de loi
 *
 * Si aucun filtre → retourne toute la version publiée.
 * Réponse : { fileId, validFrom, publishedAt, amounts: [...] }
 * 404 si aucune version publiée.
 *
 * Implémente ETag basé sur fileId pour permettre 304 Not Modified.
 */
export async function GET(req: NextRequest) {
  const data = await getActiveBaremeData()
  if (!data) {
    return NextResponse.json(
      { error: 'Aucune version publiée', amounts: [] },
      { status: 404, headers: jsonHeaders }
    )
  }

  const etag = `"bareme-${data.fileId}"`
  const ifNoneMatch = req.headers.get('if-none-match')
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ...jsonHeaders, ETag: etag },
    })
  }

  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const category = searchParams.get('category') as BaremeCategory | null
  const allocationCode = searchParams.get('allocationCode')
  const salaryCode = searchParams.get('salaryCode')
  const article = searchParams.get('article')

  let amounts = data.allAmounts

  if (key) {
    amounts = amounts.filter((a) => a.comparisonKey === key)
  } else {
    if (category) amounts = amounts.filter((a) => a.category === category)
    if (allocationCode) amounts = amounts.filter((a) => a.allocationCode === allocationCode)
    if (salaryCode) {
      const code = salaryCode.toUpperCase()
      amounts = amounts.filter((a) => a.salaryCode?.toUpperCase() === code)
    }
    if (article) amounts = amounts.filter((a) => a.article === article)
  }

  return NextResponse.json(
    {
      fileId: data.fileId,
      validFrom: data.validFrom,
      publishedAt: data.publishedAt,
      fileName: data.fileName,
      count: amounts.length,
      amounts,
    },
    {
      headers: {
        ...jsonHeaders,
        ETag: etag,
      },
    }
  )
}
