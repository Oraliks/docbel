"use client";

/**
 * Input bar minimaliste du mini-chat flottant : textarea + bouton send/stop.
 *
 * Pas de mode switch, pas de snippets palette, pas de scope, pas de toggle
 * web search — version essentielle pour rester légère et focus mini-usage.
 * Le chat complet reste accessible via /admin/chomage/ia/chat pour les
 * features avancées.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, SendHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  disabled: boolean;
  sending: boolean;
  onSend: (text: string, options?: { attachPage?: boolean }) => void;
  onStop: () => void;
  maxChars?: number;
}

const DEFAULT_MAX = 2000;

export function MiniInputBar({
  disabled,
  sending,
  onSend,
  onStop,
  maxChars = DEFAULT_MAX,
}: Props) {
  const [value, setValue] = useState("");
  const [attachPage, setAttachPage] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize du textarea (cap à 6 lignes ~150px).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled || sending) return;
    onSend(trimmed, { attachPage });
    setValue("");
    // Reset le toggle après envoi : single-use volontaire (l'admin doit
    // re-cliquer pour rattacher la page au message suivant).
    setAttachPage(false);
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = "auto";
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const isEmpty = value.trim().length === 0;
  const over = value.length / maxChars;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-1.5 rounded-xl border border-border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-primary/30">
        {/* Toggle "joindre la page courante" — l'admin clique pour ajouter
            l'URL + le titre + un extrait du DOM au prochain message. Single-use. */}
        <Button
          type="button"
          variant={attachPage ? "default" : "ghost"}
          size="icon-sm"
          disabled={disabled || sending}
          onClick={() => setAttachPage((v) => !v)}
          aria-pressed={attachPage}
          aria-label="Joindre la page courante"
          title={
            attachPage
              ? "Page courante JOINTE au prochain message (cliquer pour annuler)"
              : "Joindre l'URL + un extrait de la page courante au prochain message"
          }
          className="mb-0.5"
        >
          <Paperclip className="size-3" />
        </Button>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, maxChars))}
          onKeyDown={onKeyDown}
          disabled={disabled || sending}
          rows={1}
          placeholder="Question rapide…"
          aria-label="Question rapide"
          className={cn(
            "min-h-[28px] max-h-[150px] flex-1 resize-none bg-transparent text-[12.5px] leading-relaxed",
            "focus:outline-none placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
        {sending ? (
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            onClick={onStop}
            aria-label="Arrêter"
            title="Arrêter la génération"
          >
            <Square className="size-3 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon-sm"
            onClick={submit}
            disabled={disabled || isEmpty}
            aria-label="Envoyer"
            title="Envoyer (Entrée)"
          >
            {sending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <SendHorizontal className="size-3" />
            )}
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground">
        <span>
          Entrée envoie
          {attachPage ? (
            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-px text-primary">
              <Paperclip className="size-2.5" /> page jointe
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "tabular-nums",
            over > 0.85 && "text-amber-600 dark:text-amber-400",
          )}
        >
          {value.length} / {maxChars}
        </span>
      </div>
    </div>
  );
}
