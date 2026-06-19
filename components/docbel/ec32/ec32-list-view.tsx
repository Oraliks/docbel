'use client'

// =====================================================================
//  eC3.2 — Vue liste des jours du mois
// ---------------------------------------------------------------------
//  Liste accessible : date, situation (chip), correction éventuelle,
//  bouton « Modifier » si la carte n'est pas envoyée. Les jours grisés
//  (`not_applicable`) sont affichés en sourdine, non éditables.
// =====================================================================

import { PencilLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Ec32DayCell, Ec32SituationType } from '@/lib/ec32/types'
import { Button } from '@/components/ui/button'
import { Ec32SituationChip } from '@/components/docbel/ec32/ui'

export function Ec32ListView({
  cells,
  locked,
  labels,
  formatDate,
  situationLabel,
  onEdit,
}: {
  cells: Ec32DayCell[]
  /** Carte envoyée/verrouillée : pas de bouton « Modifier ». */
  locked: boolean
  labels: {
    date: string
    situation: string
    correction: string
    edit: string
    empty: string
  }
  /** Formate une date ISO en libellé lisible. */
  formatDate: (iso: string) => string
  situationLabel: (situation: Ec32SituationType) => string
  onEdit: (date: string) => void
}) {
  // Seuls les jours du mois sélectionné sont listés.
  const monthCells = cells.filter((c) => c.inMonth)

  if (monthCells.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div
        className="hidden grid-cols-[1fr_1.2fr_auto] gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid"
        aria-hidden
      >
        <span>{labels.date}</span>
        <span>{labels.situation}</span>
        <span className="text-right">{!locked && labels.edit}</span>
      </div>

      <ul className="divide-y divide-border">
        {monthCells.map((cell) => {
          const editable = cell.selectable && !locked
          return (
            <li
              key={cell.date}
              className={cn(
                'grid grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[1fr_1.2fr_auto] sm:gap-3',
                !cell.selectable && 'opacity-60',
              )}
            >
              <span className="text-sm font-medium text-foreground">
                {formatDate(cell.date)}
              </span>

              <span className="flex flex-col gap-1">
                <Ec32SituationChip
                  situation={cell.situation}
                  label={situationLabel(cell.situation)}
                />
                {cell.correction && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{labels.correction} : </span>
                    {cell.correction.reason}
                  </span>
                )}
              </span>

              <span className="flex justify-start sm:justify-end">
                {editable && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(cell.date)}
                    aria-label={`${labels.edit} — ${formatDate(cell.date)}`}
                  >
                    <PencilLine className="size-3.5" aria-hidden />
                    {labels.edit}
                  </Button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
