/// Moteur d'exécution pur d'un arbre d'orientation (Decision Builder).
/// Aucune dépendance Prisma/Next : testable à 100% en Vitest.
///
/// Parcours : root → question → option choisie par l'utilisateur → option's nextId
/// (question ou result). Les conditions sur option/result sont évaluées via
/// `evaluateCondition` de `lib/bundles/conditions.ts` (réutilisation totale).
///
/// Le moteur est **tolérant aux réponses incomplètes** : il marche aussi loin que
/// possible et retourne ce qui a été trouvé. Les blocages (réponse manquante,
/// option inconnue, condition rejetée) sont remontés dans `warnings`.

import { evaluateCondition } from "@/lib/bundles/conditions";
import { buildContextFromNodeResponses } from "./conditions-adapter";
import type {
  DecisionNode,
  DecisionTreeContent,
  OrientationAnswers,
  ResultNode,
} from "./types";

/// Avertissement non-bloquant émis pendant le parcours.
export type EngineWarning =
  | { code: "empty_tree" }
  | { code: "missing_root"; rootNodeId: string }
  | { code: "missing_node"; nodeId: string }
  | { code: "wrong_node_type"; nodeId: string; expected: string; got: string }
  | { code: "unanswered"; nodeId: string }
  | { code: "invalid_option"; questionId: string; optionId: string }
  | { code: "option_rejected"; nodeId: string; reason: "condition_false" }
  | { code: "pending"; nodeId: string }
  | { code: "cycle_detected"; path: string[] };

export interface EngineResult {
  /// Tous les résultats atteints (souvent 1, mais l'arbre peut converger ailleurs).
  results: ResultNode[];
  /// Chemin des nœuds visités, dans l'ordre du parcours.
  path: string[];
  /// Avertissements rencontrés pendant le parcours.
  warnings: EngineWarning[];
}

/// Exécute l'arbre avec les réponses fournies. Retourne ce qui a été atteint.
export function runDecisionTree(
  content: DecisionTreeContent,
  answers: OrientationAnswers,
): EngineResult {
  const results: ResultNode[] = [];
  const path: string[] = [];
  const warnings: EngineWarning[] = [];
  const visited = new Set<string>();
  const context = buildContextFromNodeResponses(answers);

  if (!content.rootNodeId) {
    warnings.push({ code: "empty_tree" });
    return { results, path, warnings };
  }

  walk(content.rootNodeId);

  function walk(nodeId: string): void {
    // Anti-boucle : si on revoit un nœud, c'est un cycle (le validateur le
    // signalera comme erreur ; ici on arrête juste pour éviter le stack overflow).
    if (visited.has(nodeId)) {
      warnings.push({ code: "cycle_detected", path: [...path, nodeId] });
      return;
    }
    visited.add(nodeId);

    const node: DecisionNode | undefined = content.nodes[nodeId];
    if (!node) {
      warnings.push({ code: "missing_node", nodeId });
      return;
    }
    path.push(nodeId);

    switch (node.type) {
      case "result": {
        // Conditions optionnelles sur le résultat (filtrage final).
        if (node.conditions) {
          const r = evaluateCondition(node.conditions, context);
          if (r === false) {
            warnings.push({
              code: "option_rejected",
              nodeId,
              reason: "condition_false",
            });
            return;
          }
          if (r === "pending") {
            warnings.push({ code: "pending", nodeId });
          }
        }
        results.push(node);
        return;
      }

      case "question": {
        const answer = answers[nodeId];
        if (!answer) {
          warnings.push({ code: "unanswered", nodeId });
          return;
        }
        const chosen = Array.isArray(answer.value) ? answer.value[0] : answer.value;
        if (!chosen || !node.optionIds.includes(chosen)) {
          warnings.push({
            code: "invalid_option",
            questionId: nodeId,
            optionId: chosen ?? "(none)",
          });
          return;
        }
        walk(chosen);
        return;
      }

      case "option": {
        if (node.conditions) {
          const r = evaluateCondition(node.conditions, context);
          if (r === false) {
            warnings.push({
              code: "option_rejected",
              nodeId,
              reason: "condition_false",
            });
            return;
          }
          if (r === "pending") {
            warnings.push({ code: "pending", nodeId });
          }
        }
        const next = content.nodes[node.nextId];
        if (!next) {
          warnings.push({ code: "missing_node", nodeId: node.nextId });
          return;
        }
        walk(node.nextId);
        return;
      }
    }
  }

  return { results, path, warnings };
}
