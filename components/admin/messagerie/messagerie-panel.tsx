"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Inbox,
  Send,
  AlertOctagon,
  Archive,
  Trash2,
  Search,
  CheckCheck,
  X,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmailList } from "./email-list";
import { EmailDetail } from "./email-detail";
import { ComposeDialog } from "./compose-dialog";
import { SignatureDialog } from "./signature-dialog";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import type { EmailListItem, Folder, FolderStats } from "./types";

const FOLDER_TABS: Array<{
  key: Folder;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "INBOX", icon: Inbox },
  { key: "SENT", icon: Send },
  { key: "SPAM", icon: AlertOctagon },
  { key: "ARCHIVE", icon: Archive },
  { key: "TRASH", icon: Trash2 },
];

export function MessageriePanel() {
  const t = useTranslations("admin.messagerie");
  const confirm = useConfirm();

  function formatRelativeFromNow(date: Date | null): string {
    if (!date) return t("syncNever");
    const diff = Date.now() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 30) return t("syncJustNow");
    if (seconds < 60) return t("syncSecondsAgo", { count: seconds });
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t("syncMinutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("syncHoursAgo", { count: hours });
    return date.toLocaleString("fr-FR");
  }
  const [folder, setFolder] = useState<Folder>("INBOX");
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [stats, setStats] = useState<FolderStats>({
    counts: { INBOX: 0, SENT: 0, SPAM: 0, ARCHIVE: 0, TRASH: 0 },
    unreadInbox: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const syncInFlight = useRef(false);
  const [, forceRender] = useState(0);

  const fetchEmails = useCallback(
    async (targetFolder: Folder, q = "") => {
      setLoading(true);
      try {
        const url = new URL("/api/inbox", window.location.origin);
        url.searchParams.set("folder", targetFolder);
        if (q) url.searchParams.set("q", q);
        const response = await fetch(url.toString());
        if (response.ok) {
          const data = await response.json();
          setEmails(data);
        }
      } catch (err) {
        console.error("Failed to fetch:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/inbox/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        // Notify other listeners (sidebar badge) — single source of truth.
        window.dispatchEvent(new CustomEvent("inbox:stats-changed"));
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const sync = useCallback(
    async (silent = false) => {
      if (syncInFlight.current) {
        if (!silent) toast.info(t("syncAlreadyRunning"));
        return;
      }
      syncInFlight.current = true;
      setSyncing(true);
      try {
        const response = await fetch("/api/inbox/sync", { method: "POST" });
        if (response.ok) {
          const r = await response.json();
          setLastSync(new Date());
          if (!silent) {
            const parts = [
              r.imported ? t("syncNewCount", { count: r.imported }) : null,
              r.updated ? t("syncUpdatedCount", { count: r.updated }) : null,
              r.deleted ? t("syncDeletedCount", { count: r.deleted }) : null,
            ].filter(Boolean);
            if (r.errors > 0) {
              toast.warning(
                parts.length > 0 ? `${t("syncDone")} · ${parts.join(" · ")}` : t("syncDone"),
                {
                  description: t("syncErrorsDescription", { count: r.errors }),
                }
              );
            } else if (parts.length > 0) {
              toast.success(t("syncDone"), { description: parts.join(" · ") });
            } else {
              toast.success(t("syncUpToDate"));
            }
          }
          await Promise.all([fetchEmails(folder, searchQuery), fetchStats()]);
        } else {
          const err = await response.json().catch(() => ({}));
          if (!silent) toast.error(err.error || t("syncFailed"));
        }
      } catch (err) {
        console.error("Sync failed:", err);
        if (!silent) toast.error(t("networkError"));
      } finally {
        syncInFlight.current = false;
        setSyncing(false);
      }
    },
    [fetchEmails, fetchStats, folder, searchQuery, t]
  );

  // Initial mount: fetch + silent sync
  useEffect(() => {
    void (async () => {
      await Promise.all([fetchEmails("INBOX"), fetchStats()]);
      void sync(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Folder switch: reload list, drop selection + bulk
  useEffect(() => {
    setSelectedId(null);
    setSelectedIds(new Set());
    void fetchEmails(folder, searchQuery);
  }, [folder, fetchEmails, searchQuery]);

  // Auto-refresh every 5 min when the tab is visible
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void sync(true);
      }
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [sync]);

  // Re-render every 60s so the "synced X ago" text updates
  useEffect(() => {
    const tick = window.setInterval(() => forceRender((n) => n + 1), 60_000);
    return () => window.clearInterval(tick);
  }, []);

  const selected = useMemo(
    () => emails.find((e) => e.id === selectedId) || null,
    [emails, selectedId]
  );

  const handleEmailUpdated = useCallback(
    (updated: EmailListItem) => {
      setEmails((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
      void fetchStats();
    },
    [fetchStats]
  );

  const handleEmailRemoved = useCallback(
    (id: string) => {
      setEmails((prev) => prev.filter((e) => e.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (selectedId === id) setSelectedId(null);
      void fetchStats();
    },
    [selectedId, fetchStats]
  );

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function toggleStar(id: string, next: boolean) {
    // Optimistic update
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, isFlagged: next } : e)));
    try {
      const response = await fetch(`/api/inbox/${id}/star`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFlagged: next }),
      });
      if (!response.ok) {
        // Revert
        setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, isFlagged: !next } : e)));
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || t("actionFailed"));
      }
    } catch (err) {
      console.error(err);
      setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, isFlagged: !next } : e)));
      toast.error(t("networkError"));
    }
  }

  async function handleBulkAction(action: "read" | "unread" | "archive" | "spam" | "trash" | "inbox" | "delete") {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    if (action === "delete" && folder === "TRASH") {
      const ok = await confirm({
        title: t("bulkDeleteTitle", { count: ids.length }),
        description: t("bulkDeleteDescription"),
        confirmText: t("bulkDeleteConfirm", { count: ids.length }),
        destructive: true,
        requireText: t("deleteRequireText"),
      });
      if (!ok) return;
    }

    try {
      const response = await fetch("/api/inbox/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      if (response.ok) {
        const data = await response.json();
        const labels: Record<typeof action, string> = {
          read: t("bulkMarkedRead", { count: ids.length }),
          unread: t("bulkMarkedUnread", { count: ids.length }),
          archive: t("bulkArchived", { count: ids.length }),
          spam: t("bulkMovedToSpam", { count: ids.length }),
          trash: t("bulkMovedToTrash", { count: ids.length }),
          inbox: t("bulkMovedToInbox", { count: ids.length }),
          delete: t("bulkDeleted", { count: ids.length }),
        };
        toast.success(labels[action] || t("bulkProcessed", { count: data.affected }));
        clearSelection();
        if (selectedId && ids.includes(selectedId)) setSelectedId(null);
        await Promise.all([fetchEmails(folder, searchQuery), fetchStats()]);
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || t("actionFailed"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("networkError"));
    }
  }

  async function handleMarkAllRead() {
    try {
      const response = await fetch(`/api/inbox/mark-all-read?folder=${folder}`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        toast.success(t("bulkMarkedRead", { count: data.count }));
        await Promise.all([fetchEmails(folder, searchQuery), fetchStats()]);
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || t("actionFailed"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("networkError"));
    }
  }

  // Search debounce
  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // Keyboard navigation
  useKeyboardShortcuts({
    onNextEmail: () => {
      if (emails.length === 0) return;
      const idx = selectedId ? emails.findIndex((e) => e.id === selectedId) : -1;
      const next = emails[Math.min(idx + 1, emails.length - 1)];
      if (next) setSelectedId(next.id);
    },
    onPrevEmail: () => {
      if (emails.length === 0) return;
      const idx = selectedId ? emails.findIndex((e) => e.id === selectedId) : 0;
      const prev = emails[Math.max(idx - 1, 0)];
      if (prev) setSelectedId(prev.id);
    },
    onSearch: () => searchInputRef.current?.focus(),
    onEscape: () => {
      if (searchInputRef.current && document.activeElement === searchInputRef.current) {
        searchInputRef.current.blur();
      } else if (selectedIds.size > 0) {
        clearSelection();
      } else if (selectedId) {
        setSelectedId(null);
      }
    },
    onRefresh: () => void sync(false),
  });

  const bulkMode = selectedIds.size > 0;
  const showDetailOnly = !!selectedId; // mobile: when an email is selected, show only the detail

  return (
    <>
      {/* Header bar */}
      <div className="flex flex-col gap-2 border-b px-4 py-2 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">
              contact@docbel.be ·{" "}
              {syncing
                ? t("syncInProgress")
                : t("syncedRelative", { when: formatRelativeFromNow(lastSync) })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ComposeDialog onSent={() => sync(true)} />
          <Button
            onClick={() => sync(false)}
            disabled={syncing}
            variant="outline"
            size="sm"
            className="gap-2 h-8"
            title={t("syncButtonTitle")}
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t("syncButton")}</span>
          </Button>
          <SignatureDialog />
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col gap-2 border-b px-4 py-2 md:flex-row md:items-center md:px-6">
        <Tabs value={folder} onValueChange={(v) => setFolder(v as Folder)} className="w-full md:w-auto">
          <TabsList variant="line" className="gap-1 overflow-x-auto">
            {FOLDER_TABS.map(({ key, icon: Icon }) => {
              const count = stats.counts[key] || 0;
              const showUnreadBadge = key === "INBOX" && stats.unreadInbox > 0;
              return (
                <TabsTrigger key={key} value={key} className="gap-2">
                  <Icon className="size-3.5" />
                  <span>{t(`folder_${key}` as Parameters<typeof t>[0])}</span>
                  {showUnreadBadge ? (
                    <Badge variant="default" className="h-5 px-1.5 text-[10px] tabular-nums">
                      {stats.unreadInbox}
                    </Badge>
                  ) : count > 0 ? (
                    <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        <div className="md:ml-auto">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-8 pl-8 pr-8 w-full md:w-64"
            />
            {searchInput && (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                onClick={() => setSearchInput("")}
                aria-label={t("clear")}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk action bar (or mark-all-read) */}
      {bulkMode ? (
        <div className="flex items-center gap-1 border-b bg-primary/5 px-4 py-1.5 md:px-6">
          <span className="text-sm font-medium">
            {t("selectedCount", { count: selectedIds.size })}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {(folder === "INBOX" || folder === "SPAM") && (
              <>
                <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => handleBulkAction("read")}>
                  <CheckCheck className="size-3.5" />
                  <span className="hidden sm:inline">{t("markRead")}</span>
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => handleBulkAction("unread")}>
                  <span className="hidden sm:inline">{t("markUnread")}</span>
                </Button>
              </>
            )}
            {folder !== "ARCHIVE" && folder !== "SENT" && (
              <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => handleBulkAction("archive")}>
                <Archive className="size-3.5" />
                <span className="hidden sm:inline">{t("archive")}</span>
              </Button>
            )}
            {folder === "INBOX" && (
              <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => handleBulkAction("spam")}>
                <AlertOctagon className="size-3.5" />
                <span className="hidden sm:inline">{t("spam")}</span>
              </Button>
            )}
            {folder === "SPAM" && (
              <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => handleBulkAction("inbox")}>
                <Inbox className="size-3.5" />
                <span className="hidden sm:inline">{t("notSpam")}</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleBulkAction(folder === "TRASH" ? "delete" : "trash")}
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">{folder === "TRASH" ? t("delete") : t("trash")}</span>
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={clearSelection}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : folder === "INBOX" && stats.unreadInbox > 0 ? (
        <div className="flex items-center justify-end border-b bg-muted/20 px-4 py-1.5 md:px-6">
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={handleMarkAllRead}>
            <CheckCheck className="size-3.5" />
            {t("markAllRead")}
          </Button>
        </div>
      ) : null}

      {/* Master-detail layout — mobile: list OR detail, desktop: both */}
      <div className="flex flex-1 overflow-hidden">
        <div
          className={cn(
            "shrink-0 overflow-y-auto border-r md:w-[380px]",
            showDetailOnly ? "hidden md:block" : "w-full md:block"
          )}
        >
          <EmailList
            emails={emails}
            loading={loading}
            folder={folder}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onSelect={setSelectedId}
            onToggleSelected={toggleSelected}
            onToggleStar={toggleStar}
            searchQuery={searchQuery}
          />
        </div>
        <div
          className={cn(
            "flex-1 overflow-y-auto bg-muted/30",
            showDetailOnly ? "block" : "hidden md:block"
          )}
        >
          {selected ? (
            <>
              {/* Mobile back button */}
              <div className="md:hidden border-b bg-background px-4 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-8"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="size-3.5" />
                  {t("back")}
                </Button>
              </div>
              <EmailDetail
                email={selected}
                folder={folder}
                onUpdated={handleEmailUpdated}
                onRemoved={handleEmailRemoved}
                onToggleStar={toggleStar}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {loading ? t("loading") : t("selectEmail")}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
