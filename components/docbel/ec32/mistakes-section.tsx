'use client'

// =====================================================================
//  eC3.2 — Section « Erreurs fréquentes » (présentationnel)
// ---------------------------------------------------------------------
//  Grille de cartes numérotées : titre + explication + conseil mis en
//  avant + lien « En savoir plus » (ancre interne). Glass mauve, pleine
//  largeur, responsive, accessible. Consomme content.mistakes.
// =====================================================================

import { ArrowRight, Lightbulb, TriangleAlert } from 'lucide-react'
import type { Ec32Content } from '@/lib/ec32/schema'
import { Ec32Card, Ec32Section } from './ui'

export function Ec32MistakesSection({ content }: { content: Ec32Content }) {
  const { mistakes } = content
  const items = mistakes.items.filter((item) => item.title.trim().length > 0)

  if (items.length === 0) return null

  return (
    <Ec32Section
      id="erreurs"
      eyebrow="Pièges à éviter"
      icon={TriangleAlert}
      title={mistakes.title}
      subtitle={mistakes.subtitle}
    >
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" role="list">
        {items.map((item, index) => (
          <Ec32Card
            key={item.key || index}
            as="li"
            interactive
            className="flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary"
                aria-hidden
              >
                {index + 1}
              </span>
              <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">
                <span className="sr-only">{`Erreur ${index + 1} : `}</span>
                {item.title}
              </h3>
            </div>

            {item.explanation && (
              <p className="text-sm leading-relaxed text-muted-foreground">{item.explanation}</p>
            )}

            {item.advice && (
              <div className="flex gap-2.5 rounded-2xl border border-emerald-300/50 bg-emerald-50/70 p-3 text-sm leading-relaxed text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100">
                <Lightbulb
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300"
                  aria-hidden
                />
                <p className="min-w-0">
                  <span className="font-semibold">Conseil : </span>
                  {item.advice}
                </p>
              </div>
            )}

            {item.link && (
              <a
                href={item.link}
                className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full text-sm font-semibold text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                En savoir plus
                <ArrowRight className="size-3.5" aria-hidden />
              </a>
            )}
          </Ec32Card>
        ))}
      </ul>
    </Ec32Section>
  )
}
