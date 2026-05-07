import { prisma } from "@/lib/prisma";
import { TemplateList } from "@/components/admin/documents/template-list";

export const dynamic = "force-dynamic";

export default async function DocumentsAdminPage() {
  const templates = await prisma.documentTemplate.findMany({
    include: {
      tool: { select: { id: true, name: true, slug: true } },
      sourceFile: { select: { id: true, name: true, fileType: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const serialized = templates.map((t) => ({
    id: t.id,
    toolId: t.toolId,
    sourceType: t.sourceType,
    status: t.status,
    version: t.version,
    updatedAt: t.updatedAt.toISOString(),
    tool: t.tool,
    sourceFile: t.sourceFile,
  }));

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <TemplateList templates={serialized} />
    </div>
  );
}
