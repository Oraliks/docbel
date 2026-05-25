"use client";

/**
 * Shell de la vue tabulaire des sources avec sidebar arborescente de
 * dossiers (KnowledgeFolder) + drag&drop pour organiser.
 *
 * Architecture :
 *   - sidebar gauche (240px) : arbre nested folders avec multi-select
 *   - main droite : toolbar + table + drawer édition
 *   - DndContext (@dnd-kit) wrap le tout pour permettre drag d'une source
 *     vers un folder dans la sidebar (ou "Sans dossier" / "Toutes")
 *   - filtrage table : (status + kind + tags + search) ET selection folders
 *   - extension bulk action "move-to-folder" pour déplacer en masse
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import type {
  KnowledgeSourceListItem,
  KnowledgeFolderListItem,
} from "@/lib/chomage-ia/types";
import { SourceFormDialog } from "../source-form";
import { UploadDialog } from "../upload-dialog";
import { ConfirmDeleteDialog } from "../../_shared-alerts";
import { SourcesToolbar } from "./sources-toolbar";
import { SourcesTable } from "./sources-table";
import { SourceDetailDrawer } from "./source-detail-drawer";
import { BulkActionsBar, type BulkAction } from "./bulk-actions-bar";
import { FoldersSidebar } from "./folders-sidebar";
import { FolderFormDialog, type FolderFormMode } from "./folder-form-dialog";
import { buildFolderTree, type FolderNode } from "./folders-tree";
import {
  extractAllTags,
  matchesStatusFilter,
  sortSources,
  type SortColumn,
  type SortDirection,
  type StatusFilter,
} from "./_shared-table";

interface Props {
  domain: string;
  aiAvailable: boolean;
  initialSources?: KnowledgeSourceListItem[];
}

/**
 * Collecte un set d'IDs : pour chaque root sélectionné, on inclut tous
 * ses descendants. Utilisé pour le filtrage table par folder (un click
 * sur un parent affiche aussi les sources de ses sous-dossiers).
 */
function collectDescendantIds(
  tree: FolderNode[],
  rootIds: Set<string>,
): Set<string> {
  const out = new Set<string>();
  function visit(node: FolderNode, inSelected: boolean) {
    const me = inSelected || rootIds.has(node.id);
    if (me) out.add(node.id);
    for (const child of node.children) visit(child, me);
  }
  for (const node of tree) visit(node, false);
  return out;
}

export function SourcesTableWorkspace({
  domain,
  aiAvailable,
  initialSources,
}: Props) {
  /* ----------------------------------------------------------------- */
  /*  Sources state                                                    */
  /* ----------------------------------------------------------------- */
  const [sources, setSources] = useState<KnowledgeSourceListItem[]>(
    initialSources ?? []
  );
  const [loading, setLoading] = useState(!initialSources);
  const [error, setError] = useState<string | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [tagFilters, setTagFilters] = useState<string[]>([]);

  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentDetailId, setCurrentDetailId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  /* ----------------------------------------------------------------- */
  /*  Folders state                                                    */
  /* ----------------------------------------------------------------- */
  const [folders, setFolders] = useState<KnowledgeFolderListItem[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [unassignedSelected, setUnassignedSelected] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Form dialog (create/edit folder)
  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [folderFormMode, setFolderFormMode] = useState<FolderFormMode>("create");
  const [folderFormCurrent, setFolderFormCurrent] =
    useState<KnowledgeFolderListItem | null>(null);
  const [folderFormInitialParent, setFolderFormInitialParent] = useState<
    string | null
  >(null);

  // Delete confirm
  const [pendingDeleteFolder, setPendingDeleteFolder] =
    useState<KnowledgeFolderListItem | null>(null);

  /* ----------------------------------------------------------------- */
  /*  Fetching                                                         */
  /* ----------------------------------------------------------------- */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/chomage-ia/sources?domain=${encodeURIComponent(domain)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: KnowledgeSourceListItem[] };
      setSources(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [domain]);

  const refreshFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const res = await fetch(
        `/api/chomage-ia/kb-folders?domain=${encodeURIComponent(domain)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: KnowledgeFolderListItem[] };
      setFolders(data.items);
    } catch (e) {
      // Pas bloquant : si /kb-folders est down on continue sans folders
      console.warn("[sources] refreshFolders failed:", e);
    } finally {
      setFoldersLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    if (!initialSources) refresh();
    refreshFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------------------------------------------- */
  /*  Derived state                                                    */
  /* ----------------------------------------------------------------- */
  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const allTags = useMemo(() => extractAllTags(sources), [sources]);

  const unassignedCount = useMemo(
    () => sources.filter((s) => !s.folderId).length,
    [sources],
  );

  // Resolved folder filter : selected IDs + tous leurs descendants.
  const effectiveFolderIdSet = useMemo(() => {
    if (selectedFolderIds.length === 0) return null;
    return collectDescendantIds(tree, new Set(selectedFolderIds));
  }, [tree, selectedFolderIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sources.filter((s) => {
      // Filtre folder
      if (unassignedSelected) {
        if (s.folderId) return false;
      } else if (effectiveFolderIdSet) {
        if (!s.folderId || !effectiveFolderIdSet.has(s.folderId)) return false;
      }
      if (!matchesStatusFilter(s, statusFilter)) return false;
      if (kindFilter !== "all" && s.kind !== kindFilter) return false;
      if (tagFilters.length > 0) {
        const set = new Set(s.tags);
        const someMatch = tagFilters.some((t) => set.has(t));
        if (!someMatch) return false;
      }
      if (q.length >= 1) {
        const hay =
          `${s.title} ${s.summary ?? ""} ${s.contentPreview} ${s.tags.join(
            " "
          )} ${s.sourceUrl ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    sources,
    search,
    statusFilter,
    kindFilter,
    tagFilters,
    unassignedSelected,
    effectiveFolderIdSet,
  ]);

  const sorted = useMemo(
    () => sortSources(filtered, sortColumn, sortDirection),
    [filtered, sortColumn, sortDirection]
  );

  const visibleIds = useMemo(() => new Set(sorted.map((s) => s.id)), [sorted]);
  const visibleSelectedCount = useMemo(() => {
    let n = 0;
    for (const id of selectedIds) if (visibleIds.has(id)) n++;
    return n;
  }, [selectedIds, visibleIds]);

  const selectAllState: boolean | "indeterminate" = useMemo(() => {
    if (sorted.length === 0) return false;
    if (visibleSelectedCount === 0) return false;
    if (visibleSelectedCount === sorted.length) return true;
    return "indeterminate";
  }, [sorted.length, visibleSelectedCount]);

  const cachedDetailItem = useMemo(
    () =>
      currentDetailId
        ? sources.find((s) => s.id === currentDetailId) ?? null
        : null,
    [sources, currentDetailId]
  );

  /* ----------------------------------------------------------------- */
  /*  Sélection sources                                                */
  /* ----------------------------------------------------------------- */
  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of visibleIds) next.add(id);
      } else {
        for (const id of visibleIds) next.delete(id);
      }
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleSortChange(col: SortColumn) {
    if (col === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection(col === "date" || col === "size" ? "desc" : "asc");
    }
  }

  /* ----------------------------------------------------------------- */
  /*  Folders handlers                                                 */
  /* ----------------------------------------------------------------- */
  function selectFolderAll() {
    setSelectedFolderIds([]);
    setUnassignedSelected(false);
  }
  function selectFolderUnassigned() {
    setSelectedFolderIds([]);
    setUnassignedSelected(true);
  }
  function selectFolder(id: string, withMeta: boolean) {
    setUnassignedSelected(false);
    setSelectedFolderIds((prev) => {
      if (withMeta) {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        return [...prev, id];
      }
      if (prev.length === 1 && prev[0] === id) return [];
      return [id];
    });
  }
  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function openCreateRoot() {
    setFolderFormMode("create");
    setFolderFormCurrent(null);
    setFolderFormInitialParent(null);
    setFolderFormOpen(true);
  }
  function openCreateSubfolder(parentId: string) {
    setFolderFormMode("create");
    setFolderFormCurrent(null);
    setFolderFormInitialParent(parentId);
    setFolderFormOpen(true);
  }
  function openEditFolder(folder: KnowledgeFolderListItem) {
    setFolderFormMode("edit");
    setFolderFormCurrent(folder);
    setFolderFormInitialParent(null);
    setFolderFormOpen(true);
  }
  async function confirmDeleteFolder() {
    if (!pendingDeleteFolder) return;
    const id = pendingDeleteFolder.id;
    try {
      const res = await fetch(`/api/chomage-ia/kb-folders/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Dossier supprimé`);
      await Promise.all([refreshFolders(), refresh()]);
      setSelectedFolderIds((prev) => prev.filter((x) => x !== id));
    } catch (e) {
      toast.error("Échec de la suppression", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPendingDeleteFolder(null);
    }
  }

  /* ----------------------------------------------------------------- */
  /*  DnD                                                              */
  /* ----------------------------------------------------------------- */
  const sensors = useSensors(
    // 150 ms de delay pour ne pas confondre avec un click sur la ligne
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Drag d'une source vers un folder
    if (activeId.startsWith("source:")) {
      const sourceId = activeId.slice("source:".length);

      let targetFolderId: string | null | undefined;
      if (overId === "folders-unassigned") targetFolderId = null;
      else if (overId === "folders-all") return; // pas d'action claire
      else if (overId.startsWith("folder:"))
        targetFolderId = overId.slice("folder:".length);
      else return;

      // Si la source draggée fait partie de la sélection multi → déplace tout
      const idsToMove =
        selectedIds.has(sourceId) && selectedIds.size > 1
          ? Array.from(selectedIds)
          : [sourceId];

      try {
        const res = await fetch("/api/chomage-ia/sources/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: idsToMove,
            action: "move-to-folder",
            folderId: targetFolderId,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(
          `${idsToMove.length} source${idsToMove.length > 1 ? "s" : ""} déplacée${idsToMove.length > 1 ? "s" : ""}`
        );
        await refresh();
      } catch (e) {
        toast.error("Échec du déplacement", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  /* ----------------------------------------------------------------- */
  /*  Actions ligne                                                    */
  /* ----------------------------------------------------------------- */
  async function rowAction(
    id: string,
    action:
      | { kind: "edit" }
      | { kind: "reindex" }
      | { kind: "summarize" }
      | { kind: "toggle-enabled" }
      | { kind: "delete" }
  ) {
    const item = sources.find((s) => s.id === id);
    if (!item) return;

    switch (action.kind) {
      case "edit":
        setCurrentDetailId(id);
        return;
      case "toggle-enabled": {
        try {
          const res = await fetch(`/api/chomage-ia/sources/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: !item.enabled }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast.success(item.enabled ? "Source désactivée" : "Source activée");
          setSources((arr) =>
            arr.map((s) =>
              s.id === id ? { ...s, enabled: !item.enabled } : s
            )
          );
        } catch (e) {
          toast.error("Échec de la mise à jour", {
            description: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }
      case "reindex": {
        try {
          const res = await fetch(
            `/api/chomage-ia/sources/${id}/reindex`,
            { method: "POST" }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          if (data.indexError) {
            toast.warning("Indexation partielle", {
              description: data.indexError,
            });
          } else {
            toast.success(
              `Indexation OK · ${data.reindexedCount ?? 0} chunk(s) (re)embeddés`
            );
          }
          await refresh();
        } catch (e) {
          toast.error("Échec indexation", {
            description: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }
      case "summarize": {
        try {
          const res = await fetch(
            `/api/chomage-ia/sources/${id}/summarize`,
            { method: "POST" }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          toast.success("Résumé généré");
          await refresh();
        } catch (e) {
          toast.error("Échec du résumé", {
            description: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }
      case "delete":
        setSingleDeleteId(id);
        return;
    }
  }

  async function deleteSource(id: string) {
    try {
      const res = await fetch(`/api/chomage-ia/sources/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Source supprimée");
      setSources((arr) => arr.filter((s) => s.id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (currentDetailId === id) setCurrentDetailId(null);
    } catch (e) {
      toast.error("Échec de la suppression", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /* ----------------------------------------------------------------- */
  /*  Bulk actions                                                     */
  /* ----------------------------------------------------------------- */
  async function bulkAction(action: BulkAction) {
    const idsArray = Array.from(selectedIds).filter((id) => visibleIds.has(id));
    if (idsArray.length === 0) return;

    const apiAction =
      action.kind === "enable"
        ? "enable"
        : action.kind === "disable"
          ? "disable"
          : action.kind === "delete"
            ? "delete"
            : action.kind === "reindex"
              ? "reindex"
              : action.kind === "add-tags"
                ? "add-tags"
                : "remove-tags";

    const body: Record<string, unknown> = { ids: idsArray, action: apiAction };
    if (action.kind === "add-tags" || action.kind === "remove-tags") {
      body.tags = action.tags;
    }

    setBulkSubmitting(true);
    try {
      const res = await fetch("/api/chomage-ia/sources/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const failedCount = Array.isArray(data.failed) ? data.failed.length : 0;
      const verb = labelForAction(action.kind, data.updated);
      if (failedCount > 0) {
        toast.warning(`${verb} avec ${failedCount} échec(s)`, {
          description: `${data.updated} ok, ${failedCount} en erreur.`,
        });
      } else {
        toast.success(verb);
      }
      if (action.kind === "delete") {
        const failedSet = new Set<string>(
          Array.isArray(data.failed)
            ? data.failed.map((f: { id: string }) => f.id)
            : []
        );
        setSources((arr) =>
          arr.filter((s) => !idsArray.includes(s.id) || failedSet.has(s.id))
        );
        clearSelection();
      } else {
        await refresh();
      }
    } catch (e) {
      toast.error("Action en lot échouée", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBulkSubmitting(false);
    }
  }

  /* ----------------------------------------------------------------- */
  /*  Render                                                           */
  /* ----------------------------------------------------------------- */
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[240px_1fr]">
        {/* Sidebar folders */}
        <aside className="hidden lg:block">
          <FoldersSidebar
            tree={tree}
            flatFolders={folders}
            selectedFolderIds={selectedFolderIds}
            unassignedSelected={unassignedSelected}
            expandedIds={expandedIds}
            unassignedCount={unassignedCount}
            totalCount={sources.length}
            loading={foldersLoading}
            onSelectAll={selectFolderAll}
            onSelectUnassigned={selectFolderUnassigned}
            onSelectFolder={selectFolder}
            onToggleExpand={toggleExpand}
            onCreateRoot={openCreateRoot}
            onCreateSubfolder={openCreateSubfolder}
            onEdit={openEditFolder}
            onDelete={setPendingDeleteFolder}
            pendingDelete={pendingDeleteFolder}
            onConfirmDelete={confirmDeleteFolder}
            onCancelDelete={() => setPendingDeleteFolder(null)}
          />
        </aside>

        {/* Main content */}
        <div className="flex min-w-0 flex-col gap-3">
          <SourcesToolbar
            filteredCount={sorted.length}
            totalCount={sources.length}
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            kindFilter={kindFilter}
            onKindChange={setKindFilter}
            tagFilters={tagFilters}
            onTagFiltersChange={setTagFilters}
            allTags={allTags}
            loading={loading}
            onRefresh={refresh}
            onCreate={() => setCreateOpen(true)}
            onUpload={() => setUploadOpen(true)}
          />

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
              Erreur : {error}
            </div>
          ) : null}

          <div className="flex min-h-[calc(100vh-220px)] flex-1 flex-col">
            <SourcesTable
              items={sorted}
              selectedIds={selectedIds}
              aiAvailable={aiAvailable}
              loading={loading}
              selectAllState={selectAllState}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
              onSelectAll={selectAllVisible}
              onSelectOne={toggleSelectOne}
              onOpen={(id) => setCurrentDetailId(id)}
              onRowAction={rowAction}
              onCreate={() => setCreateOpen(true)}
            />
          </div>
        </div>
      </div>

      <BulkActionsBar
        count={visibleSelectedCount}
        allTags={allTags}
        submitting={bulkSubmitting}
        onClear={clearSelection}
        onAction={bulkAction}
      />

      {/* Drawer édition */}
      <SourceDetailDrawer
        open={currentDetailId !== null}
        onOpenChange={(open) => {
          if (!open) setCurrentDetailId(null);
        }}
        sourceId={currentDetailId}
        cachedItem={cachedDetailItem}
        onSaved={refresh}
        onDeleted={() => {
          if (currentDetailId) {
            setSources((arr) => arr.filter((s) => s.id !== currentDetailId));
          }
          setCurrentDetailId(null);
        }}
      />

      <SourceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        domain={domain}
        onSuccess={() => {
          setCreateOpen(false);
          refresh();
        }}
      />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        domain={domain}
        onSuccess={() => {
          setUploadOpen(false);
          refresh();
        }}
      />

      <FolderFormDialog
        open={folderFormOpen}
        onOpenChange={setFolderFormOpen}
        mode={folderFormMode}
        domain={domain}
        allFolders={folders}
        current={folderFormCurrent}
        initialParentId={folderFormInitialParent}
        onSuccess={() => {
          setFolderFormOpen(false);
          refreshFolders();
        }}
      />

      <ConfirmDeleteDialog
        open={singleDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setSingleDeleteId(null);
        }}
        title="Supprimer cette source ?"
        description="La source sera supprimée définitivement de la knowledge base."
        onConfirm={async () => {
          if (singleDeleteId) await deleteSource(singleDeleteId);
        }}
      />
    </DndContext>
  );
}

function labelForAction(kind: BulkAction["kind"], count: number): string {
  const suffix = count > 1 ? "s" : "";
  switch (kind) {
    case "enable":
      return `${count} source${suffix} activée${suffix}`;
    case "disable":
      return `${count} source${suffix} désactivée${suffix}`;
    case "delete":
      return `${count} source${suffix} supprimée${suffix}`;
    case "reindex":
      return `${count} source${suffix} relancée${suffix} en indexation`;
    case "add-tags":
      return `${count} source${suffix} mise${suffix} à jour (tags ajoutés)`;
    case "remove-tags":
      return `${count} source${suffix} mise${suffix} à jour (tags retirés)`;
  }
}
