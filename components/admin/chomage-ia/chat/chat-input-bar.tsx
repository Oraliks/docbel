"use client";

/**
 * Barre d'input du chat avec mode switchable :
 *
 *   - mode="chat" : textarea + boutons upload (📎) + générer prompt (🪄) + send
 *   - mode="prompt" : zone "Brief Claude Code" (2 textareas brief + hint
 *                     optionnel) + bouton "Générer" + bouton X pour fermer
 *
 * Le toggle entre modes est contrôlé par le parent (state externe) pour pouvoir
 * être initialisé depuis l'URL (?mode=prompt) et pour que le parent puisse
 * forcer le retour en mode chat après génération.
 */

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Paperclip,
  SendHorizontal,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InputBarMode = "chat" | "prompt";

interface Props {
  /** Mode courant (chat ou prompt). Contrôlé par le parent. */
  mode: InputBarMode;
  /** Demande de changement de mode. */
  onModeChange: (mode: InputBarMode) => void;
  /** Désactive complètement la barre (ex: IA off). */
  disabled: boolean;
  /** True pendant une requête (chat OU prompt). */
  sending: boolean;
  /** Callback d'envoi en mode chat. */
  onSendChat: (text: string) => void | Promise<void>;
  /** Callback de génération en mode prompt. */
  onGeneratePrompt: (brief: string, contextHint?: string) => void | Promise<void>;
  /** Callback ouverture du modal upload (mode chat seulement). */
  onOpenUpload: () => void;
  /** Placeholder du chat textarea (par défaut un message générique). */
  placeholder?: string;
  /** Limite de chars en mode chat. */
  maxChars?: number;
}

const DEFAULT_PLACEHOLDER =
  "Pose une question sur le chômage — l'IA répondra en citant les sources de la KB…";
const DEFAULT_MAX = 2000;
const WARN_RATIO = 0.85;

export function ChatInputBar(props: Props) {
  return props.mode === "chat" ? (
    <ChatModeBar {...props} />
  ) : (
    <PromptModeBar {...props} />
  );
}

/* ------------------------------------------------------------------ */
/*  Mode CHAT                                                          */
/* ------------------------------------------------------------------ */

function ChatModeBar({
  onModeChange,
  disabled,
  sending,
  onSendChat,
  onOpenUpload,
  placeholder = DEFAULT_PLACEHOLDER,
  maxChars = DEFAULT_MAX,
}: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 192) + "px";
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled || sending) return;
    onSendChat(trimmed);
    setValue("");
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
    <div className="flex flex-col gap-1 px-3 py-2.5">
      <div className="flex items-end gap-1.5">
        {/* Bouton Upload */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || sending}
          onClick={onOpenUpload}
          title="Ajouter une source (upload fichier)"
          aria-label="Uploader un fichier vers la KB"
          className="size-9 shrink-0 rounded-xl"
        >
          <Paperclip className="size-4" />
        </Button>

        {/* Bouton Mode Prompt */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || sending}
          onClick={() => onModeChange("prompt")}
          title="Générer un prompt Claude Code"
          aria-label="Basculer en mode générateur de prompt"
          className="size-9 shrink-0 rounded-xl text-amber-700 hover:bg-amber-100/50 dark:text-amber-300 dark:hover:bg-amber-900/30"
        >
          <Wand2 className="size-4" />
        </Button>

        {/* Textarea */}
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

        {/* Bouton Send */}
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
          Entrée pour envoyer · Maj+Entrée pour saut de ligne ·{" "}
          <Wand2 className="inline size-2.5" /> pour générer un prompt
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

/* ------------------------------------------------------------------ */
/*  Mode PROMPT                                                        */
/* ------------------------------------------------------------------ */

const EXAMPLES = [
  "Crée un calculateur AGR (allocation de garantie de revenus) pour temps partiels involontaires",
  "Génère un brief pour un outil de simulation activation Forem (ressort wallon)",
  "Construis un assistant de rédaction de C4 chômage avec champs obligatoires",
];

function PromptModeBar({
  onModeChange,
  disabled,
  sending,
  onGeneratePrompt,
}: Props) {
  const [brief, setBrief] = useState("");
  const [hint, setHint] = useState("");
  const trimmed = brief.trim();
  const canSubmit = trimmed.length >= 5 && !disabled && !sending;

  function submit() {
    if (!canSubmit) return;
    onGeneratePrompt(trimmed, hint.trim() || undefined);
    // Reset après envoi — la bulle générée arrive dans le thread.
    setBrief("");
    setHint("");
  }

  return (
    <div className="flex flex-col gap-2 border-l-4 border-amber-400 bg-amber-50/30 px-3 py-2.5 dark:border-amber-500/60 dark:bg-amber-950/15">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-amber-900 dark:text-amber-200">
          <Wand2 className="size-3.5" />
          Brief Claude Code
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onModeChange("chat")}
          title="Revenir au chat"
          aria-label="Fermer le mode générateur"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Brief */}
      <div>
        <label
          htmlFor="prompt-brief"
          className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-amber-800/80 dark:text-amber-200/80"
        >
          Brief <span className="text-destructive">*</span>
        </label>
        <textarea
          id="prompt-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value.slice(0, 1000))}
          disabled={disabled || sending}
          rows={3}
          placeholder="Ex : Crée un calculateur AGR pour temps partiels involontaires…"
          aria-label="Brief à générer"
          className={cn(
            "w-full resize-y rounded-lg border border-amber-300/60 bg-background px-2.5 py-1.5 text-[12.5px] leading-relaxed shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "dark:border-amber-500/30",
          )}
        />
      </div>

      {/* Hint optionnel */}
      <div>
        <label
          htmlFor="prompt-hint"
          className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-amber-800/70 dark:text-amber-200/70"
        >
          Contexte technique{" "}
          <span className="opacity-60 font-normal normal-case">(optionnel)</span>
        </label>
        <textarea
          id="prompt-hint"
          value={hint}
          onChange={(e) => setHint(e.target.value.slice(0, 500))}
          disabled={disabled || sending}
          rows={2}
          placeholder="Ex : Réutiliser le pattern Pension (layout 2-col, jspdf, CountryFlag)…"
          aria-label="Contexte technique optionnel"
          className={cn(
            "w-full resize-y rounded-lg border border-amber-300/60 bg-background px-2.5 py-1.5 text-[12px] leading-relaxed shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "dark:border-amber-500/30",
          )}
        />
      </div>

      {/* Footer : exemples + bouton */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={disabled || sending}
              onClick={() => setBrief(ex)}
              className="rounded-full border border-amber-300/50 bg-amber-100/30 px-2 py-0.5 text-[10px] text-amber-900 hover:bg-amber-100/60 disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/40"
              title="Pré-remplir avec cet exemple"
            >
              {ex.slice(0, 36)}{ex.length > 36 ? "…" : ""}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-amber-800/70 dark:text-amber-200/70">
            {brief.length} / 1000
          </span>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            {sending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Génération…
              </>
            ) : (
              <>
                <Wand2 className="size-3.5" />
                Générer
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
