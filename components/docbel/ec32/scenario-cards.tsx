'use client'

// =====================================================================
//  eC3.2 — Cartes de cas pratiques
// ---------------------------------------------------------------------
//  Catalogue des scénarios chargeables dans le simulateur. Chaque carte
//  affiche le titre, les badges niveau/durée, un court extrait, et un
//  bouton « Charger dans le simulateur » qui remonte la clé via onSelect.
// =====================================================================

import { PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Ec32Card, Ec32Section } from '@/components/docbel/ec32/ui'
import type { Ec32Content } from '@/lib/ec32/schema'

export function Ec32ScenarioCards({
  content,
  onSelect,
}: {
  content: Ec32Content
  onSelect?: (key: string) => void
}) {
  const { scenarios } = content

  if (scenarios.items.length === 0) return null

  return (
    <Ec32Section
      id="cas-pratiques"
      title={scenarios.title || undefined}
      subtitle={scenarios.subtitle || undefined}
    >
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scenarios.items.map((item, index) => {
          const excerpt = item.context || item.objective
          return (
            <Ec32Card
              key={item.key || index}
              as="li"
              interactive
              className="flex flex-col gap-3"
            >
              {item.title && (
                <h3 className="text-base font-semibold leading-snug text-foreground">
                  {item.title}
                </h3>
              )}

              {(item.level || item.duration) && (
                <div className="flex flex-wrap items-center gap-2">
                  {item.level && (
                    <Badge variant="secondary" className="font-medium">
                      {item.level}
                    </Badge>
                  )}
                  {item.duration && (
                    <Badge variant="outline" className="font-medium">
                      {item.duration}
                    </Badge>
                  )}
                </div>
              )}

              {excerpt && (
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {excerpt}
                </p>
              )}

              <div className="mt-auto pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => onSelect?.(item.key)}
                  disabled={!onSelect}
                  aria-label={`Charger le cas pratique « ${item.title || item.key} » dans le simulateur`}
                >
                  <PlayCircle className="size-4" aria-hidden />
                  Charger dans le simulateur
                </Button>
              </div>
            </Ec32Card>
          )
        })}
      </ul>
    </Ec32Section>
  )
}
