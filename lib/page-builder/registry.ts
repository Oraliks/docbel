// =====================================================================
//  Block Registry (new) — aggregates every BlockDefinition.
// =====================================================================

import type { z } from 'zod'
import type { BlockDefinition } from './block-definition'
import type { BlockCategory } from './types'
import { textBlocks } from '@/components/page-blocks/text'
import { textExtraBlocks } from '@/components/page-blocks/text-extra'
import { layoutBlocks } from '@/components/page-blocks/layout'
import { mediaBlocks } from '@/components/page-blocks/media'
import { mediaExtraBlocks } from '@/components/page-blocks/media-extra'
import { uiBlocks } from '@/components/page-blocks/ui'
import { marketingBlocks } from '@/components/page-blocks/marketing'
import { marketingExtraBlocks } from '@/components/page-blocks/marketing-extra'
import { docbelBlocks } from '@/components/page-blocks/docbel'
import { docbelExtraBlocks } from '@/components/page-blocks/docbel-extra'
import { chartsBlocks } from '@/components/page-blocks/charts'
import { engagementBlocks } from '@/components/page-blocks/engagement'
import { navigationBlocks } from '@/components/page-blocks/navigation'
import { editorialBlocks } from '@/components/page-blocks/editorial'
import { utilityBlocks } from '@/components/page-blocks/utility'
import { flexibleBlocks } from '@/components/page-blocks/flexible'
import { globalBlocks } from '@/components/page-blocks/global'
import { onemBlocks } from '@/components/page-blocks/onem'

export const REGISTRY = {
  ...textBlocks,
  ...textExtraBlocks,
  ...layoutBlocks,
  ...mediaBlocks,
  ...mediaExtraBlocks,
  ...uiBlocks,
  ...marketingBlocks,
  ...marketingExtraBlocks,
  ...docbelBlocks,
  ...docbelExtraBlocks,
  ...chartsBlocks,
  ...engagementBlocks,
  ...navigationBlocks,
  ...editorialBlocks,
  ...utilityBlocks,
  ...flexibleBlocks,
  ...globalBlocks,
  ...onemBlocks,
} as const satisfies Record<string, BlockDefinition>

export type RegistryKey = keyof typeof REGISTRY

/** Union de tous les types de blocs — dérivée des clés du registry. */
export type BlockType = keyof typeof REGISTRY

/** Props de chaque bloc — inférées du schéma Zod de sa définition. */
export type BlockPropsMap = {
  [K in BlockType]: z.infer<(typeof REGISTRY)[K]['schema']>
}

export function getBlockDef(type: string): BlockDefinition | undefined {
  return (REGISTRY as Record<string, BlockDefinition>)[type]
}

// ─────────────────────────────────────────────────────────────────────
// Compat layer — exposes the legacy `BLOCK_REGISTRY` shape used by
// block-picker / outline / block-wrapper. Derived from the new REGISTRY.
// ─────────────────────────────────────────────────────────────────────

export interface LegacyBlockRegistryEntry<T extends BlockType = BlockType> {
  type: T
  name: string
  description: string
  category: BlockCategory
  icon: string
  shortcuts?: string[]
  defaultProps: BlockPropsMap[T]
  variants?: Array<{ id: string; name: string; description?: string }>
  canHaveChildren?: boolean
}

export type AnyBlockRegistryEntry = LegacyBlockRegistryEntry

export const BLOCK_CATEGORY_LABELS: Record<BlockCategory, string> = {
  text: 'Texte',
  media: 'Médias',
  layout: 'Mise en page',
  marketing: 'Marketing',
  ui: 'UI · shadcn',
  charts: 'Graphiques',
  engagement: 'Engagement',
  navigation: 'Navigation',
  editorial: 'Éditorial',
  docbel: 'DocBel',
  utility: 'Utilitaires',
  decorative: 'Décoratif',
  education: 'Éducation & A11y',
}

function defToEntry(def: BlockDefinition): LegacyBlockRegistryEntry {
  return {
    type: def.type as BlockType,
    name: def.meta.name,
    description: def.meta.description,
    category: def.meta.category,
    icon: def.meta.icon,
    shortcuts: def.meta.shortcuts,
    defaultProps: def.defaults as BlockPropsMap[BlockType],
    variants: def.meta.variants,
    canHaveChildren: def.meta.canHaveChildren,
  }
}

export const BLOCK_REGISTRY = Object.fromEntries(
  Object.values(REGISTRY).map((def) => [def.type, defToEntry(def as BlockDefinition)])
) as Record<BlockType, LegacyBlockRegistryEntry>

export const BLOCKS_BY_CATEGORY: Record<BlockCategory, LegacyBlockRegistryEntry[]> = (() => {
  const groups: Record<BlockCategory, LegacyBlockRegistryEntry[]> = {
    text: [],
    media: [],
    layout: [],
    marketing: [],
    ui: [],
    charts: [],
    engagement: [],
    navigation: [],
    editorial: [],
    docbel: [],
    utility: [],
    decorative: [],
    education: [],
  }
  for (const entry of Object.values(BLOCK_REGISTRY)) {
    groups[entry.category].push(entry)
  }
  return groups
})()
