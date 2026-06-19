'use client'

// =====================================================================
//  eC3.2 — Grille calendrier (sélection multi-jours) + légende
// ---------------------------------------------------------------------
//  Onglets Calendrier / Légende. Les cases sélectionnables sont des
//  <button> (aria-pressed + aria-label parlant), les cases grisées
//  (`not_applicable`) sont inertes. Le premier jour de chômage effectif
//  porte une icône automatique (Flag). 100 % pédagogique.
// =====================================================================

import { Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Ec32DayCell, Ec32SituationType } from '@/lib/ec32/types'
import { EC32_SELECTABLE_SITUATIONS } from '@/lib/ec32/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  SITUATION_VISUALS,
  Ec32SituationChip,
} from '@/components/docbel/ec32/ui'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const

export function Ec32Calendar({
  cells,
  selectedDates,
  situationLabel,
  legendTitle,
  calendarTabLabel,
  legendTabLabel,
  selectHint,
  disabled = false,
  onToggleDay,
}: {
  cells: Ec32DayCell[]
  /** Dates ISO actuellement sélectionnées. */
  selectedDates: Set<string>
  /** Libellé lisible d'une situation (pour aria + légende). */
  situationLabel: (situation: Ec32SituationType) => string
  legendTitle: string
  calendarTabLabel: string
  legendTabLabel: string
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
    <Tabs defaultValue="calendar" className="w-full">
      <TabsList className="w-full max-w-xs">
        <TabsTrigger value="calendar">{calendarTabLabel}</TabsTrigger>
        <TabsTrigger value="legend">{legendTabLabel}</TabsTrigger>
      </TabsList>

      <TabsContent value="calendar" className="mt-4">
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
      </TabsContent>

      <TabsContent value="legend" className="mt-4">
        <h4 className="mb-3 text-sm font-semibold text-foreground">{legendTitle}</h4>
        <ul className="flex flex-wrap gap-2">
          {EC32_SELECTABLE_SITUATIONS.map((situation) => (
            <li key={situation}>
              <Ec32SituationChip situation={situation} label={situationLabel(situation)} />
            </li>
          ))}
          <li>
            <Ec32SituationChip
              situation="first_effective_unemployment_day"
              label={situationLabel('first_effective_unemployment_day')}
            />
          </li>
          <li>
            <Ec32SituationChip
              situation="not_applicable"
              label={situationLabel('not_applicable')}
            />
          </li>
        </ul>
      </TabsContent>
    </Tabs>
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
          'flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl border border-dashed border-border/50 text-xs',
          visual.cell,
          cell.inMonth ? 'opacity-70' : 'opacity-40',
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

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      title={situationLabel(cell.situation)}
      className={cn(
        'relative flex aspect-square min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60',
        visual.cell,
        selected
          ? 'border-primary ring-2 ring-primary/60'
          : 'border-border/60 hover:border-primary/40',
      )}
    >
      <span className="text-sm font-semibold text-foreground">{cell.day}</span>
      <span className="flex items-center gap-0.5">
        {isFirstEffective ? (
          <Flag className="size-3 text-primary" aria-hidden />
        ) : (
          <span className={cn('inline-block size-2 rounded-full', visual.dot)} aria-hidden />
        )}
      </span>
    </button>
  )
}
