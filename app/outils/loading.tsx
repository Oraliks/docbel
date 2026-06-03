import { Skeleton } from "@/components/ui/skeleton";
import { CardGridSkeleton } from "@/components/ui/skeletons";

/**
 * Loading pour /outils (catalogue public, design glass).
 * Mimique : hero + barre recherche + chips de catégories + grille de cartes.
 */
export default function OutilsLoading() {
  return (
    <section className="flex flex-col gap-6">
      {/* Hero */}
      <header className="flex flex-col gap-3 px-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-11 w-3/4 max-w-xl" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-2/3 max-w-xl" />
      </header>

      {/* Recherche + filtres catégories */}
      <div className="flex flex-col gap-3 px-2 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-11 w-full max-w-md rounded-2xl" />
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>

      {/* Grille d'outils */}
      <div className="px-2">
        <CardGridSkeleton count={9} withMedia={false} />
      </div>
    </section>
  );
}
