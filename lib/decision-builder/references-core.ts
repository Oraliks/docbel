import { safeParseTreeContent } from "./schema";

/**
 * Cœur PUR de l'intégrité référentielle Arbres ↔ Dossiers (sans prisma /
 * server-only) — importable côté client (type) et testable directement.
 * Les lectures DB vivent dans `references.ts`.
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

/**
 * Un contenu d'arbre référence-t-il ce dossier ?
 * `primary` = feuille `result.bundleSlug === slug` ; `related` = cité dans un
 * `result.related[]`. Contenu invalide/vide → `{ false, false }`.
 */
export function contentReferencesBundle(
  content: unknown,
  slug: string,
): { primary: boolean; related: boolean } {
  const parsed = safeParseTreeContent(content);
  if (!parsed || !slug) return { primary: false, related: false };
  let primary = false;
  let related = false;
  for (const node of Object.values(parsed.nodes)) {
    if (node.type !== "result") continue;
    if (node.bundleSlug === slug) primary = true;
    if (node.related?.includes(slug)) related = true;
  }
  return { primary, related };
}
