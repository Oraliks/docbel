import { prisma } from "@/lib/prisma";
import { getToolBySlug } from "@/lib/docbel-data";
import { DocumentForm } from "@/components/docbel/document-form/document-form";
import { LegacyToolView } from "./legacy-tool-view";

export const dynamic = "force-dynamic";

export default async function ToolRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 1) Cherche un Tool dynamique en base avec un template publié
  const dbTool = await prisma.tool.findUnique({
    where: { slug },
    include: { documentTemplate: { select: { status: true } } },
  });

  if (
    dbTool?.type === "doc_generator" &&
    dbTool.documentTemplate?.status === "published"
  ) {
    return <DocumentForm slug={slug} />;
  }

  // 2) Fallback : catalogue statique (TOOLS_DATA)
  const staticTool = getToolBySlug(slug);
  return <LegacyToolView tool={staticTool || null} />;
}
