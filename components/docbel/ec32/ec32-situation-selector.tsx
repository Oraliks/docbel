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
  onChange,
  onSave,
  onCancel,
}: {
  /** Nombre de jours sélectionnés (active/désactive l'enregistrement). */
  selectedCount: number
  /** Situation en cours de choix dans le panneau. */
  value: Ec32SituationType
  /** Titre du sous-groupe « Travail ailleurs ». */
  groupLabel: string
  saveLabel: string
  cancelLabel: string
  /** Situation suggérée (mise en avant via un cas pratique). */
  suggestedSituation?: Ec32SituationType | null
  situationLabel: (situation: Ec32SituationType) => string
  situationDescription: (situation: Ec32SituationType) => string
  onChange: (situation: Ec32SituationType) => void
  onSave: () => void
  onCancel: () => void
}) {
  // Sépare les situations « simples » du sous-groupe « Travail ailleurs ».
  const simpleSituations = EC32_SELECTABLE_SITUATIONS.filter(
    (s) => !WORK_ELSEWHERE_SET.has(s),
  )

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="sr-only">Situations encodables</legend>

        {simpleSituations.map((situation) => (
          <SituationOption
            key={situation}
            situation={situation}
            checked={value === situation}
            suggested={suggestedSituation === situation}
            label={situationLabel(situation)}
            description={situationDescription(situation)}
            onSelect={() => onChange(situation)}
          />
        ))}

        <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {groupLabel}
          </p>
          <div className="space-y-2">
            {EC32_WORK_ELSEWHERE_SITUATIONS.map((situation) => (
              <SituationOption
                key={situation}
                situation={situation}
                checked={value === situation}
                suggested={suggestedSituation === situation}
                label={situationLabel(situation)}
                description={situationDescription(situation)}
                onSelect={() => onChange(situation)}
              />
            ))}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" onClick={onSave} disabled={selectedCount === 0}>
          {saveLabel}
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
  onSelect,
}: {
  situation: Ec32SituationType
  checked: boolean
  suggested: boolean
  label: string
  description: string
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
        'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        checked
          ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
          : 'border-border bg-card/60 hover:bg-primary/5',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border',
          visual.chip,
        )}
        aria-hidden
      >
        <Icon className={cn('size-4', visual.accent)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {suggested && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
              Suggéré
            </span>
          )}
        </span>
        {description && (
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
