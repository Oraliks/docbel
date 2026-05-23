import { prisma } from "@/lib/prisma";
import { fetchToolActive } from "@/lib/tools-active";
import { getToolBySlug } from "@/lib/docbel-data";
import { DocumentForm } from "@/components/docbel/document-form/document-form";
import { LegacyToolView } from "./legacy-tool-view";
import { DisabledToolView } from "./disabled-tool-view";

export const dynamic = "force-dynamic";

export default async function ToolRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 1) Cherche un Tool dynamique en base
  const dbTool = await prisma.tool.findUnique({
    where: { slug },
    include: { documentTemplate: { select: { status: true } } },
  });

  // 2) Vérifie active via raw SQL (le client Prisma ne connaît pas encore le
  // champ tant que pnpm db:generate n'a pas tourné après la migration récente).
  // Si l'outil est en DB et désactivé : on rend la page "désactivé" plutôt
  // qu'un 404, avec le nom de l'outil pour contexte.
  if (dbTool) {
    const active = await fetchToolActive(slug);
    if (active === false) {
      return <DisabledToolView toolName={dbTool.name} />;
    }
  }

  if (
    dbTool?.type === "doc_generator" &&
    dbTool.documentTemplate?.status === "published"
  ) {
    return <DocumentForm slug={slug} />;
  }

  // 3) Fallback : catalogue statique (TOOLS_DATA) — preavis, bureaux, lookup-onem
  const staticTool = getToolBySlug(slug);
  return <LegacyToolView tool={staticTool || null} />;
}
