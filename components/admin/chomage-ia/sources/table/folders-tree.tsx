"use client";

/**
 * Arbre récursif des KnowledgeFolder (3 niveaux max — la profondeur est
 * forcée côté API). Chaque nœud est :
 *   - Cliquable    → sélectionne le folder (filtre la table à droite)
 *   - Draggable    → on peut le déplacer dans un autre folder
 *   - Droppable    → un autre folder OU une source peut y être déposé
 *
 * Le multi-select se fait via Ctrl/Cmd+click (sélection cumulable pour le
 * filtre OR de la table).
 *
 * NB : ne contient PAS le DndContext lui-même — le parent (workspace) le
 * monte autour de la sidebar + la table pour qu'un drag de ligne table puisse
 * être déposé dans cette sidebar.
 */

import { useState, type CSSProperties } from "react";
import { ChevronRight, MoreHorizontal, FolderPlus, Pencil, Palette, Trash2 } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { KnowledgeFolderListItem } from "@/lib/chomage-ia/types";
import { getFolderIcon, getFolderColor } from "./folder-form-dialog";

export interface FolderNode extends KnowledgeFolderListItem {
  children: FolderNode[];
  /** Profondeur (1 = racine). */
  depth: number;
}

interface Props {
  /** Arbre construit à partir de la liste plate (cf. buildFolderTree). */
  nodes: FolderNode[];
  /** IDs sélectionnés (multi-select OR). */
  selectedIds: Set<string>;
  /** IDs expandés (afficher les enfants). */
  expandedIds: Set<string>;
  /** Click simple → sélectionne (remplace la sélection). */
  onSelect: (id: string, withMeta: boolean) => void;
  /** Toggle expand/collapse. */
  onToggleExpand: (id: string) => void;
  /** Ouvre le dialog d'édition pour ce folder. */
  onEdit: (folder: KnowledgeFolderListItem) => void;
  /** Crée un sous-dossier sous ce folder. */
  onCreateSubfolder: (parentId: string) => void;
  /** Demande de suppression (le parent affiche le ConfirmDeleteDialog). */
  onDelete: (folder: KnowledgeFolderListItem) => void;
}

export function FoldersTree(props: Props) {
  return (
    <ul className="flex flex-col gap-0.5">
      {props.nodes.map((n) => (
        <FolderTreeItem key={n.id} node={n} {...props} />
      ))}
    </ul>
  );
}

function FolderTreeItem({
  node,
  selectedIds,
  expandedIds,
  onSelect,
  onToggleExpand,
  onEdit,
  onCreateSubfolder,
  onDelete,
  nodes: _ignored, // évite eslint unused
}: Props & { node: FolderNode }) {
  const t = useTranslations("admin.chomageIa");
  const [menuOpen, setMenuOpen] = useState(false);
  const expanded = expandedIds.has(node.id);
  const selected = selectedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const Icon = getFolderIcon(node.icon);
  const color = getFolderColor(node.color);

  // Droppable : ce folder peut accepter une autre source OU un folder.
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `folder:${node.id}`,
    data: { type: "folder", folderId: node.id },
  });

  // Draggable : on peut prendre ce folder pour le déplacer ailleurs.
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `folder-drag:${node.id}`,
    data: { type: "folder", folderId: node.id },
  });

  function setRefs(el: HTMLElement | null) {
    setDropRef(el);
    setDragRef(el);
  }

  const indent = (node.depth - 1) * 12;
  const style: CSSProperties = {
    paddingLeft: `${indent + 4}px`,
  };

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            ref={setRefs}
            {...attributes}
            {...listeners}
            data-folder-id={node.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(node.id, e.ctrlKey || e.metaKey);
            }}
            style={style}
            className={cn(
              "group relative flex h-7 cursor-pointer items-center gap-1 rounded-md pr-1 text-[12px] transition-colors",
              selected
                ? "bg-primary/15 text-primary"
                : "hover:bg-muted/60 text-foreground",
              isOver && "ring-2 ring-primary ring-inset",
              isDragging && "opacity-40",
            )}
          >
            {/* Triangle expand */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(node.id);
                }}
                aria-label={expanded ? t("collapse") : t("expand")}
                className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <ChevronRight
                  className={cn(
                    "size-3 transition-transform",
                    expanded && "rotate-90",
                  )}
                />
              </button>
            ) : (
              <span className="size-4 shrink-0" aria-hidden />
            )}
            {/* Icon coloré */}
            <span
              className="flex size-4 shrink-0 items-center justify-center"
              style={{ color }}
            >
              <Icon className="size-3.5" />
            </span>
            {/* Nom */}
            <span className="flex-1 truncate font-medium">{node.name}</span>
            {/* Count */}
            {node.sourceCount > 0 ? (
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70 group-hover:text-muted-foreground">
                {node.sourceCount}
              </span>
            ) : null}
            {/* Bouton ⋮ (visible au hover) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(true);
              }}
              aria-label={t("actionsFor", { name: node.name })}
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
            >
              <MoreHorizontal className="size-3" />
            </button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ContextMenuItem
            onClick={() => onEdit(node)}
            className="text-[12px]"
          >
            <Pencil className="size-3.5" />
            {t("renameColorIcon")}
          </ContextMenuItem>
          {node.depth < 3 ? (
            <ContextMenuItem
              onClick={() => onCreateSubfolder(node.id)}
              className="text-[12px]"
            >
              <FolderPlus className="size-3.5" />
              {t("subfolder")}
            </ContextMenuItem>
          ) : null}
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => onDelete(node)}
            className="text-[12px]"
          >
            <Trash2 className="size-3.5" />
            {t("delete")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Children (récursif) */}
      {expanded && hasChildren ? (
        <ul className="flex flex-col gap-0.5">
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onCreateSubfolder={onCreateSubfolder}
              onDelete={onDelete}
              nodes={_ignored}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Convertit une liste plate de folders en arbre.
 * Limite la profondeur à 3 (les nœuds plus profonds sont ignorés — protection).
 */
export function buildFolderTree(
  flat: KnowledgeFolderListItem[],
  maxDepth = 3,
): FolderNode[] {
  // Map id → node enrichi.
  const byId = new Map<string, FolderNode>();
  for (const f of flat) {
    byId.set(f.id, { ...f, children: [], depth: 1 });
  }
  // Détache les root + push children.
  const roots: FolderNode[] = [];
  for (const f of flat) {
    const node = byId.get(f.id)!;
    if (f.parentId && byId.has(f.parentId)) {
      const parent = byId.get(f.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Tri par order + assignation des profondeurs.
  function walk(nodes: FolderNode[], depth: number) {
    nodes.sort((a, b) => a.order - b.order);
    for (const n of nodes) {
      n.depth = depth;
      if (depth < maxDepth && n.children.length > 0) {
        walk(n.children, depth + 1);
      } else {
        // Tronque les descendants au-delà du max — ne devrait pas arriver
        // si l'API valide bien, mais on protège.
        n.children = [];
      }
    }
  }
  walk(roots, 1);
  return roots;
}
