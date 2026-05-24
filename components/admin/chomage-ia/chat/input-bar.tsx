"use client";

/**
 * Barre de saisie du chat IA chômage.
 *
 * - Textarea auto-resize (1 → 8 lignes max)
 * - Enter envoie ; Shift+Enter insère un retour à la ligne
 * - Spinner pendant l'envoi ; bouton désactivé si IA off ou message vide
 * - Compteur de caractères discret avec seuil d'alerte
 *
 * Reste un composant volontairement compact : pas de menu attachments, pas
 * de mention @, pas de slash-commands. L'objectif MVP est la conversation
 * sourcée — l'ergonomie avancée viendra plus tard si besoin.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InputBarProps {
  disabled: boolean;
  sending: boolean;
  onSend: (text: string) => void | Promise<void>;
  placeholder?: string;
  maxChars?: number;
}

const DEFAULT_PLACEHOLDER =
  "Pose une question sur le chômage — l'IA répondra en citant les sources de la KB…";
const DEFAULT_MAX = 2000;
const WARN_RATIO = 0.85;

export function InputBar({
  disabled,
  sending,
  onSend,
  placeholder = DEFAULT_PLACEHOLDER,
  maxChars = DEFAULT_MAX,
}: InputBarProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize 1 → ~8 lignes (24px/ligne approx).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 192) + "px";
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled || sending) return;
    onSend(trimmed);
    setValue("");
    // Reset hauteur après envoi.
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
  const ratio = value.length / maxChars;
  const warn = ratio >= WARN_RATIO;
  const over = value.length > maxChars;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, maxChars + 50))}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={placeholder}
          aria-label="Message à envoyer"
          className={cn(
            "min-h-[36px] max-h-48 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-[13.5px] leading-relaxed shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
        <Button
          type="button"
          size="icon"
          disabled={disabled || sending || isEmpty || over}
          onClick={submit}
          title={
            disabled
              ? "IA désactivée"
              : sending
                ? "Envoi en cours…"
                : "Envoyer (Entrée)"
          }
          className="size-9 shrink-0 rounded-xl"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizontal className="size-4" />
          )}
          <span className="sr-only">Envoyer</span>
        </Button>
      </div>
      <div className="flex items-center justify-between px-1 text-[10.5px] text-muted-foreground">
        <span className="opacity-70">
          Entrée pour envoyer · Maj+Entrée pour saut de ligne
        </span>
        <span
          className={cn(
            over
              ? "font-semibold text-destructive"
              : warn
                ? "text-amber-600 dark:text-amber-400"
                : "opacity-70",
          )}
        >
          {value.length} / {maxChars}
        </span>
      </div>
    </div>
  );
}
