import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/ui/skeletons";

/**
 * Loading partagé pour les routes /admin/* de type liste qui n'ont pas leur
 * propre loading.tsx. S'affiche entre le clic et le premier paint, pendant que
 * le Server Component fetch sa data (Prisma).
 *
 * Mimique le layout standard des pages admin (titre + filtres + table). Les
 * routes non-liste (dashboards, éditeurs, stats) fournissent leur propre
 * loading.tsx avec une forme adaptée — cf. components/ui/skeletons.tsx.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <PageHeaderSkeleton actions={2} />
      <FilterBarSkeleton fields={4} />
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}
