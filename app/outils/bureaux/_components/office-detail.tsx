// app/outils/bureaux/_components/office-detail.tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, X, MapPin, Globe, CalendarCheck, Flag } from 'lucide-react'
import { GLASS_CARD } from '@/lib/glass-classes'
import { computeOpenStatus } from '@/lib/bureaus/types'
import { estimateTravel, TYPE_META, type OfficeItem } from '@/lib/bureaus/finder-model'
import { TypeIcon } from './type-icon'
import { HoursTimeline } from './hours-timeline'
import { PhoneReveal } from './phone-reveal'
import { ReportForm } from './report-form'

export function OfficeDetail({
  item,
  onClose,
  variant,
}: {
  // Accepte un `OfficeItem` ou un `RankedOffice` (surtype `OfficeItem`) : la
  // fiche ne lit que `item.type` / `item.bureau` / `item.distanceKm`, jamais
  // le rang. La favorisation a été retirée (V2-12).
  item: OfficeItem
  onClose: () => void
  variant: 'inline' | 'sheet'
}) {
  // Cast (idiome déjà utilisé dans office-card.tsx) : `meta.labelKey` est un
  // `string` dynamique (jamais un littéral), donc le typage strict next-intl
  // (`i18n/global.ts`) fait échouer `tsc` sans ce cast.
  const t = useTranslations('public.outils') as (key: string) => string
  const [reporting, setReporting] = useState(false)
  const meta = TYPE_META[item.type]
  const b = item.bureau
  const status = computeOpenStatus(b.hours)
  const open = status.state === 'open'
  const address = [b.street, b.streetNum].filter(Boolean).join(' ') + `, ${b.postalCode} ${b.city}`
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address + ', Belgique')}`
  const dist = item.distanceKm != null ? `${item.distanceKm.toFixed(1).replace('.', ',')} km` : null
  const walk = item.distanceKm != null ? `${estimateTravel(item.distanceKm).walkMin} min` : null

  return (
    <div className="flex flex-col h-full">
      {/* Header selon variant */}
      {variant === 'inline' ? (
        <div className="flex-none flex items-center gap-2.5 p-4 border-b border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-none w-9 h-9 rounded-xl border border-border flex items-center justify-center"
            aria-label={t('bureauxBackToResults')}
          >
            <ChevronLeft className="w-[18px] h-[18px]" />
          </button>
          <span className="text-sm font-bold text-foreground/80">{t('bureauxBackToResults')}</span>
        </div>
      ) : (
        <div className="flex-none relative pt-3 pb-1">
          <span className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-border" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-muted flex items-center justify-center"
            aria-label={t('bureauxClose')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6 pt-4">
        <div className="flex gap-3.5 items-start">
          <span
            className="flex-none w-14 h-14 rounded-2xl flex items-center justify-center text-white"
            style={{ background: meta.color }}
          >
            <TypeIcon name={meta.icon} className="w-6 h-6" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
              {t(meta.labelKey)}
            </div>
            <div className="text-xl font-extrabold text-foreground leading-tight mt-0.5">{b.name}</div>
            {status.state !== 'no_data' && (
              <span
                className={`inline-flex items-center mt-2 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  open
                    ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                {open ? t('bureauxStatusOpen') : t('bureauxStatusClosed')}
              </span>
            )}
          </div>
        </div>

        {/* Adresse + distance + site */}
        <div className={`${GLASS_CARD} mt-4 rounded-2xl p-4`}>
          <div className="text-[13.5px] font-semibold text-foreground/80">{address}</div>
          {dist && (
            <div className="text-xs text-muted-foreground mt-1">
              {dist} · {walk} {t('bureauxWalk')}
            </div>
          )}
          {b.website && (
            <a
              href={b.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold mt-2"
              style={{ color: 'var(--primary)' }}
            >
              <Globe className="w-3.5 h-3.5" />
              {b.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>

        {/* Horaires complets (réutilisé) */}
        <div className="mt-4">
          <HoursTimeline
            hours={b.hours}
            notes={b.hoursNotes}
            type={b.type}
            onReport={() => setReporting(true)}
          />
        </div>

        {/* Téléphone anti-scraping (réutilisé) */}
        {b.phone && (
          <div className="mt-3">
            <PhoneReveal phone={b.phone} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary" />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 mt-4">
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-12 rounded-2xl text-white text-sm font-bold"
            style={{ background: 'var(--primary)' }}
          >
            <MapPin className="w-4 h-4" />
            {t('bcItinerary')}
          </a>
          {b.appointmentUrl && (
            <a
              href={b.appointmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-12 rounded-2xl border border-border text-sm font-bold text-foreground/80"
            >
              <CalendarCheck className="w-4 h-4" />
              {t('bureauxAppointment')}
            </a>
          )}
        </div>

        {/* Signalement (réutilisé) */}
        <div className="mt-4">
          {reporting ? (
            <ReportForm bureauId={b.id} onClose={() => setReporting(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Flag className="w-3.5 h-3.5" />
              {t('bureauxReportError')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
