import "server-only";
import { prisma } from "@/lib/prisma";
import { safeParseTreeContent } from "./schema";

/**
 * Intégrité référentielle Arbres ↔ Dossiers.
 *
 * Une feuille de résultat d'arbre pointe vers un `DocumentBundle` par son
 * `bundleSlug` (chaîne libre, pas de FK DB). Ce module scanne les arbres pour
 * répondre à « quels arbres référencent ce dossier ? » — côté éditeur de dossier
 * (panneau « Référencé par ») et garde-fous (désactivation / publication).
 *
 * Les arbres sont des données de configuration (faible volume) → un scan complet
 * en mémoire est acceptable. Résilient : toute erreur DB → liste vide.
 */

export type BundleReference = {
  treeId: string;
  treeSlug: string;
  treeTitle: string;
  status: string; // draft | published | archived
  /** Référencé dans le brouillon en cours d'édition. */
  inDraft: boolean;
  /** Référencé dans la version publiée (celle servie au public). */
  inPublished: boolean;
  /** Cible principale (`result.bundleSlug`). */
  asPrimary: boolean;
  /** Cité en dossier connexe (`result.related[]`). */
  asRelated: boolean;
};

function scanContent(
  content: unknown,
  slug: string,
): { primary: boolean; related: boolean } {
  const parsed = safeParseTreeContent(content);
  if (!parsed) return { primary: false, related: false };
  let primary = false;
  let related = false;
  for (const node of Object.values(parsed.nodes)) {
    if (node.type !== "result") continue;
    if (node.bundleSlug === slug) primary = true;
    if (node.related?.includes(slug)) related = true;
  }
  return { primary, related };
}

/** Liste des arbres qui référencent un dossier (par son slug), brouillon OU publié. */
export async function findTreesReferencingBundle(
  slug: string,
): Promise<BundleReference[]> {
  if (!slug) return [];
  try {
    const trees = await prisma.decisionTree.findMany({
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        draftContent: true,
        publishedContent: true,
      },
    });
    const refs: BundleReference[] = [];
    for (const t of trees) {
      const d = scanContent(t.draftContent, slug);
      const p = t.publishedContent
        ? scanContent(t.publishedContent, slug)
        : { primary: false, related: false };
      const inDraft = d.primary || d.related;
      const inPublished = p.primary || p.related;
      if (!inDraft && !inPublished) continue;
      refs.push({
        treeId: t.id,
        treeSlug: t.slug,
        treeTitle: t.title,
        status: t.status,
        inDraft,
        inPublished,
        asPrimary: d.primary || p.primary,
        asRelated: d.related || p.related,
      });
    }
    return refs;
  } catch {
    return [];
  }
}
