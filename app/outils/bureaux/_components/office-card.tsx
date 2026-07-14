// app/outils/bureaux/_components/office-card.tsx
'use client'

import { useTranslations } from 'next-intl'
import { MapPin, Star, Phone, Globe } from 'lucide-react'
import { computeOpenStatus } from '@/lib/bureaus/types'
import { estimateTravel, TYPE_META, type OfficeItem } from '@/lib/bureaus/finder-model'
import { TypeIcon } from './type-icon' // créé en Task 3.1 ci-dessous

export function OfficeCard({
  item,
  selected,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  item: OfficeItem
  selected?: boolean
  isFavorite?: boolean
  onSelect: (id: string) => void
  onToggleFavorite?: (id: string) => void
}) {
  // Cast (idiome déjà utilisé dans users-list-client.tsx / admin/news) :
  // `meta.labelKey` est un `string` dynamique (jamais un littéral) et les
  // clés bureauxStatusOpen/Closed/Walk/Favorite/Call/Website sont ajoutées
  // par la Task 11 (i18n) de ce même plan, pas encore mergées. Sans ce
  // cast, le typage strict next-intl (`i18n/global.ts`) fait échouer `tsc`.
  const t = useTranslations('public.outils') as (key: string) => string
  const meta = TYPE_META[item.type]
  const b = item.bureau
  const status = computeOpenStatus(b.hours)
  const open = status.state === 'open'
  const address = [b.street, b.streetNum].filter(Boolean).join(' ') + `, ${b.postalCode} ${b.city}`
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address + ', Belgique')}`
  const dist = item.distanceKm != null ? `${item.distanceKm.toFixed(1).replace('.', ',')} km` : null
  const walk = item.distanceKm != null ? `${estimateTravel(item.distanceKm).walkMin} min` : null

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`glass-surface w-full text-left p-3.5 rounded-2xl transition ${
        selected ? 'ring-2 ring-[var(--primary)]' : ''
      }`}
      // `.glass-surface` pose son propre `box-shadow: var(--glass-shadow)`
      // (règle CSS globale, non Tailwind) qui gagne sur le box-shadow des
      // utilitaires `ring-*` (même mécanisme) : l'anneau de sélection ne
      // s'affichait pas malgré les classes ci-dessus. On recompose les deux
      // en style inline (priorité maximale) pour garder l'ombre verre + un
      // anneau visible quand la carte est sélectionnée.
      style={
        selected
          ? { boxShadow: 'var(--glass-shadow), 0 0 0 2px var(--primary)' }
          : undefined
      }
    >
      <div className="flex gap-3 items-start">
        <span
          className="flex-none w-11 h-11 rounded-xl flex items-center justify-center text-white"
          style={{ background: meta.color }}
        >
          <TypeIcon name={meta.icon} className="w-5.5 h-5.5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wide truncate"
              style={{ color: meta.color }}
            >
              {t(meta.labelKey)}
            </span>
            <span
              className={`flex-none text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                open ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'
              }`}
            >
              {open ? t('bureauxStatusOpen') : t('bureauxStatusClosed')}
            </span>
          </div>
          <div className="text-[15px] font-bold text-foreground leading-tight mt-0.5 truncate">
            {b.name}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{address}</div>
          {dist && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
              <span className="font-bold text-foreground/80">{dist}</span>
              <span>·</span>
              <span>{walk} {t('bureauxWalk')}</span>
            </div>
          )}
        </div>
        {onToggleFavorite && (
          <span
            role="button"
            tabIndex={0}
            aria-label={t('bureauxFavorite')}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(item.id)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                onToggleFavorite(item.id)
              }
            }}
            className="flex-none p-0.5 cursor-pointer"
          >
            <Star
              className="w-5 h-5"
              fill={isFavorite ? '#f6b93b' : 'none'}
              stroke={isFavorite ? '#f6b93b' : 'currentColor'}
            />
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border text-[13px] font-semibold text-foreground/80"
        >
          <MapPin className="w-3.5 h-3.5" />
          {t('bcItinerary')}
        </a>
        <a
          href={b.phone ? `tel:${b.phone}` : b.website ?? '#'}
          target={b.phone ? undefined : '_blank'}
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-[13px] font-bold"
          style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)' }}
        >
          {b.phone ? <Phone className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
          {b.phone ? t('bureauxCall') : t('bureauxWebsite')}
        </a>
      </div>
    </button>
  )
}
