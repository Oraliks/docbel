// app/outils/bureaux/_components/office-result-row.tsx
'use client'

import { useTranslations } from 'next-intl'
import { computeOpenStatus } from '@/lib/bureaus/types'
import { estimateTravel, TYPE_META } from '@/lib/bureaus/finder-model'
import type { RankedOffice } from '@/lib/bureaus/office-ranking'
import { TypeIcon } from './type-icon'

/**
 * Ligne compacte d'un bureau NON recommandé (rang 2..N, sorti de
 * `rankOffices`) dans `OfficeResultsList`. Contrairement à
 * `RecommendedOfficeCard` (héros n°1) : pas d'itinéraire/rdv ici, juste de
 * quoi arbitrer + un bouton "Voir le bureau" qui ouvre la fiche détaillée.
 *
 * `selected` est piloté par le parent (survol de cette ligne OU du pin
 * carte correspondant, cf. V2-8) : pas de :hover CSS propre sur la ligne,
 * tout passe par la prop pour rester en sync bidirectionnelle liste ↔
 * carte. `onHover` se contente d'informer le parent ; il ne déclenche
 * aucune navigation. Seul le bouton "Voir le bureau" est cliquable — la
 * ligne elle-même est un `<div>` (jamais de bouton imbriqué dans un bouton).
 */
export function OfficeResultRow({
  office,
  selected,
  onView,
  onHover,
}: {
  office: RankedOffice
  selected?: boolean
  onView: (id: string) => void
  onHover: (id: string | null) => void
}) {
  // Cast (idiome déjà utilisé dans office-card.tsx / recommended-office-card.tsx) :
  // `meta.labelKey` est un `string` dynamique (jamais un littéral), donc le
  // typage strict next-intl (`i18n/global.ts`) fait échouer `tsc` sans ce cast.
  const t = useTranslations('public.outils') as (key: string) => string
  const meta = TYPE_META[office.type]
  const b = office.bureau
  const status = computeOpenStatus(b.hours)
  const address = [b.street, b.streetNum].filter(Boolean).join(' ') + `, ${b.postalCode} ${b.city}`

  // Segments de la ligne d'info, chacun omis individuellement si la donnée
  // manque (jamais de "undefined km" / "NaN min" / trou visuel). Règle
  // d'honnêteté sur le statut : `no_data` (aucun horaire connu pour ce
  // bureau) n'affiche PAS "Fermé" — ce serait une donnée inventée — le
  // segment est simplement omis.
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
      className: 'font-semibold text-emerald-700 dark:text-emerald-300',
    })
  } else if (status.state !== 'no_data') {
    segments.push({ key: 'status', text: t('bureauxStatusClosed') })
  }

  return (
    <div
      onMouseEnter={() => onHover(office.id)}
      onMouseLeave={() => onHover(null)}
      className="glass-surface rounded-2xl p-3.5 sm:p-4"
      // Même contournement que office-card.tsx : `.glass-surface` pose son
      // propre `box-shadow: var(--glass-shadow)` (règle CSS globale) qui
      // gagne sur les utilitaires Tailwind `ring-*`/`shadow-*` à spécificité
      // égale — l'anneau de sélection ne s'affiche pas avec Tailwind seul.
      // Style inline (priorité max) pour superposer l'anneau à l'ombre verre.
      style={
        selected
          ? { boxShadow: 'var(--glass-shadow), 0 0 0 2px var(--primary)' }
          : undefined
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-black text-white"
            style={{ background: 'var(--primary)' }}
          >
            {office.number}
          </span>
          <div className="min-w-0 flex-1">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{
                background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                color: meta.color,
              }}
            >
              <TypeIcon name={meta.icon} className="h-3 w-3" />
              {t(meta.labelKey)}
            </span>
            {/* Nom complet : jamais tronqué à partir de `sm:` (desktop) —
                seul le mobile tronque sur une ligne pour garder une liste
                compacte. `truncate` pose overflow-hidden + ellipsis +
                nowrap ; on annule les trois à `sm:` pour autoriser le
                retour à la ligne complet. */}
            <div className="mt-1 truncate text-[15px] font-bold leading-tight text-foreground sm:overflow-visible sm:whitespace-normal">
              {b.name}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground sm:overflow-visible sm:whitespace-normal">
              {address}
            </div>
            {segments.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                {segments.map((seg, i) => (
                  <span key={seg.key} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden="true">·</span>}
                    <span className={seg.className}>{seg.text}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onView(office.id)}
          className="inline-flex h-9 w-full flex-none items-center justify-center rounded-xl px-4 text-[13px] font-bold text-white sm:w-auto"
          style={{ background: 'var(--primary)' }}
        >
          {t('viewOffice')}
        </button>
      </div>
    </div>
  )
}
