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
}

export interface CitedSourceLite {
  id: string;
  title: string;
  kind: string;
  sourceUrl: string | null;
  summary: string | null;
}
