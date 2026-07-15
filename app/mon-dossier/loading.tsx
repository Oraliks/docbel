import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 px-1">
        <Skeleton className="h-12 w-[min(42rem,90%)] rounded-2xl" />
        <Skeleton className="h-6 w-[min(34rem,95%)] rounded-full" />
      </header>

      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />

      <section className="glass-surface flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-64 rounded-xl" />
          <Skeleton className="h-5 w-full rounded-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </section>

      <section className="glass-surface flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-7 w-52 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
      </section>
    </section>
  );
}
