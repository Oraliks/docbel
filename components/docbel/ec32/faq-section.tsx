'use client'

// =====================================================================
//  eC3.2 — Section « Questions fréquentes » (présentationnel)
// ---------------------------------------------------------------------
//  Accordéon mono-ouverture. `limit` : n'affiche que les N premières
//  questions + bouton « Voir toutes les questions » qui déplie le reste.
// =====================================================================

import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import type { Ec32Content } from '@/lib/ec32/schema'
import { ec32ResolveKey, type Ec32Translator } from '@/lib/ec32/labels'
import { Ec32Card, Ec32Section } from './ui'

export function Ec32FaqSection({
  content,
  limit,
  withHeader = true,
}: {
  content: Ec32Content
  /** Si défini, n'affiche que les `limit` premières questions + « Voir toutes ». */
  limit?: number
  withHeader?: boolean
}) {
  const tRoot = useTranslations() as unknown as Ec32Translator
  const { faq } = content
  const items = faq.items.filter((item) => item.q.trim().length > 0)
  const [showAll, setShowAll] = useState(false)

  if (items.length === 0) return null

  const collapsed = typeof limit === 'number' && !showAll
  const visible = collapsed ? items.slice(0, limit) : items
  const hiddenCount = items.length - visible.length

  return (
    <Ec32Section
      id="faq"
      eyebrow={withHeader ? 'Questions fréquentes' : undefined}
      icon={withHeader ? HelpCircle : undefined}
      title={withHeader ? faq.title : undefined}
      subtitle={withHeader ? faq.subtitle : undefined}
    >
      <Ec32Card className="px-5 py-1 sm:px-6">
        <Accordion type="single" collapsible className="divide-y divide-border">
          {visible.map((item, index) => {
            const q = ec32ResolveKey(tRoot, item.questionKey, item.q)
            const a = ec32ResolveKey(tRoot, item.answerKey, item.a)
            return (
              <AccordionItem key={index} value={String(index)} className="border-b-0">
                <AccordionTrigger className="items-start gap-4 py-4 text-base font-semibold text-foreground">
                  <span className="min-w-0">{q}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                  <p className="max-w-2xl whitespace-pre-line">{a}</p>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </Ec32Card>

      {collapsed && hiddenCount > 0 && (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowAll(true)}
            className="font-semibold text-primary"
          >
            Voir toutes les questions ({items.length})
            <ChevronDown className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </Ec32Section>
  )
}
