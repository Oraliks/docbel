import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requirePartnerOrAdminAuth } from '@/lib/auth-check'
import { privateLookupError } from '@/lib/lookup/projections'

export const runtime = 'nodejs'
const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
}

/**
 * Historique des versions d'un code dans une table de lookup.
 *
 * Réservé aux professionnels autorisés et aux administrateurs : évolution d'un libellé
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
  const auth = await requirePartnerOrAdminAuth()
  if (!auth.isAuthorized) return privateLookupError(auth.error)

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')?.trim()

  if (!code || code.length > 120) {
    return NextResponse.json(
      { error: 'code requis' },
      { status: 400, headers: jsonHeaders }
    )
  }

  try {
  const versions = await withDbRetry(() =>
    prisma.lookupEntry.findMany({
      where: { tableId: id, code },
      orderBy: [{ validFrom: 'desc' }],
      take: 201,
      select: {
        labelFr: true,
        labelNl: true,
        labelDe: true,
        labelEn: true,
        validFrom: true,
        validUntil: true,
        ...(auth.user.isAdmin ? { metadata: true } : {}),
      },
    })
  )

  return NextResponse.json(
    { code, count: Math.min(versions.length, 200), truncated: versions.length > 200, versions: versions.slice(0, 200) },
    { headers: jsonHeaders }
  )
  } catch (error) {
    console.error('[lookup history] error:', error)
    return NextResponse.json({ error: 'Service Lookup indisponible' }, { status: 503, headers: jsonHeaders })
  }
}
