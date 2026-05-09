import { prisma } from "@/lib/prisma";
import { TemplateList } from "@/components/admin/documents/template-list";

export const dynamic = "force-dynamic";

export default async function DocumentsAdminPage() {
  const [templates, organismes] = await Promise.all([
    prisma.documentTemplate.findMany({
      include: {
        tool: { select: { id: true, name: true, slug: true } },
        sourceFile: { select: { id: true, name: true, fileType: true } },
        organisme: { select: { id: true, code: true, name: true, shortName: true, color: true, type: true } },
        _count: { select: { generated: true, revisions: true, drafts: true, bundleItems: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.organisme.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, shortName: true, color: true, type: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
  ]);

  const serialized = templates.map((t) => ({
    id: t.id,
    toolId: t.toolId,
    sourceType: t.sourceType,
    status: t.status,
    version: t.version,
    requiresSignature: t.requiresSignature,
    effectiveDate: t.effectiveDate?.toISOString() ?? null,
    expiresAt: t.expiresAt?.toISOString() ?? null,
    officialRef: t.officialRef,
    updatedAt: t.updatedAt.toISOString(),
    tool: t.tool,
    sourceFile: t.sourceFile,
    organisme: t.organisme,
    counts: t._count,
  }));

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <TemplateList templates={serialized} organismes={organismes} />
    </div>
  );
}
