'use client'

// =====================================================================
//  eC3.2 — Cartes de cas pratiques
// ---------------------------------------------------------------------
//  Catalogue des scénarios chargeables dans le simulateur. Chaque carte
//  affiche le titre, les badges niveau/durée, un court extrait, et un
//  bouton « Charger dans le simulateur » qui remonte la clé via onSelect.
//  `limit` : n'affiche que les N premiers + bouton « Voir tous les cas
//  pratiques » (onViewAll) — utilisé pour l'aperçu compact de l'onglet Démo.
// =====================================================================

import { ArrowRight, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Ec32Card, Ec32Section } from '@/components/docbel/ec32/ui'
import type { Ec32Content } from '@/lib/ec32/schema'

export function Ec32ScenarioCards({
  content,
  onSelect,
  limit,
  onViewAll,
  withHeader = true,
  anchorId,
}: {
  content: Ec32Content
  onSelect?: (key: string) => void
  /** Si défini, n'affiche que les `limit` premiers cas (aperçu compact). */
  limit?: number
  /** Callback du bouton « Voir tous les cas pratiques » (aperçu compact). */
  onViewAll?: () => void
  /** Affiche l'en-tête de section (titre/sous-titre). */
  withHeader?: boolean
  /** id d'ancrage de la section (évite les doublons entre aperçu et onglet complet). */
  anchorId?: string
}) {
  const { scenarios } = content
  const all = scenarios.items.filter((item) => (item.title || item.key).trim().length > 0)

  if (all.length === 0) return null

  const limited = typeof limit === 'number' ? all.slice(0, limit) : all
  const hasMore = typeof limit === 'number' && all.length > limited.length

  return (
    <Ec32Section
      id={anchorId}
      title={withHeader ? scenarios.title || undefined : undefined}
      subtitle={withHeader ? scenarios.subtitle || undefined : undefined}
    >
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {limited.map((item, index) => {
          const excerpt = item.context || item.objective
          return (
            <Ec32Card key={item.key || index} as="li" interactive className="flex flex-col gap-3">
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
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
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

      {hasMore && onViewAll && (
        <div className="mt-5 flex justify-center">
          <Button type="button" variant="ghost" onClick={onViewAll} className="font-semibold text-primary">
            Voir tous les cas pratiques ({all.length})
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </Ec32Section>
  )
}
