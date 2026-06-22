"use client";

/**
 * Workspace de veille / ingestion (Feature 1) — orchestrateur.
 *
 * Compose 2 sections atomiques :
 *   1. <IngestionSourcesTable> : sources configurées + actions CRUD.
 *   2. <IngestionQueueList>    : file d'attente "À valider".
 *
 * Gère le state global (data + loading + IDs en cours d'action) et les
 * fetches API. Les sous-composants restent purement présentationnels.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Plus, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "../_shared-alerts";
import { IngestionSourceForm } from "./ingestion-source-form";
import { IngestionSourcesTable } from "./ingestion-sources-table";
import { IngestionQueueList } from "./ingestion-queue-list";
import type {
  IngestedDocumentListItem,
  IngestionSourceListItem,
} from "@/lib/chomage-ia/types";

interface Props {
  domain: string;
}

export function IngestionWorkspace({ domain }: Props) {
  const t = useTranslations("admin.chomageIa");
  const [sources, setSources] = useState<IngestionSourceListItem[]>([]);
  const [queue, setQueue] = useState<IngestedDocumentListItem[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [actingDocId, setActingDocId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<IngestionSourceListItem | null>(null);
  const [toDelete, setToDelete] = useState<IngestionSourceListItem | null>(
    null,
  );

  const refresh = useCallback(async () => {
    setLoadingSources(true);
    setLoadingQueue(true);
    try {
      const [sRes, qRes] = await Promise.all([
        fetch(`/api/chomage-ia/ingestion/sources?domain=${domain}`),
        fetch(`/api/chomage-ia/ingestion/queue?domain=${domain}&status=pending`),
      ]);
      if (!sRes.ok) throw new Error(`HTTP ${sRes.status}`);
      if (!qRes.ok) throw new Error(`HTTP ${qRes.status}`);
      const sData = await sRes.json();
      const qData = await qRes.json();
      setSources(sData.items);
      setQueue(qData.items);
    } catch (e) {
      toast.error(t("dataLoadError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoadingSources(false);
      setLoadingQueue(false);
    }
  }, [domain, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggleEnabled(s: IngestionSourceListItem) {
    const next = !s.enabled;
    setSources((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, enabled: next } : x)),
    );
    try {
      const res = await fetch(`/api/chomage-ia/ingestion/sources/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      setSources((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, enabled: !next } : x)),
      );
      toast.error(t("toggleError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function checkNow(s: IngestionSourceListItem) {
    setCheckingId(s.id);
    try {
      const res = await fetch(
        `/api/chomage-ia/ingestion/check?sourceId=${s.id}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const { result } = data;
      if (result.error) {
        toast.warning(t("checkDoneWithError", { error: result.error }));
      } else {
        toast.success(
          t("checkOk", { created: result.created, skipped: result.skipped }),
        );
      }
      refresh();
    } catch (e) {
      toast.error(t("checkError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCheckingId(null);
    }
  }

  async function deleteSource(s: IngestionSourceListItem) {
    try {
      const res = await fetch(`/api/chomage-ia/ingestion/sources/${s.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(t("sourceDeleted"));
      refresh();
    } catch (e) {
      toast.error(t("deleteError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function actOnDoc(
    doc: IngestedDocumentListItem,
    action: "validate" | "reject",
  ) {
    setActingDocId(doc.id);
    try {
      const res = await fetch(
        `/api/chomage-ia/ingestion/queue/${doc.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast.success(
        action === "validate"
          ? t("docValidated")
          : t("docRejected"),
      );
      setQueue((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e) {
      toast.error(t("actionError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setActingDocId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <header className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold">
            <Rss className="size-4 text-primary" />
            {t("watchSources")}
          </h2>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            {t("newSource")}
          </Button>
        </header>
        <div className="mt-2">
          <IngestionSourcesTable
            items={sources}
            loading={loadingSources}
            checkingId={checkingId}
            onToggleEnabled={toggleEnabled}
            onCheckNow={checkNow}
            onEdit={setEditing}
            onDelete={setToDelete}
          />
        </div>
      </section>

      <section>
        <IngestionQueueList
          items={queue}
          loading={loadingQueue}
          actingDocId={actingDocId}
          onRefresh={refresh}
          onAct={actOnDoc}
        />
      </section>

      <IngestionSourceForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />
      <IngestionSourceForm
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        editing={editing}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
      <ConfirmDeleteDialog
        requireText={t("deleteKeyword")}
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t("deleteWatchSourceTitle")}
        description={t("deleteWatchSourceDescription")}
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteSource(toDelete);
          setToDelete(null);
        }}
      />
    </div>
  );
}
