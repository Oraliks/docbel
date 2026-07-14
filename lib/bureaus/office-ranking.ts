import { computeOpenStatus } from './types'
import { TYPE_ORDER, type OfficeItem } from './finder-model'
import { demarcheToOfficeTypes, type Demarche } from './demarche-map'

export interface RankedOffice extends OfficeItem {
  number: number
  isRecommended: boolean
}

/** Classe les bureaux pour une démarche. Priorité (déterministe) :
 *  1. compétence territoriale (isCompetent)
 *  2. statut d'ouverture (ouvert avant fermé)
 *  3. distance croissante (coords absentes après)
 *  4. ordre de type stable (TYPE_ORDER)
 * Puis numérote 1..N ; le rang 1 est le bureau recommandé. */
export function rankOffices(items: OfficeItem[], opts: { demarche: Demarche; at?: Date }): RankedOffice[] {
  const allowed = demarcheToOfficeTypes(opts.demarche)
  const filtered = allowed === 'all' ? items : items.filter((i) => (allowed as string[]).includes(i.type))
  // Référence temporelle figée une seule fois pour tout le tri (au lieu de
  // laisser `computeOpenStatus` retomber sur son `new Date()` par défaut à
  // chaque appel) : un comparateur doit être pur pour un même appel de
  // `rankOffices`, sinon `Array.prototype.sort` peut produire un ordre
  // incohérent si l'horloge franchit une frontière ouverture/fermeture
  // pendant le tri.
  const at = opts.at ?? new Date()
  const isOpen = (i: OfficeItem) => computeOpenStatus(i.bureau.hours, at).state === 'open'
  const typeIdx = (i: OfficeItem) => TYPE_ORDER.indexOf(i.type)

  const sorted = [...filtered].sort((a, b) => {
    if (a.isCompetent !== b.isCompetent) return a.isCompetent ? -1 : 1
    const ao = isOpen(a), bo = isOpen(b)
    if (ao !== bo) return ao ? -1 : 1
    if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm
    if (a.distanceKm != null && b.distanceKm == null) return -1
    if (a.distanceKm == null && b.distanceKm != null) return 1
    return typeIdx(a) - typeIdx(b)
  })

  return sorted.map((item, idx) => ({ ...item, number: idx + 1, isRecommended: idx === 0 }))
}

export function getRecommendedOffice(ranked: RankedOffice[]): RankedOffice | null {
  return ranked[0] ?? null
}
