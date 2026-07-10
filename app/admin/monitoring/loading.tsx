import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <PageHeaderSkeleton actions={0} />
      <CardGridSkeleton />
    </div>
  );
}
