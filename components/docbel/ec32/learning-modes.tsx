'use client'

// =====================================================================
//  eC3.2 — Modes d'apprentissage
// ---------------------------------------------------------------------
//  Trois façons d'aborder la page : guidé pas à pas, vue d'ensemble,
//  exploration libre. Chaque carte mappe une icône (clé string venant
//  du contenu) vers une icône lucide, avec repli sûr.
// =====================================================================

import type { ComponentType } from 'react'
import { ArrowRight, Compass, LayoutList, type LucideProps, Sparkles } from 'lucide-react'
import { Ec32Card, Ec32Section } from '@/components/docbel/ec32/ui'
import type { Ec32Content } from '@/lib/ec32/schema'

/** Correspondance clé d'icône (contenu) → icône lucide, avec repli. */
const MODE_ICONS: Record<string, ComponentType<LucideProps>> = {
  compass: Compass,
  'layout-list': LayoutList,
  sparkles: Sparkles,
}

const FALLBACK_ICON = Sparkles

export function Ec32LearningModes({
  content,
  onAction,
}: {
  content: Ec32Content
  onAction?: (modeKey: string) => void
}) {
  const { learningModes } = content

  if (learningModes.modes.length === 0) return null

  return (
    <Ec32Section
      id="modes"
      title={learningModes.title || undefined}
      subtitle={learningModes.subtitle || undefined}
    >
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {learningModes.modes.map((mode, index) => {
          const Icon = MODE_ICONS[mode.icon] ?? FALLBACK_ICON
          const showCta = Boolean(mode.cta) && Boolean(onAction)
          return (
            <Ec32Card key={mode.key || index} interactive className="flex h-full flex-col gap-3">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              {mode.title && (
                <h3 className="text-lg font-semibold leading-tight text-foreground">{mode.title}</h3>
              )}
              {mode.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">{mode.description}</p>
              )}
              {showCta && (
                <div className="mt-auto pt-2">
                  <button
                    type="button"
                    onClick={() => onAction?.(mode.key)}
                    className="inline-flex items-center gap-1 rounded-md font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {mode.cta}
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                </div>
              )}
            </Ec32Card>
          )
        })}
      </div>
    </Ec32Section>
  )
}
