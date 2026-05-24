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
}

export interface CitedSourceLite {
  id: string;
  title: string;
  kind: string;
  sourceUrl: string | null;
  summary: string | null;
}
