'use client'

import { defineBlock } from '@/lib/page-builder/block-definition'
import { globalRefSchema as schema } from './schemas'

/**
 * `globalRef` — a live reference to a reusable GlobalBlock.
 *
 * The actual content is resolved + rendered by `BlockRenderer` (which has the
 * resolved global-blocks map via `GlobalBlocksContext`). This block's own
 * `Render`/`Fields` are only fallbacks shown when the reference can't be
 * resolved (e.g. unset id) or outside a provider.
 */
export const globalRef = defineBlock({
  type: 'globalRef',
  schema,
  defaults: { globalBlockId: '' },
  meta: {
    name: 'Bloc global',
    description: 'Référence vers un bloc réutilisable (édité à un seul endroit)',
    category: 'utility',
    icon: 'box',
  },
  Render: () => (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      Bloc global — référence non résolue.
    </div>
  ),
  Fields: () => (
    <div className="px-4 py-3 text-xs text-muted-foreground">
      Ce bloc est une référence partagée : ses modifications s’appliquent partout
      où il est utilisé.
    </div>
  ),
})
