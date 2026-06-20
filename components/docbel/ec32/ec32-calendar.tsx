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
import { EC32_PRIMARY_SITUATIONS, EC32_T2_SITUATION } from '@/lib/ec32/types'
import { SITUATION_VISUALS } from '@/components/docbel/ec32/ui'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const

/** Lettre de la situation PRINCIPALE (le chômage reste vide). */
const SITUATION_LETTER: Partial<Record<Ec32SituationType, string>> = {
  work_own_employer: 'T1',
  // Les types « travail ailleurs » sont l'axe secondaire T2 (cumulable) ;
  // conservés ici comme repli au cas où ils seraient la situation principale.
  work_elsewhere_usual_day: 'T2',
  work_elsewhere_non_usual_day: 'T2',
  work_other_regular_employer: 'T2',
  incapacity: 'M',
  vacation: 'V',
  other: 'A',
}

/**
 * Code affiché dans une case : situation principale + éventuel T2 cumulé.
 * Ex. `T1/T2`, `M/T2`, `V/T2`, `A/T2`, ou `T2` seul (chômage + travail ailleurs),
 * ou la lettre principale seule, ou rien (chômage pur).
 */
function cellCode(cell: Ec32DayCell): string {
  const primary = SITUATION_LETTER[cell.situation] ?? ''
  const secondary = cell.secondaryWork ? 'T2' : ''
  // Évite « T2/T2 » si la situation principale est déjà un travail ailleurs.
  if (primary === 'T2' && secondary === 'T2') return 'T2'
  return [primary, secondary].filter(Boolean).join('/')
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
        {EC32_PRIMARY_SITUATIONS.map((situation) => (
          <LegendDot
            key={situation}
            situation={situation}
            code={SITUATION_LETTER[situation]}
            label={situationLabel(situation)}
          />
        ))}
        <LegendDot
          situation={EC32_T2_SITUATION}
          code="T2"
          label="Travail ailleurs (2ᵉ activité)"
        />
        <LegendDot
          situation="first_effective_unemployment_day"
          label={situationLabel('first_effective_unemployment_day')}
        />
        <LegendDot situation="not_applicable" label={situationLabel('not_applicable')} />
      </div>
    </div>
  )
}

/** Point de légende discret : code (lettre) + pastille colorée + libellé muté. */
function LegendDot({
  situation,
  label,
  code,
}: {
  situation: Ec32SituationType
  label: string
  /** Lettre/code affiché dans les cases (T1, T2, M, V, A). Absent = chômage. */
  code?: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {code ? (
        <span
          className={cn(
            'text-[0.65rem] font-bold leading-none',
            SITUATION_VISUALS[situation].accent,
          )}
          aria-hidden
        >
          {code}
        </span>
      ) : (
        <span
          className={cn('size-2 shrink-0 rounded-full', SITUATION_VISUALS[situation].dot)}
          aria-hidden
        />
      )}
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
    cell.secondaryWork ? ' + travail ailleurs (T2)' : ''
  }${cell.isFirstEffectiveDay ? ' (premier jour de chômage effectif)' : ''}${
    selected ? ' — sélectionné' : ''
  }`

  const isFirstEffective =
    cell.isFirstEffectiveDay && cell.situation === 'temporary_unemployment'
  const code = cellCode(cell)
  // Couleur : si une situation principale porte une lettre, sa teinte ; sinon
  // (chômage + T2) on prend la teinte « travail ailleurs ».
  const codeAccent =
    SITUATION_LETTER[cell.situation] && cell.situation !== 'temporary_unemployment'
      ? visual.accent
      : SITUATION_VISUALS.work_elsewhere_usual_day.accent

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      title={`${situationLabel(cell.situation)}${cell.secondaryWork ? ' + travail ailleurs (T2)' : ''}`}
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
        {isFirstEffective && !code ? (
          <Flag className="size-3 text-primary" aria-hidden />
        ) : code ? (
          <span className={cn('text-[0.6rem] font-bold leading-none', codeAccent)} aria-hidden>
            {code}
          </span>
        ) : null}
      </span>
    </button>
  )
}
