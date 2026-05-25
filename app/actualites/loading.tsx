import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading pour /actualites et /actualites/[slug].
 * Mimique la grille d'articles (hero + cards) pendant le fetch DB.
 */
export default function ActualitesLoading() {
  return (
    <div className="flex flex-col gap-10 py-6">
      {/* Bandeau de tête : titre + filtres */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* Article hero (featured) */}
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      </div>

      {/* Grille de cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-[16/10] w-full rounded-xl" />
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
