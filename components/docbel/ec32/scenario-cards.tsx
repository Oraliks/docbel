'use client'

// =====================================================================
//  eC3.2 — Cartes de cas pratiques
// ---------------------------------------------------------------------
//  Catalogue des scénarios chargeables dans le simulateur. Chaque carte
//  est cliquable en entier (charge la clé via onSelect) et affiche un
//  badge d'icône coloré selon la situation, le titre, un court extrait,
//  puis une rangée niveau/durée.
//  `limit` : n'affiche que les N premiers + bouton « Voir tous les cas
//  pratiques » (onViewAll) — utilisé pour l'aperçu compact de l'onglet Démo.
// =====================================================================

import { ArrowRight, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Ec32Section, SITUATION_VISUALS } from '@/components/docbel/ec32/ui'
import type { Ec32Content } from '@/lib/ec32/schema'
import { ec32ResolveKey, type Ec32Translator } from '@/lib/ec32/labels'
import type { Ec32SituationType } from '@/lib/ec32/types'

/** Mappe une clé de scénario vers un type de situation (pour la couleur/icône). */
const SCENARIO_SITUATION: Record<string, Ec32SituationType> = {
  'all-month': 'temporary_unemployment',
  'work-own': 'work_own_employer',
  'work-elsewhere-usual': 'work_elsewhere_usual_day',
  'work-elsewhere-weekend': 'work_elsewhere_non_usual_day',
  'other-regular': 'work_other_regular_employer',
  sick: 'incapacity',
  vacation: 'vacation',
  'other-situation': 'other',
  'multiple-employers': 'work_other_regular_employer',
  'no-payment-org': 'other',
  correction: 'other',
  'construction-cp124': 'work_own_employer',
  'first-effective-day': 'first_effective_unemployment_day',
  'wrong-month': 'other',
}

/** Tinte le badge de niveau selon son libellé (repli secondary). */
function levelBadge(level: string) {
  const normalized = level.trim().toLowerCase()
  if (normalized.startsWith('débutant') || normalized.startsWith('debutant')) {
    return (
      <Badge className="border-transparent bg-emerald-100 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        {level}
      </Badge>
    )
  }
  if (normalized.startsWith('intermédiaire') || normalized.startsWith('intermediaire')) {
    return (
      <Badge className="border-transparent bg-amber-100 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        {level}
      </Badge>
    )
  }
  if (normalized.startsWith('avancé') || normalized.startsWith('avance')) {
    return (
      <Badge className="border-transparent bg-rose-100 font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
        {level}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="font-medium">
      {level}
    </Badge>
  )
}

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
  const t = useTranslations('public.ec32')
  // `tRoot` est utilisé pour résoudre les *Key i18n (ex. `public.ec32Content.scenarios.…`).
  const tRoot = useTranslations() as unknown as Ec32Translator
  const { scenarios } = content
  const all = scenarios.items.filter((item) => (item.title || item.key).trim().length > 0)

  if (all.length === 0) return null

  const limited = typeof limit === 'number' ? all.slice(0, limit) : all
  const hasMore = typeof limit === 'number' && all.length > limited.length

  const grid = (
    <ul className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {limited.map((item, index) => {
        const title = ec32ResolveKey(tRoot, item.titleKey, item.title)
        const context = ec32ResolveKey(tRoot, item.contextKey, item.context)
        const objective = ec32ResolveKey(tRoot, item.objectiveKey, item.objective)
        const level = ec32ResolveKey(tRoot, item.levelKey, item.level)
        const duration = ec32ResolveKey(tRoot, item.durationKey, item.duration)
        const excerpt = context || objective
        const situation = SCENARIO_SITUATION[item.key] ?? 'temporary_unemployment'
        const visual = SITUATION_VISUALS[situation]
        const Icon = visual.icon
        return (
          <li key={item.key || index} className="flex">
            <button
              type="button"
              onClick={() => onSelect?.(item.key)}
              disabled={!onSelect}
              aria-label={t('scenarios.cardAriaLabel', { label: title || item.key })}
              className="flex w-full flex-col gap-3 rounded-3xl border border-primary/10 bg-card p-5 text-left shadow-[0_1px_3px_rgba(26,26,36,0.05),0_16px_38px_-22px_rgba(91,70,229,0.24)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_2px_6px_rgba(26,26,36,0.06),0_22px_46px_-22px_rgba(91,70,229,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:border-primary/10 disabled:hover:shadow-[0_1px_3px_rgba(26,26,36,0.05),0_16px_38px_-22px_rgba(91,70,229,0.24)]"
            >
              <span
                className={`flex size-11 items-center justify-center rounded-2xl ${visual.chip}`}
                aria-hidden
              >
                <Icon className={`size-5 ${visual.accent}`} />
              </span>

              {title && (
                <h3 className="text-base font-semibold leading-snug text-foreground">
                  {title}
                </h3>
              )}

              {excerpt && (
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {excerpt}
                </p>
              )}

              {(level || duration) && (
                <div className="mt-auto flex items-center gap-2 pt-1">
                  {level && levelBadge(level)}
                  {duration && (
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden />
                      {duration}
                    </span>
                  )}
                </div>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )

  // Mode COMPACT : header avec titre à gauche + « Voir tous » à droite.
  if (hasMore && onViewAll) {
    return (
      <section id={anchorId} className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            {withHeader && scenarios.title && (
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {scenarios.title}
              </h2>
            )}
            {withHeader && scenarios.subtitle && (
              <p className="text-sm text-muted-foreground">{scenarios.subtitle}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onViewAll}
            className="font-semibold text-primary"
          >
            {t('scenarios.viewAll', { count: all.length })}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
        {grid}
      </section>
    )
  }

  // Mode complet : header classique <Ec32Section>.
  return (
    <Ec32Section
      id={anchorId}
      title={withHeader ? scenarios.title || undefined : undefined}
      subtitle={withHeader ? scenarios.subtitle || undefined : undefined}
    >
      {grid}
    </Ec32Section>
  )
}
