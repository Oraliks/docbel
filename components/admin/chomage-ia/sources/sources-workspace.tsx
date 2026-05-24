"use client";

/**
 * Workspace principal de la gestion sources (KB).
 *
 * Client component qui orchestre :
 *   - chargement / refresh de la liste sources (GET /api/chomage-ia/sources)
 *   - filtres (search, kind, enabled-only)
 *   - ouverture des modals (création / édition / suppression)
 *   - actions inline (toggle enabled, summarize, delete)
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Search, Filter as FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KnowledgeSourceListItem } from "@/lib/chomage-ia/types";
import { SourcesList } from "./sources-list";
import { SourceFormDialog } from "./source-form";
import { UploadDialog } from "./upload-dialog";
import { KIND_LABELS } from "../_shared";

interface SourcesWorkspaceProps {
  domain: string;
  aiAvailable: boolean;
}

type FilterKind = "all" | "text" | "url" | "tutorial" | "video_transcript" | "image_caption" | "pdf";

export function SourcesWorkspace({ domain, aiAvailable }: SourcesWorkspaceProps) {
  const [items, setItems] = useState<KnowledgeSourceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<FilterKind>("all");
  const [enabledOnly, setEnabledOnly] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("domain", domain);
      if (enabledOnly) params.set("enabled", "true");
      if (kind !== "all") params.set("kind", kind);
      if (search.trim().length >= 2) params.set("search", search.trim());
      const res = await fetch(`/api/chomage-ia/sources?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: KnowledgeSourceListItem[] };
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [domain, enabledOnly, kind, search]);

  // Auto-refresh à chaque changement de filtre (debounce sur search uniquement).
  useEffect(() => {
    const t = setTimeout(refresh, search.length > 0 ? 250 : 0);
    return () => clearTimeout(t);
  }, [refresh, search]);

  const stats = useMemo(() => {
    const enabled = items.filter((i) => i.enabled).length;
    return { total: items.length, enabled };
  }, [items]);

  async function toggleEnabled(id: string, current: boolean) {
    try {
      const res = await fetch(`/api/chomage-ia/sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !current }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(current ? "Source désactivée" : "Source activée");
      refresh();
    } catch (e) {
      toast.error("Échec de la mise à jour", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Supprimer définitivement "${title}" ?`)) return;
    try {
      const res = await fetch(`/api/chomage-ia/sources/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Source supprimée");
      refresh();
    } catch (e) {
      toast.error("Échec de la suppression", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function summarize(id: string) {
    try {
      const res = await fetch(`/api/chomage-ia/sources/${id}/summarize`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast.success("Résumé généré");
      refresh();
    } catch (e) {
      toast.error("Échec du résumé", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher (titre, contenu, résumé)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <FilterIcon className="size-3.5 text-muted-foreground" />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as FilterKind)}
            className="h-8 rounded-md border border-border bg-background px-2 text-[12.5px] font-medium"
          >
            <option value="all">Tous les types</option>
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={enabledOnly}
            onChange={(e) => setEnabledOnly(e.target.checked)}
            className="size-3.5"
          />
          Actives uniquement
        </label>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Rafraîchir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUploadOpen(true)}
          >
            Upload PDF/Image
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Nouvelle source
          </Button>
        </div>
      </div>

      {/* Stats compactes */}
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span>
          {stats.total} affichée{stats.total > 1 ? "s" : ""}
        </span>
        <span>·</span>
        <span>
          {stats.enabled} active{stats.enabled > 1 ? "s" : ""}
        </span>
        {aiAvailable ? (
          <>
            <span>·</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              IA disponible
            </span>
          </>
        ) : null}
      </div>

      {/* Erreur globale */}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
          Erreur : {error}
        </div>
      ) : null}

      {/* Liste */}
      <SourcesList
        items={items}
        loading={loading}
        aiAvailable={aiAvailable}
        onEdit={(id) => setEditingId(id)}
        onToggleEnabled={toggleEnabled}
        onDelete={remove}
        onSummarize={summarize}
      />

      {/* Modals */}
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
      <SourceFormDialog
        open={editingId !== null}
        onOpenChange={(open) => !open && setEditingId(null)}
        mode="edit"
        domain={domain}
        sourceId={editingId}
        onSuccess={() => {
          setEditingId(null);
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
    </div>
  );
}
