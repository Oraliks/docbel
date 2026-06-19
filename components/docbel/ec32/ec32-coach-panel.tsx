'use client'

// =====================================================================
//  eC3.2 — Panneau « Coach Docbel »
// ---------------------------------------------------------------------
//  Affiche l'intro du coach + le conseil de l'étape courante + une
//  éventuelle astuce de cas pratique. Sur mobile, se place SOUS le
//  simulateur (géré par la grille du parent). 100 % pédagogique.
// =====================================================================

import { Lightbulb, MessageCircleHeart, Sparkles } from 'lucide-react'
import type { Ec32StepKey } from '@/lib/ec32/types'
import { Ec32InfoBox } from '@/components/docbel/ec32/ui'

export interface Ec32CoachTip {
  stepKey: string
  message: string
}

export function Ec32CoachPanel({
  title,
  intro,
  tips,
  activeStep,
  scenarioHint,
}: {
  title: string
  intro: string
  tips: Ec32CoachTip[]
  activeStep: Ec32StepKey
  /** Astuce contextuelle d'un cas pratique chargé (optionnelle). */
  scenarioHint?: string | null
}) {
  const tip = tips.find((t) => t.stepKey === activeStep)?.message?.trim()

  return (
    <aside
      aria-label={title || 'Coach Docbel'}
      className="rounded-3xl border border-primary/20 bg-primary/5 p-5 shadow-sm backdrop-blur-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
          aria-hidden
        >
          <MessageCircleHeart className="size-5" />
        </span>
        <h3 className="text-base font-bold text-foreground">{title || 'Coach Docbel'}</h3>
      </div>

      {intro && (
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{intro}</p>
      )}

      {tip && (
        <div className="flex gap-3 rounded-2xl border border-primary/20 bg-card/70 p-3">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground">{tip}</p>
        </div>
      )}

      {scenarioHint && (
        <Ec32InfoBox tone="success" icon={Sparkles} className="mt-3" title="Astuce du cas pratique">
          {scenarioHint}
        </Ec32InfoBox>
      )}
    </aside>
  )
}
