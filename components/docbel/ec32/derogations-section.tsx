'use client'

// =====================================================================
//  eC3.2 — Section « Dérogations & cas particuliers » (présentationnel)
// ---------------------------------------------------------------------
//  Badge « À vérifier avant publication finale », cartes (titre +
//  résumé + conditions[] si non vide) + note de transition en encadré
//  warning. Compact, glass mauve, responsive.
// =====================================================================

import { Check, ScrollText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Ec32Content } from '@/lib/ec32/schema'
import { Ec32Card, Ec32InfoBox, Ec32Section } from './ui'

export function Ec32DerogationsSection({ content }: { content: Ec32Content }) {
  const { derogations } = content
  const items = derogations.items.filter((item) => item.title.trim().length > 0)

  if (items.length === 0 && !derogations.transitionNote) return null

  return (
    <Ec32Section
      id="derogations"
      eyebrow="Cas particuliers"
      icon={ScrollText}
      title={derogations.title}
      subtitle={derogations.subtitle}
    >
      {derogations.badge && (
        <Badge variant="warning" className="mb-4 h-auto whitespace-normal px-2.5 py-1 text-xs">
          {derogations.badge}
        </Badge>
      )}

      {items.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" role="list">
          {items.map((item, index) => {
            const conditions = item.conditions.filter((c) => c.trim().length > 0)
            return (
              <Ec32Card key={item.key || index} as="li" className="flex flex-col gap-2 p-4">
                <h3 className="text-sm font-semibold leading-snug text-foreground">{item.title}</h3>
                {item.summary && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
                )}
                {conditions.length > 0 && (
                  <ul className="mt-1 space-y-1.5" role="list">
                    {conditions.map((condition, ci) => (
                      <li key={ci} className="flex gap-2 text-sm leading-relaxed text-foreground">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0">{condition}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Ec32Card>
            )
          })}
        </ul>
      )}

      {derogations.transitionNote && (
        <Ec32InfoBox tone="warning" className="mt-4 max-w-3xl">
          {derogations.transitionNote}
        </Ec32InfoBox>
      )}
    </Ec32Section>
  )
}
