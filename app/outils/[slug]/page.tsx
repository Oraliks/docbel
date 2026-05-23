import { notFound } from "next/navigation";
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

  // Outil désactivé par l'admin (via /admin/chomage/outils) → 404 public.
  // active peut ne pas exister sur le client Prisma non-régénéré, défaut true.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isActive = dbTool ? ((dbTool as any).active ?? true) : true;
  if (dbTool && !isActive) {
    notFound();
  }

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
