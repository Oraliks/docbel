/**
 * Construction du `where` Prisma pour les entrées d'une LookupTable, partagé
 * entre la route de détail (`GET /api/lookup/tables/[id]`) et l'export CSV
 * (`GET /api/lookup/tables/[id]/export`). Centralisé ici pour que la liste
 * affichée et le fichier exporté appliquent EXACTEMENT les mêmes filtres.
 *
 * Tous les filtres sont optionnels et se combinent (ET logique). Pensés pour
 * la vue table partenaire (refonte façon services.onem.be/lookupweb).
 */

export interface EntryFilterParams {
  /** Recherche large code + labelFr + labelNl (champ unique historique). */
  q?: string | null
  /** Filtre ciblé "Code" : préfixe, insensible à la casse. */
  code?: string | null
  /** Filtre ciblé "Description" : substring dans FR/NL/DE/EN. */
  desc?: string | null
  /** ISO date — entrées valides à cette date (ignoré si includeAll). */
  validOn?: string | null
  /** "none" = validUntil null · "filled" = validUntil non null. */
  endDate?: string | null
  /** ISO date — entrées dont updatedAt (édition Beldoc) >= cette date. */
  modifiedSince?: string | null
  /** true = inclut les entrées expirées (pas de fenêtre de validité). */
  includeAll?: boolean
}

/** Type structurel du `where` (évite `any`, reste compatible Prisma). */
export interface EntryWhere {
  tableId: string
  OR?: Array<Record<string, unknown>>
  AND?: Array<Record<string, unknown>>
  code?: Record<string, unknown>
  validUntil?: Record<string, unknown> | null
  updatedAt?: Record<string, unknown>
}

/**
 * Lit les filtres depuis des URLSearchParams (clé → param). Pratique pour les
 * routes : `extractEntryFilters(new URL(req.url).searchParams)`.
 */
export function extractEntryFilters(searchParams: URLSearchParams): EntryFilterParams {
  return {
    q: searchParams.get('q'),
    code: searchParams.get('code'),
    desc: searchParams.get('desc'),
    validOn: searchParams.get('validOn'),
    endDate: searchParams.get('endDate'),
    modifiedSince: searchParams.get('modifiedSince'),
    includeAll: searchParams.get('includeAll') === 'true',
  }
}

export function buildEntryWhere(tableId: string, p: EntryFilterParams): EntryWhere {
  const where: EntryWhere = { tableId }
  const and: Array<Record<string, unknown>> = []

  const q = p.q?.trim()
  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { labelFr: { contains: q, mode: 'insensitive' } },
      { labelNl: { contains: q, mode: 'insensitive' } },
    ]
  }

  const code = p.code?.trim()
  if (code) {
    where.code = { startsWith: code, mode: 'insensitive' }
  }

  const desc = p.desc?.trim()
  if (desc) {
    and.push({
      OR: [
        { labelFr: { contains: desc, mode: 'insensitive' } },
        { labelNl: { contains: desc, mode: 'insensitive' } },
        { labelDe: { contains: desc, mode: 'insensitive' } },
        { labelEn: { contains: desc, mode: 'insensitive' } },
      ],
    })
  }

  if (p.endDate === 'none') {
    where.validUntil = null
  } else if (p.endDate === 'filled') {
    where.validUntil = { not: null }
  }

  if (p.modifiedSince) {
    const since = new Date(p.modifiedSince)
    if (!Number.isNaN(since.getTime())) {
      where.updatedAt = { gte: since }
    }
  }

  if (p.validOn && !p.includeAll) {
    const validOn = new Date(p.validOn)
    if (!Number.isNaN(validOn.getTime())) {
      and.push(
        { OR: [{ validFrom: null }, { validFrom: { lte: validOn } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: validOn } }] }
      )
    }
  } else if (!p.includeAll) {
    const now = new Date()
    and.push(
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validUntil: null }, { validUntil: { gte: now } }] }
    )
  }

  if (and.length > 0) where.AND = and
  return where
}
