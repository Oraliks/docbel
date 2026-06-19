'use client'

// =====================================================================
//  eC3.2 — Section « Questions fréquentes » (présentationnel)
// ---------------------------------------------------------------------
//  Accordéon mono-ouverture (type="single" collapsible) : une question
//  par item de content.faq. Glass mauve, pleine largeur, accessible.
// =====================================================================

import { HelpCircle } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { Ec32Content } from '@/lib/ec32/schema'
import { Ec32Card, Ec32Section } from './ui'

export function Ec32FaqSection({ content }: { content: Ec32Content }) {
  const { faq } = content
  const items = faq.items.filter((item) => item.q.trim().length > 0)

  if (items.length === 0) return null

  return (
    <Ec32Section
      id="faq"
      eyebrow="Questions fréquentes"
      icon={HelpCircle}
      title={faq.title}
      subtitle={faq.subtitle}
    >
      <Ec32Card className="px-5 py-1 sm:px-6">
        <Accordion type="single" collapsible className="divide-y divide-border">
          {items.map((item, index) => (
            <AccordionItem key={index} value={String(index)} className="border-b-0">
              <AccordionTrigger className="items-start gap-4 py-4 text-base font-semibold text-foreground">
                <span className="min-w-0">{item.q}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                <p className="max-w-2xl whitespace-pre-line">{item.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Ec32Card>
    </Ec32Section>
  )
}
