/// Chargement runtime d'un arbre d'orientation PUBLIÉ, pour alimenter
/// `/mon-dossier`. Converti en `WizardSituation[]` via l'adapter pour réutiliser
/// le wizard public tel quel.
///
/// GARDE-FOUS (cf. plan, risque n°1 = régression /mon-dossier) :
///   - Derrière un flag d'env `DECISION_TREE_RUNTIME_ENABLED` (défaut OFF).
///   - Tout est dans un try/catch : la moindre erreur (DB, parsing, mapping)
///     retourne `null` → l'appelant retombe sur `WIZARD_SITUATIONS` (TS).
/// Donc : tant que le flag est OFF ou qu'un arbre est cassé, /mon-dossier
/// fonctionne EXACTEMENT comme aujourd'hui.

import { prisma, withDbRetry } from "@/lib/prisma";
import type { WizardSituation } from "@/lib/dossier-wizard/config";
import type { DecisionTreeContent } from "@/lib/decision-builder/types";
import { treeContentToWizardSituations } from "./adapter";
import { safeParseTreeContent } from "./schema";

/// `true` si le runtime DB est activé (flag d'env). Accepte "1"/"true".
export function isDecisionTreeRuntimeEnabled(): boolean {
  const v = process.env.DECISION_TREE_RUNTIME_ENABLED;
  return v === "1" || v === "true";
}

/// Charge l'arbre publié pour un segment et le convertit en situations wizard.
/// Retourne `null` si : flag OFF, aucun arbre publié, contenu invalide, ou
/// toute erreur → l'appelant DOIT alors retomber sur le fallback TS.
export async function loadPublishedDecisionTree(
  segment: string,
): Promise<WizardSituation[] | null> {
  if (!isDecisionTreeRuntimeEnabled()) return null;

  try {
    const tree = await withDbRetry(() =>
      prisma.decisionTree.findFirst({
        where: { segment, status: "published" },
        orderBy: { publishedAt: "desc" },
        select: { publishedContent: true },
      }),
    );
    if (!tree?.publishedContent) return null;

    const content = safeParseTreeContent(tree.publishedContent);
    if (!content) return null;

    const situations = treeContentToWizardSituations(content);
    // Un arbre publié sans situation exploitable = on préfère le fallback TS.
    return situations.length > 0 ? situations : null;
  } catch (e) {
    console.error("[decision-builder/loader] fallback TS (erreur):", e);
    return null;
  }
}

/// Contenu BRUT (nœuds) de l'arbre publié d'un segment — pour marcher les tags
/// `canonical` des options côté serveur. Même garde flag que
/// `loadPublishedDecisionTree` : quand le flag runtime est OFF, l'orientation
/// n'est pas pilotée par l'arbre DB → on renvoie `null` (repli sûr, aucun fait).
export async function loadPublishedTreeContent(
  segment: string,
): Promise<DecisionTreeContent | null> {
  if (!isDecisionTreeRuntimeEnabled()) return null;

  try {
    const tree = await withDbRetry(() =>
      prisma.decisionTree.findFirst({
        where: { segment, status: "published" },
        orderBy: { publishedAt: "desc" },
        select: { publishedContent: true },
      }),
    );
    if (!tree?.publishedContent) return null;
    return safeParseTreeContent(tree.publishedContent);
  } catch {
    return null;
  }
}
