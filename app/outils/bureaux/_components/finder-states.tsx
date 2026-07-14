// app/outils/bureaux/_components/finder-states.tsx
'use client'

import { useTranslations } from 'next-intl'
import { AlertCircle, MapPinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * États d'interface partagés de la colonne résultats (liste + carte) :
 * vide (aucun résultat / CP inconnu / aucun organisme pour la démarche),
 * erreur réseau, et squelette de chargement. Purement présentationnels —
 * `title`/`body`/`message` arrivent déjà localisés du parent (qui choisit
 * la bonne clé selon le cas : `emptyTitle`/`emptyBody`, `demarcheEmptyBody`,
 * `bureauxGenericError`…) ; seul le libellé du bouton « Réessayer » est
 * traduit ici.
 */
export function EmptyState({
  title,
  body,
  actions,
}: {
  title: string
  body: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[color:var(--glass-border)] px-6 py-12 text-center">
      <MapPinOff className="h-10 w-10 text-muted-foreground/50" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {actions && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}

/**
 * Bloc d'erreur (recherche/résolution échouée) — délibérément sobre : pas de
 * fond rouge alarmant, une icône neutre et un bouton "Réessayer" optionnel
 * (affiché seulement si le parent fournit une action de relance).
 */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  const t = useTranslations('public.outils')
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-6 py-10 text-center">
      <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" aria-hidden />
      <p className="max-w-sm text-sm text-foreground">{message}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t('errorRetry')}
        </Button>
      )}
    </div>
  )
}

/**
 * Squelette de la colonne résultats pendant la résolution : un bloc à la
 * taille de `RecommendedOfficeCard` (héros) + 4 lignes à la taille
 * `OfficeResultRow`. `Skeleton` gère déjà `prefers-reduced-motion` (classe
 * `skeleton-shimmer` dans globals.css) — pas d'animation custom ici.
 */
export function SkeletonResults() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-56 w-full rounded-3xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  )
}
