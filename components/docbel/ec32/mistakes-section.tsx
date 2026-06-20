'use client'

// =====================================================================
//  eC3.2 — Section « Erreurs fréquentes » (présentationnel)
// ---------------------------------------------------------------------
//  Cartes numérotées : titre + explication + conseil + lien interne.
//  `priorityKeys` : met en avant ces erreurs (cartes) ; `collapseRest`
//  place les autres dans un accordéon « Voir toutes les erreurs ».
//  `limit` : aperçu compact (N cartes, pas d'accordéon).
// =====================================================================

import { Lightbulb, TriangleAlert } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { Ec32Content, Ec32MistakeItem } from '@/lib/ec32/schema'
import { Ec32Card, Ec32Section } from './ui'

function MistakeCard({ item, index }: { item: Ec32MistakeItem; index: number }) {
  return (
    <Ec32Card as="li" interactive className="flex flex-col gap-3">
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
    </Ec32Card>
  )
}

export function Ec32MistakesSection({
  content,
  priorityKeys,
  collapseRest = false,
  limit,
  withHeader = true,
}: {
  content: Ec32Content
  /** Clés des erreurs prioritaires à afficher en cartes (dans cet ordre). */
  priorityKeys?: string[]
  /** Place les erreurs non prioritaires dans un accordéon « Voir toutes les erreurs ». */
  collapseRest?: boolean
  /** Aperçu compact : n'affiche que les N premières (ignore priorityKeys). */
  limit?: number
  withHeader?: boolean
}) {
  const { mistakes } = content
  const all = mistakes.items.filter((item) => item.title.trim().length > 0)

  if (all.length === 0) return null

  // Ordonne : prioritaires d'abord (dans l'ordre fourni), puis le reste.
  let primary: Ec32MistakeItem[]
  let rest: Ec32MistakeItem[]
  if (priorityKeys && priorityKeys.length > 0) {
    primary = priorityKeys
      .map((key) => all.find((m) => m.key === key))
      .filter((m): m is Ec32MistakeItem => Boolean(m))
    const primaryKeys = new Set(primary.map((m) => m.key))
    rest = all.filter((m) => !primaryKeys.has(m.key))
  } else {
    primary = all
    rest = []
  }

  if (typeof limit === 'number') {
    primary = primary.slice(0, limit)
    rest = []
  }

  return (
    <Ec32Section
      id="erreurs"
      eyebrow={withHeader ? 'Pièges à éviter' : undefined}
      icon={withHeader ? TriangleAlert : undefined}
      title={withHeader ? mistakes.title : undefined}
      subtitle={withHeader ? mistakes.subtitle : undefined}
    >
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" role="list">
        {primary.map((item, index) => (
          <MistakeCard key={item.key || index} item={item} index={index} />
        ))}
      </ul>

      {collapseRest && rest.length > 0 && (
        <Ec32Card className="mt-5 px-5 py-1 sm:px-6">
          <Accordion type="single" collapsible>
            <AccordionItem value="all" className="border-b-0">
              <AccordionTrigger className="py-4 text-base font-semibold text-foreground">
                Voir toutes les erreurs ({all.length})
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <ul className="space-y-4" role="list">
                  {rest.map((item, index) => (
                    <li key={item.key || index} className="border-l-2 border-primary/30 pl-4">
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      {item.explanation && (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {item.explanation}
                        </p>
                      )}
                      {item.advice && (
                        <p className="mt-1 text-sm leading-relaxed text-emerald-700 dark:text-emerald-300">
                          <span className="font-semibold">Conseil : </span>
                          {item.advice}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Ec32Card>
      )}
    </Ec32Section>
  )
}
