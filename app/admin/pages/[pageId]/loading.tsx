import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading pour /admin/pages/[pageId] — l'éditeur page-builder (plein écran,
 * chrome admin retiré). Mimique : barre d'outils + panneau de blocs + canvas +
 * inspecteur. S'affiche dès le clic, avant même que le client component lourd
 * (chargé en dynamic) ne monte.
 */
export default function PageBuilderLoading() {
  return (
    <div className="flex h-svh flex-col">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Corps : panneau blocs · canvas · inspecteur */}
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden w-60 flex-col gap-3 border-r border-border/60 p-3 md:flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
        <div className="flex flex-1 flex-col items-center gap-4 overflow-hidden p-6">
          <Skeleton className="h-7 w-1/2 max-w-md" />
          <Skeleton className="h-40 w-full max-w-2xl rounded-xl" />
          <Skeleton className="h-24 w-full max-w-2xl rounded-xl" />
          <Skeleton className="h-56 w-full max-w-2xl rounded-xl" />
        </div>
        <div className="hidden w-72 flex-col gap-3 border-l border-border/60 p-3 lg:flex">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
