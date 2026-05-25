import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading partagé pour toutes les routes /admin/* qui n'ont pas leur
 * propre loading.tsx. S'affiche pendant que le Server Component fetch
 * sa data (Prisma queries), entre le clic et le premier paint.
 *
 * Mimique le layout standard des pages admin :
 *   - barre de titre + actions
 *   - panneau de filtres
 *   - table de résultats
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      {/* Header — titre + actions à droite */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Barre de filtres / recherche */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Table : header + 8 lignes */}
      <div className="overflow-hidden rounded-xl border border-border/60">
        <div className="grid grid-cols-[1fr_120px_120px_100px_80px] gap-4 border-b border-border/60 bg-muted/30 px-4 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full max-w-[80%]" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="grid grid-cols-[1fr_120px_120px_100px_80px] items-center gap-4 border-b border-border/40 px-4 py-3 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
