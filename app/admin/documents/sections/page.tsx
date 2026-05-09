import { prisma } from "@/lib/prisma";
import { SectionsAdmin } from "@/components/admin/documents/sections-admin";

export const dynamic = "force-dynamic";

export default async function SectionsAdminPage() {
  const sections = await prisma.toolSection.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { tools: true } } },
  });

  const serialized = sections.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    icon: s.icon,
    order: s.order,
    toolCount: s._count.tools,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <SectionsAdmin initial={serialized} />
    </div>
  );
}
