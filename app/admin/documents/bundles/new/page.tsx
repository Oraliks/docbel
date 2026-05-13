import { prisma } from "@/lib/prisma";
import { BundleEditor, type AvailableTemplate } from "@/components/admin/documents/bundle-editor";
import { DocumentField } from "@/lib/documents/types";

export const dynamic = "force-dynamic";

export default async function NewBundlePage() {
  const templates = await prisma.documentTemplate.findMany({
    where: { status: "published" },
    include: {
      tool: { select: { id: true, name: true, slug: true } },
      organisme: { select: { id: true, shortName: true, color: true } },
    },
    orderBy: { tool: { name: "asc" } },
  });

  const availableTemplates: AvailableTemplate[] = templates.map((t) => ({
    id: t.id,
    toolId: t.tool.id,
    toolName: t.tool.name,
    toolSlug: t.tool.slug,
    organisme: t.organisme,
  }));

  const templateSchemas: Record<
    string,
    { id: string; label: string; type: string; options?: { value: string; label: string }[] }[]
  > = {};
  for (const t of templates) {
    const fields = (t.schema as unknown as DocumentField[]) || [];
    templateSchemas[t.id] = fields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      options: f.options,
    }));
  }

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <BundleEditor
        initial={null}
        availableTemplates={availableTemplates}
        templateSchemas={templateSchemas}
      />
    </div>
  );
}
