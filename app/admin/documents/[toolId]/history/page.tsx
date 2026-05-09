import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TemplateHistoryView } from "@/components/admin/documents/template-history-view";
import { DocumentField } from "@/lib/documents/types";

export const dynamic = "force-dynamic";

export default async function TemplateHistoryPage({
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
          revisions: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!tool || !tool.documentTemplate) {
    notFound();
  }

  const t = tool.documentTemplate;
  const data = {
    toolId: tool.id,
    toolName: tool.name,
    toolSlug: tool.slug,
    templateId: t.id,
    currentVersion: t.version,
    currentSchema: (t.schema as unknown as DocumentField[]) || [],
    revisions: t.revisions.map((r) => ({
      id: r.id,
      version: r.version,
      schema: (r.schema as unknown as DocumentField[]) || [],
      sourceType: r.sourceType,
      rgpdNotice: r.rgpdNotice,
      retentionDays: r.retentionDays,
      outputFilenameTpl: r.outputFilenameTpl,
      changeNotes: r.changeNotes,
      changeType: r.changeType,
      diffSummary: r.diffSummary as {
        added: { id: string; label: string; type: string }[];
        removed: { id: string; label: string; type: string }[];
        modified: { id: string; label: string; changes: { key: string; from: unknown; to: unknown }[] }[];
        summary: string;
      } | null,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    })),
  };

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <TemplateHistoryView data={data} />
    </div>
  );
}
