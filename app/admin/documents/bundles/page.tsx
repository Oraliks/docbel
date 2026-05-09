import { prisma } from "@/lib/prisma";
import { BundlesAdmin } from "@/components/admin/documents/bundles-admin";

export const dynamic = "force-dynamic";

export default async function BundlesAdminPage() {
  const [bundles, templates] = await Promise.all([
    prisma.documentBundle.findMany({
      orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            template: {
              include: {
                tool: { select: { id: true, name: true, slug: true } },
                organisme: { select: { id: true, shortName: true, color: true } },
              },
            },
          },
        },
      },
    }),
    prisma.documentTemplate.findMany({
      where: { status: "published" },
      include: {
        tool: { select: { id: true, name: true, slug: true } },
        organisme: { select: { id: true, shortName: true, color: true } },
      },
      orderBy: { tool: { name: "asc" } },
    }),
  ]);

  const serializedBundles = bundles.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    icon: b.icon,
    color: b.color,
    active: b.active,
    order: b.order,
    items: b.items.map((it) => ({
      id: it.id,
      templateId: it.templateId,
      order: it.order,
      required: it.required,
      condition: it.condition as { fieldId: string; equals: unknown } | null,
      template: {
        id: it.template.id,
        toolId: it.template.tool.id,
        toolName: it.template.tool.name,
        toolSlug: it.template.tool.slug,
        organisme: it.template.organisme,
      },
    })),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  const serializedTemplates = templates.map((t) => ({
    id: t.id,
    toolId: t.tool.id,
    toolName: t.tool.name,
    toolSlug: t.tool.slug,
    organisme: t.organisme,
  }));

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <BundlesAdmin initialBundles={serializedBundles} availableTemplates={serializedTemplates} />
    </div>
  );
}
