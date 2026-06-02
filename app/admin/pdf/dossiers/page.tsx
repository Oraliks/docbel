import { prisma } from "@/lib/prisma";
import type { BundleRow } from "@/components/admin/documents/bundles-list";
import { BundlesList } from "@/components/admin/documents/bundles-list";

export const dynamic = "force-dynamic";

/// Liste des dossiers (= bundles dans le code). Un dossier groupe plusieurs
/// PdfForms avec une logique d'inclusion conditionnelle + questions
/// d'orientation. Ex. « Chômage temporaire » → C32, C1 (si 1ère demande),
/// C6 (si force majeure médicale), etc.
export default async function PdfDossiersPage() {
  const bundlesRaw = await prisma.documentBundle.findMany({
    orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: true } } },
  });

  const bundles: BundleRow[] = bundlesRaw.map((b) => ({
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
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <BundlesList initialBundles={bundles} />
    </div>
  );
}
