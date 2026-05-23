import { prisma } from "@/lib/prisma";
import { ToolsCardsView } from "@/components/admin/tools-cards-view";

export const dynamic = "force-dynamic";

export default async function OutilsPage() {
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
      // active : peut ne pas exister sur le client Prisma régénéré si
      // db:generate n'a pas tourné après migration. On défaut à true.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      active: (t as any).active ?? true,
    })),
  }));

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <ToolsCardsView sections={sections} />
    </div>
  );
}
