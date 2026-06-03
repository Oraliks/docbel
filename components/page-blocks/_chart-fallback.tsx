import { cn } from '@/lib/utils'

/**
 * Fallback partagé pour les vues graphiques (recharts) chargées en `dynamic`.
 * Remplit le conteneur dimensionné déjà rendu par le bloc → pas de CLS pendant
 * le chargement du chunk recharts (sorti du bundle public initial).
 */
export function ChartBlockFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn('skeleton-shimmer h-full w-full rounded-md', className)}
      aria-hidden
    />
  )
}
