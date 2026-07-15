import type {
  DecisionNode,
  DecisionTreeContent,
  QuestionNode,
} from "./types";

export interface SeedTreeMerge {
  content: DecisionTreeContent;
  addedNodeIds: string[];
  addedRootOptionIds: string[];
  preservedConflictIds: string[];
}

/**
 * Ajoute les nœuds manquants d'un seed sans modifier les nœuds déjà édités
 * dans l'admin. Les nouvelles portes racines sont insérées dans l'ordre du
 * seed ; le texte, les positions et les branches existantes restent intacts.
 */
export function mergeSeedTreeContent(
  current: DecisionTreeContent,
  desired: DecisionTreeContent,
): SeedTreeMerge {
  const currentRootId = current.rootNodeId;
  const desiredRootId = desired.rootNodeId;
  if (!currentRootId || !desiredRootId) {
    throw new Error("Racine de l'arbre absente pour la fusion du seed.");
  }
  const currentRoot = current.nodes[currentRootId];
  const desiredRoot = desired.nodes[desiredRootId];
  if (currentRoot?.type !== "question" || desiredRoot?.type !== "question") {
    throw new Error("Racine de l'arbre invalide pour la fusion du seed.");
  }

  const nodes: Record<string, DecisionNode> = { ...current.nodes };
  const addedNodeIds: string[] = [];
  const preservedConflictIds: string[] = [];

  for (const [id, desiredNode] of Object.entries(desired.nodes)) {
    if (id === desiredRootId) continue;
    const existing = nodes[id];
    if (!existing) {
      nodes[id] = desiredNode;
      addedNodeIds.push(id);
    } else if (stableStringify(existing) !== stableStringify(desiredNode)) {
      preservedConflictIds.push(id);
    }
  }

  const nextRootOptionIds = mergeOrderedIds(
    currentRoot.optionIds,
    desiredRoot.optionIds,
  );
  const addedRootOptionIds = nextRootOptionIds.filter(
    (id) => !currentRoot.optionIds.includes(id),
  );
  nodes[currentRootId] = {
    ...currentRoot,
    optionIds: nextRootOptionIds,
  } satisfies QuestionNode;

  return {
    content: { ...current, nodes },
    addedNodeIds: addedNodeIds.sort(),
    addedRootOptionIds,
    preservedConflictIds: preservedConflictIds.sort(),
  };
}

function mergeOrderedIds(current: string[], desired: string[]): string[] {
  const result = [...current];
  for (let index = 0; index < desired.length; index += 1) {
    const id = desired[index];
    if (result.includes(id)) continue;

    const nextExisting = desired
      .slice(index + 1)
      .find((candidate) => result.includes(candidate));
    if (nextExisting) result.splice(result.indexOf(nextExisting), 0, id);
    else result.push(id);
  }
  return result;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (val as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return val;
  });
}
