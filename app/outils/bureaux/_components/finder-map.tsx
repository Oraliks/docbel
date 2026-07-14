'use client'

import { CommunePanel } from './commune-panel'
import type { OfficeItem } from '@/lib/bureaus/finder-model'
import type { CommuneSummary } from './types'

/**
 * Wrapper plein-cadre autour de la carte commune existante (CommunePanel →
 * CustomBelgiumMap). Convertit OfficeItem[] (modèle plat du finder) → les
 * bureaux attendus par CommunePanel, et propage la sélection pin ↔ carte ↔
 * liste via selectedId/onSelect.
 */
export function FinderMap({
  commune,
  items,
  selectedId,
  onSelect,
}: {
  commune: CommuneSummary | null
  items: OfficeItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const bureaux = items.map((it) => it.bureau)
  return (
    <div className="h-full w-full">
      <CommunePanel
        commune={commune}
        bureaux={bureaux}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  )
}
