'use client'

// =====================================================================
//  eC3.2 — Sélecteur de situation pour les jours sélectionnés
// ---------------------------------------------------------------------
//  Liste des situations encodables (EC32_SELECTABLE_SITUATIONS) avec le
//  sous-groupe « Travail ailleurs » regroupé. Chaque option = label +
//  description courte (depuis le contenu, repli sur la situation par
//  défaut). Bouton « Enregistrer ce(s) jour(s) ». 100 % pédagogique.
// =====================================================================

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  EC32_SELECTABLE_SITUATIONS,
  EC32_WORK_ELSEWHERE_SITUATIONS,
  type Ec32SituationType,
} from '@/lib/ec32/types'
import { Button } from '@/components/ui/button'
import { SITUATION_VISUALS } from '@/components/docbel/ec32/ui'

const WORK_ELSEWHERE_SET = new Set<Ec32SituationType>(EC32_WORK_ELSEWHERE_SITUATIONS)

export function Ec32SituationSelector({
  selectedCount,
  value,
  groupLabel,
  saveLabel,
  cancelLabel,
  suggestedSituation,
  situationLabel,
  situationDescription,
  compact = false,
  onChange,
  onSave,
  onCancel,
}: {
  selectedCount: number
  value: Ec32SituationType
  groupLabel: string
  saveLabel: string
  cancelLabel: string
  suggestedSituation?: Ec32SituationType | null
  situationLabel: (situation: Ec32SituationType) => string
  situationDescription: (situation: Ec32SituationType) => string
  /** Mode compact : cache les descriptions, réduit les icônes et le padding. */
  compact?: boolean
  onChange: (situation: Ec32SituationType) => void
  onSave: () => void
  onCancel: () => void
}) {
  const simpleSituations = EC32_SELECTABLE_SITUATIONS.filter(
    (s) => !WORK_ELSEWHERE_SET.has(s),
  )

  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      <fieldset className={compact ? 'space-y-1' : 'space-y-2'}>
        <legend className="sr-only">Situations encodables</legend>

        {simpleSituations.map((situation) => (
          <SituationOption
            key={situation}
            situation={situation}
            checked={value === situation}
            suggested={suggestedSituation === situation}
            label={situationLabel(situation)}
            description={situationDescription(situation)}
            compact={compact}
            onSelect={() => onChange(situation)}
          />
        ))}

        <div className={cn('rounded-2xl border border-border/70 bg-muted/30', compact ? 'p-2' : 'p-3')}>
          <p className={cn('font-semibold uppercase tracking-wide text-muted-foreground', compact ? 'mb-1 text-[0.6rem]' : 'mb-2 text-xs')}>
            {groupLabel}
          </p>
          <div className={compact ? 'space-y-1' : 'space-y-2'}>
            {EC32_WORK_ELSEWHERE_SITUATIONS.map((situation) => (
              <SituationOption
                key={situation}
                situation={situation}
                checked={value === situation}
                suggested={suggestedSituation === situation}
                label={situationLabel(situation)}
                description={situationDescription(situation)}
                compact={compact}
                onSelect={() => onChange(situation)}
              />
            ))}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Button type="button" size={compact ? 'sm' : 'default'} onClick={onSave} disabled={selectedCount === 0}>
          {saveLabel}
        </Button>
        <Button type="button" variant="ghost" size={compact ? 'sm' : 'default'} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  )
}

function SituationOption({
  situation,
  checked,
  suggested,
  label,
  description,
  compact = false,
  onSelect,
}: {
  situation: Ec32SituationType
  checked: boolean
  suggested: boolean
  label: string
  description: string
  compact?: boolean
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
        'flex w-full items-center rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        compact ? 'gap-2 p-1.5' : 'gap-3 rounded-2xl p-3',
        checked
          ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
          : 'border-border bg-card/60 hover:bg-primary/5',
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border',
          compact ? 'size-5' : 'size-8 mt-0.5',
          visual.chip,
        )}
        aria-hidden
      >
        <Icon className={cn(compact ? 'size-3' : 'size-4', visual.accent)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn('font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>{label}</span>
          {suggested && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-primary">
              Suggéré
            </span>
          )}
        </span>
        {!compact && description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
        )}
        aria-hidden
      >
        {checked && <Check className="size-3" />}
      </span>
    </button>
  )
}
