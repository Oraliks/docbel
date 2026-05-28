"use client";

/**
 * Thread du mini-chat flottant — version allégée du MessageList du chat
 * complet. Pas de ContextMenu, pas d'édition, pas de fork — juste un fil
 * en lecture pour un usage quick-fire.
 *
 * Rendu markdown réutilise `renderMarkdownReact` du chat existant pour
 * conserver le rendu citations [SRC:id] avec HoverCard.
 */

import { useMemo, type RefObject } from "react";
import { Loader2, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderMarkdownReact } from "../chat/markdown";
import type { CitedSourceLite } from "../chat/types";

export interface MiniMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  pending?: boolean;
  streaming?: boolean;
  citedSources?: CitedSourceLite[];
}

interface Props {
  messages: MiniMessage[];
  threadEndRef: RefObject<HTMLDivElement | null>;
}

export function MiniThread({ messages, threadEndRef }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
      {messages.map((m, idx) => (
        <MiniBubble key={`${m.createdAt}-${idx}`} message={m} />
      ))}
      <div ref={threadEndRef} aria-hidden="true" />
    </div>
  );
}

function MiniBubble({ message }: { message: MiniMessage }) {
  const isUser = message.role === "user";

  const sourcesById = useMemo(() => {
    const map = new Map<string, CitedSourceLite>();
    for (const s of message.citedSources ?? []) map.set(s.id, s);
    return map;
  }, [message.citedSources]);

  const rendered = useMemo(
    () =>
      isUser ? null : renderMarkdownReact(message.content, sourcesById),
    [isUser, message.content, sourcesById],
  );

  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary/10 text-primary"
            : "bg-muted text-foreground",
        )}
      >
        {isUser ? <User className="size-3" /> : <Sparkles className="size-3" />}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl border px-2.5 py-1.5 text-[12.5px] leading-relaxed",
          isUser
            ? "border-primary/20 bg-primary/5"
            : "border-border bg-card",
        )}
      >
        {message.pending ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Réflexion en cours…
          </span>
        ) : isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <div className="chomage-ia-md text-[12.5px]">
            {rendered}
            {message.streaming ? <StreamCursor /> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function StreamCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 animate-pulse rounded-sm bg-primary/70 align-middle"
      aria-label="Génération en cours"
    />
  );
}
