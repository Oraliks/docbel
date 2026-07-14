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

export function flattenResolveToOffices(
  data: ResolveResponse,
): { bureau: BureauResult; type: OfficeType }[] {
  const a = data.attitre
  const out: { bureau: BureauResult; type: OfficeType }[] = []
  if (a.onem) out.push({ bureau: a.onem, type: 'ONEM' })
  if (a.cpas) out.push({ bureau: a.cpas, type: 'CPAS' })
  if (a.commune) out.push({ bureau: a.commune, type: 'COMMUNE' })
  if (a.emploiRegional) out.push({ bureau: a.emploiRegional, type: 'SRE' })
  for (const op of a.organismesPaiement) out.push({ bureau: op, type: 'PAIEMENT' })
  if (a.mutuelle) out.push({ bureau: a.mutuelle, type: 'MUTUELLE' })
  return out
}

export function buildOffices(
  data: ResolveResponse,
  ref: { lat: number; lng: number } | null,
): OfficeItem[] {
  const flat = flattenResolveToOffices(data)
  const items: OfficeItem[] = flat.map(({ bureau, type }) => ({
    id: bureau.id,
    type,
    bureau,
    distanceKm:
      ref && bureau.lat != null && bureau.lng != null
        ? haversineKm(ref, { lat: bureau.lat, lng: bureau.lng })
        : null,
    // Tous les items proviennent de data.attitre (résolution territoriale
    // par adresse/commune) : ils sont donc compétents par construction.
    isCompetent: true,
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
