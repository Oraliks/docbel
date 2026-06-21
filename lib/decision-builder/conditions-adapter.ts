/// Adapter : mappe les réponses d'un wizard d'orientation (forme `OrientationAnswers`)
/// vers le format `CollectedPayloads` attendu par `evaluateCondition` du module
/// `lib/bundles/conditions.ts`.
///
/// **Pourquoi un adapter** : on réutilise le moteur AND/OR récursif déjà testé
/// (22 tests, 12 opérateurs) plutôt que d'en réécrire un. Le format
/// `CollectedPayloads` parle de "templateId → payload validé". Pour le
/// Decision Builder, le templateId = nodeId d'une question, et le payload =
/// `{ value: <option choisie> }`. Une condition s'écrit donc naturellement :
///   { type: "leaf", sourceTemplateId: "q_root", fieldId: "value",
///     op: "equals", value: "opt_a" }

import type { CollectedPayloads } from "@/lib/bundles/conditions";
import type { OrientationAnswers } from "./types";

/// Convertit les réponses du wizard en payloads compatibles avec evaluateCondition.
/// Préserve les valeurs telles quelles (string OU string[]).
export function buildContextFromNodeResponses(
  answers: OrientationAnswers,
): CollectedPayloads {
  const context: CollectedPayloads = {};
  for (const [nodeId, answer] of Object.entries(answers)) {
    if (!answer) continue;
    context[nodeId] = { value: answer.value };
  }
  return context;
}
