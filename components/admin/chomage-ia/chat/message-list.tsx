"use client";

/**
 * Liste des bulles de chat. Inclut un état "empty" descriptif + un état "loading".
 */

import { Loader2, MessageSquare } from "lucide-react";
import type { ChatMessageItem, CitedSourceLite } from "./types";
import { MessageBubble } from "./message-bubble";

interface Props {
  messages: ChatMessageItem[];
  loading: boolean;
  citedSources: CitedSourceLite[];
}

export function MessageList({ messages, loading, citedSources }: Props) {
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
            cliquables. Clique sur un marqueur pour ouvrir la fiche source.
          </p>
        </div>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {messages.map((m, i) => (
        <li key={m.id ?? `${m.role}-${i}`}>
          <MessageBubble message={m} citedSources={citedSources} />
        </li>
      ))}
    </ul>
  );
}
