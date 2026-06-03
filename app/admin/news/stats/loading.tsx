import {
  PageHeaderSkeleton,
  KpiCardsSkeleton,
  ChartSkeleton,
} from "@/components/ui/skeletons";

/**
 * Loading pour /admin/news/stats — dashboard (KPI + graphiques).
 * Forme adaptée (pas la table générique de app/admin/loading.tsx).
 */
export default function NewsStatsLoading() {
  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <PageHeaderSkeleton actions={1} />
      <KpiCardsSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
