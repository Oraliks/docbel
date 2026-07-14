// app/outils/bureaux/_components/office-list.tsx
'use client'
import { useTranslations } from 'next-intl'
import { OfficeCard } from './office-card'
import type { OfficeItem } from '@/lib/bureaus/finder-model'

export function OfficeList({
  items,
  selectedId,
  favorites,
  onSelect,
  onToggleFavorite,
  countLabel,
}: {
  items: OfficeItem[]
  selectedId: string | null
  favorites: Set<string>
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
  countLabel: string
}) {
  const t = useTranslations('public.outils')
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-[13px] font-bold text-foreground">{countLabel}</span>
        <span className="text-xs text-muted-foreground">{t('bureauxSortedByProximity')}</span>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-3 pb-4">
        {items.map((item) => (
          <OfficeCard
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            isFavorite={favorites.has(item.id)}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
        {items.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">{t('bureauxNoResult')}</div>
        )}
      </div>
    </div>
  )
}
