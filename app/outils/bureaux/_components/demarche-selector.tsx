'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Briefcase, HandHelping, MoreHorizontal } from 'lucide-react'
import { DEMARCHE_LABEL, type DemarcheKey } from './types'

interface Props {
  value: DemarcheKey | null
  onChange: (v: DemarcheKey | null) => void
}

/**
 * Sélecteur de démarche en pillules. Pilote la mise en avant ("Recommandé")
 * sur la card correspondante (ONEM pour chômage, CPAS pour aide sociale).
 * null = pas de choix = aucune card mise en avant.
 */
export function DemarcheSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground shrink-0">
        Pour quelle démarche&nbsp;?
      </span>
      <ToggleGroup
        // @base-ui/react ToggleGroup gère un array de valeurs ; on simule un
        // single-select en limitant à 1 entrée.
        value={value ? [value] : []}
        onValueChange={(vals) => {
          const next = (vals as string[])[0]
          onChange((next as DemarcheKey) || null)
        }}
        spacing={4}
      >
        <ToggleGroupItem value="chomage" className="gap-1.5 px-3 text-xs">
          <Briefcase className="w-3.5 h-3.5" />
          {DEMARCHE_LABEL.chomage}
        </ToggleGroupItem>
        <ToggleGroupItem value="aide_sociale" className="gap-1.5 px-3 text-xs">
          <HandHelping className="w-3.5 h-3.5" />
          {DEMARCHE_LABEL.aide_sociale}
        </ToggleGroupItem>
        <ToggleGroupItem value="autre" className="gap-1.5 px-3 text-xs">
          <MoreHorizontal className="w-3.5 h-3.5" />
          {DEMARCHE_LABEL.autre}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
