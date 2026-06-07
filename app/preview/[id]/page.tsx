import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicRenderer } from "@/components/page-builder/public-renderer";
import { GlobalBlocksProvider } from "@/components/page-builder/global-blocks-context";
import { ThemeProvider } from "@/components/page-builder/theme-tokens";
import { BlockProps, ThemeTokens } from "@/lib/page-builder/types";
import { verifyPreviewToken } from "@/lib/page-builder/preview-token";

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
  const globalBlockIds = Array.from(
    new Set(
      blocks
        .filter((b) => b.type === "globalRef")
        .map((b) => (b.props as { globalBlockId?: string }).globalBlockId)
        .filter((gid): gid is string => Boolean(gid)),
    ),
  );

  let globalMap: Record<string, BlockProps> = {};
  if (globalBlockIds.length > 0) {
    const globals = await prisma.globalBlock.findMany({
      where: { id: { in: globalBlockIds } },
      select: { id: true, block: true },
    });
    globalMap = Object.fromEntries(
      globals.map((g) => [g.id, g.block as unknown as BlockProps]),
    );
  }

  const pageVars = Array.isArray(page.variables)
    ? Object.fromEntries(
        (page.variables as Array<{ key?: string; value?: string }>)
          .filter((v) => v && typeof v.key === "string" && v.key)
          .map((v) => [v.key as string, v.value ?? ""]),
      )
    : {};

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
          color: "#fff",
          background: "#7c3aed",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        }}
      >
        <span aria-hidden>👁️</span>
        <span>
          Aperçu — brouillon
          {page.status !== "published" ? "" : " (page publiée)"}
        </span>
      </div>

      <ThemeProvider tokens={page.themeTokens as ThemeTokens | null}>
        <GlobalBlocksProvider value={globalMap}>
          <PublicRenderer
            blocks={blocks}
            context={{
              site: { name: "Docbel" },
              page: {
                title: page.title,
                slug: page.slug,
                description: page.metaDesc ?? undefined,
              },
              vars: pageVars,
            }}
          />
        </GlobalBlocksProvider>
      </ThemeProvider>
    </>
  );
}
