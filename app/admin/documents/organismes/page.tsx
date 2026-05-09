import { prisma } from "@/lib/prisma";
import { OrganismesAdmin } from "@/components/admin/documents/organismes-admin";

export const dynamic = "force-dynamic";

export default async function OrganismesAdminPage() {
  const organismes = await prisma.organisme.findMany({
    orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
    include: { _count: { select: { templates: true } } },
  });

  const serialized = organismes.map((o) => ({
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

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <OrganismesAdmin initial={serialized} />
    </div>
  );
}
