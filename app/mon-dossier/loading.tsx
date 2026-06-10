import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <section className="flex flex-col gap-8">
      {/* En-tête */}
      <header className="flex flex-col gap-3 px-1">
        <Skeleton className="h-3 w-40 rounded-full" />
        <Skeleton className="h-11 w-[min(28rem,90%)] rounded-2xl" />
        <Skeleton className="h-4 w-[min(34rem,95%)] rounded-full" />
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        {/* Colonne gauche */}
        <section className="glass-surface flex flex-col gap-5 p-7">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-52 rounded-xl" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-2/3 rounded-full" />
          </div>
          <Skeleton className="mx-auto size-[120px] rounded-3xl" />
          <div className="flex items-center justify-between gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="size-7 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-4 w-60 rounded-full" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-2xl" />
        </section>

        {/* Colonne droite */}
        <section className="glass-surface flex flex-col gap-4 p-7">
          <Skeleton className="h-6 w-40 rounded-xl" />
          <Skeleton className="h-13 w-full rounded-2xl" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[150px] rounded-3xl" />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
