import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CompareSourceView } from "@/components/admin/documents/compare-source-view";

export const dynamic = "force-dynamic";

export default async function CompareSourcePage({
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
    },
  });

  if (!tool || !tool.documentTemplate) notFound();

  // Lister les autres PDFs de la bibliothèque pour comparaison
  const otherPdfs = await prisma.file.findMany({
    where: {
      type: "file",
      fileType: "pdf",
      id: { not: tool.documentTemplate.sourceFileId },
    },
    select: { id: true, name: true, sha256: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <CompareSourceView
        toolId={tool.id}
        toolName={tool.name}
        currentFile={tool.documentTemplate.sourceFile}
        otherPdfs={otherPdfs.map((f) => ({
          id: f.id,
          name: f.name,
          sha256: f.sha256,
          createdAt: f.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
