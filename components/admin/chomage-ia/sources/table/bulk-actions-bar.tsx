"use client";

/**
 * Barre d'actions en lot, fixed-bottom, visible quand au moins une source
 * est sélectionnée.
 *
 * Actions :
 *   - Activer / Désactiver
 *   - Réindexer
 *   - Tagger (popover BulkTagPicker)
 *   - Supprimer (AlertDialog count-aware)
 *
 * Le composant est purement présentationnel — toutes les actions appellent
 * `onAction(key, payload)` que le parent dispatch vers POST /sources/bulk.
 */

import { useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  RefreshCcw,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ConfirmDeleteDialog } from "../../_shared-alerts";
import { BulkTagPicker } from "./bulk-tag-picker";

export type BulkAction =
  | { kind: "enable" }
  | { kind: "disable" }
  | { kind: "reindex" }
  | { kind: "delete" }
  | { kind: "add-tags"; tags: string[] }
  | { kind: "remove-tags"; tags: string[] };

interface Props {
  /** Nb de sources sélectionnées. Si 0, le composant ne s'affiche pas. */
  count: number;
  /** Tags disponibles (suggestions pour le picker). */
  allTags: string[];
  /** True pendant un dispatch — désactive tous les boutons + spinner. */
  submitting: boolean;
  /** Clear la sélection. */
  onClear: () => void;
  /** Dispatch d'une action. Le parent doit refresh à la fin. */
  onAction: (action: BulkAction) => void | Promise<void>;
}

export function BulkActionsBar({
  count,
  allTags,
  submitting,
  onClear,
  onAction,
}: Props) {
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (count === 0) return null;

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
        <div
          role="toolbar"
          aria-label="Actions en lot sur les sources sélectionnées"
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-popover/95 px-2 py-1.5 shadow-lg ring-1 ring-foreground/5 backdrop-blur-md"
        >
          {/* Counter + clear */}
          <div className="flex items-center gap-1 pl-1 pr-1.5">
            <span className="text-[12px] font-semibold tabular-nums">
              {count}
            </span>
            <span className="text-[12px] text-muted-foreground">
              sélectionnée{count > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              aria-label="Clear sélection"
              onClick={onClear}
              disabled={submitting}
              className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <span className="h-5 w-px bg-border" aria-hidden />

          {/* Actions */}
          <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => onAction({ kind: "enable" })}
            className="h-7 px-2 text-[12px]"
          >
            <Eye className="size-3.5" />
            Activer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => onAction({ kind: "disable" })}
            className="h-7 px-2 text-[12px]"
          >
            <EyeOff className="size-3.5" />
            Désactiver
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => onAction({ kind: "reindex" })}
            className="h-7 px-2 text-[12px]"
          >
            <RefreshCcw className="size-3.5" />
            Réindexer
          </Button>

          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={submitting}
                className="h-7 px-2 text-[12px]"
              >
                <Tag className="size-3.5" />
                Tagger
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="center"
              className="w-auto p-3"
            >
              <BulkTagPicker
                count={count}
                allTags={allTags}
                submitting={submitting}
                onApply={async (mode, tags) => {
                  await onAction(
                    mode === "add"
                      ? { kind: "add-tags", tags }
                      : { kind: "remove-tags", tags }
                  );
                  setTagPopoverOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>

          <span className="h-5 w-px bg-border" aria-hidden />

          <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => setDeleteOpen(true)}
            className="h-7 px-2 text-[12px] text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Supprimer
          </Button>
        </div>
      </div>

      <ConfirmDeleteDialog
        requireText="supprimer"
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Supprimer ${count} source${count > 1 ? "s" : ""} ?`}
        description={`${count} source${count > 1 ? "s" : ""} seront supprimée${
          count > 1 ? "s" : ""
        } définitivement de la knowledge base. Les conversations qui les citaient garderont les références (mais les pills seront grisées).`}
        onConfirm={async () => {
          await onAction({ kind: "delete" });
        }}
      />
    </>
  );
}
