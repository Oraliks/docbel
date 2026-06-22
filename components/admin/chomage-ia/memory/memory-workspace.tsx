"use client";

/**
 * Workspace de gestion de la mémoire long-terme (Feature 4).
 *
 * UI :
 *   - Toolbar : filtre importance + bouton "Nouveau fait"
 *   - Tableau dense : importance / contenu / toggle / actions
 *   - Dialog inline pour créer / éditer (form simple)
 *
 * Pattern Beldoc : pas de bibliothèque tierce de table, juste une <table>
 * stylée Tailwind. La liste reste petite (~20-50 entrées attendues), pas
 * besoin de virtualisation ni de tri serveur.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Brain, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "../_shared-alerts";
import { fmtRelative } from "../_shared";
import { MemoryFormDialog } from "./memory-form-dialog";
import type {
  ChatMemoryListItem,
  MemoryImportance,
} from "@/lib/chomage-ia/types";

type FilterValue = "all" | MemoryImportance;

const IMPORTANCE_COLORS: Record<MemoryImportance, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

interface Props {
  domain: string;
}

export function MemoryWorkspace({ domain }: Props) {
  const t = useTranslations("admin.chomageIa");
  const [items, setItems] = useState<ChatMemoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ChatMemoryListItem | null>(null);
  const [toDelete, setToDelete] = useState<ChatMemoryListItem | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ domain });
      if (filter !== "all") params.set("importance", filter);
      const res = await fetch(`/api/chomage-ia/memory?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: ChatMemoryListItem[] };
      setItems(data.items);
    } catch (e) {
      toast.error(t("memoryLoadError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [domain, filter, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggleEnabled(item: ChatMemoryListItem) {
    const next = !item.enabled;
    setItems((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, enabled: next } : m)),
    );
    try {
      const res = await fetch(`/api/chomage-ia/memory/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      setItems((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, enabled: !next } : m)),
      );
      toast.error(t("toggleError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function deleteItem(item: ChatMemoryListItem) {
    try {
      const res = await fetch(`/api/chomage-ia/memory/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(t("factDeleted"));
      setItems((prev) => prev.filter((m) => m.id !== item.id));
    } catch (e) {
      toast.error(t("deleteError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const enabledCount = items.filter((m) => m.enabled).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary" />
          <h2 className="text-[14px] font-semibold">{t("memoryTitle")}</h2>
          <span className="text-[11.5px] text-muted-foreground">
            {t("memoryFactsCount", { count: items.length })} ·{" "}
            {t("memoryActiveCount", { count: enabledCount })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-9 text-[12px]">
                  {filter === "all"
                    ? t("importanceFilterAll")
                    : t("importanceFilter", {
                        importance: t("importanceLabel", { importance: filter }),
                      })}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuRadioGroup
                value={filter}
                onValueChange={(v) => setFilter(v as FilterValue)}
              >
                <DropdownMenuRadioItem value="all" className="text-[12px]">
                  {t("importanceAll")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="high" className="text-[12px]">
                  {t("importanceHigh")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="medium" className="text-[12px]">
                  {t("importanceMedium")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="low" className="text-[12px]">
                  {t("importanceLow")}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            {t("newFact")}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-[12.5px]">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold w-[110px]">
                {t("colImportance")}
              </th>
              <th className="px-3 py-2 text-left font-semibold">{t("colFact")}</th>
              <th className="px-3 py-2 text-right font-semibold w-[130px]">
                {t("colUpdated")}
              </th>
              <th className="px-3 py-2 text-right font-semibold w-[90px]">
                {t("colActive")}
              </th>
              <th className="px-3 py-2 text-right font-semibold w-[110px]">
                {t("colActions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {t("loading")}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  {t("memoryEmpty")}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${IMPORTANCE_COLORS[item.importance]}`}
                    >
                      {t("importanceLabel", { importance: item.importance })}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-[12.5px] leading-relaxed">
                    {item.content}
                  </td>
                  <td className="px-3 py-2 text-right align-top text-[11px] text-muted-foreground tabular-nums">
                    {fmtRelative(item.updatedAt)}
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={() => toggleEnabled(item)}
                      aria-label={t("toggleEnabledAria")}
                    />
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <div className="inline-flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing(item)}
                        title={t("edit")}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setToDelete(item)}
                        title={t("delete")}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MemoryFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        domain={domain}
        onCreated={() => {
          setCreateOpen(false);
          refresh();
        }}
      />
      <MemoryFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        domain={domain}
        editing={editing}
        onCreated={() => {
          setEditing(null);
          refresh();
        }}
      />
      <ConfirmDeleteDialog
        requireText={t("deleteKeyword")}
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("deleteFactTitle")}
        description={t("deleteFactDescription")}
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteItem(toDelete);
          setToDelete(null);
        }}
      />
    </div>
  );
}
