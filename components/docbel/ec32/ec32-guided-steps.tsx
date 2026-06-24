'use client'

// =====================================================================
//  eC3.2 — Stepper guidé (8 étapes)
// ---------------------------------------------------------------------
//  Desktop : rail horizontal cliquable (on ne peut revenir que sur une
//  étape déjà atteinte). Mobile : compact (étape courante + progression
//  + flèches précédent/suivant). 100 % pédagogique, aucune donnée réelle.
// =====================================================================

import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { EC32_STEPS, type Ec32StepKey } from '@/lib/ec32/types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface Ec32GuidedStep {
  key: Ec32StepKey
  title: string
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
  const t = useTranslations('public.ec32')
  const orderedSteps = EC32_STEPS.map((key, idx) => {
    const found = steps.find((s) => s.key === key)
    return {
      key,
      title: found?.title?.trim() || defaultStepTitle(key, t),
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
    <nav aria-label={t('guidedSteps.navAriaLabel')} className="w-full">
      {/* ── Desktop : stepper numéroté connecté (chiffres seuls, libellé en
          tooltip pour rester compact sur une seule ligne), centré ── */}
      <TooltipProvider delay={120}>
        <ol
          className="hidden flex-wrap items-center justify-center gap-y-2 md:flex"
          role="list"
        >
          {orderedSteps.map((step, i) => {
            const isActive = step.key === activeStep
            const isDone = step.index < activeIndex
            const reachable = step.index <= maxReachedIndex
            // Le connecteur AVANT ce nœud est violet si le nœud est atteint (fait/actif).
            const connectorOn = isDone || isActive
            return (
              <li key={step.key} className="flex flex-none items-center">
                {i > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      'mx-1.5 h-px w-6 shrink-0 rounded-full lg:w-9',
                      connectorOn ? 'bg-primary/40' : 'bg-border',
                    )}
                  />
                )}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => reachable && onSelectStep(step.key)}
                        aria-disabled={!reachable}
                        aria-current={isActive ? 'step' : undefined}
                        aria-label={t('guidedSteps.stepAriaLabel', {
                          index: step.index + 1,
                          title: step.title,
                        })}
                        className={cn(
                          'flex size-8 flex-none items-center justify-center rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                          isActive
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                            : isDone
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : reachable
                                ? 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-foreground'
                                : 'cursor-not-allowed bg-muted text-muted-foreground/50',
                        )}
                      >
                        {isDone ? <Check className="size-4" aria-hidden /> : step.index + 1}
                      </button>
                    }
                  />
                  <TooltipContent side="bottom">
                    {t('guidedSteps.stepTooltip', {
                      index: step.index + 1,
                      title: step.title,
                    })}
                  </TooltipContent>
                </Tooltip>
              </li>
            )
          })}
        </ol>
      </TooltipProvider>

      {/* ── Mobile : compact ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-3 md:hidden">
        <button
          type="button"
          onClick={() => goRelative(-1)}
          disabled={activeIndex <= 0}
          aria-label={t('guidedSteps.previousAriaLabel')}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('guidedSteps.mobileCounter', { index: current.index + 1, total })}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{current.title}</p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={current.index + 1}
            aria-label={t('guidedSteps.progressAriaLabel')}
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
          aria-label={t('guidedSteps.nextAriaLabel')}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  )
}

function defaultStepTitle(
  key: Ec32StepKey,
  t: ReturnType<typeof useTranslations>,
): string {
  const map: Record<Ec32StepKey, string> = {
    login: t('guidedSteps.defaultTitles.login'),
    declaration: t('guidedSteps.defaultTitles.declaration'),
    employer: t('guidedSteps.defaultTitles.employer'),
    month: t('guidedSteps.defaultTitles.month'),
    calendar: t('guidedSteps.defaultTitles.calendar'),
    correction: t('guidedSteps.defaultTitles.correction'),
    verify: t('guidedSteps.defaultTitles.verify'),
    send: t('guidedSteps.defaultTitles.send'),
  }
  return map[key]
}
