"use client";

/**
 * Liste des bulles de chat. Inclut un état "empty" descriptif + un état "loading".
 *
 * Route entre `MessageBubble` (chat/markdown) et `GeneratedPromptMessage`
 * (bulle ambre avec block code) selon `message.kind`.
 *
 * Supporte le mode édition d'un message user via `editingIndex` (l'index du
 * message dans le tableau) + callbacks `onRequestEdit` / `onSubmitEdit` /
 * `onCancelEdit` pour piloter le flux edit → regenerate.
 */

import { Loader2, MessageSquare } from "lucide-react";
import type { ChatMessageItem, CitedSourceLite } from "./types";
import { MessageBubble } from "./message-bubble";
import { GeneratedPromptMessage } from "./generated-prompt-message";

interface Props {
  messages: ChatMessageItem[];
  loading: boolean;
  citedSources: CitedSourceLite[];
  /** Index du message actuellement en édition (null = aucun). */
  editingIndex?: number | null;
  /** Demande de passer en mode édition pour le message à `index`. */
  onRequestEdit?: (index: number) => void;
  /** Submit du contenu édité pour le message à `index`. */
  onSubmitEdit?: (index: number, newContent: string) => void;
  /** Annule l'édition. */
  onCancelEdit?: () => void;
  /** Désactive globalement les actions (sending). */
  actionsDisabled?: boolean;
  /** Supprimer un message (context menu). Si absent → toast "bientôt dispo". */
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  /** Régénérer une réponse IA (context menu sur assistant msg). */
  onRegenerateMessage?: (messageId: string) => void;
  /** Forker la conversation à partir d'un message (context menu sur assistant msg). */
  onForkFromMessage?: (messageId: string) => void;
  /** Ouvrir le drawer "Sources citées" (depuis context menu). */
  onOpenSources?: () => void;
}

export function MessageList({
  messages,
  loading,
  citedSources,
  editingIndex = null,
  onRequestEdit,
  onSubmitEdit,
  onCancelEdit,
  actionsDisabled = false,
  onDeleteMessage,
  onRegenerateMessage,
  onForkFromMessage,
  onOpenSources,
}: Props) {
  if (loading) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-[12.5px]">Chargement…</span>
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <MessageSquare className="size-5" />
        </span>
        <div>
          <p className="text-[13px] font-bold text-foreground">
            Pose ta première question
          </p>
          <p className="max-w-md text-[12.5px]">
            L&apos;IA citera les sources de la KB avec des marqueurs <code className="rounded bg-muted px-1 py-0.5 text-[11px]">[SRC:id]</code>{" "}
            cliquables. Bouton{" "}
            <span className="inline-flex items-baseline gap-0.5 font-semibold">
              baguette
            </span>{" "}
            pour générer un prompt Claude Code à coller.
          </p>
        </div>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {messages.map((m, i) => (
        <li key={m.id ?? `${m.role}-${m.kind ?? "chat"}-${i}`}>
          {m.kind === "generated_prompt" ? (
            <GeneratedPromptMessage message={m} citedSources={citedSources} />
          ) : (
            <MessageBubble
              message={m}
              citedSources={citedSources}
              editMode={editingIndex === i}
              onRequestEdit={
                m.role === "user" && !m.pending && onRequestEdit
                  ? () => onRequestEdit(i)
                  : undefined
              }
              onSubmitEdit={
                onSubmitEdit
                  ? (newContent) => onSubmitEdit(i, newContent)
                  : undefined
              }
              onCancelEdit={onCancelEdit}
              disabled={actionsDisabled}
              onDelete={onDeleteMessage}
              onRegenerate={onRegenerateMessage}
              onFork={onForkFromMessage}
              onOpenSources={onOpenSources}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
