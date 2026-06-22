"use client";

/**
 * Command palette pour les snippets, à afficher quand l'utilisateur tape `/`
 * dans une textarea.
 *
 * Approche :
 *   - Le composant parent (chat-input-bar) détecte le token actif via
 *     `detectSlashToken()` à chaque keystroke / clic / sélection sur la
 *     textarea, et passe `token` à ce composant.
 *   - Si `token` est non-null, on affiche la palette positionnée juste
 *     au-dessus de la textarea (anchor passé via prop).
 *   - Navigation : flèches haut/bas, Enter pour insérer, Esc pour fermer.
 *   - Click sur un item → insère et ferme.
 *   - Pas de snippet trouvé → entry "Gérer les snippets →" qui ouvre la Sheet.
 *
 * Volontairement minimaliste — pas de Shadcn Command parce que ce dernier veut
 * sa propre Dialog modal, alors qu'ici on veut un popover collé à la textarea.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Code2, FolderCog, MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  filterSnippets,
  type SlashToken,
  type SnippetLike,
} from "@/lib/chomage-ia/snippets-helper";

export interface PaletteSnippet extends SnippetLike {
  domain: string;
  order: number;
}

interface Props {
  /** Snippets disponibles (déjà chargés par le parent). */
  snippets: PaletteSnippet[];
  /** Token `/query` actif, ou null si pas de palette à afficher. */
  token: SlashToken | null;
  /** Anchor pour positionner la palette (généralement le wrapper de la textarea). */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Callback quand l'utilisateur insère un snippet via Enter ou click. */
  onInsert: (snippet: PaletteSnippet) => void;
  /** Callback pour fermer (Esc ou click outside). */
  onClose: () => void;
  /** Callback pour ouvrir la Sheet de gestion des snippets. */
  onOpenManage: () => void;
}

/** Hauteur max approx du popover pour le calcul de position. */
const MAX_HEIGHT = 280;

export function SnippetCommandPalette({
  snippets,
  token,
  anchorRef,
  onInsert,
  onClose,
  onOpenManage,
}: Props) {
  const t = useTranslations("admin.chomageIa");
  const [hoverIndex, setHoverIndex] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Filtre les snippets sur la query courante.
  const filtered = useMemo(() => {
    if (!token) return [];
    return filterSnippets(snippets, token.query);
  }, [snippets, token]);

  // Total d'items = N snippets + 1 (entry "Gérer les snippets").
  const totalItems = filtered.length + 1;
  const manageIndex = filtered.length;

  // Reset l'index sélectionné quand la query change.
  useEffect(() => {
    setHoverIndex(0);
  }, [token?.query]);

  // Scroll vers l'item sélectionné s'il sort de la fenêtre visible.
  useEffect(() => {
    if (!popoverRef.current) return;
    const selectedEl = popoverRef.current.querySelector<HTMLElement>(
      `[data-palette-index="${hoverIndex}"]`
    );
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [hoverIndex]);

  // Click outside → ferme.
  useEffect(() => {
    if (!token) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [token, anchorRef, onClose]);

  // Position de la palette : au-dessus de l'anchor (textarea wrapper), aligné
  // à gauche, en CSS fixed pour ne pas dépendre du parent flex.
  const [pos, setPos] = useState<{
    left: number;
    bottom: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setPos(null);
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vh = window.innerHeight;
    setPos({
      left: rect.left,
      // Bottom relative au viewport — on ancre par le bas pour que la palette
      // pousse vers le haut quand elle grossit.
      bottom: vh - rect.top + 6,
      width: Math.min(rect.width, 480),
    });
  }, [token, anchorRef]);

  // Capture les touches clavier au niveau document tant que le palette est
  // ouvert. On utilise capture phase pour intercepter avant le keydown de la
  // textarea (qui sinon enverrait le message sur Enter).
  useEffect(() => {
    if (!token) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setHoverIndex((i) => (i + 1) % Math.max(totalItems, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setHoverIndex(
          (i) => (i - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1)
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (hoverIndex === manageIndex) {
          onOpenManage();
          onClose();
        } else if (filtered[hoverIndex]) {
          onInsert(filtered[hoverIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [
    token,
    filtered,
    hoverIndex,
    totalItems,
    manageIndex,
    onInsert,
    onClose,
    onOpenManage,
  ]);

  if (!token || !pos) return null;

  return (
    <div
      ref={popoverRef}
      data-snippet-palette
      role="listbox"
      aria-label={t("paletteAvailable")}
      style={{
        position: "fixed",
        left: pos.left,
        bottom: pos.bottom,
        width: pos.width,
        maxHeight: MAX_HEIGHT,
        zIndex: 60,
      }}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10",
        "animate-in fade-in-0 zoom-in-95 duration-100"
      )}
    >
      {/* Header : query + count */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold">
          <Code2 className="size-3 text-indigo-600 dark:text-indigo-400" />
          {t("snippets")}
          {token.query ? (
            <span className="text-muted-foreground">
              · <code className="font-mono">/{token.query}</code>
            </span>
          ) : null}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {filtered.length} / {snippets.length}
        </span>
      </div>

      <ul className="flex-1 overflow-y-auto py-1">
        {snippets.length === 0 ? (
          <li className="flex flex-col items-center justify-center gap-1.5 px-4 py-6 text-center text-muted-foreground">
            <MessageSquareWarning className="size-5 opacity-50" />
            <p className="max-w-xs text-[11px] leading-relaxed">
              {t("paletteEmpty")}
            </p>
          </li>
        ) : filtered.length === 0 ? (
          <li className="px-3 py-4 text-center text-[11px] text-muted-foreground">
            {t("paletteNoMatch")}{" "}
            <code className="rounded bg-muted px-1 font-mono text-[10.5px]">
              /{token.query}
            </code>
          </li>
        ) : (
          filtered.map((s, idx) => {
            const selected = idx === hoverIndex;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  data-palette-index={idx}
                  onMouseEnter={() => setHoverIndex(idx)}
                  onClick={() => onInsert(s)}
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left transition-colors",
                    selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/40"
                  )}
                >
                  <span className="flex w-full items-center gap-1.5 text-[12px] font-semibold leading-tight">
                    <code className="shrink-0 rounded bg-indigo-500/15 px-1 py-px font-mono text-[10.5px] text-indigo-700 dark:text-indigo-300">
                      /{s.shortcut}
                    </code>
                    <span className="truncate">{s.title}</span>
                  </span>
                  <span className="line-clamp-1 text-[10.5px] text-muted-foreground">
                    {s.content.replace(/\s+/g, " ").slice(0, 120)}
                  </span>
                </button>
              </li>
            );
          })
        )}

        {/* Entry "Gérer les snippets" → ouvre la Sheet de gestion. */}
        <li>
          <button
            type="button"
            data-palette-index={manageIndex}
            onMouseEnter={() => setHoverIndex(manageIndex)}
            onClick={() => {
              onOpenManage();
              onClose();
            }}
            role="option"
            aria-selected={hoverIndex === manageIndex}
            className={cn(
              "flex w-full items-center gap-2 border-t border-border/40 px-3 py-1.5 text-left transition-colors",
              hoverIndex === manageIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted/40"
            )}
          >
            <FolderCog className="size-3.5 text-muted-foreground" />
            <span className="text-[11.5px] font-semibold">
              {t("paletteManage")}
            </span>
          </button>
        </li>
      </ul>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/20 px-2.5 py-1 text-[10px] text-muted-foreground">
        <span>
          <kbd className="rounded border border-border bg-background px-1 py-px font-mono">
            ↑↓
          </kbd>{" "}
          {t("paletteNavigate")} ·{" "}
          <kbd className="rounded border border-border bg-background px-1 py-px font-mono">
            Enter
          </kbd>{" "}
          {t("paletteInsert")}
        </span>
        <span>
          <kbd className="rounded border border-border bg-background px-1 py-px font-mono">
            Esc
          </kbd>{" "}
          {t("paletteClose")}
        </span>
      </div>
    </div>
  );
}
