import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'

export const runtime = 'nodejs'
const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=60',
}

/**
 * Historique des versions d'un code dans une table de lookup.
 *
 * Public (pas d'auth, comme resolve) : sert à afficher l'évolution d'un libellé
 * ONEM au fil du temps (changements de description, périodes de validité).
 *
 * Params :
 *   - id   : identifiant de la table (route)
 *   - code : code recherché en correspondance EXACTE (query, trim).
 *            Le match exact est volontaire pour ne pas confondre '153,1' et '153,10'.
 *
 * Réponse 200 : { code, count, versions: [...] }
 * Réponse 400 si le code est manquant.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')?.trim()

  if (!code) {
    return NextResponse.json(
      { error: 'code requis' },
      { status: 400, headers: jsonHeaders }
    )
  }

  const versions = await withDbRetry(() =>
    prisma.lookupEntry.findMany({
      where: { tableId: id, code },
      orderBy: [{ validFrom: 'desc' }],
      select: {
        labelFr: true,
        labelNl: true,
        labelDe: true,
        labelEn: true,
        validFrom: true,
        validUntil: true,
        metadata: true,
      },
    })
  )

  return NextResponse.json(
    { code, count: versions.length, versions },
    { headers: jsonHeaders }
  )
}
