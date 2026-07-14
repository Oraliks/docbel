// app/outils/bureaux/_components/office-map-popup.tsx
'use client'

import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import type { OfficeMapMarker } from './office-map-types'

/**
 * Infobulle du marqueur sélectionné, overlayée par `OfficeMap` en bas de la
 * carte. Purement présentationnelle : ne consomme QUE `OfficeMapMarker`
 * (jamais `OfficeItem`/`BureauResult`/`RankedOffice`) pour rester du bon
 * côté du boundary carto — tous les libellés arrivent déjà résolus (i18n,
 * formatage) depuis l'orchestrateur, via `OfficeMap`.
 *
 * `onClose` n'efface qu'un survol/highlight côté carte (`OfficeMap` la
 * câble sur `onHover(null)`) : la fermeture "réelle" de la sélection reste
 * décidée par l'orchestrateur.
 */
export function OfficeMapPopup({
  marker,
  onView,
  onClose,
}: {
  marker: OfficeMapMarker
  onView: (id: string) => void
  onClose: () => void
}) {
  const t = useTranslations('public.outils')

  // Statut et distance sont chacun omis individuellement s'ils manquent
  // (jamais de "null"/"undefined" affiché) : la source (`OfficeMapMarker`)
  // encode déjà cette absence via `null`.
  const hasSegments = marker.statusLabel != null || marker.distanceLabel != null

  return (
    <div className="glass-surface-strong relative rounded-2xl p-4 pr-11">
      <button
        type="button"
        onClick={onClose}
        aria-label={t('bureauxClose')}
        className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-muted"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-black text-white"
          style={{ background: marker.color }}
          aria-hidden="true"
        >
          {marker.number}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[10px] font-bold uppercase tracking-wide"
            style={{ color: marker.color }}
          >
            {marker.typeLabel}
          </p>
          <p className="truncate text-[15px] font-bold leading-tight text-foreground">{marker.label}</p>
          <p className="truncate text-xs text-muted-foreground">{marker.address}</p>
          {hasSegments && (
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
              {marker.statusLabel != null && <span>{marker.statusLabel}</span>}
              {marker.statusLabel != null && marker.distanceLabel != null && (
                <span aria-hidden="true">·</span>
              )}
              {marker.distanceLabel != null && <span>{marker.distanceLabel}</span>}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onView(marker.id)}
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl text-sm font-bold text-white"
        style={{ background: 'var(--primary)' }}
      >
        {t('viewOffice')}
      </button>
    </div>
  )
}
