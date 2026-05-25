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

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Loader2,
  Paperclip,
  SendHorizontal,
  Square,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  detectSlashToken,
  insertSnippetContent,
  type SlashToken,
} from "@/lib/chomage-ia/snippets-helper";
import {
  SnippetCommandPalette,
  type PaletteSnippet,
} from "./snippet-command-palette";
import { VoiceInputButton } from "./voice-input-button";
import {
  PROMPT_TEMPLATES_LIST,
  firstPlaceholderIndex,
  type PromptTemplate,
} from "./prompt-templates";

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
  /**
   * Callback d'interruption du stream SSE en cours.
   * Quand `sending=true` ET `onStop` est fourni, on remplace le bouton Send
   * par un bouton Stop (icône Square). Sinon le bouton Send affiche un spinner
   * désactivé comme avant.
   */
  onStop?: () => void;
  /** Placeholder du chat textarea (par défaut un message générique). */
  placeholder?: string;
  /** Limite de chars en mode chat. */
  maxChars?: number;
  /**
   * Snippets à afficher dans le command palette `/`. Chargés par le parent
   * (chat-full-shell) et passés ici. Si la liste est vide, taper `/` affiche
   * tout de même la palette avec l'entry "Gérer les snippets".
   */
  snippets?: PaletteSnippet[];
  /** Ouvre la Sheet de gestion des snippets (CRUD complet). */
  onOpenSnippetsManage?: () => void;
  /**
   * Active le bouton voice input (Whisper).
   * Faux par défaut — l'admin doit l'activer dans /admin/documents/settings
   * (nécessite OPENAI_API_KEY car Anthropic ne fait pas de transcription).
   */
  voiceAvailable?: boolean;
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
  onStop,
  placeholder = DEFAULT_PLACEHOLDER,
  maxChars = DEFAULT_MAX,
  snippets = [],
  onOpenSnippetsManage,
  voiceAvailable = false,
}: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ----- Snippet command palette (`/<query>`) -----
  const [slashToken, setSlashToken] = useState<SlashToken | null>(null);

  /** Met à jour la valeur ET recalcule le token actif autour du curseur. */
  const updateValueAndToken = useCallback(
    (next: string, cursor?: number) => {
      setValue(next);
      const el = ref.current;
      const pos = cursor ?? el?.selectionStart ?? next.length;
      const token = detectSlashToken(next, pos);
      setSlashToken(token);
    },
    []
  );

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
    setSlashToken(null);
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = "auto";
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Si le palette est ouvert, il intercepte Enter/Esc/ArrowUp/ArrowDown
    // au niveau document avec event.stopPropagation, donc on n'arrive ici
    // que pour les autres touches.
    if (slashToken) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  /** Insère le contenu d'un snippet dans la textarea à la place du `/query`. */
  function insertSnippet(snippet: PaletteSnippet) {
    if (!slashToken) return;
    const { value: nextValue, cursor: nextCursor } = insertSnippetContent(
      value,
      slashToken,
      snippet.content,
      { addTrailingSpace: true }
    );
    setValue(nextValue);
    setSlashToken(null);
    // Refocus + positionne le curseur après l'insertion.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  }

  /** Ajoute une transcription voice à la fin de la textarea. */
  function appendVoiceTranscript(text: string) {
    if (!text) return;
    setValue((prev) => {
      const joiner = prev.length === 0 || /\s$/.test(prev) ? "" : " ";
      return prev + joiner + text;
    });
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
      }
    });
  }

  const isEmpty = value.trim().length === 0;
  const ratio = value.length / maxChars;
  const warn = ratio >= WARN_RATIO;
  const over = value.length > maxChars;

  return (
    <div className="flex flex-col gap-1 px-3 py-2.5">
      <div ref={wrapperRef} className="flex items-end gap-1.5">
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

        {/* Bouton Voice input (Whisper) — affiché uniquement si l'admin
            a activé la feature ET configuré OPENAI_API_KEY. */}
        {voiceAvailable ? (
          <VoiceInputButton
            disabled={disabled || sending}
            onTranscript={appendVoiceTranscript}
          />
        ) : null}

        {/* Textarea */}
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            const next = e.target.value.slice(0, maxChars + 50);
            updateValueAndToken(next, e.target.selectionStart);
          }}
          onKeyUp={(e) => {
            // Recalcule le token si l'utilisateur navigue avec les flèches /
            // home/end (la position du curseur change sans onChange).
            if (
              e.key === "ArrowLeft" ||
              e.key === "ArrowRight" ||
              e.key === "Home" ||
              e.key === "End"
            ) {
              const el = ref.current;
              const pos = el?.selectionStart ?? value.length;
              setSlashToken(detectSlashToken(value, pos));
            }
          }}
          onClick={() => {
            const el = ref.current;
            const pos = el?.selectionStart ?? value.length;
            setSlashToken(detectSlashToken(value, pos));
          }}
          onBlur={() => {
            // On laisse le palette se gérer via click outside — pas de close
            // sur blur ici, sinon click sur un item ne marche pas.
          }}
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

        {/* Bouton Send / Stop selon état :
             - sending=true + onStop fourni → bouton Stop (interrompt le stream)
             - sending=true sans onStop      → bouton spinner désactivé (fallback)
             - sinon                          → bouton Send classique
        */}
        {sending && onStop ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={onStop}
            title="Interrompre la réponse (Stop)"
            aria-label="Interrompre la réponse en cours"
            className="size-9 shrink-0 rounded-xl"
          >
            <Square className="size-3.5 fill-current" />
            <span className="sr-only">Stop</span>
          </Button>
        ) : (
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
        )}

        {/* Command palette `/` — affiché ssi token actif. Anchor sur le wrapper. */}
        <SnippetCommandPalette
          snippets={snippets}
          token={slashToken}
          anchorRef={wrapperRef}
          onInsert={insertSnippet}
          onClose={() => setSlashToken(null)}
          onOpenManage={() => onOpenSnippetsManage?.()}
        />
      </div>
      <div className="flex items-center justify-between px-1 text-[10.5px] text-muted-foreground">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 opacity-70">
          <span>
            Entrée pour envoyer · Maj+Entrée saut de ligne
          </span>
          <span className="hidden md:inline">·</span>
          <span className="hidden md:inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted/60 px-1 py-px font-mono text-[9.5px]">
              Ctrl+K
            </kbd>
            nouveau
            <kbd className="ml-1 rounded border border-border bg-muted/60 px-1 py-px font-mono text-[9.5px]">
              Ctrl+/
            </kbd>
            mode
            <kbd className="ml-1 rounded border border-border bg-muted/60 px-1 py-px font-mono text-[9.5px]">
              Esc
            </kbd>
            fermer
          </span>
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

function PromptModeBar({
  onModeChange,
  disabled,
  sending,
  onGeneratePrompt,
  snippets = [],
  onOpenSnippetsManage,
}: Props) {
  const [brief, setBrief] = useState("");
  const [hint, setHint] = useState("");
  /** Template courant sélectionné (null = aucun, mode libre). */
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const briefWrapperRef = useRef<HTMLDivElement>(null);

  // ----- Snippet command palette `/` côté brief uniquement -----
  const [slashToken, setSlashToken] = useState<SlashToken | null>(null);

  function insertSnippetInBrief(snippet: PaletteSnippet) {
    if (!slashToken) return;
    const { value: nextValue, cursor: nextCursor } = insertSnippetContent(
      brief,
      slashToken,
      snippet.content,
      { addTrailingSpace: true }
    );
    setBrief(nextValue);
    setSlashToken(null);
    requestAnimationFrame(() => {
      const el = briefRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  }

  const trimmed = brief.trim();
  const canSubmit = trimmed.length >= 5 && !disabled && !sending;

  function submit() {
    if (!canSubmit) return;
    onGeneratePrompt(trimmed, hint.trim() || undefined);
    // Reset après envoi — la bulle générée arrive dans le thread.
    setBrief("");
    setHint("");
    setActiveTemplateId(null);
  }

  /**
   * Applique un template : remplace brief + contextHint et positionne le
   * curseur sur le premier placeholder `[…]`.
   *
   * Si l'admin a déjà tapé du contenu non vide ET différent du template
   * précédent, on demande confirmation pour éviter d'écraser son travail.
   */
  function applyTemplate(tpl: PromptTemplate) {
    const userHasContent = brief.trim().length > 0 || hint.trim().length > 0;
    if (userHasContent) {
      const ok = window.confirm(
        "Écraser le brief et le contexte technique actuels avec ce template ?"
      );
      if (!ok) return;
    }
    setBrief(tpl.brief);
    setHint(tpl.contextHint ?? "");
    setActiveTemplateId(tpl.id);
    // Focus + sélection du 1er placeholder pour une UX directe.
    requestAnimationFrame(() => {
      const ta = briefRef.current;
      if (!ta) return;
      ta.focus();
      const start = firstPlaceholderIndex(tpl.brief);
      // Sélectionne le placeholder entier `[…]` si présent pour que l'admin
      // puisse taper par-dessus.
      const end = tpl.brief.indexOf("]", start);
      ta.setSelectionRange(start, end === -1 ? start : end + 1);
    });
  }

  /** Reset à l'état "aucun template". */
  function clearTemplate() {
    setBrief("");
    setHint("");
    setActiveTemplateId(null);
    requestAnimationFrame(() => {
      briefRef.current?.focus();
    });
  }

  const activeTemplate = activeTemplateId
    ? PROMPT_TEMPLATES_LIST.find((t) => t.id === activeTemplateId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-2 border-l-4 border-amber-400 bg-amber-50/30 px-3 py-2.5 dark:border-amber-500/60 dark:bg-amber-950/15">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-amber-900 dark:text-amber-200">
          <Wand2 className="size-3.5" />
          Brief Claude Code
        </div>
        <div className="flex items-center gap-1">
          {/* Sélecteur de template */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={disabled || sending}
              render={
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors",
                    activeTemplate
                      ? "border-amber-500 bg-amber-100 text-amber-900 dark:border-amber-400/60 dark:bg-amber-900/40 dark:text-amber-100"
                      : "border-amber-300/60 bg-background text-amber-800 hover:bg-amber-100/40 dark:border-amber-500/30 dark:text-amber-200 dark:hover:bg-amber-900/30",
                    (disabled || sending) && "cursor-not-allowed opacity-60"
                  )}
                  aria-label="Choisir un template de prompt"
                />
              }
            >
              {activeTemplate ? (
                <>
                  <activeTemplate.icon className="size-3" />
                  {activeTemplate.label}
                </>
              ) : (
                <>Template</>
              )}
              <ChevronDown className="size-3 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-72">
              <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider">
                Templates pré-définis
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PROMPT_TEMPLATES_LIST.map((tpl) => {
                const Icon = tpl.icon;
                const selected = tpl.id === activeTemplateId;
                return (
                  <DropdownMenuItem
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className={cn(
                      "flex flex-col items-start gap-0.5",
                      selected && "bg-accent/60"
                    )}
                  >
                    <span className="flex w-full items-center gap-1.5 text-[12px] font-semibold">
                      <Icon className="size-3.5" />
                      {tpl.label}
                      {selected ? (
                        <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-primary">
                          actif
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[10.5px] text-muted-foreground">
                      {tpl.hint}
                    </span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={clearTemplate}
                className="text-[12px]"
              >
                <X className="size-3.5" />
                Effacer le template (brief libre)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      </div>

      {/* Brief */}
      <div>
        <label
          htmlFor="prompt-brief"
          className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-amber-800/80 dark:text-amber-200/80"
        >
          Brief <span className="text-destructive">*</span>
          {activeTemplate ? (
            <span className="ml-2 normal-case font-normal opacity-70">
              · Template « {activeTemplate.label} » — remplis les{" "}
              <code className="rounded bg-muted px-1 font-mono text-[10px]">
                [...]
              </code>
            </span>
          ) : null}
        </label>
        <div ref={briefWrapperRef} className="relative">
          <textarea
            ref={briefRef}
            id="prompt-brief"
            value={brief}
            onChange={(e) => {
              const next = e.target.value.slice(0, 1000);
              setBrief(next);
              const pos = e.target.selectionStart;
              setSlashToken(detectSlashToken(next, pos));
            }}
            onKeyUp={(e) => {
              if (
                e.key === "ArrowLeft" ||
                e.key === "ArrowRight" ||
                e.key === "Home" ||
                e.key === "End"
              ) {
                const el = briefRef.current;
                const pos = el?.selectionStart ?? brief.length;
                setSlashToken(detectSlashToken(brief, pos));
              }
            }}
            onClick={() => {
              const el = briefRef.current;
              const pos = el?.selectionStart ?? brief.length;
              setSlashToken(detectSlashToken(brief, pos));
            }}
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
          <SnippetCommandPalette
            snippets={snippets}
            token={slashToken}
            anchorRef={briefWrapperRef}
            onInsert={insertSnippetInBrief}
            onClose={() => setSlashToken(null)}
            onOpenManage={() => onOpenSnippetsManage?.()}
          />
        </div>
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

      {/* Footer : counter + bouton */}
      <div className="flex flex-wrap items-center justify-end gap-2">
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
  );
}
