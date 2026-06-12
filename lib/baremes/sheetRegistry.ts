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
  slug: string
  navLabel: string
  /** Titre long affiché sur la carte du hub. */
  title: string
  description: string
  /** Regroupement sur le hub. */
  group: string
  category: BaremeCategory
  builder: 'anb' | 'flat' | 'hourly'
}

// Ordre = ordre d'affichage (nav + hub).
export const BAREME_SHEETS: SheetEntry[] = [
  {
    slug: 'chomage-complet',
    navLabel: 'Chômage complet',
    title: 'Allocations de chômage complet',
    description: "Montant journalier de l'allocation entière, par code, situation familiale et tranche salariale.",
    group: 'Allocations de chômage',
    category: 'full_unemployment',
    builder: 'anb',
  },
  {
    slug: 'mi-temps',
    navLabel: 'Mi-temps',
    title: 'Chômage complet — mi-temps',
    description: 'Allocation sur base d’un travail à temps partiel (demi-allocation).',
    group: 'Allocations de chômage',
    category: 'half_unemployment',
    builder: 'anb',
  },
  {
    slug: 'temporaire',
    navLabel: 'Chômage temporaire',
    title: 'Chômage temporaire',
    description: 'Montants journaliers du chômage temporaire (force majeure, économique…).',
    group: 'Allocations de chômage',
    category: 'temporary_unemployment_full',
    builder: 'flat',
  },
  {
    slug: 'categorie-speciale',
    navLabel: 'Catégories spéciales',
    title: 'Catégories spéciales',
    description: 'Catégories particulières : travailleurs portuaires, pêcheurs de mer, SWT…',
    group: 'Allocations de chômage',
    category: 'special_category_full',
    builder: 'flat',
  },
  {
    slug: 'salaires-horaires',
    navLabel: 'Salaires horaires',
    title: 'Salaires horaires de référence',
    description: 'Salaire horaire par tranche et régime hebdomadaire (35 à 40 h).',
    group: 'Salaires de référence',
    category: 'hourly_wage',
    builder: 'hourly',
  },
]

export function findSheet(slug: string): SheetEntry | undefined {
  return BAREME_SHEETS.find((s) => s.slug === slug)
}

/** href public d'une feuille (toutes sous /outils/bareme-chomage/[slug]). */
export function sheetHref(slug: string): string {
  return `/outils/bareme-chomage/${slug}`
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
