// app/outils/bureaux/_components/office-results-list.tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { OfficeResultRow } from './office-result-row'
import type { RankedOffice } from '@/lib/bureaus/office-ranking'

/**
 * Liste compacte numérotée des bureaux NON recommandés (rang 2..N — le rang
 * 1 vit dans `RecommendedOfficeCard`, rendu séparément par l'orchestrateur).
 * Repliée par défaut sur `initialCount` lignes ("Voir plus de résultats")
 * pour ne pas noyer la fiche recommandée sous une longue liste.
 */
export function OfficeResultsList({
  offices,
  selectedId,
  onView,
  onHover,
  initialCount = 4,
}: {
  offices: RankedOffice[]
  selectedId: string | null
  onView: (id: string) => void
  onHover: (id: string | null) => void
  initialCount?: number
}) {
  const t = useTranslations('public.outils')
  const [expanded, setExpanded] = useState(false)

  if (offices.length === 0) return null

  const visible = expanded ? offices : offices.slice(0, initialCount)
  const hasMore = !expanded && offices.length > initialCount

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[15px] font-bold text-foreground">{t('otherOfficesTitle')}</h2>
      <div className="flex flex-col gap-3">
        {visible.map((office) => (
          <OfficeResultRow
            key={office.id}
            office={office}
            selected={office.id === selectedId}
            onView={onView}
            onHover={onHover}
          />
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground/80"
        >
          {t('seeMoreResults')}
        </button>
      )}
    </div>
  )
}
