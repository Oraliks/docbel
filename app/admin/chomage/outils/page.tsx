import { prisma } from "@/lib/prisma";
import { ToolsManager } from "@/components/admin/tools-manager";

export const dynamic = "force-dynamic";

export default async function OutilsPage() {
  // Sections + tools (mêmes données qu'utilisait l'ancien ToolsListView, mais
  // expressed comme structure groupée pour ToolsManager qui sait éditer).
  const sectionsRaw = await prisma.toolSection.findMany({
    include: {
      tools: { orderBy: { order: "asc" } },
    },
    orderBy: { order: "asc" },
  });

  const sections = sectionsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    icon: s.icon ?? undefined,
    order: s.order,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    tools: s.tools.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      type: t.type,
      icon: t.icon ?? undefined,
      popular: t.popular,
      timeMin: t.timeMin ?? undefined,
      order: t.order,
    })),
  }));

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <ToolsManager sections={sections} />
    </div>
  );
}
