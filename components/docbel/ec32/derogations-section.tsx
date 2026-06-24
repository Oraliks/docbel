'use client'

// =====================================================================
//  eC3.2 — Section « Dérogations & cas particuliers » (présentationnel)
// ---------------------------------------------------------------------
//  Badge « À vérifier avant publication finale », cartes (titre +
//  résumé + conditions[] si non vide) + note de transition en encadré
//  warning. Compact, glass mauve, responsive.
// =====================================================================

import { Check, ScrollText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import type { Ec32Content } from '@/lib/ec32/schema'
import { ec32ResolveKey, type Ec32Translator } from '@/lib/ec32/labels'
import { Ec32Card, Ec32InfoBox, Ec32Section } from './ui'

export function Ec32DerogationsSection({ content }: { content: Ec32Content }) {
  const tRoot = useTranslations() as unknown as Ec32Translator
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
            const title = ec32ResolveKey(tRoot, item.titleKey, item.title)
            const summary = ec32ResolveKey(tRoot, item.summaryKey, item.summary)
            const conditions = item.conditions.filter((c) => c.trim().length > 0)
            return (
              <Ec32Card key={item.key || index} as="li" className="flex flex-col gap-2 p-4">
                <h3 className="text-sm font-semibold leading-snug text-foreground">{title}</h3>
                {summary && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
                )}
                {conditions.length > 0 && (
                  <ul className="mt-1 space-y-1.5" role="list">
                    {conditions.map((condition, ci) => {
                      // Si une clé i18n parallèle est définie pour ce tableau,
                      // résoudre l'entrée par index ; sinon, fallback FR.
                      const conditionKey = item.conditionsKey
                        ? `${item.conditionsKey}.${ci}`
                        : undefined
                      const resolvedCondition = ec32ResolveKey(
                        tRoot,
                        conditionKey,
                        condition,
                      )
                      return (
                        <li
                          key={ci}
                          className="flex gap-2 text-sm leading-relaxed text-foreground"
                        >
                          <Check
                            className="mt-0.5 size-3.5 shrink-0 text-primary"
                            aria-hidden
                          />
                          <span className="min-w-0">{resolvedCondition}</span>
                        </li>
                      )
                    })}
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
