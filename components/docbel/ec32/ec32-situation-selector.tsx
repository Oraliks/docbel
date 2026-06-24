'use client'

// =====================================================================
//  eC3.2 — Sélecteur de situation pour les jours sélectionnés
// ---------------------------------------------------------------------
//  Modèle ALIGNÉ sur le vrai eC3.2 :
//   1. SITUATION PRINCIPALE (radio, 1 seul) :
//      Chômage / Travail (employeur) / Vacances (V) / Inaptitude (M) / Autre (A)
//   2. TRAVAIL AILLEURS QUE CHEZ L'EMPLOYEUR (3 cases à cocher cumulables avec le
//      primaire ; les 2 premières sont mutuellement exclusives ■ XOR ▲ ; la 3ᵉ
//      🧑‍🤝‍🧑 se cumule indépendamment).
//  Libellés ONEM verbatim. 100 % pédagogique.
// =====================================================================

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  EC32_PRIMARY_SITUATIONS,
  EC32_WORK_ELSEWHERE_EXCLUSIVE,
  EC32_WORK_ELSEWHERE_SITUATIONS,
  type Ec32SituationType,
} from '@/lib/ec32/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SITUATION_VISUALS } from '@/components/docbel/ec32/ui'

const EXCLUSIVE_SET = new Set<Ec32SituationType>(EC32_WORK_ELSEWHERE_EXCLUSIVE)

/** Libellés ONEM verbatim des 3 cases « Travail ailleurs ». `{employer}` = nom employeur. */
function workElsewhereLabel(
  t: ReturnType<typeof useTranslations<'public.ec32'>>,
  situation: Ec32SituationType,
  employerName: string,
): string {
  switch (situation) {
    case 'work_elsewhere_usual_day':
      return t('situationSelector.workElsewhere.usualDay', { employer: employerName })
    case 'work_elsewhere_non_usual_day':
      return t('situationSelector.workElsewhere.nonUsualDay', { employer: employerName })
    case 'work_other_regular_employer':
      return t('situationSelector.workElsewhere.otherRegularEmployer')
    default:
      return ''
  }
}

/** Icône glyphe pleine pour ■ / ▲ (👥 reste en trait). */
function isFilledGlyph(situation: Ec32SituationType): boolean {
  return EXCLUSIVE_SET.has(situation)
}

export function Ec32SituationSelector({
  selectedCount,
  value,
  secondaryWork,
  employerName,
  saveLabel,
  cancelLabel,
  suggestedSituation,
  situationLabel,
  onChange,
  onSecondaryToggle,
  onSave,
  onCancel,
}: {
  selectedCount: number
  /** Situation principale en cours de choix (axe « statut »). */
  value: Ec32SituationType
  /** Secondaires « travail ailleurs » cochés (sous-ensemble des 3 cases). */
  secondaryWork: Ec32SituationType[]
  /** Nom de l'employeur (injecté dans les libellés ONEM). */
  employerName: string
  saveLabel: string
  cancelLabel: string
  suggestedSituation?: Ec32SituationType | null
  situationLabel: (situation: Ec32SituationType) => string
  onChange: (situation: Ec32SituationType) => void
  /** Bascule l'état d'une des 3 cases (gère l'exclusion ■/▲ en amont). */
  onSecondaryToggle: (situation: Ec32SituationType, checked: boolean) => void
  onSave: () => void
  onCancel: () => void
}) {
  const t = useTranslations('public.ec32')
  const secondarySet = new Set(secondaryWork)
  // Règle d'exclusion : si ■ coché, ▲ doit être désactivée (et vice-versa).
  const isExclusiveDisabled = (s: Ec32SituationType): boolean => {
    if (!EXCLUSIVE_SET.has(s)) return false
    const other = EC32_WORK_ELSEWHERE_EXCLUSIVE.find((x) => x !== s)
    return other ? secondarySet.has(other) : false
  }

  return (
    <div className="space-y-4">
      {/* Bloc principal : radio des 5 situations. */}
      <fieldset className="space-y-1.5">
        <legend className="sr-only">{t('situationSelector.primaryLegend')}</legend>
        {EC32_PRIMARY_SITUATIONS.map((situation) => (
          <PrimaryOption
            key={situation}
            situation={situation}
            checked={value === situation}
            suggested={suggestedSituation === situation}
            label={
              situation === 'work_own_employer'
                ? t('situationSelector.workOwnEmployer', { employer: employerName })
                : situationLabel(situation)
            }
            onSelect={() => onChange(situation)}
          />
        ))}
      </fieldset>

      {/* Bloc secondaire : 3 cases « Travail ailleurs que chez {employeur} ». */}
      <fieldset className="space-y-2 border-t border-border/60 pt-3">
        <legend className="text-xs font-semibold text-foreground">
          {t('situationSelector.secondaryLegend', { employer: employerName })}
        </legend>
        {EC32_WORK_ELSEWHERE_SITUATIONS.map((s) => (
          <SecondaryOption
            key={s}
            situation={s}
            checked={secondarySet.has(s)}
            disabled={isExclusiveDisabled(s)}
            label={workElsewhereLabel(t, s, employerName)}
            onToggle={(v) => onSecondaryToggle(s, v)}
          />
        ))}
      </fieldset>

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

/** Lettre principale (V/M/A) — absent pour Chômage et Travail. */
const PRIMARY_LETTER: Partial<Record<Ec32SituationType, string>> = {
  vacation: 'V',
  incapacity: 'M',
  other: 'A',
}

/**
 * Swatch d'une situation principale, ALIGNÉ sur la légende du calendrier :
 *  - Chômage  → petit carré vide (case blanche bordée)
 *  - Travail  → petit carré plein violet (case pleine)
 *  - V/M/A    → lettre colorée centrée dans la case
 */
function PrimarySwatch({ situation }: { situation: Ec32SituationType }) {
  if (situation === 'temporary_unemployment') {
    return <span className="size-5 shrink-0 rounded border border-border bg-card" aria-hidden />
  }
  if (situation === 'work_own_employer') {
    return <span className="size-5 shrink-0 rounded bg-primary" aria-hidden />
  }
  const letter = PRIMARY_LETTER[situation]
  const visual = SITUATION_VISUALS[situation]
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded border border-border bg-card"
      aria-hidden
    >
      <span className={cn('text-[0.7rem] font-bold leading-none', visual.accent)}>{letter}</span>
    </span>
  )
}

/** Option de situation principale : swatch légende + libellé + check. */
function PrimaryOption({
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
  const t = useTranslations('public.ec32')
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
      <PrimarySwatch situation={situation} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
        {label}
      </span>
      {suggested && (
        <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-primary">
          {t('situationSelector.suggested')}
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

/** Une des 3 cases « Travail ailleurs ». Disabled = exclusion ■/▲. */
function SecondaryOption({
  situation,
  checked,
  disabled,
  label,
  onToggle,
}: {
  situation: Ec32SituationType
  checked: boolean
  disabled: boolean
  label: string
  onToggle: (checked: boolean) => void
}) {
  const visual = SITUATION_VISUALS[situation]
  const Icon = visual.icon
  return (
    <label
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 rounded-xl border p-2 transition-colors',
        checked
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card/60 hover:bg-primary/5',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-card/60',
      )}
    >
      {/* Swatch : case bordée avec le glyphe (■/▲/👥) — même rendu que la légende. */}
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded border border-border bg-card"
        aria-hidden
      >
        <Icon
          className={cn(
            'size-3',
            isFilledGlyph(situation) && 'fill-current',
            visual.accent,
          )}
        />
      </span>
      <span className="min-w-0 flex-1 text-[0.7rem] leading-snug text-foreground">{label}</span>
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onToggle(v === true)}
        aria-label={label}
      />
    </label>
  )
}
