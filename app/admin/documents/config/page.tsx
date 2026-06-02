import { prisma } from "@/lib/prisma";
import { DocumentsConfigTabs } from "@/components/admin/documents/documents-config-tabs";
import type { BundleRow } from "@/components/admin/documents/bundles-list";

export const dynamic = "force-dynamic";

/// Page de config "Documents" — version PR2 :
/// - Plus de templates (DocumentTemplate ne s'édite plus via l'admin)
/// - Plus de presets ici (déplacés vers /admin/pdf/presets)
/// - Plus de sections ici (la taxonomie ToolSection se gère ailleurs)
/// Reste : Organismes (référentiel partagé) + Bundles (dossiers).
export default async function DocumentsConfigPage() {
  const [organismesRaw, bundlesRaw] = await Promise.all([
    prisma.organisme.findMany({
      orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
      include: { _count: { select: { templates: true } } },
    }),
    prisma.documentBundle.findMany({
      orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const organismes = organismesRaw.map((o) => ({
    id: o.id,
    code: o.code,
    name: o.name,
    shortName: o.shortName,
    type: o.type,
    color: o.color,
    logoUrl: o.logoUrl,
    website: o.website,
    description: o.description,
    active: o.active,
    order: o.order,
    templateCount: o._count.templates,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }));

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
      <DocumentsConfigTabs organismes={organismes} bundles={bundles} />
    </div>
  );
}
