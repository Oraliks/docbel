import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TemplateEditor } from "@/components/admin/documents/template-editor";
import { DocumentField } from "@/lib/documents/types";

export const dynamic = "force-dynamic";

export default async function EditDocumentTemplatePage({
  params,
}: {
  params: Promise<{ toolId: string }>;
}) {
  const { toolId } = await params;

  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
    include: {
      documentTemplate: {
        include: {
          sourceFile: { select: { id: true, name: true, fileType: true } },
        },
      },
      section: { select: { id: true, name: true } },
    },
  });

  if (!tool || !tool.documentTemplate) {
    notFound();
  }

  const t = tool.documentTemplate;
  const initial = {
    id: t.id,
    toolId: t.toolId,
    sourceType: t.sourceType,
    schema: (t.schema as unknown as DocumentField[]) || [],
    rgpdNotice: t.rgpdNotice,
    retentionDays: t.retentionDays,
    outputFilenameTpl: t.outputFilenameTpl,
    status: t.status,
    version: t.version,
    sourceFile: t.sourceFile,
    tool: {
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      sectionName: tool.section.name,
    },
  };

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <TemplateEditor initial={initial} />
    </div>
  );
}
