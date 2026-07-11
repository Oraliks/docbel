import "server-only";
import { prisma } from "@/lib/prisma";
import {
  contentReferencesBundle,
  type BundleReference,
} from "./references-core";

/**
 * Intégrité référentielle Arbres ↔ Dossiers (lecture DB).
 *
 * Une feuille de résultat d'arbre pointe vers un `DocumentBundle` par son
 * `bundleSlug` (chaîne libre, pas de FK DB). Ce module scanne les arbres pour
 * répondre à « quels arbres référencent ce dossier ? » — côté éditeur de dossier
 * (panneau « Référencé par ») et garde-fous (désactivation / publication).
 *
 * Les arbres sont des données de configuration (faible volume) → un scan complet
 * en mémoire est acceptable. Résilient : toute erreur DB → liste vide. Le cœur
 * pur (détection de référence) vit dans `references-core.ts` (testé).
 */

export type { BundleReference };

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
      const d = contentReferencesBundle(t.draftContent, slug);
      const p = t.publishedContent
        ? contentReferencesBundle(t.publishedContent, slug)
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
