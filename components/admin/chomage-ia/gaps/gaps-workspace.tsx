"use client";

/**
 * Workspace de gestion des gaps de connaissance (Feature 6).
 *
 * UI :
 *   - Tabs status (open / resolved / ignored) avec compteurs
 *   - Liste de cards verticales (1 gap = 1 card) : query + occurrences + notes
 *     + actions inline (Marquer résolu, Ignorer, Rouvrir, Chercher Moniteur belge)
 *
 * Les gaps "open" sont ordonnés par occurrences DESC (questions répétées en haut).
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtRelative } from "../_shared";
import type {
  KnowledgeGapListItem,
  KnowledgeGapStatus,
} from "@/lib/chomage-ia/types";

interface Props {
  domain: string;
}

const TABS: Array<{ value: KnowledgeGapStatus; labelKey: "gapsTabOpen" | "gapsTabResolved" | "gapsTabIgnored" }> = [
  { value: "open", labelKey: "gapsTabOpen" },
  { value: "resolved", labelKey: "gapsTabResolved" },
  { value: "ignored", labelKey: "gapsTabIgnored" },
];

export function GapsWorkspace({ domain }: Props) {
  const t = useTranslations("admin.chomageIa");
  const [items, setItems] = useState<KnowledgeGapListItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    open: 0,
    resolved: 0,
    ignored: 0,
  });
  const [loading, setLoading] = useState(true);
  const [tabValue, setTab] = useState<KnowledgeGapStatus>("open");
  const [actingId, setActingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ domain, status: tabValue });
      const res = await fetch(`/api/chomage-ia/gaps?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items);
      setCounts(data.countsByStatus ?? counts);
    } catch (e) {
      toast.error(t("gapsLoadError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, tabValue]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function updateStatus(
    id: string,
    nextStatus: KnowledgeGapStatus,
  ): Promise<void> {
    setActingId(id);
    try {
      const res = await fetch(`/api/chomage-ia/gaps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(
        nextStatus === "resolved"
          ? t("gapResolvedToast")
          : nextStatus === "ignored"
            ? t("gapIgnoredToast")
            : t("gapReopenedToast"),
      );
      refresh();
    } catch (e) {
      toast.error(t("updateError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setActingId(null);
    }
  }

  function openMoniteurSearch(query: string) {
    const url = `https://www.ejustice.just.fgov.be/cgi/welcome.pl?language=fr&query=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openOnemSearch(query: string) {
    const url = `https://www.onem.be/search?q=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border bg-background/80 p-0.5">
          {TABS.map((tab) => {
            const active = tab.value === tabValue;
            const count = counts[tab.value] ?? 0;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setTab(tab.value)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {t(tab.labelKey)}
                <span
                  className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                    active ? "bg-primary-foreground/20" : "bg-muted-foreground/10"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("refresh")}
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-[12.5px] text-muted-foreground">
          {t("gapsEmpty")}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((g) => (
            <article
              key={g.id}
              className="rounded-lg border border-border bg-card p-3"
            >
              <header className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-[13px] font-semibold leading-snug">
                    {g.query}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("gapDetected", {
                      when: fmtRelative(g.detectedAt),
                      count: g.occurrences,
                    })}
                    {g.sessionId ? (
                      <>
                        {" · "}
                        <a
                          href={`/admin/chomage/ia/chat?session=${g.sessionId}${g.messageId ? `&msg=${g.messageId}` : ""}`}
                          className="text-primary hover:underline"
                        >
                          {t("gapViewConversation")}
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    g.status === "open"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      : g.status === "resolved"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {t("gapStatus", { status: g.status })}
                </span>
              </header>
              {g.notes ? (
                <p className="mt-2 text-[11.5px] italic text-muted-foreground">
                  {g.notes}
                </p>
              ) : null}
              <footer className="mt-3 flex flex-wrap items-center gap-1.5">
                {g.status === "open" ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actingId === g.id}
                      onClick={() => updateStatus(g.id, "resolved")}
                    >
                      <CheckCircle2 className="size-3.5" />
                      {t("gapMarkResolved")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actingId === g.id}
                      onClick={() => updateStatus(g.id, "ignored")}
                    >
                      <XCircle className="size-3.5" />
                      {t("gapIgnore")}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actingId === g.id}
                    onClick={() => updateStatus(g.id, "open")}
                  >
                    <RefreshCw className="size-3.5" />
                    {t("gapReopen")}
                  </Button>
                )}
                <span className="mx-1 text-muted-foreground/40">·</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openMoniteurSearch(g.query)}
                  title={t("searchInMoniteur")}
                >
                  <Search className="size-3.5" />
                  {t("moniteurBelge")}
                  <ExternalLink className="size-3 opacity-60" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openOnemSearch(g.query)}
                  title={t("searchOnOnem")}
                >
                  <MessageCircle className="size-3.5" />
                  {t("onem")}
                  <ExternalLink className="size-3 opacity-60" />
                </Button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
