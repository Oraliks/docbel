import { prisma } from "@/lib/prisma";
import { BundlesList, type BundleRow } from "@/components/admin/documents/bundles-list";

export const dynamic = "force-dynamic";

export default async function BundlesAdminPage() {
  const bundles = await prisma.documentBundle.findMany({
    orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { items: true } },
    },
  });

  const rows: BundleRow[] = bundles.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    color: b.color,
    active: b.active,
    order: b.order,
    lifeEventCategory: b.lifeEventCategory,
    showOnOnboarding: b.showOnOnboarding,
    itemsCount: b._count.items,
    updatedAt: b.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <BundlesList initialBundles={rows} />
    </div>
  );
}
