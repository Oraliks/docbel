'use client'

// =====================================================================
//  eC3.2 — Section « Ressources & liens utiles » (présentationnel)
// ---------------------------------------------------------------------
//  Intro + bouton « site officiel » clairement séparé (rappel : ce
//  n'est PAS la simulation), liste de ressources (lien externe
//  optionnel) + note de non-affiliation. Glass mauve, responsive.
// =====================================================================

import { BookOpen, ExternalLink, Link2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Ec32Content } from '@/lib/ec32/schema'
import { ec32ResolveKey, type Ec32Translator } from '@/lib/ec32/labels'
import { Ec32Card, Ec32InfoBox, Ec32Section } from './ui'

export function Ec32ResourcesSection({ content }: { content: Ec32Content }) {
  const tRoot = useTranslations() as unknown as Ec32Translator
  const { resources } = content
  const items = resources.items.filter((item) => item.label.trim().length > 0)

  return (
    <Ec32Section
      id="ressources"
      eyebrow="Pour aller plus loin"
      icon={BookOpen}
      title={resources.title}
      subtitle={resources.subtitle}
    >
      {/* Liste des ressources & liens officiels */}
      {items.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {items.map((item, index) => {
              const hasUrl = item.url.trim().length > 0
              const label = ec32ResolveKey(tRoot, item.labelKey, item.label)
              const description = ec32ResolveKey(
                tRoot,
                item.descriptionKey,
                item.description,
              )
              return (
                <Ec32Card key={index} as="li" interactive className="flex flex-col gap-2">
                  <div className="flex items-start gap-2.5">
                    <Link2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 space-y-1">
                      {hasUrl ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          {label}
                          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="sr-only">(ouvre un nouvel onglet)</span>
                        </a>
                      ) : (
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                      )}
                      {description && (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {description}
                        </p>
                      )}
                    </div>
                  </div>
                </Ec32Card>
              )
            })}
          </ul>
        )}

      {resources.note && (
        <Ec32InfoBox tone="neutral" className="mt-5 max-w-3xl text-xs">
          {resources.note}
        </Ec32InfoBox>
      )}
    </Ec32Section>
  )
}
