'use client'

// =====================================================================
//  eC3.2 — Grille calendrier (sélection multi-jours) + légende
// ---------------------------------------------------------------------
//  Reproduit le rendu réel de l'eC3.2 :
//   • Chômage  → case vide (rien à indiquer)
//   • Travail  → case PLEINE (violet), sans lettre
//   • Vacances/Inaptitude/Autre → lettre V / M / A
//   • Travail ailleurs (secondaire, cumulable) → icônes empilées ■ / ▲ / 👥
//   • 1er jour de chômage effectif → case verte (auto)
//   • Pas d'application → case grise (auto, inerte)
//   • 1ʳᵉ date d'envoi possible → pastille pêche derrière le numéro (auto)
//  100 % pédagogique, palette Docbel (jamais l'orange officiel ONEM).
// =====================================================================

import { Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Ec32DayCell, Ec32SituationType } from '@/lib/ec32/types'
import {
  EC32_PRIMARY_SITUATIONS,
  EC32_WORK_ELSEWHERE_SITUATIONS,
} from '@/lib/ec32/types'
import { SITUATION_VISUALS } from '@/components/docbel/ec32/ui'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const

/** Lettre de la situation PRINCIPALE (chômage = vide, travail = case pleine). */
const PRIMARY_LETTER: Partial<Record<Ec32SituationType, string>> = {
  vacation: 'V',
  incapacity: 'M',
  other: 'A',
}

/** Icône glyphe pleine pour ■ / ▲ (👥 reste en trait). */
function isFilledGlyph(situation: Ec32SituationType): boolean {
  return (
    situation === 'work_elsewhere_usual_day' ||
    situation === 'work_elsewhere_non_usual_day'
  )
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
          week.map((cell, di) => (
            <Ec32CalendarCell
              key={`${wi}-${di}-${cell.date}`}
              cell={cell}
              selected={selectedDates.has(cell.date)}
              situationLabel={situationLabel}
              disabled={disabled}
              onToggle={() => onToggleDay(cell.date)}
            />
          )),
        )}
      </div>

      <Ec32Legend legendTitle={legendTitle} situationLabel={situationLabel} />
    </div>
  )
}

// ─────────────────────────── Légende (12 types) ───────────────────────────

function Ec32Legend({
  legendTitle,
  situationLabel,
}: {
  legendTitle: string
  situationLabel: (situation: Ec32SituationType) => string
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 pt-3">
      {legendTitle && (
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {legendTitle}
        </span>
      )}

      {/* Chômage = case vide */}
      <LegendItem
        swatch={<span className="size-3 shrink-0 rounded border border-border bg-card" />}
        label={situationLabel('temporary_unemployment')}
      />
      {/* Travail = case pleine violette */}
      <LegendItem
        swatch={<span className="size-3 shrink-0 rounded bg-primary" />}
        label={situationLabel('work_own_employer')}
      />
      {/* Lettres V / M / A */}
      <LegendItem
        swatch={<LegendLetter letter="V" situation="vacation" />}
        label={situationLabel('vacation')}
      />
      <LegendItem
        swatch={<LegendLetter letter="M" situation="incapacity" />}
        label={situationLabel('incapacity')}
      />
      <LegendItem
        swatch={<LegendLetter letter="A" situation="other" />}
        label={situationLabel('other')}
      />
      {/* Travail ailleurs (secondaire) : ■ / ▲ / 👥 */}
      {EC32_WORK_ELSEWHERE_SITUATIONS.map((situation) => {
        const Icon = SITUATION_VISUALS[situation].icon
        return (
          <LegendItem
            key={situation}
            swatch={
              <Icon
                className={cn(
                  'size-3 shrink-0',
                  isFilledGlyph(situation) && 'fill-current',
                  SITUATION_VISUALS[situation].accent,
                )}
              />
            }
            label={situationLabel(situation)}
          />
        )
      })}
      {/* Notification téléphonique (auto) */}
      <LegendItem
        swatch={<Phone className="size-3 shrink-0 text-red-500" />}
        label="Notification téléphonique"
      />
      {/* 1er jour de chômage effectif (case verte, auto) */}
      <LegendItem
        swatch={<span className="size-3 shrink-0 rounded bg-emerald-400" />}
        label={situationLabel('first_effective_unemployment_day')}
      />
      {/* Pas d'application (case grise, auto) */}
      <LegendItem
        swatch={<span className="size-3 shrink-0 rounded bg-slate-300 dark:bg-slate-600" />}
        label={situationLabel('not_applicable')}
      />
      {/* 1ʳᵉ date d'envoi possible (pastille pêche) */}
      <LegendItem
        swatch={<span className="size-3 shrink-0 rounded-full bg-orange-200" />}
        label="1ʳᵉ date d'envoi possible"
      />
    </div>
  )
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {swatch}
      {label}
    </span>
  )
}

function LegendLetter({
  letter,
  situation,
}: {
  letter: string
  situation: Ec32SituationType
}) {
  return (
    <span
      className={cn(
        'inline-flex w-3 shrink-0 justify-center text-[0.7rem] font-bold leading-none',
        SITUATION_VISUALS[situation].accent,
      )}
      aria-hidden
    >
      {letter}
    </span>
  )
}

// ─────────────────────────── Case ───────────────────────────

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
  // Cases non encodables (hors mois / hors contrat) : inertes & grisées.
  if (!cell.selectable) {
    return (
      <div
        className={cn(
          'flex aspect-square min-h-8 flex-col items-center justify-center rounded-xl border border-dashed border-border/40 bg-slate-200/50 text-xs dark:bg-slate-800/40',
          cell.inMonth ? 'opacity-60' : 'opacity-35',
        )}
        aria-hidden
      >
        <span className="font-medium text-muted-foreground">{cell.day}</span>
      </div>
    )
  }

  const isWork = cell.situation === 'work_own_employer'
  const isFirstEffective =
    cell.isFirstEffectiveDay && cell.situation === 'temporary_unemployment'
  const letter = PRIMARY_LETTER[cell.situation]
  const secondary = cell.secondaryWork ?? []

  // Libellé accessible.
  const secondaryLabel =
    secondary.length > 0
      ? ` + ${secondary.map((s) => situationLabel(s)).join(', ')}`
      : ''
  const label = `Jour ${cell.day}, situation : ${situationLabel(cell.situation)}${secondaryLabel}${
    isFirstEffective ? ' (premier jour de chômage effectif)' : ''
  }${cell.isFirstSendDay ? ' (première date d’envoi possible)' : ''}${
    selected ? ' — sélectionné' : ''
  }`

  // Fond de la case.
  const cellTone = isWork
    ? 'bg-primary text-primary-foreground'
    : isFirstEffective
      ? 'bg-emerald-200/70 dark:bg-emerald-800/40'
      : 'bg-card'

  const markerColor = (situation: Ec32SituationType) =>
    isWork ? 'text-primary-foreground' : SITUATION_VISUALS[situation].accent

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      title={`${situationLabel(cell.situation)}${secondaryLabel}`}
      className={cn(
        'relative flex aspect-square min-h-8 flex-col items-center justify-center gap-0.5 rounded-xl border text-xs transition-all duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
        cellTone,
        selected
          ? 'border-primary ring-2 ring-primary/60 shadow-[0_8px_20px_-12px_rgba(91,70,229,0.45)]'
          : 'border-border/60 hover:border-primary/40 hover:shadow-[0_8px_18px_-14px_rgba(91,70,229,0.35)]',
      )}
    >
      {/* Numéro du jour (pastille pêche si 1ʳᵉ date d'envoi). */}
      <span
        className={cn(
          'flex size-5 items-center justify-center rounded-full text-xs font-semibold',
          isWork ? 'text-primary-foreground' : 'text-foreground',
          cell.isFirstSendDay && 'bg-orange-200/90 text-orange-900',
        )}
      >
        {cell.day}
      </span>

      {/* Marqueurs : lettre principale + icônes secondaires empilées. */}
      {(letter || secondary.length > 0) && (
        <span className="flex h-3 items-center justify-center gap-0.5">
          {letter && (
            <span
              className={cn('text-[0.6rem] font-bold leading-none', markerColor(cell.situation))}
              aria-hidden
            >
              {letter}
            </span>
          )}
          {secondary.map((s) => {
            const Icon = SITUATION_VISUALS[s].icon
            return (
              <Icon
                key={s}
                className={cn('size-2.5', isFilledGlyph(s) && 'fill-current', markerColor(s))}
                aria-hidden
              />
            )
          })}
        </span>
      )}
    </button>
  )
}
