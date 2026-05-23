import { NextRequest, NextResponse } from 'next/server'
import { getLookupEntry } from '@/lib/lookup/getLookupEntry'

export const runtime = 'nodejs'
const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
}

/**
 * Résout un code ONEM en libellé multi-langues.
 *
 * Query params :
 *   - tableSlug : slug de la table (ex: "s04-s36-article-indemnisation")
 *   - code      : code (ex: "44")
 *
 * Réponse 200 : { entry: { code, labelFr, labelNl, labelDe, labelEn, ... } }
 * Réponse 404 si pas trouvé.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tableSlug = searchParams.get('tableSlug')?.trim()
  const code = searchParams.get('code')?.trim()

  if (!tableSlug || !code) {
    return NextResponse.json(
      { error: 'tableSlug et code requis' },
      { status: 400, headers: jsonHeaders }
    )
  }

  const entry = await getLookupEntry(tableSlug, code)
  if (!entry) {
    return NextResponse.json(
      { entry: null, error: 'Code introuvable' },
      { status: 404, headers: jsonHeaders }
    )
  }

  return NextResponse.json({ entry }, { headers: jsonHeaders })
}
