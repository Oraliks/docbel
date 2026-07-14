import type { BureauResult, ResolveResponse } from '@/app/outils/bureaux/_components/types'

export type OfficeType = 'ONEM' | 'CPAS' | 'COMMUNE' | 'PAIEMENT' | 'SRE' | 'MUTUELLE'

export interface OfficeItem {
  id: string
  type: OfficeType
  bureau: BureauResult
  distanceKm: number | null
  isCompetent: boolean
}

/** Ordre d'affichage par défaut (quand pas de tri par distance). */
export const TYPE_ORDER: OfficeType[] = ['ONEM', 'CPAS', 'COMMUNE', 'SRE', 'PAIEMENT', 'MUTUELLE']

/**
 * Registre unique type → présentation. `labelKey` = clé i18n `public.outils`.
 * `color` = couleur catégorielle des pins/puces (esprit --chart-*, contrôlée ici,
 * jamais éparpillée dans les composants). `icon` = nom d'icône lucide-react.
 */
export const TYPE_META: Record<OfficeType, { labelKey: string; color: string; icon: string }> = {
  ONEM: { labelKey: 'bureauxTypeOnem', color: '#33406b', icon: 'Landmark' },
  CPAS: { labelKey: 'bureauxTypeCpas', color: '#7c5cff', icon: 'HeartHandshake' },
  COMMUNE: { labelKey: 'bureauxTypeCommune', color: '#22a06b', icon: 'Building2' },
  SRE: { labelKey: 'bureauxTypeSre', color: '#2563eb', icon: 'Briefcase' },
  PAIEMENT: { labelKey: 'bureauxTypePaiement', color: '#f97316', icon: 'Wallet' },
  MUTUELLE: { labelKey: 'bureauxTypeMutuelle', color: '#ec4899', icon: 'Users' },
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

/** Plafond de mutuelles/CAAMI de proximité surfacées (autres est déjà trié par
 * distance et borné à 12 côté serveur ; on garde les plus proches). */
const PROXIMITE_MUTUELLE_LIMIT = 6

export interface FlatOffice {
  bureau: BureauResult
  type: OfficeType
  /** Compétence territoriale : `true` pour les bureaux attitrés (résolus par
   * adresse), `false` pour les bureaux de proximité (mutuelles/CAAMI). */
  isCompetent: boolean
}

export function flattenResolveToOffices(data: ResolveResponse): FlatOffice[] {
  const a = data.attitre
  const out: FlatOffice[] = []
  if (a.onem) out.push({ bureau: a.onem, type: 'ONEM', isCompetent: true })
  if (a.cpas) out.push({ bureau: a.cpas, type: 'CPAS', isCompetent: true })
  if (a.commune) out.push({ bureau: a.commune, type: 'COMMUNE', isCompetent: true })
  if (a.emploiRegional) out.push({ bureau: a.emploiRegional, type: 'SRE', isCompetent: true })
  for (const op of a.organismesPaiement) out.push({ bureau: op, type: 'PAIEMENT', isCompetent: true })
  if (a.mutuelle) out.push({ bureau: a.mutuelle, type: 'MUTUELLE', isCompetent: true })

  // Mutuelles / CAAMI de proximité : le résolveur ne peuple `attitre.mutuelle`
  // qu'avec un code mutuelle explicite. En l'absence d'attitrée, on surface les
  // plus proches depuis `proximite.autres` (mélange d'organismes AUTRE : on ne
  // garde que ceux typés MUTUELLE via le code organisme). Marquées « à
  // proximité » (isCompetent=false) : ce n'est pas « votre mutuelle attitrée ».
  if (!a.mutuelle && data.proximite?.autres?.length) {
    const seen = new Set(out.map((o) => o.bureau.id))
    let added = 0
    for (const b of data.proximite.autres) {
      if (added >= PROXIMITE_MUTUELLE_LIMIT) break
      if (seen.has(b.id)) continue
      if (officeTypeOfBureau({ type: b.type, organismeCode: b.organismeCode }) === 'MUTUELLE') {
        out.push({ bureau: b, type: 'MUTUELLE', isCompetent: false })
        seen.add(b.id)
        added++
      }
    }
  }
  return out
}

export function buildOffices(
  data: ResolveResponse,
  ref: { lat: number; lng: number } | null,
): OfficeItem[] {
  const flat = flattenResolveToOffices(data)
  const items: OfficeItem[] = flat.map(({ bureau, type, isCompetent }) => ({
    id: bureau.id,
    type,
    bureau,
    distanceKm:
      ref && bureau.lat != null && bureau.lng != null
        ? haversineKm(ref, { lat: bureau.lat, lng: bureau.lng })
        : null,
    // Attitrés (résolution territoriale) = compétents ; mutuelles/CAAMI de
    // proximité = non compétents (cf. flattenResolveToOffices).
    isCompetent,
  }))
  const orderIndex = (t: OfficeType) => TYPE_ORDER.indexOf(t)
  items.sort((x, y) => {
    if (x.distanceKm != null && y.distanceKm != null) return x.distanceKm - y.distanceKm
    if (x.distanceKm != null) return -1
    if (y.distanceKm != null) return 1
    return orderIndex(x.type) - orderIndex(y.type)
  })
  return items
}

export function filterOffices(
  items: OfficeItem[],
  activeTypes: Set<OfficeType>,
  query: string,
): OfficeItem[] {
  const q = query.trim().toLowerCase()
  return items.filter((it) => {
    if (!activeTypes.has(it.type)) return false
    if (!q) return true
    const hay = `${it.bureau.name} ${it.bureau.street} ${it.bureau.city} ${it.bureau.postalCode}`.toLowerCase()
    return hay.includes(q)
  })
}

export function estimateTravel(km: number): { walkMin: number; driveMin: number } {
  return { walkMin: Math.max(1, Math.round(km * 12)), driveMin: Math.max(1, Math.round(km * 2)) }
}

/** Codes organisme → famille de guichet. Signal le plus fiable pour typer un
 * bureau ISOLÉ récupéré par id (le `type` DB brut est plus grossier :
 * SYNDICAT/PERMANENCE/AUTRE couvrent paiement, emploi ET mutuelle). */
const ORG_CODE_TO_TYPE: Record<string, OfficeType> = {
  onem: 'ONEM',
  actiris: 'SRE', forem: 'SRE', vdab: 'SRE', adg: 'SRE',
  capac: 'PAIEMENT', fgtb: 'PAIEMENT', csc: 'PAIEMENT', cgslb: 'PAIEMENT', synova: 'PAIEMENT',
  solidaris: 'MUTUELLE', mc: 'MUTUELLE', mloz: 'MUTUELLE', helan: 'MUTUELLE',
  partenamut: 'MUTUELLE', caami: 'MUTUELLE',
}

/**
 * Détermine le `OfficeType` d'un bureau isolé (récupéré par id via
 * /api/bureaux/[id], ex. clic dans l'autocomplete) pour l'affichage de la
 * fiche : icône, couleur et libellé de famille. Priorité au code organisme
 * (signal fin) ; repli sur le `type` DB brut. Best-effort et purement
 * COSMÉTIQUE — jamais un filtre de compétence territoriale.
 */
export function officeTypeOfBureau(input: { type: string; organismeCode: string | null }): OfficeType {
  const code = input.organismeCode?.toLowerCase() ?? ''
  if (code && ORG_CODE_TO_TYPE[code]) return ORG_CODE_TO_TYPE[code]
  switch (input.type) {
    case 'ONEM':
      return 'ONEM'
    case 'CPAS':
      return 'CPAS'
    case 'COMMUNE':
      return 'COMMUNE'
    case 'SYNDICAT':
    case 'PERMANENCE':
      return 'PAIEMENT'
    default:
      return 'COMMUNE'
  }
}
