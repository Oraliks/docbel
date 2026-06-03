"use client";

/**
 * Sidebar gauche de la vue Sources (migration 21) — affiche l'arborescence
 * des KnowledgeFolder + filtres meta ("Toutes" / "Sans dossier" / "Tous
 * les dossiers").
 *
 * Clique → filtre la table à droite (selectedFolderIds).
 * Ctrl/Cmd+click → multi-select cumulé (OR).
 * Drag&drop → géré par le parent (DndContext + handleDragEnd).
 *
 * Les nodes "Toutes" et "Sans dossier" sont droppables pour permettre de
 * retirer une source de son folder (drop sur "Sans dossier" → folderId=null).
 */

import { useDroppable } from "@dnd-kit/core";
import { ConfirmDeleteDialog } from "../../_shared-alerts";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Inbox,
  Layers,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeFolderListItem } from "@/lib/chomage-ia/types";
import { FoldersTree, type FolderNode } from "./folders-tree";

interface Props {
  /** Arbre construit en amont (via buildFolderTree). */
  tree: FolderNode[];
  /** Liste plate, sert au dialog de création/édition (parent picker). */
  flatFolders: KnowledgeFolderListItem[];
  /** IDs sélectionnés. Vide = pas de filtre. */
  selectedFolderIds: string[];
  /** "Sans dossier" → seules les sources folderId=null sont affichées. */
  unassignedSelected: boolean;
  /** IDs expandés (UI state). */
  expandedIds: Set<string>;
  /** Compteur de sources sans dossier (folderId=null). */
  unassignedCount: number;
  /** Compteur global (toutes les sources du domaine). */
  totalCount: number;
  loading: boolean;
  /** Click sur "Toutes les sources" → reset. */
  onSelectAll: () => void;
  /** Click sur "Sans dossier". */
  onSelectUnassigned: () => void;
  /** Click sur un folder (multi via Ctrl/Cmd). */
  onSelectFolder: (id: string, withMeta: boolean) => void;
  /** Toggle expand/collapse. */
  onToggleExpand: (id: string) => void;
  /** Ouvre le dialog de création (root). */
  onCreateRoot: () => void;
  /** Ouvre le dialog de création (sous-dossier de parentId). */
  onCreateSubfolder: (parentId: string) => void;
  /** Ouvre le dialog d'édition d'un folder. */
  onEdit: (folder: KnowledgeFolderListItem) => void;
  /** Demande suppression d'un folder. Le parent affiche le ConfirmDeleteDialog. */
  onDelete: (folder: KnowledgeFolderListItem) => void;
  /** Folder en cours de confirmation de suppression (UI parent state). */
  pendingDelete: KnowledgeFolderListItem | null;
  onConfirmDelete: () => Promise<void> | void;
  onCancelDelete: () => void;
}

export function FoldersSidebar({
  tree,
  flatFolders: _flatFolders,
  selectedFolderIds,
  unassignedSelected,
  expandedIds,
  unassignedCount,
  totalCount,
  loading,
  onSelectAll,
  onSelectUnassigned,
  onSelectFolder,
  onToggleExpand,
  onCreateRoot,
  onCreateSubfolder,
  onEdit,
  onDelete,
  pendingDelete,
  onConfirmDelete,
  onCancelDelete,
}: Props) {
  const allActive = selectedFolderIds.length === 0 && !unassignedSelected;
  const selectedSet = new Set(selectedFolderIds);

  return (
    <aside className="flex h-full min-h-0 w-[240px] shrink-0 flex-col border-r border-border bg-card/30">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Dossiers
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreateRoot}
          title="Créer un dossier racine"
          aria-label="Créer un dossier"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Liste scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        {/* "Toutes" — droppable pour drop d'une source = retire le folder */}
        <RootDropItem
          dropId="root:all"
          dropData={{ type: "root-all" }}
          active={allActive}
          onClick={onSelectAll}
          icon={<Layers className="size-3.5" />}
          label="Toutes les sources"
          count={totalCount}
        />
        <RootDropItem
          dropId="root:unassigned"
          dropData={{ type: "root-unassigned" }}
          active={unassignedSelected}
          onClick={onSelectUnassigned}
          icon={<Inbox className="size-3.5" />}
          label="Sans dossier"
          count={unassignedCount}
        />

        <div className="my-2 h-px bg-border/60" />

        {loading && tree.length === 0 ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Chargement…
          </div>
        ) : tree.length === 0 ? (
          <button
            type="button"
            onClick={onCreateRoot}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left text-[11.5px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <FolderPlus className="size-3.5" />
            <span>Crée ton 1er dossier pour organiser la KB.</span>
          </button>
        ) : (
          <FoldersTree
            nodes={tree}
            selectedIds={selectedSet}
            expandedIds={expandedIds}
            onSelect={onSelectFolder}
            onToggleExpand={onToggleExpand}
            onEdit={onEdit}
            onCreateSubfolder={onCreateSubfolder}
            onDelete={onDelete}
          />
        )}
      </div>

      {/* Confirm delete */}
      <ConfirmDeleteDialog
        requireText="supprimer"
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) onCancelDelete();
        }}
        title={`Supprimer « ${pendingDelete?.name ?? ""} » ?`}
        description={
          pendingDelete && pendingDelete.sourceCount > 0
            ? `Les ${pendingDelete.sourceCount} source(s) contenue(s) seront déplacées à la racine (Sans dossier). Les sous-dossiers remonteront aussi à la racine.`
            : "Les sous-dossiers éventuels remonteront à la racine."
        }
        onConfirm={onConfirmDelete}
      />
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Items "Toutes" / "Sans dossier" — droppable + sélectionnable       */
/* ------------------------------------------------------------------ */

function RootDropItem({
  dropId,
  dropData,
  active,
  onClick,
  icon,
  label,
  count,
}: {
  dropId: string;
  dropData: { type: string };
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dropId, data: dropData });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-[12px] transition-colors",
        active
          ? "bg-primary/15 text-primary font-medium"
          : "text-foreground hover:bg-muted/60",
        isOver && "ring-2 ring-primary ring-inset",
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {count > 0 ? (
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}

// Ré-export pour éviter une dépendance circulaire et permettre au workspace
// d'importer le helper directement depuis ce fichier.
export { Folder, FolderOpen };
