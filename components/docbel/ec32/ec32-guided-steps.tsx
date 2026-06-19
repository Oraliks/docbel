'use client'

// =====================================================================
//  eC3.2 — Stepper guidé (8 étapes)
// ---------------------------------------------------------------------
//  Desktop : rail horizontal cliquable (on ne peut revenir que sur une
//  étape déjà atteinte). Mobile : compact (étape courante + progression
//  + flèches précédent/suivant). 100 % pédagogique, aucune donnée réelle.
// =====================================================================

import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  CalendarDays,
  CalendarCheck,
  LogIn,
  Building2,
  PencilLine,
  ListChecks,
  Send,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { EC32_STEPS, type Ec32StepKey } from '@/lib/ec32/types'

export interface Ec32GuidedStep {
  key: Ec32StepKey
  title: string
}

const STEP_ICONS: Record<Ec32StepKey, ComponentType<{ className?: string }>> = {
  login: LogIn,
  declaration: FileSignature,
  employer: Building2,
  month: CalendarDays,
  calendar: CalendarCheck,
  correction: PencilLine,
  verify: ListChecks,
  send: Send,
}

export function Ec32GuidedSteps({
  steps,
  activeStep,
  maxReachedIndex,
  onSelectStep,
}: {
  /** Étapes (titres éditables) ; l'ordre suit EC32_STEPS. */
  steps: Ec32GuidedStep[]
  activeStep: Ec32StepKey
  /** Index maximal déjà atteint (les étapes ≤ sont cliquables). */
  maxReachedIndex: number
  onSelectStep: (key: Ec32StepKey) => void
}) {
  const orderedSteps = EC32_STEPS.map((key, idx) => {
    const found = steps.find((s) => s.key === key)
    return {
      key,
      title: found?.title?.trim() || defaultStepTitle(key),
      index: idx,
    }
  })

  const activeIndex = orderedSteps.findIndex((s) => s.key === activeStep)
  const total = orderedSteps.length
  const current = orderedSteps[activeIndex] ?? orderedSteps[0]

  const goRelative = (delta: number): void => {
    const target = orderedSteps[activeIndex + delta]
    if (!target) return
    if (target.index <= maxReachedIndex) onSelectStep(target.key)
  }

  return (
    <nav aria-label="Étapes de la simulation" className="w-full">
      {/* ── Desktop : rail horizontal ── */}
      <ol className="hidden flex-wrap items-stretch gap-1.5 md:flex" role="list">
        {orderedSteps.map((step) => {
          const isActive = step.key === activeStep
          const isDone = step.index < activeIndex
          const reachable = step.index <= maxReachedIndex
          const Icon = STEP_ICONS[step.key]
          return (
            <li key={step.key} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => reachable && onSelectStep(step.key)}
                disabled={!reachable}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isActive
                    ? 'border-primary/50 bg-primary/10 text-foreground shadow-sm'
                    : reachable
                      ? 'border-border bg-card/60 text-foreground hover:bg-primary/5'
                      : 'cursor-not-allowed border-border/60 bg-muted/30 text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isDone
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground',
                  )}
                  aria-hidden
                >
                  {isDone ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Étape {step.index + 1}
                  </span>
                  <span className="block truncate text-xs font-medium leading-tight">
                    {step.title}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* ── Mobile : compact ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-3 md:hidden">
        <button
          type="button"
          onClick={() => goRelative(-1)}
          disabled={activeIndex <= 0}
          aria-label="Étape précédente"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Étape {current.index + 1} sur {total}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{current.title}</p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={current.index + 1}
            aria-label="Progression de la simulation"
          >
            <span
              className="block h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${((current.index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => goRelative(1)}
          disabled={
            activeIndex >= total - 1 ||
            (orderedSteps[activeIndex + 1]?.index ?? Infinity) > maxReachedIndex
          }
          aria-label="Étape suivante"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  )
}

function defaultStepTitle(key: Ec32StepKey): string {
  const map: Record<Ec32StepKey, string> = {
    login: 'Connexion simulée',
    declaration: 'Déclaration sur l’honneur',
    employer: 'Choix de l’employeur',
    month: 'Choix du mois',
    calendar: 'Remplir le calendrier',
    correction: 'Corriger une erreur',
    verify: 'Vérifier',
    send: 'Envoyer',
  }
  return map[key]
}
