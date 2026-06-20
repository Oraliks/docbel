'use client'

// =====================================================================
//  eC3.2 — Sélecteur de situation pour les jours sélectionnés
// ---------------------------------------------------------------------
//  Deux axes pour un jour :
//   1. Situation PRINCIPALE (EC32_PRIMARY_SITUATIONS) — radio :
//      Chômage / Travail employeur (T1) / Inaptitude (M) / Vacances (V) /
//      Autre (A).
//   2. Seconde activité « Travail ailleurs » (T2) — case à cocher CUMULABLE
//      avec n'importe quelle situation principale (T1/T2, M/T2, V/T2, ou
//      « T2 » seul si chômage). Indique qu'il y a eu deux activités dans la
//      journée (p. ex. chômage prévu mais travail ailleurs ⇒ pas de CT).
//  100 % pédagogique.
// =====================================================================

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EC32_PRIMARY_SITUATIONS, type Ec32SituationType } from '@/lib/ec32/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SITUATION_VISUALS } from '@/components/docbel/ec32/ui'

export function Ec32SituationSelector({
  selectedCount,
  value,
  secondaryWork,
  saveLabel,
  cancelLabel,
  suggestedSituation,
  situationLabel,
  onChange,
  onSecondaryChange,
  onSave,
  onCancel,
}: {
  selectedCount: number
  /** Situation principale en cours de choix (axe « statut »). */
  value: Ec32SituationType
  /** Seconde activité T2 (travail ailleurs) cochée ? */
  secondaryWork: boolean
  saveLabel: string
  cancelLabel: string
  suggestedSituation?: Ec32SituationType | null
  situationLabel: (situation: Ec32SituationType) => string
  onChange: (situation: Ec32SituationType) => void
  onSecondaryChange: (checked: boolean) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-3">
      <fieldset className="space-y-1.5">
        <legend className="sr-only">Situation principale du jour</legend>
        {EC32_PRIMARY_SITUATIONS.map((situation) => (
          <SituationOption
            key={situation}
            situation={situation}
            checked={value === situation}
            suggested={suggestedSituation === situation}
            label={situationLabel(situation)}
            onSelect={() => onChange(situation)}
          />
        ))}
      </fieldset>

      {/* Seconde activité cumulable : travail ailleurs (T2). */}
      <label
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-xl border p-2 transition-colors',
          secondaryWork
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card/60 hover:bg-primary/5',
        )}
      >
        <Checkbox
          checked={secondaryWork}
          onCheckedChange={(v) => onSecondaryChange(v === true)}
          aria-label="A aussi travaillé ailleurs ce jour-là (T2)"
        />
        <span className="min-w-0 flex-1 text-xs leading-snug text-foreground">
          <span className="font-medium">A aussi travaillé ailleurs (T2)</span>
          <span className="block text-[0.7rem] text-muted-foreground">
            Seconde activité dans la journée — se cumule (T1/T2, M/T2, V/T2…).
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 rounded px-1 text-[0.65rem] font-bold',
            SITUATION_VISUALS.work_elsewhere_usual_day.accent,
          )}
          aria-hidden
        >
          T2
        </span>
      </label>

      <div className="flex flex-col gap-2 pt-1">
        <Button type="button" size="sm" onClick={onSave} disabled={selectedCount === 0}>
          {saveLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  )
}

/** Une option de situation principale : pastille colorée + lettre + libellé. */
function SituationOption({
  situation,
  checked,
  suggested,
  label,
  onSelect,
}: {
  situation: Ec32SituationType
  checked: boolean
  suggested: boolean
  label: string
  onSelect: () => void
}) {
  const visual = SITUATION_VISUALS[situation]
  const Icon = visual.icon
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        checked
          ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
          : 'border-border bg-card/60 hover:bg-primary/5',
      )}
    >
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full border',
          visual.chip,
        )}
        aria-hidden
      >
        <Icon className={cn('size-3.5', visual.accent)} />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
        {label}
      </span>
      {suggested && (
        <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-primary">
          Suggéré
        </span>
      )}
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
        )}
        aria-hidden
      >
        {checked && <Check className="size-2.5" />}
      </span>
    </button>
  )
}
