import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BlockProps } from "@/lib/page-builder/types";
import { verifyPreviewToken } from "@/lib/page-builder/preview-token";
import { RenderedPage, resolveGlobalBlocks } from "@/lib/page-builder/render-page";

// Aperçu d'un brouillon : pas de cache, pas d'indexation.
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  // Token signé invalide / absent → on ne révèle même pas l'existence de la page.
  if (!verifyPreviewToken(id, token)) notFound();

  // Lookup par id SANS filtre `status` : on veut justement voir le brouillon.
  // On exclut seulement les pages supprimées.
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page || page.deletedAt) notFound();

  const blocks: BlockProps[] = Array.isArray(page.content)
    ? (page.content as unknown as BlockProps[])
    : [];

  // Résolution des blocs globaux référencés (SSR), comme sur la page publique.
  const globalMap = await resolveGlobalBlocks(blocks);

  return (
    <>
      {/* Bannière d'aperçu — non incluse dans la page publiée. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--primary-foreground)",
          background: "var(--primary)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        }}
      >
        <span aria-hidden>👁️</span>
        <span>
          Aperçu — brouillon
          {page.status !== "published" ? "" : " (page publiée)"}
        </span>
      </div>

      <RenderedPage page={page} blocks={blocks} globalMap={globalMap} />
    </>
  );
}
