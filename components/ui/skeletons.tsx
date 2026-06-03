import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Briques de skeleton réutilisables pour les fichiers `loading.tsx`.
 *
 * Toutes réutilisent le primitive partagé <Skeleton/> (classe
 * `skeleton-shimmer`). But : éviter de redupliquer des skeletons quasi
 * identiques dans chaque route (cf. règle perf d'AGENTS.md). On compose ces
 * briques par route pour obtenir un squelette proche du rendu final et limiter
 * le CLS.
 *
 * Container admin standard : `flex flex-col gap-6 py-6 px-4 lg:px-6`.
 */

/** En-tête de page admin : titre + sous-titre + actions à droite. */
export function PageHeaderSkeleton({
  actions = 2,
  className,
}: {
  actions?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {actions > 0 ? (
        <div className="flex items-center gap-2">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Barre de filtres / recherche : un champ large + N filtres. */
export function FilterBarSkeleton({
  fields = 4,
  className,
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Skeleton className="h-9 w-64" />
      {Array.from({ length: Math.max(0, fields - 1) }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-32" />
      ))}
    </div>
  );
}

/**
 * Tableau : en-tête + lignes. Colonnes dimensionnées via inline style
 * (`gridTemplateColumns`) pour rester dynamique sans casser le purge Tailwind.
 * La 1re colonne est plus large (libellé principal).
 */
export function TableSkeleton({
  rows = 8,
  columns = 5,
  withAvatar = true,
  className,
}: {
  rows?: number;
  columns?: number;
  withAvatar?: boolean;
  className?: string;
}) {
  const gridTemplateColumns = `minmax(0,1fr) repeat(${Math.max(
    1,
    columns - 1
  )}, minmax(0,120px))`;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/60",
        className
      )}
    >
      {/* En-tête */}
      <div
        className="grid gap-4 border-b border-border/60 bg-muted/30 px-4 py-3"
        style={{ gridTemplateColumns }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full max-w-[80%]" />
        ))}
      </div>
      {/* Lignes */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="grid items-center gap-4 border-b border-border/40 px-4 py-3 last:border-b-0"
          style={{ gridTemplateColumns }}
        >
          {withAvatar ? (
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ) : (
            <Skeleton className="h-4 w-40" />
          )}
          {Array.from({ length: Math.max(0, columns - 2) }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
          {columns > 1 ? <Skeleton className="h-6 w-12 rounded-full" /> : null}
        </div>
      ))}
    </div>
  );
}

/** Rangée de cartes KPI (statistiques). */
export function KpiCardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-border/60 p-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Grille de cartes (catalogue, événements de vie, articles…). */
export function CardGridSkeleton({
  count = 6,
  withMedia = true,
  className,
}: {
  count?: number;
  withMedia?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-2xl border border-border/50 p-4"
        >
          {withMedia ? (
            <Skeleton className="aspect-[16/10] w-full rounded-xl" />
          ) : (
            <Skeleton className="size-10 rounded-xl" />
          )}
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Zone de graphique (analytics / stats). */
export function ChartSkeleton({
  height = "h-72",
  className,
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/60 p-4",
        className
      )}
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className={cn("w-full rounded-lg", height)} />
    </div>
  );
}
