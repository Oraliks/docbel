"use client";

/**
 * Ligne individuelle de la table sources (52 px de haut, dense).
 *
 * Layout (de gauche à droite) :
 *   [checkbox] [icon-kind] [titre + tags inline] [statut pills] [taille] [date] [⋮]
 *
 * Le click sur la ligne (hors checkbox / kebab) ouvre le drawer via `onClick`.
 * Le clic sur les colonnes interactives stop propagation pour ne pas ouvrir
 * le drawer.
 *
 * Migration 21 — la ligne est draggable via `useDraggable` (data type=source) :
 *   - Drag handle = toute la zone "icon kind + titre + tags" (zone large).
 *   - Activation : PointerSensor avec un délai de 150ms (cf. workspace) pour
 *     ne pas déclencher un drag sur un simple click rapide qui ouvre le drawer.
 *   - Si la ligne est dans `selectedIds`, le workspace draggue toute la sélection.
 */

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import {
  AlertTriangle,
  Database,
  Eye,
  EyeOff,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  Sparkles,
  Trash2,
  GripVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { KnowledgeSourceListItem } from "@/lib/chomage-ia/types";
import { getKindIcon, getKindColor, getKindLabel } from "../../_shared";
import {
  deriveIndexStatus,
  fmtCompactDate,
  fmtContentLen,
  getValidityMeta,
} from "./_shared-table";

interface RowAction {
  kind:
    | "edit"
    | "reindex"
    | "summarize"
    | "toggle-enabled"
    | "delete";
}

interface Props {
  source: KnowledgeSourceListItem;
  selected: boolean;
  aiAvailable: boolean;
  /** Hauteur en pixels fixée par la virtualization (52). */
  height: number;
  /** Position absolue dans le scroll virtuel (top en px). */
  top: number;
  /** Toggle sélection. */
  onSelect: () => void;
  /** Ouvre le drawer. */
  onOpen: () => void;
  /** Dispatch action. */
  onAction: (action: RowAction) => void | Promise<void>;
}

export function SourcesTableRow({
  source,
  selected,
  aiAvailable,
  height,
  top,
  onSelect,
  onOpen,
  onAction,
}: Props) {
  const [reindexing, setReindexing] = useState(false);
  const Icon = getKindIcon(source.kind);
  const color = getKindColor(source.kind);
  const indexStatus = deriveIndexStatus(source);

  // Migration 21 — draggable. On utilise un handle dédié (icône GripVertical)
  // pour éviter qu'un click sur le titre/zone ne se transforme en drag.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source:${source.id}`,
    data: { type: "source", sourceId: source.id, selected },
  });

  async function handleReindexClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (reindexing) return;
    setReindexing(true);
    try {
      await onAction({ kind: "reindex" });
    } finally {
      setReindexing(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      role="row"
      data-selected={selected ? "true" : "false"}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        height,
      }}
      className={`group flex items-center gap-2 border-b border-border/60 px-3 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset ${
        selected
          ? "bg-primary/5"
          : "bg-card hover:bg-muted/40"
      } ${!source.enabled ? "opacity-70" : ""} ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {/* Checkbox */}
      <div
        className="flex w-6 shrink-0 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onSelect()}
          aria-label={`Sélectionner ${source.title}`}
        />
      </div>

      {/* Drag handle — déclenche le drag uniquement quand on l'utilise.
          Évite que le click "ouvre drawer" ne devienne un drag accidentel. */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        onClick={(e) => e.stopPropagation()}
        aria-label="Glisser pour déplacer"
        title="Glisser pour déplacer vers un dossier"
        className="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted hover:text-foreground active:cursor-grabbing group-hover:opacity-100"
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Icon kind */}
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{ background: `${color}1A`, color }}
        title={getKindLabel(source.kind)}
      >
        <Icon className="size-4" />
      </div>

      {/* Titre + tags inline */}
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate text-[12.5px] font-semibold text-foreground">
            {source.title}
          </span>
        </div>
        <div className="flex items-center gap-1 truncate text-[10.5px] text-muted-foreground">
          {source.tags.length > 0 ? (
            <>
              {source.tags.slice(0, 3).map((t, i) => (
                <span key={t} className="truncate">
                  {i > 0 ? <span className="px-0.5">·</span> : null}
                  {t}
                </span>
              ))}
              {source.tags.length > 3 ? (
                <span className="text-muted-foreground/70">
                  +{source.tags.length - 3}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground/60">
              {source.summary || source.contentPreview.slice(0, 60) || "—"}
            </span>
          )}
        </div>
      </div>

      {/* Status pills (enabled + index + validity) */}
      <div className="hidden w-[120px] shrink-0 items-center gap-1.5 sm:flex">
        <span
          className={`inline-block size-1.5 rounded-full ${
            source.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"
          }`}
          title={source.enabled ? "Active" : "Désactivée"}
        />
        <IndexDot
          status={indexStatus}
          indexError={source.indexError}
        />
        <span
          className="text-[10px]"
          title={`Fraîcheur : ${getValidityMeta(source.validityStatus).label}`}
        >
          {getValidityMeta(source.validityStatus).emoji}
        </span>
        <span
          className={`text-[10.5px] font-medium uppercase tracking-wider ${
            source.enabled
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-muted-foreground"
          }`}
        >
          {source.enabled ? "ON" : "OFF"}
        </span>
      </div>

      {/* Taille */}
      <div className="hidden w-[60px] shrink-0 text-right text-[10.5px] tabular-nums text-muted-foreground md:block">
        {fmtContentLen(source.contentLength)}
      </div>

      {/* Date */}
      <div
        className="hidden w-[52px] shrink-0 text-right text-[10.5px] tabular-nums text-muted-foreground md:block"
        title={new Date(source.updatedAt).toLocaleString("fr-BE")}
      >
        {fmtCompactDate(source.updatedAt)}
      </div>

      {/* Kebab menu */}
      <div
        className="flex w-7 shrink-0 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Actions"
                className="opacity-60 group-hover:opacity-100"
              />
            }
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onAction({ kind: "edit" });
              }}
              className="text-[12px]"
            >
              <Pencil className="size-3.5" />
              Éditer
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleReindexClick}
              disabled={reindexing}
              className="text-[12px]"
            >
              {reindexing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="size-3.5" />
              )}
              Réindexer
            </DropdownMenuItem>
            {aiAvailable ? (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onAction({ kind: "summarize" });
                }}
                className="text-[12px]"
              >
                <Sparkles className="size-3.5" />
                Résumé IA
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onAction({ kind: "toggle-enabled" });
              }}
              className="text-[12px]"
            >
              {source.enabled ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
              {source.enabled ? "Désactiver" : "Activer"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                onAction({ kind: "delete" });
              }}
              className="text-[12px]"
            >
              <Trash2 className="size-3.5" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function IndexDot({
  status,
  indexError,
}: {
  status: "none" | "pending" | "ok" | "error";
  indexError: string | null;
}) {
  if (status === "ok") {
    return (
      <span
        className="inline-flex size-2.5 items-center justify-center text-emerald-600 dark:text-emerald-400"
        title="Indexée pour la recherche sémantique (RAG)"
      >
        <Database className="size-2.5" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="inline-flex size-2.5 items-center justify-center text-amber-600 dark:text-amber-400"
        title={indexError ?? "Erreur d'indexation"}
      >
        <AlertTriangle className="size-2.5" />
      </span>
    );
  }
  return (
    <span
      className="inline-flex size-2.5 items-center justify-center text-muted-foreground/50"
      title={
        indexError ??
        "Pas encore indexée (le chat utilise le fallback complet)"
      }
    >
      <Database className="size-2.5 opacity-60" />
    </span>
  );
}
