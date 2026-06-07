// =====================================================================
//  Page Builder — Shared SSR rendering helpers
// =====================================================================
//  Factorise le rendu SSR commun à la page publique (`app/[slug]`) et à
//  l'aperçu (`app/preview/[id]`) :
//    • résolution des blocs `globalRef` (→ prisma → map)
//    • construction du contexte d'interpolation (site / page / vars)
//    • le JSX <ThemeProvider><GlobalBlocksProvider><PublicRenderer/></...>
//  Le comportement doit rester STRICTEMENT identique à l'existant.
// =====================================================================

import { prisma } from "@/lib/prisma";
import { PublicRenderer } from "@/components/page-builder/public-renderer";
import { GlobalBlocksProvider } from "@/components/page-builder/global-blocks-context";
import { ThemeProvider } from "@/components/page-builder/theme-tokens";
import type { BlockProps, ThemeTokens } from "@/lib/page-builder/types";
import type { InterpolationContext } from "@/lib/page-builder/interpolate";

/**
 * Champs d'une page nécessaires au rendu SSR partagé. La ligne Prisma `Page`
 * satisfait structurellement ce type (`themeTokens` / `variables` sont du Json).
 */
export interface RenderablePage {
  title: string;
  slug: string;
  metaDesc?: string | null;
  themeTokens: unknown;
  variables: unknown;
}

/**
 * Résout les blocs globaux référencés par les blocs `globalRef` (SSR), afin que
 * le `GlobalBlocksProvider` puisse passer la map au `BlockRenderer`.
 * Logique identique à celle dupliquée dans les deux pages.
 */
export async function resolveGlobalBlocks(
  blocks: BlockProps[],
): Promise<Record<string, BlockProps>> {
  const globalBlockIds = Array.from(
    new Set(
      blocks
        .filter((b) => b.type === "globalRef")
        .map((b) => (b.props as { globalBlockId?: string }).globalBlockId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (globalBlockIds.length === 0) return {};

  const globals = await prisma.globalBlock.findMany({
    where: { id: { in: globalBlockIds } },
    select: { id: true, block: true },
  });
  return Object.fromEntries(
    globals.map((g) => [g.id, g.block as unknown as BlockProps]),
  );
}

/**
 * Construit le contexte d'interpolation (`site` / `page` / `vars`) — identique
 * à celui construit dans les deux pages.
 */
export function buildPageContext(page: RenderablePage): InterpolationContext {
  const vars = Array.isArray(page.variables)
    ? Object.fromEntries(
        (page.variables as Array<{ key?: string; value?: string }>)
          .filter((v) => v && typeof v.key === "string" && v.key)
          .map((v) => [v.key as string, v.value ?? ""]),
      )
    : {};

  return {
    site: { name: "Docbel" },
    page: {
      title: page.title,
      slug: page.slug,
      description: page.metaDesc ?? undefined,
    },
    vars,
  };
}

/**
 * Rend l'arbre commun : <ThemeProvider><GlobalBlocksProvider><PublicRenderer/>.
 * Exactement comme aujourd'hui dans les deux pages.
 */
export function RenderedPage({
  page,
  blocks,
  globalMap,
}: {
  page: RenderablePage;
  blocks: BlockProps[];
  globalMap: Record<string, BlockProps>;
}) {
  return (
    <ThemeProvider tokens={page.themeTokens as ThemeTokens | null}>
      <GlobalBlocksProvider value={globalMap}>
        <PublicRenderer blocks={blocks} context={buildPageContext(page)} />
      </GlobalBlocksProvider>
    </ThemeProvider>
  );
}
