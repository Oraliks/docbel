"use client";

/**
 * Historique latéral des prompts générés.
 *
 * Liste compacte avec titre, date relative, nombre de sources citées.
 * Click → charge le détail dans le panneau de sortie.
 */

import { useEffect, useMemo, useState } from "react";
import { History, MessageSquareWarning, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtRelative } from "../_shared";
import type { PromptHistoryItem } from "./types";

interface PromptHistoryProps {
  items: PromptHistoryItem[];
  currentId: string | null;
  loading: boolean;
  onSelect: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

export function PromptHistory({
  items,
  currentId,
  loading,
  onSelect,
  onDelete,
}: PromptHistoryProps) {
  const [q, setQ] = useState("");

  useEffect(() => {
    // Reset filter si la liste devient vide pour éviter un état orphelin.
    if (items.length === 0 && q) setQ("");
  }, [items.length, q]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(t) || it.brief.toLowerCase().includes(t),
    );
  }, [items, q]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <History className="size-3.5" />
          Historique ({items.length})
        </span>
      </header>

      {items.length > 0 ? (
        <div className="relative border-b border-border bg-background/60 px-2 py-1.5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3 -translate-y-1/2 opacity-50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrer…"
            className="w-full rounded-md bg-transparent pl-6 pr-2 py-1 text-[11.5px] focus:outline-none"
          />
        </div>
      ) : null}

      <ul className="flex-1 overflow-y-auto">
        {loading ? (
          <li className="px-3 py-6 text-center text-[11.5px] text-muted-foreground">
            Chargement…
          </li>
        ) : items.length === 0 ? (
          <li className="flex flex-col items-center justify-center gap-1.5 px-3 py-8 text-center text-muted-foreground">
            <MessageSquareWarning className="size-5 opacity-50" />
            <p className="text-[11.5px] leading-relaxed">
              Pas encore de prompt généré.
              <br />
              Lance ton premier brief à gauche.
            </p>
          </li>
        ) : filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-[11.5px] text-muted-foreground">
            Aucun résultat pour « {q} »
          </li>
        ) : (
          filtered.map((it) => {
            const isActive = it.id === currentId;
            return (
              <li
                key={it.id}
                className={cn(
                  "group flex items-start gap-2 border-b border-border/50 px-3 py-2 last:border-b-0 cursor-pointer transition-colors",
                  isActive ? "bg-primary/5" : "hover:bg-muted/50",
                )}
                onClick={() => onSelect(it.id)}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-[12.5px] font-semibold leading-snug",
                      isActive ? "text-primary" : "text-foreground",
                    )}
                  >
                    {it.title}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                    {it.brief}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground/80">
                    {fmtRelative(it.createdAt)}
                    {it.citedCount > 0 ? ` · ${it.citedCount} sources` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Supprimer ce prompt de l'historique ?")) {
                      onDelete(it.id);
                    }
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  title="Supprimer"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
