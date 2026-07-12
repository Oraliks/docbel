// =====================================================================
//  Type de bloc → catégorie source (PUR, server-safe).
//
//  Dérivé des 18 `schemas.ts` (Zod pur, sans composant React) : donne, pour
//  chaque type de bloc, la catégorie d'où il provient — SANS importer les
//  composants. Sert au rendu public à *lazy-loader* le bon barrel de catégorie
//  (voir components/page-builder/block-render-lazy.tsx) au lieu de charger les
//  133 blocs. Aucune liste par bloc écrite à la main : on lit les clés des
//  schémas (source de vérité), donc pas de dérive.
// =====================================================================

import { textSchemas } from '@/components/page-blocks/text/schemas'
import { textExtraSchemas } from '@/components/page-blocks/text-extra/schemas'
import { layoutSchemas } from '@/components/page-blocks/layout/schemas'
import { mediaSchemas } from '@/components/page-blocks/media/schemas'
import { mediaExtraSchemas } from '@/components/page-blocks/media-extra/schemas'
import { uiSchemas } from '@/components/page-blocks/ui/schemas'
import { marketingSchemas } from '@/components/page-blocks/marketing/schemas'
import { marketingExtraSchemas } from '@/components/page-blocks/marketing-extra/schemas'
import { docbelSchemas } from '@/components/page-blocks/docbel/schemas'
import { docbelExtraSchemas } from '@/components/page-blocks/docbel-extra/schemas'
import { chartsSchemas } from '@/components/page-blocks/charts/schemas'
import { engagementSchemas } from '@/components/page-blocks/engagement/schemas'
import { navigationSchemas } from '@/components/page-blocks/navigation/schemas'
import { editorialSchemas } from '@/components/page-blocks/editorial/schemas'
import { utilitySchemas } from '@/components/page-blocks/utility/schemas'
import { flexibleSchemas } from '@/components/page-blocks/flexible/schemas'
import { globalSchemas } from '@/components/page-blocks/global/schemas'
import { onemSchemas } from '@/components/page-blocks/onem/schemas'

/** Clé de catégorie source — DOIT correspondre aux clés du map de barrels
 *  dans block-render-lazy.tsx. */
export type CategorySource =
  | 'text'
  | 'textExtra'
  | 'layout'
  | 'media'
  | 'mediaExtra'
  | 'ui'
  | 'marketing'
  | 'marketingExtra'
  | 'docbel'
  | 'docbelExtra'
  | 'charts'
  | 'engagement'
  | 'navigation'
  | 'editorial'
  | 'utility'
  | 'flexible'
  | 'global'
  | 'onem'

const SOURCES: Record<CategorySource, Record<string, unknown>> = {
  text: textSchemas,
  textExtra: textExtraSchemas,
  layout: layoutSchemas,
  media: mediaSchemas,
  mediaExtra: mediaExtraSchemas,
  ui: uiSchemas,
  marketing: marketingSchemas,
  marketingExtra: marketingExtraSchemas,
  docbel: docbelSchemas,
  docbelExtra: docbelExtraSchemas,
  charts: chartsSchemas,
  engagement: engagementSchemas,
  navigation: navigationSchemas,
  editorial: editorialSchemas,
  utility: utilitySchemas,
  flexible: flexibleSchemas,
  global: globalSchemas,
  onem: onemSchemas,
}

/** type de bloc → catégorie source. */
export const BLOCK_CATEGORY_SOURCE: Record<string, CategorySource> = (() => {
  const map: Record<string, CategorySource> = {}
  for (const [cat, schemas] of Object.entries(SOURCES) as [CategorySource, Record<string, unknown>][]) {
    for (const type of Object.keys(schemas)) map[type] = cat
  }
  return map
})()

/** Catégorie source d'un type, ou undefined si le type est inconnu. */
export function categoryOf(type: string): CategorySource | undefined {
  return BLOCK_CATEGORY_SOURCE[type]
}
