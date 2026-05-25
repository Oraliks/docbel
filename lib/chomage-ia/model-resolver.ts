/**
 * Helper de résolution du modèle Claude pour une session de chat.
 *
 * Une `ChatSession` peut avoir un `preferredModel` non-null pour forcer
 * un modèle spécifique (Sonnet "qualité" ou Haiku "rapide"). Si null,
 * on retombe sur le défaut serveur (Sonnet 4.5).
 *
 * Cette fonction valide aussi la valeur stockée — si elle ne correspond
 * pas à un modèle connu de `CLAUDE_MODELS`, on log et on retombe sur le
 * défaut (évite un crash si on retire un modèle de la liste plus tard).
 *
 * Utilisé par :
 *   - `POST /api/chomage-ia/chat` (streaming + non-streaming)
 *   - `POST /api/chomage-ia/sessions/[id]/regenerate-from`
 */

import { CLAUDE_MODELS, type ClaudeModel } from "./models";

/** Liste des modèles valides exposables au client (pas Opus pour l'instant). */
const VALID_MODELS: ClaudeModel[] = [CLAUDE_MODELS.sonnet, CLAUDE_MODELS.haiku];

export interface ResolvedModel {
  /** Modèle Claude effectif à passer à `callClaude` / `callClaudeStream`. */
  model: ClaudeModel;
  /** True si l'admin a forcé un modèle via `preferredModel`. */
  forced: boolean;
  /** Valeur d'origine de la session (pour log debug). */
  preferred: string | null;
}

/**
 * Résout le modèle effectif à partir d'un `preferredModel` éventuel.
 *
 * @param preferredModel - Valeur stockée en base sur la `ChatSession`
 *                        (null = défaut). Peut être null/undefined si la
 *                        session vient d'être créée.
 * @returns Le modèle Claude à utiliser + métadonnées pour le log.
 */
export function resolveSessionModel(
  preferredModel: string | null | undefined
): ResolvedModel {
  if (!preferredModel) {
    return {
      model: CLAUDE_MODELS.sonnet,
      forced: false,
      preferred: null,
    };
  }
  const valid = VALID_MODELS.find((m) => m === preferredModel);
  if (!valid) {
    console.warn(
      `[chomage-ia model-resolver] preferredModel="${preferredModel}" invalide → fallback Sonnet`
    );
    return {
      model: CLAUDE_MODELS.sonnet,
      forced: false,
      preferred: preferredModel,
    };
  }
  return {
    model: valid,
    forced: true,
    preferred: preferredModel,
  };
}

/**
 * Helper de log court côté serveur pour traquer les appels par modèle.
 * Format : `[chat] sending to claude-haiku-4-5-… (forced=true)`.
 */
export function logResolvedModel(
  route: string,
  resolved: ResolvedModel
): void {
  console.log(
    `[${route}] sending to ${resolved.model} (forced=${resolved.forced})`
  );
}
