"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangleIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiffResponse {
  hasSeedSource: boolean;
  hasDiff?: boolean;
  fieldsCount?: number;
  expectedCount?: number;
  idsAdded?: string[];
  idsRemoved?: string[];
  idsModified?: string[];
}

/// Banner qui apparait si la DB derive de son seed source (Feature #3 des
/// ameliorations post-plan bindings-canonical-ux). Poll GET seed-diff au
/// mount et sur `refreshKey` — bouton Sync appelle POST seed-diff pour
/// re-appliquer improve() puis rafraichit la vue parente via `onSynced`.
export function SeedDiffBanner({
  formId,
  refreshKey = 0,
  onSynced,
}: {
  formId: string;
  refreshKey?: number;
  onSynced?: () => void;
}) {
  const t = useTranslations("admin.pdf");
  const [state, setState] = useState<DiffResponse | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/pdf/forms/${formId}/seed-diff`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setState(d);
      })
      .catch(() => {
        // Fail-soft : pas de banner en cas d'erreur reseau. L'admin
        // continuera de travailler comme d'habitude.
      });
    return () => {
      active = false;
    };
  }, [formId, refreshKey]);

  if (!state || !state.hasSeedSource || !state.hasDiff) return null;

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/admin/pdf/forms/${formId}/seed-diff`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error(t("seedDiffSyncFail"));
        return;
      }
      toast.success(t("seedDiffSyncDone"));
      // Force le refresh du diff + re-chargement des donnees du form
      // cote parent.
      setState(null);
      onSynced?.();
    } finally {
      setSyncing(false);
    }
  }

  const added = state.idsAdded?.length ?? 0;
  const removed = state.idsRemoved?.length ?? 0;
  const modified = state.idsModified?.length ?? 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("seedDiffTitle")}</span>
          <span className="text-xs text-muted-foreground">
            {t("seedDiffCounts", { added, removed, modified })}
          </span>
        </div>
      </div>
      <Button size="sm" onClick={sync} disabled={syncing}>
        {syncing ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <RefreshCwIcon className="size-4" />
        )}
        {syncing ? t("seedDiffSyncing") : t("seedDiffSyncButton")}
      </Button>
    </div>
  );
}
