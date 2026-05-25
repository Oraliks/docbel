/**
 * Types client partagés entre les composants de chat.
 */

export interface ChatSessionItem {
  id: string;
  title: string;
  domain: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/**
 * Message dans le thread. `kind` (optionnel, défaut "chat") permet d'afficher
 * un rendu spécial pour les prompts générés inline (mode `generated_prompt`).
 * Les prompts générés ne sont PAS persistés comme ChatMessage en DB — ils sont
 * sauvegardés via /api/chomage-ia/prompts (GeneratedPrompt). Ils n'apparaissent
 * que dans la session courante côté UI.
 */
export interface ChatMessageItem {
  id?: string;
  role: "user" | "assistant";
  content: string;
  citedSourceIds: string[];
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  createdAt?: string;
  /** Marker local pour le streaming optimistic (avant réponse serveur). */
  pending?: boolean;
  /** Timestamp (ms) du début de la requête — sert au timer live + à la
   *  durée totale persistée dans `elapsedMs` une fois la réponse arrivée. */
  pendingStartedAt?: number;
  /** Durée totale de l'appel IA en millisecondes (côté client uniquement). */
  elapsedMs?: number;
  /** Type de bulle. "chat" (par défaut) = bulle markdown normale.
   *  "generated_prompt" = bulle spéciale avec block code + bouton "Copier" prominent. */
  kind?: "chat" | "generated_prompt";
  /** Pour kind="generated_prompt" : id de l'entrée GeneratedPrompt persistée. */
  promptId?: string;
  /** Pour kind="generated_prompt" : brief d'origine (affiché dans la bulle). */
  promptBrief?: string;
  /** Pour kind="generated_prompt" : titre court généré par Claude. */
  promptTitle?: string;
}

export interface CitedSourceLite {
  id: string;
  title: string;
  kind: string;
  sourceUrl: string | null;
  summary: string | null;
}
