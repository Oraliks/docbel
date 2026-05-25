"use client";

/**
 * Shell de la vue tabulaire des sources.
 *
 * Remplace l'ancien `<SourcesWorkspace>` (vue cards). Architecture :
 *   - état global : sources[], filtres, sélection, drawer
 *   - fetch GET /sources?domain=X (recharge à chaque mount + refresh manuel)
 *   - dispatch des actions ligne (toggle, reindex, summarize, delete) et
 *     bulk (POST /sources/bulk)
 *   - drawer right pour édition inline (SourceDetailDrawer)
 *   - modals préservées : SourceFormDialog (create), UploadDialog (upload)
 *
 * Le filtrage et le tri sont 100 % côté client : la KB tient sous quelques
 * centaines de sources, on évite les round-trips. Si on dépasse 1000, on
 * pourra passer en server-side avec query params.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { KnowledgeSourceListItem } from "@/lib/chomage-ia/types";
import { SourceFormDialog } from "../source-form";
import { UploadDialog } from "../upload-dialog";
import { ConfirmDeleteDialog } from "../../_shared-alerts";
import { SourcesToolbar } from "./sources-toolbar";
import { SourcesTable } from "./sources-table";
import { SourceDetailDrawer } from "./source-detail-drawer";
import { BulkActionsBar, type BulkAction } from "./bulk-actions-bar";
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

export function SourcesTableWorkspace({
  domain,
  aiAvailable,
  initialSources,
}: Props) {
  const [sources, setSources] = useState<KnowledgeSourceListItem[]>(
    initialSources ?? []
  );
  const [loading, setLoading] = useState(!initialSources);
  const [error, setError] = useState<string | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Filtres
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [tagFilters, setTagFilters] = useState<string[]>([]);

  // Tri
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  // Sélection multi
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drawer
  const [currentDetailId, setCurrentDetailId] = useState<string | null>(null);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

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

  useEffect(() => {
    // Charge à mount si on n'a pas d'initialSources.
    if (!initialSources) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------------------------------------------- */
  /*  Derived state                                                    */
  /* ----------------------------------------------------------------- */
  const allTags = useMemo(() => extractAllTags(sources), [sources]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sources.filter((s) => {
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
  }, [sources, search, statusFilter, kindFilter, tagFilters]);

  const sorted = useMemo(
    () => sortSources(filtered, sortColumn, sortDirection),
    [filtered, sortColumn, sortDirection]
  );

  // selectedIds après filtrage : on garde uniquement ceux encore visibles.
  // Évite de garder une sélection "fantôme" sur des sources hors filtre.
  // Note : on ne purge PAS l'état (le user pourrait rouvrir le filtre),
  // mais le triple-state du checkbox header se base sur les visibles.
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
  /*  Sélection                                                        */
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
      // Date desc par défaut (plus récent en haut), texte asc, taille desc.
      setSortDirection(col === "date" || col === "size" ? "desc" : "asc");
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
          // Optimistic update local pour réactivité immédiate.
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
      // Optimistic remove + retire de la sélection.
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
        // Optimistic remove des IDs supprimés (data.failed contient ceux non-touchés).
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
        // On garde la sélection pour les opérations non destructives :
        // le user peut vouloir enchaîner activer puis tagger sur le même set.
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
    <div className="flex flex-col gap-3">
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

      <BulkActionsBar
        count={visibleSelectedCount}
        allTags={allTags}
        submitting={bulkSubmitting}
        onClear={clearSelection}
        onAction={bulkAction}
      />

      {/* Drawer */}
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

      {/* Dialogs préservés (création + upload) */}
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

      {/* Confirm delete single (déclenché depuis la kebab menu) */}
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
    </div>
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
