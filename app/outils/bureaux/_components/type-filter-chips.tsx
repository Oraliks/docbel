// app/outils/bureaux/_components/type-filter-chips.tsx
'use client'
import { useTranslations } from 'next-intl'
import { TYPE_ORDER, TYPE_META, type OfficeType } from '@/lib/bureaus/finder-model'

export function TypeFilterChips({
  active,
  onToggle,
  counts,
}: {
  active: Set<OfficeType>
  onToggle: (t: OfficeType) => void
  counts?: Record<OfficeType, number>
}) {
  // Cast (idiome déjà utilisé dans office-card.tsx) : `meta.labelKey` est un
  // `string` dynamique (jamais un littéral) et les clés bureauxType* sont
  // ajoutées par la Task 11 (i18n) de ce même plan, pas encore mergées. Sans
  // ce cast, le typage strict next-intl (`i18n/global.ts`) fait échouer `tsc`.
  const t = useTranslations('public.outils') as (key: string) => string
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
      {TYPE_ORDER.map((type) => {
        const meta = TYPE_META[type]
        const isActive = active.has(type)
        const count = counts?.[type] ?? 0
        const disabled = counts != null && count === 0
        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(type)}
            className="flex-none inline-flex items-center h-8 px-3 rounded-full text-xs font-semibold transition disabled:opacity-40"
            style={
              isActive
                ? { background: meta.color, color: '#fff', border: `1px solid ${meta.color}` }
                : { background: 'var(--glass-surface, transparent)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }
            }
          >
            {t(meta.labelKey)}
            {counts != null && count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
