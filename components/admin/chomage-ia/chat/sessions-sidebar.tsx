"use client";

/**
 * Sidebar de gauche : liste des ChatSession + bouton "Nouvelle".
 */

import { useState } from "react";
import { Loader2, Plus, MessageSquare, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

export function SessionsSidebar({
  sessions,
  loading,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onRename,
}: Props) {
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
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start"
          onClick={onNew}
        >
          <Plus className="size-3.5" />
          Nouvelle conversation
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {loading && sessions.length === 0 ? (
          <div className="flex h-20 items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-2 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Aucune conversation pour l&apos;instant. Démarre en posant ta première
            question dans le panneau central.
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((s) => {
              const isActive = s.id === currentId;
              const isEditing = s.id === editingId;
              return (
                <li key={s.id}>
                  {isEditing ? (
                    <div className="flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1">
                      <input
                        autoFocus
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 bg-transparent text-[12px] outline-none"
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={commitEdit}
                      >
                        <Check className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted/60",
                        isActive && "bg-primary/10 text-primary"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(s.id)}
                        className="flex flex-1 items-center gap-2 text-left text-[12px]"
                      >
                        <MessageSquare
                          className={cn(
                            "size-3.5 shrink-0",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">
                            {truncate(s.title, 40)}
                          </span>
                          <span className="truncate text-[10.5px] text-muted-foreground">
                            {s.messageCount} msg · {fmtRelative(s.updatedAt)}
                          </span>
                        </span>
                      </button>
                      <div className="ml-auto flex items-center opacity-0 group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(s);
                          }}
                          title="Renommer"
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(s.id);
                          }}
                          title="Supprimer"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
