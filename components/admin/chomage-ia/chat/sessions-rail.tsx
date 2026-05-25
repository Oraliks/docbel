"use client";

/**
 * Rail vertical étroit (~48 px) à gauche du chat full-page.
 *
 * Affiche les sessions sous forme d'avatars circulaires colorés (initiales du
 * titre + couleur stable hashée), avec tooltip au hover sur le titre complet.
 *
 * Sections :
 *   - "+" bouton nouvelle conversation (top)
 *   - Liste des sessions (scrollable)
 *   - Bouton "Historique prompts" (bottom — ouvre Sheet via callback parent)
 *
 * Mode "expanded" (click sur l'icône expand en bas) → bascule en sidebar plus
 * large avec titres lisibles + actions inline rename/delete.
 */

import { useMemo, useState } from "react";
import {
  Check,
  History,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fmtRelative, truncate } from "../_shared";
import type { ChatSessionItem } from "./types";

interface Props {
  sessions: ChatSessionItem[];
  loading: boolean;
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onOpenPrompts: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers : initiales + couleur stable depuis un titre               */
/* ------------------------------------------------------------------ */

const AVATAR_COLORS = [
  // teintes pastel sur fond clair + contraste lisible
  "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  "bg-teal-500/20 text-teal-700 dark:text-teal-300",
  "bg-sky-500/20 text-sky-700 dark:text-sky-300",
  "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300",
  "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  "bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300",
] as const;

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initialsFromTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "?";
  const words = trimmed
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 2);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function avatarColorFor(id: string): string {
  return AVATAR_COLORS[hashString(id) % AVATAR_COLORS.length];
}

/* ------------------------------------------------------------------ */
/*  Composant principal                                                */
/* ------------------------------------------------------------------ */

export function SessionsRail({
  sessions,
  loading,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onOpenPrompts,
}: Props) {
  // expanded = sidebar large avec titres + actions
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  function startEdit(s: ChatSessionItem) {
    setEditingId(s.id);
    setDraftTitle(s.title);
  }

  function commitEdit() {
    if (!editingId) return;
    if (draftTitle.trim().length > 0) {
      onRename(editingId, draftTitle.trim());
    }
    setEditingId(null);
  }

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-muted/30 transition-[width] duration-200",
        expanded ? "w-64" : "w-12"
      )}
      aria-label="Conversations"
    >
      {/* Header rail : bouton nouvelle conversation */}
      <div
        className={cn(
          "flex shrink-0 items-center border-b border-border",
          expanded ? "justify-between gap-1 px-2 py-2" : "justify-center py-2"
        )}
      >
        {expanded ? (
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            Conversations
          </span>
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="default"
                size="icon-sm"
                onClick={onNew}
                aria-label="Nouvelle conversation"
              />
            }
          >
            <Plus className="size-4" />
          </TooltipTrigger>
          {!expanded ? (
            <TooltipContent side="right">Nouvelle conversation</TooltipContent>
          ) : null}
        </Tooltip>
      </div>

      {/* Liste sessions */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && sessions.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          expanded ? (
            <p className="px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
              Aucune conversation — démarre en posant une question dans le
              chat.
            </p>
          ) : null
        ) : (
          <ul className={cn("flex flex-col", expanded ? "gap-0.5 px-1" : "items-center gap-1")}>
            {sessions.map((s) => {
              const isActive = s.id === currentId;
              const isEditing = s.id === editingId;
              const colorCls = avatarColorFor(s.id);
              const initials = initialsFromTitle(s.title);

              if (expanded) {
                return (
                  <li key={s.id}>
                    {isEditing ? (
                      <ExpandedEditRow
                        draft={draftTitle}
                        onChange={setDraftTitle}
                        onCommit={commitEdit}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <ExpandedRow
                        session={s}
                        active={isActive}
                        avatarColor={colorCls}
                        initials={initials}
                        onSelect={() => onSelect(s.id)}
                        onStartEdit={() => startEdit(s)}
                        onDelete={() => onDelete(s.id)}
                      />
                    )}
                  </li>
                );
              }

              return (
                <li key={s.id}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => onSelect(s.id)}
                          aria-label={s.title}
                          className={cn(
                            "flex size-8 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-all",
                            colorCls,
                            isActive &&
                              "ring-2 ring-primary ring-offset-2 ring-offset-muted/30",
                            !isActive && "opacity-80 hover:opacity-100"
                          )}
                        />
                      }
                    >
                      {initials}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <span className="font-semibold">{truncate(s.title, 60)}</span>
                      <span className="block text-[10px] opacity-80">
                        {s.messageCount} msg · {fmtRelative(s.updatedAt)}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer rail : bouton historique prompts + toggle expand */}
      <div
        className={cn(
          "flex shrink-0 items-center border-t border-border bg-background/60",
          expanded
            ? "justify-between gap-1 px-2 py-2"
            : "flex-col gap-1 px-1 py-2"
        )}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onOpenPrompts}
                aria-label="Historique des prompts générés"
              />
            }
          >
            <History className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="right">Historique prompts générés</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "Replier" : "Déployer"}
              />
            }
          >
            {expanded ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </TooltipTrigger>
          {!expanded ? (
            <TooltipContent side="right">Déployer</TooltipContent>
          ) : null}
        </Tooltip>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Sous-composants pour le mode expanded                              */
/* ------------------------------------------------------------------ */

function ExpandedRow({
  session,
  active,
  avatarColor,
  initials,
  onSelect,
  onStartEdit,
  onDelete,
}: {
  session: ChatSessionItem;
  active: boolean;
  avatarColor: string;
  initials: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted",
        active && "bg-primary/10"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums",
            avatarColor,
            active && "ring-2 ring-primary ring-offset-1 ring-offset-background"
          )}
        >
          {initials}
        </span>
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              "truncate text-[11.5px] font-semibold leading-tight",
              active ? "text-primary" : "text-foreground"
            )}
          >
            {truncate(session.title, 40)}
          </span>
          <span className="truncate text-[10px] text-muted-foreground">
            {session.messageCount} msg · {fmtRelative(session.updatedAt)}
          </span>
        </span>
      </button>
      <div className="ml-auto flex items-center opacity-0 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          title="Renommer"
          aria-label="Renommer"
        >
          <Pencil className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Supprimer"
          aria-label="Supprimer"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function ExpandedEditRow({
  draft,
  onChange,
  onCommit,
  onCancel,
}: {
  draft: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
        }}
        className="flex-1 bg-transparent text-[11.5px] outline-none"
        aria-label="Nouveau titre"
      />
      <Button variant="ghost" size="icon-xs" onClick={onCommit} aria-label="Valider">
        <Check className="size-3" />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={onCancel} aria-label="Annuler">
        <X className="size-3" />
      </Button>
    </div>
  );
}
