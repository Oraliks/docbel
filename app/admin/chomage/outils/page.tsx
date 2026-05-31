import { prisma } from "@/lib/prisma";
import { ToolsAdminWorkspace } from "@/components/admin/tools-admin/workspace";
import { isAudienceId, type AudienceId } from "@/lib/audience";

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
    tools: s.tools.map((t) => {
      // Le client Prisma régénéré peut ne pas exposer les nouveaux champs
      // tant que pnpm db:generate n'a pas tourné. Fallback safe :
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = t as any;
      const audience: AudienceId = isAudienceId(raw.audience)
        ? raw.audience
        : "citoyen";
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        type: t.type,
        icon: t.icon ?? undefined,
        popular: t.popular,
        timeMin: t.timeMin ?? undefined,
        order: t.order,
        active: raw.active ?? true,
        audience,
        access: Array.isArray(raw.access) ? raw.access : [],
      };
    }),
  }));

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <ToolsAdminWorkspace sections={sections} />
    </div>
  );
}
