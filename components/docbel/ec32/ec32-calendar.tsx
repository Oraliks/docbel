'use client'

// =====================================================================
//  eC3.2 — Grille calendrier (sélection multi-jours) + légende discrète
// ---------------------------------------------------------------------
//  La grille s'affiche directement (plus d'onglets, plus de vue liste).
//  Une légende DISCRÈTE (petits points colorés) est rappelée sous le
//  calendrier. Les cases sélectionnables sont des <button> (aria-pressed +
//  aria-label parlant), les cases grisées (`not_applicable`) sont inertes.
//  Le premier jour de chômage effectif porte une icône automatique (Flag).
//  100 % pédagogique.
// =====================================================================

import { Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Ec32DayCell, Ec32SituationType } from '@/lib/ec32/types'
import { EC32_SELECTABLE_SITUATIONS } from '@/lib/ec32/types'
import { SITUATION_VISUALS } from '@/components/docbel/ec32/ui'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const

const SITUATION_LETTER: Partial<Record<Ec32SituationType, string>> = {
  work_own_employer: 'T1',
  work_elsewhere_usual_day: 'T2',
  work_elsewhere_non_usual_day: 'T2',
  work_other_regular_employer: 'T2',
  incapacity: 'M',
  vacation: 'V',
  other: 'A',
}

export function Ec32Calendar({
  cells,
  selectedDates,
  situationLabel,
  legendTitle,
  selectHint,
  disabled = false,
  onToggleDay,
}: {
  cells: Ec32DayCell[]
  /** Dates ISO actuellement sélectionnées. */
  selectedDates: Set<string>
  /** Libellé lisible d'une situation (pour aria + légende). */
  situationLabel: (situation: Ec32SituationType) => string
  /** Intitulé discret de la légende sous le calendrier. */
  legendTitle: string
  selectHint: string
  /** Carte verrouillée : les cases ne sont plus cliquables. */
  disabled?: boolean
  onToggleDay: (date: string) => void
}) {
  // Découpe en semaines de 7 cases (la grille est déjà alignée lundi→dimanche).
  const weeks: Ec32DayCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <div className="w-full">
      <p className="mb-3 text-xs text-muted-foreground">{selectHint}</p>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="pb-1 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
            aria-hidden
          >
            {label}
          </div>
        ))}

        {weeks.map((week, wi) =>
          week.map((cell, di) => {
            const key = `${wi}-${di}-${cell.date}`
            return (
              <Ec32CalendarCell
                key={key}
                cell={cell}
                selected={selectedDates.has(cell.date)}
                situationLabel={situationLabel}
                disabled={disabled}
                onToggle={() => onToggleDay(cell.date)}
              />
            )
          }),
        )}
      </div>

      {/* Légende discrète rappelée sous le calendrier (petits points colorés). */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 pt-3">
        {legendTitle && (
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {legendTitle}
          </span>
        )}
        {EC32_SELECTABLE_SITUATIONS.map((situation) => (
          <LegendDot key={situation} situation={situation} label={situationLabel(situation)} />
        ))}
        <LegendDot
          situation="first_effective_unemployment_day"
          label={situationLabel('first_effective_unemployment_day')}
        />
        <LegendDot situation="not_applicable" label={situationLabel('not_applicable')} />
      </div>
    </div>
  )
}

/** Point de légende discret : petite pastille colorée + libellé muté. */
function LegendDot({
  situation,
  label,
}: {
  situation: Ec32SituationType
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn('size-2 shrink-0 rounded-full', SITUATION_VISUALS[situation].dot)}
        aria-hidden
      />
      {label}
    </span>
  )
}

function Ec32CalendarCell({
  cell,
  selected,
  situationLabel,
  disabled,
  onToggle,
}: {
  cell: Ec32DayCell
  selected: boolean
  situationLabel: (situation: Ec32SituationType) => string
  disabled: boolean
  onToggle: () => void
}) {
  const visual = SITUATION_VISUALS[cell.situation]

  // Cases non encodables (hors mois / hors contrat) : inertes & grisées.
  if (!cell.selectable) {
    return (
      <div
        className={cn(
          'flex aspect-square min-h-8 flex-col items-center justify-center rounded-xl border border-dashed border-border/40 text-xs',
          visual.cell,
          cell.inMonth ? 'opacity-60' : 'opacity-35',
        )}
        aria-hidden
      >
        <span className="font-medium text-muted-foreground">{cell.day}</span>
      </div>
    )
  }

  const label = `Jour ${cell.day}, situation : ${situationLabel(cell.situation)}${
    cell.isFirstEffectiveDay ? ' (premier jour de chômage effectif)' : ''
  }${selected ? ' — sélectionné' : ''}`

  const isFirstEffective =
    cell.isFirstEffectiveDay && cell.situation === 'temporary_unemployment'
  const letter = SITUATION_LETTER[cell.situation]

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      title={situationLabel(cell.situation)}
      className={cn(
        'relative flex aspect-square min-h-8 flex-col items-center justify-center gap-0.5 rounded-xl border text-xs transition-all duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
        visual.cell,
        selected
          ? 'border-primary ring-2 ring-primary/60 shadow-[0_8px_20px_-12px_rgba(91,70,229,0.45)]'
          : 'border-border/60 hover:border-primary/40 hover:shadow-[0_8px_18px_-14px_rgba(91,70,229,0.35)]',
      )}
    >
      <span className="text-xs font-semibold text-foreground">{cell.day}</span>
      <span className="flex h-3 items-center justify-center">
        {isFirstEffective ? (
          <Flag className="size-3 text-primary" aria-hidden />
        ) : letter ? (
          <span className={cn('text-[0.6rem] font-bold leading-none', visual.accent)} aria-hidden>
            {letter}
          </span>
        ) : null}
      </span>
    </button>
  )
}
