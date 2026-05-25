"use client";

/**
 * Bulle de message individuelle.
 *
 * Responsabilités :
 *   - Layout (avatar + bubble + méta footer)
 *   - Rendu markdown JSX via `renderMarkdownReact` (citations [SRC:id] avec
 *     HoverCard, tables, blockquotes, code blocks, listes, links)
 *   - ContextMenu (right-click) avec actions :
 *       Copier contenu, copier permalink, [user: éditer], [assistant: régénérer,
 *       forker, voir sources], supprimer
 *   - Mode édition inline (textarea + boutons Renvoyer / Annuler) pour user msg
 *     contrôlé par le parent via `editMode` + callbacks `onRequestEdit`,
 *     `onSubmitEdit`, `onCancelEdit`
 *   - Pending indicator avec timer live + status rotatif (avant réponse IA)
 *
 * Les helpers markdown sont isolés dans `./markdown.tsx` pour respecter la
 * limite 250 LOC du projet.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  User,
  Sparkles,
  Copy,
  CheckCheck,
  Clock,
  Pencil,
  X,
  SendHorizontal,
  Link2,
  RefreshCw,
  GitBranch,
  BookOpen,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { fmtDateTime, fmtTokens, getKindIcon, truncate } from "../_shared";
import { ConfirmDeleteDialog } from "../_shared-alerts";
import { renderMarkdownReact } from "./markdown";
import type { ChatMessageItem, CitedSourceLite } from "./types";

interface Props {
  message: ChatMessageItem;
  citedSources: CitedSourceLite[];
  /** Active le mode édition inline (textarea + boutons Renvoyer / Annuler).
   *  Seulement valable pour les messages de role="user". */
  editMode?: boolean;
  /** Callback déclenché quand le user clique sur "Éditer" (button ou context menu).
   *  Le parent doit retourner le messageId en passant à editMode=true. */
  onRequestEdit?: () => void;
  /** Callback en mode édition : envoyer le nouveau contenu (déclenche regenerate). */
  onSubmitEdit?: (newContent: string) => void;
  /** Callback en mode édition : annuler. */
  onCancelEdit?: () => void;
  /** Désactive les actions (pendant un sending global). */
  disabled?: boolean;
  /** Callback supprimer ce message (context menu). Si absent → toast "bientôt dispo". */
  onDelete?: (messageId: string) => void | Promise<void>;
  /** Callback régénérer (assistant msg). Si absent → toast "bientôt dispo". */
  onRegenerate?: (messageId: string) => void;
  /** Callback forker la conversation à partir de ce message (assistant msg). */
  onFork?: (messageId: string) => void;
  /** Callback ouvrir le drawer "Sources citées". */
  onOpenSources?: () => void;
}

export function MessageBubble({
  message,
  citedSources,
  editMode = false,
  onRequestEdit,
  onSubmitEdit,
  onCancelEdit,
  disabled = false,
  onDelete,
  onRegenerate,
  onFork,
  onOpenSources,
}: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  // Quand on entre en édition, on initialise le draft avec le contenu courant
  // et on focus le textarea.
  useEffect(() => {
    if (editMode) {
      setDraft(message.content);
      requestAnimationFrame(() => {
        const el = draftRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
          el.style.height = "auto";
          el.style.height = Math.min(el.scrollHeight, 256) + "px";
        }
      });
    }
  }, [editMode, message.content]);

  // Auto-resize du textarea pendant l'édition.
  useEffect(() => {
    if (!editMode) return;
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 256) + "px";
  }, [editMode, draft]);

  const sourcesById = useMemo(() => {
    const map = new Map<string, CitedSourceLite>();
    for (const s of citedSources) map.set(s.id, s);
    return map;
  }, [citedSources]);

  function copyToClipboard() {
    navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopied(true);
        toast.success("Message copié");
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Échec de la copie"));
  }

  function copyPermalink() {
    if (!message.id) {
      toast.error("Permalink indisponible (message non persisté)");
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("msg", message.id);
    navigator.clipboard
      .writeText(url.toString())
      .then(() => toast.success("Lien copié"))
      .catch(() => toast.error("Échec de la copie"));
  }

  function handleRegenerate() {
    if (!onRegenerate) {
      // TODO(backend): brancher la régénération sur l'API. Pour l'instant,
      // on signale juste à l'utilisateur que la feature est en préparation.
      toast("Régénération bientôt disponible", {
        description: "Cette action nécessite un endpoint dédié.",
      });
      return;
    }
    // Si pas d'id (cas aborted avant le 1er token persisté), on passe une
    // chaîne vide — le parent ira chercher le dernier user message en amont
    // par position dans le thread (l'aborted bubble est toujours la dernière).
    onRegenerate(message.id ?? "");
  }

  function handleFork() {
    if (!message.id) {
      toast.error("Fork indisponible (message non persisté)");
      return;
    }
    if (onFork) {
      onFork(message.id);
    } else {
      // TODO(backend): brancher /api/chomage-ia/sessions/[id]/fork
      toast("Fork bientôt disponible", {
        description: "Cette action nécessite un endpoint dédié.",
      });
    }
  }

  function handleOpenSources() {
    if (onOpenSources) {
      onOpenSources();
    } else {
      toast("Ouvre le drawer « Sources citées » depuis l'en-tête.");
    }
  }

  const renderedMd = useMemo(
    () => renderMarkdownReact(message.content, sourcesById),
    [message.content, sourcesById]
  );

  const bubbleClass = cn(
    "rounded-2xl border px-3 py-2.5 text-[13.5px] leading-relaxed",
    isUser
      ? "border-primary/20 bg-primary/5 text-foreground"
      : "border-border bg-card text-foreground",
    editMode && "w-full max-w-2xl"
  );

  // Contenu de la bulle (sans le wrapper / context menu).
  // Trois états possibles pour une bulle assistant :
  //   - pending=true               → spinner + status rotatif (avant 1er token)
  //   - streaming=true, pending=false → rendu markdown + curseur clignotant à la fin
  //   - aucun des deux             → rendu markdown final
  const bubbleBody =
    editMode && isUser ? (
      <EditModeContent
        draftRef={draftRef}
        draft={draft}
        onChange={setDraft}
        onSubmit={() => {
          const trimmed = draft.trim();
          if (!trimmed) return;
          onSubmitEdit?.(trimmed);
        }}
        onCancel={() => onCancelEdit?.()}
        disabled={disabled}
      />
    ) : message.pending ? (
      <PendingIndicator startedAt={message.pendingStartedAt} />
    ) : (
      <div className="chomage-ia-md">
        {renderedMd}
        {message.streaming ? <StreamCursor /> : null}
      </div>
    );

  // ContextMenu désactivé pendant l'édition, le pending (rien d'utile à
  // proposer, right-click sur un textarea ouvre le menu natif), ou le
  // streaming actif (le message n'est pas encore persisté → permalink/regen
  // pas disponibles, et copier-coller un message incomplet n'a pas grand
  // sens — l'utilisateur peut le faire après le `done`).
  const allowContextMenu = !editMode && !message.pending && !message.streaming;

  const inner = allowContextMenu ? (
    <ContextMenu>
      <ContextMenuTrigger className={bubbleClass} render={<div />}>
        {bubbleBody}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-52">
        <ContextMenuItem onClick={copyToClipboard}>
          <Copy className="size-3.5" />
          Copier le contenu
        </ContextMenuItem>
        {message.id ? (
          <ContextMenuItem onClick={copyPermalink}>
            <Link2 className="size-3.5" />
            Copier le permalien
          </ContextMenuItem>
        ) : null}

        {!isUser ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleRegenerate}>
              <RefreshCw className="size-3.5" />
              Régénérer la réponse
            </ContextMenuItem>
            <ContextMenuItem onClick={handleFork}>
              <GitBranch className="size-3.5" />
              Forker la conversation ici
            </ContextMenuItem>
            {message.citedSourceIds.length > 0 ? (
              <ContextMenuItem onClick={handleOpenSources}>
                <BookOpen className="size-3.5" />
                Voir les sources citées
              </ContextMenuItem>
            ) : null}
          </>
        ) : null}

        {isUser && onRequestEdit ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onRequestEdit()}>
              <Pencil className="size-3.5" />
              Éditer le message
            </ContextMenuItem>
          </>
        ) : null}

        {message.id ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Supprimer ce message
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  ) : (
    <div className={bubbleClass}>{bubbleBody}</div>
  );

  return (
    <>
      <div
        className={cn(
          "flex gap-2",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* Avatar */}
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
            isUser
              ? "bg-primary/10 text-primary"
              : "bg-muted text-foreground"
          )}
        >
          {isUser ? <User className="size-3.5" /> : <Sparkles className="size-3.5" />}
        </span>

        {/* Bubble */}
        <div className={cn("flex max-w-[85%] flex-col gap-1", isUser && "items-end")}>
          {inner}

          {/* Bouton "Régénérer" prominent sous une bulle aborted (assistant uniquement).
              Visible uniquement si la dernière réponse a été interrompue par
              l'utilisateur (Stop). Clic → relance Claude depuis le même prompt
              user qui précède cette bulle. */}
          {!isUser && message.aborted && !message.streaming && !message.pending ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRegenerate}
              disabled={disabled}
              className="mt-1 self-start gap-1.5"
              title="Relancer Claude depuis la même question (le contenu partiel sera remplacé)"
            >
              <RefreshCw className="size-3.5" />
              Régénérer la réponse
            </Button>
          ) : null}

          {/* Méta + actions */}
          {!editMode ? (
            <div className="flex items-center gap-2 px-2 text-[10.5px] text-muted-foreground">
              <span>{fmtDateTime(message.createdAt)}</span>
              {message.elapsedMs != null && message.elapsedMs > 0 ? (
                <span
                  className="inline-flex items-center gap-0.5"
                  title="Durée de l'appel IA"
                >
                  · <Clock className="size-2.5" /> {fmtElapsed(message.elapsedMs)}
                </span>
              ) : null}
              {message.tokensIn != null || message.tokensOut != null ? (
                <span>
                  · {fmtTokens(message.tokensIn)}/{fmtTokens(message.tokensOut)} tk
                </span>
              ) : null}
              {message.streaming ? (
                <span
                  className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                  title="Réponse en cours de génération via Claude streaming"
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  Live
                </span>
              ) : !message.pending ? (
                <div className="ml-auto inline-flex items-center gap-0.5">
                  {isUser && onRequestEdit ? (
                    <button
                      type="button"
                      onClick={onRequestEdit}
                      disabled={disabled}
                      className="inline-flex items-center gap-1 rounded-sm px-1 hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Éditer ce message et régénérer la suite"
                    >
                      <Pencil className="size-3" />
                      Éditer
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="inline-flex items-center gap-1 rounded-sm px-1 hover:bg-muted hover:text-foreground"
                    title="Copier (ou clic droit pour plus d'actions)"
                  >
                    {copied ? (
                      <CheckCheck className="size-3" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {copied ? "Copié" : "Copier"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Citations résumées sous la bulle (mini pills) — masquées pendant
              le streaming car `citedSourceIds` n'arrive qu'avec l'event `meta`
              à la fin du stream. */}
          {!isUser &&
          !editMode &&
          !message.streaming &&
          message.citedSourceIds.length > 0 ? (
            <div className="mt-1 flex flex-wrap items-center gap-1 px-1">
              {message.citedSourceIds.slice(0, 8).map((id) => {
                const src = sourcesById.get(id);
                const label = src ? truncate(src.title, 36) : id.slice(0, 8);
                const Icon = src ? getKindIcon(src.kind) : Sparkles;
                return (
                  <a
                    key={id}
                    href={src?.sourceUrl ?? "#"}
                    target={src?.sourceUrl ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10.5px] font-medium hover:bg-muted"
                    title={src?.summary ?? src?.title ?? id}
                  >
                    <Icon className="size-3" />
                    {label}
                  </a>
                );
              })}
              {message.citedSourceIds.length > 8 ? (
                <span className="text-[10.5px] text-muted-foreground">
                  +{message.citedSourceIds.length - 8} autres
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer ce message ?"
        description={
          isUser
            ? "Ce message utilisateur sera supprimé définitivement de la conversation."
            : "Cette réponse IA sera supprimée définitivement. Les sources citées restent dans la KB."
        }
        onConfirm={async () => {
          if (!message.id) {
            toast.error("Message non persisté, suppression impossible.");
            return;
          }
          if (!onDelete) {
            // TODO(backend): brancher DELETE /api/chomage-ia/messages/[id]
            toast("Suppression bientôt disponible", {
              description: "Cette action nécessite un endpoint dédié.",
            });
            return;
          }
          await onDelete(message.id);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit mode — textarea + boutons Renvoyer / Annuler                  */
/* ------------------------------------------------------------------ */

function EditModeContent({
  draftRef,
  draft,
  onChange,
  onSubmit,
  onCancel,
  disabled,
}: {
  draftRef: React.RefObject<HTMLTextAreaElement | null>;
  draft: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const isEmpty = draft.trim().length === 0;
  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={draftRef}
        value={draft}
        onChange={(e) => onChange(e.target.value.slice(0, 4000))}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
            return;
          }
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            if (!isEmpty) onSubmit();
          }
        }}
        disabled={disabled}
        rows={3}
        aria-label="Éditer le message"
        className={cn(
          "min-h-[60px] max-h-64 w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-[13px] leading-relaxed",
          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-muted-foreground">
          Ctrl/Cmd+Entrée : renvoyer · Échap : annuler
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={disabled}
          >
            <X className="size-3.5" />
            Annuler
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSubmit}
            disabled={disabled || isEmpty}
            title="Renvoyer le message édité et régénérer la suite"
            className="gap-1"
          >
            <SendHorizontal className="size-3.5" />
            Renvoyer
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pending indicator — timer live + status rotatif                    */
/* ------------------------------------------------------------------ */

const PENDING_STEPS = [
  { atSec: 0, label: "Lecture des sources de la KB…" },
  { atSec: 4, label: "Synthèse et identification des citations…" },
  { atSec: 10, label: "Rédaction de la réponse…" },
  { atSec: 25, label: "Réponse longue en cours, encore un instant…" },
  { atSec: 60, label: "Toujours en cours — la requête peut prendre 1-2 min." },
] as const;

function PendingIndicator({ startedAt }: { startedAt?: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt]);

  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0;
  const elapsedSec = elapsedMs / 1000;
  const step =
    [...PENDING_STEPS].reverse().find((s) => elapsedSec >= s.atSec) ??
    PENDING_STEPS[0];

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      <span className="text-[12.5px]">{step.label}</span>
      {startedAt ? (
        <span
          className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] tabular-nums"
          title="Temps écoulé"
        >
          <Clock className="size-2.5" />
          {fmtElapsed(elapsedMs)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Petit curseur clignotant affiché à la fin du markdown pendant un stream SSE.
 * Disparaît dès que le stream est terminé (event `done`) ou interrompu.
 *
 * Inline-block + animate-pulse pour un effet "ChatGPT-like" discret.
 */
function StreamCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary/70 align-middle"
      aria-label="Réponse en cours de génération"
    />
  );
}

/**
 * Formate une durée en ms vers une chaîne lisible :
 * < 1 s   → "0.3s"
 * < 60 s  → "12s"
 * ≥ 60 s  → "1m 23s"
 */
function fmtElapsed(ms: number): string {
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
