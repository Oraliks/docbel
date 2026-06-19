'use client'

// =====================================================================
//  eC3.2 — Onglet « Règles importantes » (accordéon de compléments)
// ---------------------------------------------------------------------
//  Regroupe les contenus longs en accordéons repliés par défaut, en
//  COMPLÉMENT du simulateur (pas un doublon intégral). Tout le texte
//  provient de champs déjà éditables dans le builder : officialInfo,
//  derogations, mistakes, et les notices/situations du simulateur.
// =====================================================================

import type { ReactNode } from 'react'
import { BookMarked, Check } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { Ec32Content } from '@/lib/ec32/schema'
import { ec32Notice } from '@/lib/ec32/labels'
import { EC32_WORK_ELSEWHERE_SITUATIONS } from '@/lib/ec32/types'
import { Ec32Card, Ec32Section } from './ui'

interface RuleEntry {
  id: string
  title: string
  body: ReactNode
}

function Paragraphs({ texts }: { texts: string[] }) {
  const cleaned = texts.filter((t) => t.trim().length > 0)
  if (cleaned.length === 0) return null
  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      {cleaned.map((t, i) => (
        <p key={i} className="max-w-3xl whitespace-pre-line">
          {t}
        </p>
      ))}
    </div>
  )
}

function CheckList({ title, items }: { title?: string; items: string[] }) {
  const cleaned = items.filter((i) => i.trim().length > 0)
  if (cleaned.length === 0) return null
  return (
    <div className="space-y-2">
      {title && (
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
      )}
      <ul className="space-y-2" role="list">
        {cleaned.map((item, index) => (
          <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Ec32RulesSection({ content }: { content: Ec32Content }) {
  const { officialInfo, derogations, mistakes, simulator } = content

  const notice = (key: string): string =>
    simulator.notices.find((n) => n.key === key)?.text || ec32Notice(key)
  const mistake = (key: string) => mistakes.items.find((m) => m.key === key)

  const cp124 = mistake('ignorer-regle-cp124')
  const workElsewhere = simulator.situations.filter((s) =>
    (EC32_WORK_ELSEWHERE_SITUATIONS as readonly string[]).includes(s.type),
  )
  const obligation = officialInfo.obligation
  const why = officialInfo.why
  const whyItems = why.items.filter((i) => i.trim().length > 0)

  const entries: RuleEntry[] = []

  // 1 — Obligation à partir du 1er janvier 2025
  if (obligation.title || obligation.workers.length || obligation.employers.length) {
    entries.push({
      id: 'obligation',
      title: obligation.title || 'Obligation à partir du 1er janvier 2025',
      body: (
        <div className="space-y-4">
          {obligation.intro && (
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {obligation.intro}
            </p>
          )}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <CheckList title={obligation.workersTitle} items={obligation.workers} />
            <CheckList title={obligation.employersTitle} items={obligation.employers} />
          </div>
        </div>
      ),
    })
  }

  // 2 — Dérogations & exception CP 327
  const derogItems = derogations.items.filter((d) => d.title.trim().length > 0)
  if (derogItems.length > 0 || derogations.transitionNote) {
    entries.push({
      id: 'derogations',
      title: derogations.title || 'Dérogations & exception CP 327',
      body: (
        <div className="space-y-4">
          <ul className="space-y-4" role="list">
            {derogItems.map((d, i) => {
              const conds = d.conditions.filter((c) => c.trim().length > 0)
              return (
                <li key={d.key || i} className="border-l-2 border-primary/30 pl-4">
                  <p className="text-sm font-semibold text-foreground">{d.title}</p>
                  {d.summary && (
                    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                      {d.summary}
                    </p>
                  )}
                  {conds.length > 0 && (
                    <ul className="mt-2 space-y-1.5" role="list">
                      {conds.map((c, ci) => (
                        <li
                          key={ci}
                          className="flex gap-2 text-sm leading-relaxed text-foreground"
                        >
                          <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                          <span className="min-w-0">{c}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
          {derogations.transitionNote && (
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {derogations.transitionNote}
            </p>
          )}
        </div>
      ),
    })
  }

  // 3 — Construction (CP 124)
  if (cp124) {
    entries.push({
      id: 'cp124',
      title: 'Construction (CP 124)',
      body: <Paragraphs texts={[cp124.explanation, cp124.advice]} />,
    })
  }

  // 4 — Organisme de paiement
  entries.push({
    id: 'organisme',
    title: 'Organisme de paiement',
    body: <Paragraphs texts={[notice('send.noPaymentOrg'), notice('send.notNeeded')]} />,
  })

  // 5 — Travail ailleurs
  if (workElsewhere.length > 0) {
    entries.push({
      id: 'travail-ailleurs',
      title: 'Travail ailleurs',
      body: (
        <ul className="space-y-3" role="list">
          {workElsewhere.map((s) => (
            <li key={s.type} className="border-l-2 border-primary/30 pl-4">
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              {s.description && (
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {s.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      ),
    })
  }

  // 6 — Corriger une erreur
  entries.push({
    id: 'correction',
    title: 'Corriger une erreur',
    body: <Paragraphs texts={[notice('correction.help')]} />,
  })

  // 7 — Première date d'envoi possible
  entries.push({
    id: 'premiere-date-envoi',
    title: 'Première date d’envoi possible',
    body: <Paragraphs texts={[notice('send.firstSendBefore')]} />,
  })

  // 8 — Pourquoi l'eC3.2 ?
  if (why.title || whyItems.length > 0) {
    entries.push({
      id: 'pourquoi',
      title: why.title || 'Pourquoi l’eC3.2 ?',
      body: (
        <div className="space-y-3">
          {whyItems.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="list">
              {whyItems.map((item, index) => (
                <li
                  key={index}
                  className="flex gap-2 text-sm leading-relaxed text-foreground"
                >
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
          )}
          {why.note && (
            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{why.note}</p>
          )}
        </div>
      ),
    })
  }

  if (entries.length === 0) return null

  return (
    <Ec32Section
      id="regles"
      eyebrow="À garder en tête"
      icon={BookMarked}
      title="Règles importantes"
      subtitle="Les compléments du simulateur, regroupés par thème. Dépliez une rubrique."
    >
      <Ec32Card className="px-5 py-1 sm:px-6">
        <Accordion type="single" collapsible className="divide-y divide-border">
          {entries.map((entry) => (
            <AccordionItem key={entry.id} value={entry.id} className="border-b-0">
              <AccordionTrigger className="py-4 text-left text-base font-semibold text-foreground">
                {entry.title}
              </AccordionTrigger>
              <AccordionContent className="pb-5">{entry.body}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Ec32Card>
    </Ec32Section>
  )
}
