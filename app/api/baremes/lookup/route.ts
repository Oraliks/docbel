import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getActiveBaremeData } from '@/lib/baremes/getActiveBaremeData'
import type { BaremeCategory } from '@/lib/baremes/types'

export const runtime = 'nodejs'
// Le résultat dépend des paramètres de requête : interroger la DB à l'exécution,
// pas pendant le build. Le cache mémoire des barèmes et les headers CDN restent actifs.
export const dynamic = 'force-dynamic'

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  // Chaque réponse est revalidée : un changement de publication/rollback ne
  // peut pas rester servi par un CDN pendant une fenêtre stale arbitraire.
  'Cache-Control': 'no-cache, max-age=0, must-revalidate',
}

function etagForRepresentation(fileId: string, filters: Record<string, string | null>): string {
  const representation = JSON.stringify(filters)
  const fingerprint = createHash('sha256').update(representation).digest('base64url').slice(0, 16)
  return `"bareme-${fileId}-${fingerprint}"`
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
  // La route publique ne réutilise pas le cache mémoire d'une autre instance :
  // l'ETag permet la revalidation HTTP sans servir une ancienne publication.
  const data = await getActiveBaremeData({ force: true })
  if (!data) {
    return NextResponse.json(
      { error: 'Aucune version publiée', amounts: [] },
      { status: 404, headers: jsonHeaders }
    )
  }

  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const category = searchParams.get('category') as BaremeCategory | null
  const allocationCode = searchParams.get('allocationCode')
  const salaryCode = searchParams.get('salaryCode')
  const article = searchParams.get('article')
  const etag = etagForRepresentation(data.fileId, {
    key,
    category,
    allocationCode,
    salaryCode,
    article,
  })
  const ifNoneMatch = req.headers.get('if-none-match')
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ...jsonHeaders, ETag: etag },
    })
  }

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
