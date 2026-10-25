import { NextRequest, NextResponse } from 'next/server'
import { resolveLookupEntry } from '@/lib/lookup/getLookupEntry'
import { requirePartnerOrAdminAuth } from '@/lib/auth-check'
import { privateLookupError } from '@/lib/lookup/projections'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' }

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
  const auth = await requirePartnerOrAdminAuth()
  if (!auth.isAuthorized) return privateLookupError(auth.error)

  const { searchParams } = new URL(req.url)
  const tableSlug = searchParams.get('tableSlug')?.trim()
  const code = searchParams.get('code')?.trim()
  const asOf = searchParams.get('asOf')

  if (!tableSlug || !code || tableSlug.length > 120 || code.length > 120) {
    return NextResponse.json(
      { error: 'tableSlug et code requis' },
      { status: 400, headers: jsonHeaders }
    )
  }

  try {
    const result = await resolveLookupEntry(tableSlug, code, { asOf })
    if (result.status === 'absent') {
      return NextResponse.json(
        { ...result, error: 'Code introuvable à la date demandée' },
        { status: 404, headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' } }
      )
    }
    if (result.status === 'ambiguous') {
      return NextResponse.json(result, { status: 409, headers: jsonHeaders })
    }
    const entry = result.entry
    const safeEntry = {
      id: entry.id,
      code: entry.code,
      labelFr: entry.labelFr,
      labelNl: entry.labelNl,
      labelDe: entry.labelDe,
      labelEn: entry.labelEn,
      tableSlug: entry.tableSlug,
      tableLabelFr: entry.tableLabelFr,
      categorySlug: entry.categorySlug,
      validFrom: entry.validFrom,
      validUntil: entry.validUntil,
      importSource: entry.importSource,
    }
    return NextResponse.json({ ...result, entry: safeEntry }, {
      headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' },
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Date Lookup invalide')) {
      return NextResponse.json({ error: err.message }, { status: 400, headers: jsonHeaders })
    }
    console.error('[lookup/resolve] error:', err)
    return NextResponse.json({ status: 'unavailable', entry: null, error: 'Service Lookup indisponible' }, {
      status: 503,
      headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' },
    })
  }
}
