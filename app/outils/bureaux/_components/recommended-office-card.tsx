// app/outils/bureaux/_components/recommended-office-card.tsx
'use client'

import { useTranslations } from 'next-intl'
import { CheckCircle2, Info, MapPin, CalendarCheck } from 'lucide-react'
import { computeOpenStatus } from '@/lib/bureaus/types'
import { estimateTravel, TYPE_META } from '@/lib/bureaus/finder-model'
import type { RankedOffice } from '@/lib/bureaus/office-ranking'
import { TypeIcon } from './type-icon'

/**
 * Grande carte « héros » pour le bureau n°1 recommandé (sortie de
 * `rankOffices`). Purement présentationnel : nos données n'ont pas de
 * photos de bureaux, donc pas d'image ni de placeholder — l'emphase
 * visuelle vient du badge de rang, du badge de compétence et d'une mise
 * en page généreuse (verre).
 */
export function RecommendedOfficeCard({
  office,
  onView,
}: {
  office: RankedOffice
  onView: (id: string) => void
}) {
  // Cast (idiome déjà utilisé dans office-card.tsx / office-detail.tsx) :
  // `meta.labelKey` est un `string` dynamique (jamais un littéral), donc le
  // typage strict next-intl (`i18n/global.ts`) fait échouer `tsc` sans ce cast.
  const t = useTranslations('public.outils') as (key: string) => string
  const meta = TYPE_META[office.type]
  const b = office.bureau
  const status = computeOpenStatus(b.hours)
  const address = [b.street, b.streetNum].filter(Boolean).join(' ') + `, ${b.postalCode} ${b.city}`
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address + ', Belgique')}`

  // Segments de la ligne d'info, chacun omis individuellement si la donnée
  // manque (jamais de "undefined km" / trou visuel). Règle d'honnêteté sur
  // le statut (même règle que office-result-row.tsx) : `no_data` (aucun
  // horaire connu pour ce bureau) n'affiche PAS "Fermé" — ce serait une
  // donnée inventée — le segment est simplement omis.
  const segments: { key: string; text: string; className?: string }[] = []
  if (office.distanceKm != null) {
    segments.push({
      key: 'dist',
      text: `${office.distanceKm.toFixed(1).replace('.', ',')} km`,
      className: 'font-bold text-foreground/80',
    })
    segments.push({
      key: 'walk',
      text: `${estimateTravel(office.distanceKm).walkMin} min ${t('bureauxWalk')}`,
    })
  }
  if (status.state === 'open') {
    segments.push({
      key: 'status',
      text: t('bureauxStatusOpen'),
      className: 'font-semibold text-[color:var(--glass-success-ink)]',
    })
  } else if (status.state !== 'no_data') {
    segments.push({ key: 'status', text: t('bureauxStatusClosed') })
  }

  return (
    <div className="glass-surface rounded-3xl p-6 sm:p-8">
      {/* Badges : rang + compétence */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-2xl text-xl font-black text-white"
          style={{ background: 'var(--primary)' }}
        >
          {office.number}
        </span>
        {office.isCompetent ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--glass-success-surface)] px-3 py-1 text-xs font-bold text-[color:var(--glass-success-ink)]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('recommendedCompetent')}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)' }}
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            {t('recommendedNeutral')}
          </span>
        )}
      </div>

      {/* Eyebrow (type d'organisme) + nom complet + adresse complète */}
      <div className="mt-5">
        <div className="flex items-center gap-1.5" style={{ color: meta.color }}>
          <TypeIcon name={meta.icon} className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wide">{t(meta.labelKey)}</span>
        </div>
        <h2 className="mt-1 text-xl font-extrabold leading-tight text-foreground sm:text-2xl">
          {b.name}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{address}</p>
      </div>

      {/* Ligne d'info : distance · marche · statut d'ouverture */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {segments.map((seg, i) => (
          <span key={seg.key} className="inline-flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">·</span>}
            <span className={seg.className}>{seg.text}</span>
          </span>
        ))}
      </div>

      {/* Rendez-vous (optionnel) : simple lien honnête, on n'invente pas de
          "rendez-vous requis" — cette donnée n'existe pas côté modèle. */}
      {b.appointmentUrl && (
        <a
          href={b.appointmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: 'var(--primary)' }}
        >
          <CalendarCheck className="h-4 w-4" aria-hidden="true" />
          {t('bureauxAppointment')}
        </a>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={() => onView(office.id)}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl text-sm font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          {t('viewOffice')}
        </button>
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border text-sm font-bold text-foreground/80"
        >
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {t('bcItinerary')}
        </a>
      </div>
    </div>
  )
}
