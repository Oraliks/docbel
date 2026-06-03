import { Skeleton } from "@/components/ui/skeleton";
import { CardGridSkeleton } from "@/components/ui/skeletons";

/**
 * Loading pour /creer-ma-demande (onboarding public, design glass).
 * Mimique : hero + barre de recherche d'intention + grilles d'événements de
 * vie. Le shell public (header/footer) reste stable autour.
 */
export default function OnboardingLoading() {
  return (
    <section className="flex flex-col gap-10">
      {/* Hero */}
      <header className="flex flex-col gap-3 px-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-11 w-3/4 max-w-xl" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-2/3 max-w-xl" />
      </header>

      {/* Recherche d'intention */}
      <div className="px-2">
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>

      {/* Groupes d'événements de vie */}
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="space-y-3 px-2">
          <Skeleton className="h-5 w-48" />
          <CardGridSkeleton count={3} withMedia={false} />
        </div>
      ))}
    </section>
  );
}
