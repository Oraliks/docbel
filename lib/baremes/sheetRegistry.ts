// Registre des feuilles de barème consultables côté public + sélection du
// builder de matrice adapté à chaque forme.

import type { ActiveBaremeData } from './getActiveBaremeData'
import type { BaremeCategory } from './types'
import {
  buildAnbMatrix,
  buildFlatMatrix,
  buildHourlyMatrix,
  type AllocationMatrixData,
} from './allocationMatrix'

export interface SheetEntry {
  /** Slug d'URL (la 1ʳᵉ entrée vit sur /outils/bareme-chomage, les autres sur /[slug]). */
  slug: string
  navLabel: string
  category: BaremeCategory
  builder: 'anb' | 'flat' | 'hourly'
}

// Ordre = ordre d'affichage dans la navigation inter-feuilles.
export const BAREME_SHEETS: SheetEntry[] = [
  { slug: 'chomage-complet', navLabel: 'Chômage complet', category: 'full_unemployment', builder: 'anb' },
  { slug: 'mi-temps', navLabel: 'Mi-temps', category: 'half_unemployment', builder: 'anb' },
  { slug: 'temporaire', navLabel: 'Chômage temporaire', category: 'temporary_unemployment_full', builder: 'flat' },
  { slug: 'categorie-speciale', navLabel: 'Catégories spéciales', category: 'special_category_full', builder: 'flat' },
  { slug: 'salaires-horaires', navLabel: 'Salaires horaires', category: 'hourly_wage', builder: 'hourly' },
]

/** Slug de la feuille servie sur la racine /outils/bareme-chomage. */
export const ROOT_SHEET_SLUG = 'chomage-complet'

export function findSheet(slug: string): SheetEntry | undefined {
  return BAREME_SHEETS.find((s) => s.slug === slug)
}

/** href public d'une feuille (racine pour chomage-complet, sous-route sinon). */
export function sheetHref(slug: string): string {
  return slug === ROOT_SHEET_SLUG ? '/outils/bareme-chomage' : `/outils/bareme-chomage/${slug}`
}

/** Construit la matrice d'une feuille à partir des données publiées. */
export function buildMatrixForEntry(
  entry: SheetEntry,
  data: ActiveBaremeData
): AllocationMatrixData | null {
  const amounts = data.amountsByCategory[entry.category] ?? []
  switch (entry.builder) {
    case 'anb':
      return buildAnbMatrix(amounts, entry.category, data.multiplicateur)
    case 'flat':
      return buildFlatMatrix(amounts, entry.category, data.multiplicateur)
    case 'hourly':
      return buildHourlyMatrix(amounts, data.multiplicateur)
  }
}
