"use client";

/**
 * Sélecteur de scope KB pour le chat — multi-folder.
 *
 * Affiche un chip "Scope" dans la barre d'input chat (mode chat uniquement).
 * Click → popover avec liste des folders (avec count de sources) et toggles
 * checkbox. État vide = toute la KB (comportement par défaut).
 *
 * La sélection est persistée dans `ChatSession.scopeFolderIds` côté backend
 * (PATCH /sessions/[id]) — le parent (chat-full-shell) gère le fetch et
 * l'optimistic update.
 *
 * Le sélecteur n'affiche QUE des folders racine pour MVP — pour cibler un
 * sous-dossier, le user peut depuis la sidebar Sources (qui inclut les
 * descendants automatiquement). Évite une UI tree complexe dans une popover.
 */

import { useMemo, useState } from "react";
import { Check, FolderTree, Search, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeFolderListItem } from "@/lib/chomage-ia/types";
import { getFolderIcon, getFolderColor } from "../sources/table/folder-form-dialog";

interface Props {
  /** Folders disponibles (fetched par le parent). */
  folders: KnowledgeFolderListItem[];
  /** IDs sélectionnés actuellement (state contrôlé). */
  value: string[];
  /** Callback avec la nouvelle sélection. */
  onChange: (next: string[]) => void;
  /** Désactivé pendant un upload/sending. */
  disabled?: boolean;
}

export function ScopeSelector({
  folders,
  value,
  onChange,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Folders racine uniquement pour MVP. Pour scoper sur un sous-dossier,
  // l'user peut activer son parent (qui inclut tous les descendants côté
  // backend via expandFolderIdsWithDescendants).
  const rootFolders = useMemo(
    () =>
      folders
        .filter((f) => !f.parentId)
        .sort((a, b) => a.order - b.order),
    [folders],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rootFolders;
    return rootFolders.filter((f) => f.name.toLowerCase().includes(q));
  }, [rootFolders, query]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedCount = value.length;
  const allFolders = value.length === 0;

  const label = useMemo(() => {
    if (allFolders) return "Toutes les sources";
    if (selectedCount === 1) {
      const f = folders.find((x) => x.id === value[0]);
      return f?.name ?? "1 dossier";
    }
    return `${selectedCount} dossiers`;
  }, [allFolders, selectedCount, value, folders]);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(value.filter((x) => x !== id));
    } else {
      onChange([...value, id]);
    }
  }

  function selectAll() {
    onChange([]); // [] = toutes les sources (sémantique backend)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors",
            allFolders
              ? "border-border bg-muted/40 text-muted-foreground hover:bg-muted/60"
              : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          title="Scoper la recherche IA sur certains dossiers de la KB"
          aria-label={`Scope KB — ${label}`}
        >
          <FolderTree className="size-3" />
          <span className="max-w-[160px] truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[280px] p-0">
        <div className="flex flex-col gap-1.5 border-b border-border px-3 py-2">
          <div className="flex items-center gap-1.5">
            <FolderTree className="size-3.5 text-muted-foreground" />
            <span className="text-[12px] font-semibold">Scope KB</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Limite la recherche IA à certains dossiers. Vide = toute la KB.
            Inclut automatiquement les sous-dossiers.
          </p>
        </div>

        {rootFolders.length > 4 ? (
          <div className="relative border-b border-border px-2 py-1.5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer…"
              className="w-full rounded-md bg-transparent pl-6 pr-2 py-1 text-[11.5px] focus:outline-none"
              aria-label="Filtrer les dossiers"
            />
          </div>
        ) : null}

        <ul className="max-h-[280px] overflow-y-auto p-1">
          <li>
            <button
              type="button"
              onClick={selectAll}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                allFolders
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                  allFolders
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {allFolders ? <Check className="size-2.5" /> : null}
              </span>
              <span className="font-medium">Toutes les sources</span>
            </button>
          </li>

          {filtered.length === 0 && query ? (
            <li className="px-2 py-3 text-center text-[11.5px] text-muted-foreground">
              Aucun dossier pour « {query} »
            </li>
          ) : (
            filtered.map((folder) => {
              const Icon = getFolderIcon(folder.icon);
              const color = getFolderColor(folder.color);
              const checked = selectedSet.has(folder.id);
              return (
                <li key={folder.id}>
                  <button
                    type="button"
                    onClick={() => toggle(folder.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                      checked
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {checked ? <Check className="size-2.5" /> : null}
                    </span>
                    <Icon className="size-3.5 shrink-0" style={{ color }} />
                    <span className="truncate">{folder.name}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {selectedCount > 0 ? (
          <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="h-6 gap-1 text-[11px]"
            >
              <X className="size-3" />
              Effacer
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
