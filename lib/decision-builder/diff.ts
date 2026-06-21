/// Diff structurel entre deux versions d'un arbre d'orientation.
/// Calque léger de `lib/pdf-forms/diff.ts` : retourne les IDs de nœuds
/// ajoutés / supprimés / modifiés. Stocké dans `DecisionTreeRevision.diffSummary`
/// pour afficher un changelog dans l'historique des versions.
///
/// Pur : aucune dépendance Prisma/Next. Comparaison par sérialisation JSON
/// stable (les nœuds sont de petits objets plats).

import type { DecisionTreeContent } from "./types";

export interface TreeDiff {
  /// IDs de nœuds présents dans `next` mais absents de `prev`.
  added: string[];
  /// IDs de nœuds présents dans `prev` mais absents de `next`.
  removed: string[];
  /// IDs de nœuds présents dans les deux mais dont le contenu diffère.
  modified: string[];
}

/// Calcule le diff entre l'ancien et le nouveau contenu.
/// Si `prev` est null/undefined (1re publication), tous les nœuds de `next`
/// sont considérés comme ajoutés.
export function computeTreeDiff(
  prev: DecisionTreeContent | null | undefined,
  next: DecisionTreeContent,
): TreeDiff {
  const prevNodes = prev?.nodes ?? {};
  const nextNodes = next.nodes ?? {};
  const prevIds = new Set(Object.keys(prevNodes));
  const nextIds = new Set(Object.keys(nextNodes));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const id of nextIds) {
    if (!prevIds.has(id)) {
      added.push(id);
    } else if (stableStringify(prevNodes[id]) !== stableStringify(nextNodes[id])) {
      modified.push(id);
    }
  }
  for (const id of prevIds) {
    if (!nextIds.has(id)) removed.push(id);
  }

  return {
    added: added.sort(),
    removed: removed.sort(),
    modified: modified.sort(),
  };
}

/// Sérialisation déterministe (clés triées) pour comparer deux nœuds sans
/// être sensible à l'ordre des propriétés.
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val;
  });
}
