// app/outils/bureaux/_components/active-filters.tsx
'use client'

import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

/**
 * Rangée de badges pour les filtres actuellement appliqués (recherche
 * finder bureaux). Purement présentationnel : l'orchestrateur (V2-12)
 * fournit la liste `{ key, label }` déjà résolue (i18n, formatage) et
 * reçoit les callbacks de retrait.
 *
 * Ne rend rien tant qu'aucun filtre n'est actif.
 */
export function ActiveFilters({
  filters,
  onRemove,
  onClear,
}: {
  filters: { key: string; label: string }[]
  onRemove: (key: string) => void
  onClear: () => void
}) {
  const t = useTranslations('public.outils')

  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <span className="text-xs font-semibold text-muted-foreground">
        {t('activeFiltersLabel')}
      </span>
      {filters.map((filter) => (
        <span
          key={filter.key}
          className="inline-flex items-center gap-1 h-7 pl-3 pr-1.5 rounded-full text-xs font-semibold"
          style={{
            background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
            color: 'var(--primary)',
            border: '1px solid color-mix(in srgb, var(--primary) 22%, transparent)',
          }}
        >
          {filter.label}
          <button
            type="button"
            onClick={() => onRemove(filter.key)}
            aria-label={t('removeFilterAria', { label: filter.label })}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground underline-offset-2 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
      >
        {t('clearFilters')}
      </button>
    </div>
  )
}
