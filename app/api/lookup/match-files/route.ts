import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/auth-check'
import { matchAllFileNames } from '@/lib/lookup/matchFileName'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

/**
 * Pour une liste de noms de fichiers, retourne pour chacun la LookupTable
 * candidate (ou null) basée sur un match heuristique.
 *
 * Utilisé par la page batch upload pour pré-remplir le dropdown table cible.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  try {
    const body = (await req.json()) as { fileNames: string[] }
    if (!Array.isArray(body.fileNames)) {
      return NextResponse.json(
        { error: 'fileNames doit être un tableau' },
        { status: 400, headers: jsonHeaders }
      )
    }

    const tables = await withDbRetry(() =>
      prisma.lookupTable.findMany({
        select: {
          id: true,
          slug: true,
          prefix: true,
          labelFr: true,
          labelNl: true,
          exportName: true,
        },
      })
    )

    const matches = matchAllFileNames(body.fileNames, tables)
    return NextResponse.json({ matches }, { headers: jsonHeaders })
  } catch (err) {
    console.error('[lookup/match-files] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: jsonHeaders }
    )
  }
}
