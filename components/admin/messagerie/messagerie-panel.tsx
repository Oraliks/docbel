"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Inbox, Send, AlertOctagon, Archive, Trash2 } from "lucide-react";
import { EmailList } from "./email-list";
import { EmailDetail } from "./email-detail";
import { ComposeDialog } from "./compose-dialog";
import type { EmailListItem, Folder, FolderStats } from "./types";

const FOLDER_TABS: Array<{
  key: Folder;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "INBOX", label: "Reçus", icon: Inbox },
  { key: "SENT", label: "Envoyés", icon: Send },
  { key: "SPAM", label: "Spam", icon: AlertOctagon },
  { key: "ARCHIVE", label: "Archivés", icon: Archive },
  { key: "TRASH", label: "Corbeille", icon: Trash2 },
];

export function MessageriePanel() {
  const [folder, setFolder] = useState<Folder>("INBOX");
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<FolderStats>({
    counts: { INBOX: 0, SENT: 0, SPAM: 0, ARCHIVE: 0, TRASH: 0 },
    unreadInbox: 0,
  });

  const fetchEmails = useCallback(async (targetFolder: Folder) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/inbox?folder=${targetFolder}`);
      if (response.ok) {
        const data = await response.json();
        setEmails(data);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/inbox/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const sync = useCallback(
    async (silent = false) => {
      setSyncing(true);
      if (!silent) setSyncMessage(null);
      try {
        const response = await fetch("/api/inbox/sync", { method: "POST" });
        if (response.ok) {
          const r = await response.json();
          if (!silent) {
            const parts = [
              r.imported ? `${r.imported} nouveau(x)` : null,
              r.updated ? `${r.updated} mis à jour` : null,
              r.deleted ? `${r.deleted} supprimé(s)` : null,
            ].filter(Boolean);
            setSyncMessage(parts.length > 0 ? parts.join(" · ") : "À jour");
            window.setTimeout(() => setSyncMessage(null), 4000);
          }
          await Promise.all([fetchEmails(folder), fetchStats()]);
        } else {
          const err = await response.json().catch(() => ({}));
          setSyncMessage(`Erreur : ${err.error || "sync"}`);
        }
      } catch (err) {
        console.error("Sync failed:", err);
        setSyncMessage("Erreur réseau");
      } finally {
        setSyncing(false);
      }
    },
    [fetchEmails, fetchStats, folder]
  );

  // Initial mount: fetch + silent sync
  useEffect(() => {
    void (async () => {
      await Promise.all([fetchEmails("INBOX"), fetchStats()]);
      void sync(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Folder switch: reload list, drop selection
  useEffect(() => {
    setSelectedId(null);
    void fetchEmails(folder);
  }, [folder, fetchEmails]);

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
      if (selectedId === id) setSelectedId(null);
      void fetchStats();
    },
    [selectedId, fetchStats]
  );

  return (
    <>
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 border-b px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Messagerie</h1>
          <p className="text-xs text-muted-foreground">contact@docbel.be · synchronisé avec OVH</p>
        </div>
        <div className="flex items-center gap-3">
          {syncMessage && (
            <span className="text-xs text-muted-foreground">{syncMessage}</span>
          )}
          <ComposeDialog onSent={() => sync(true)} />
          <Button
            onClick={() => sync(false)}
            disabled={syncing}
            variant="outline"
            size="sm"
            className="gap-2 h-8"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            Synchroniser
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-6 py-2">
        <Tabs value={folder} onValueChange={(v) => setFolder(v as Folder)}>
          <TabsList variant="line" className="gap-2">
            {FOLDER_TABS.map(({ key, label, icon: Icon }) => {
              const count = stats.counts[key] || 0;
              const showUnreadBadge = key === "INBOX" && stats.unreadInbox > 0;
              return (
                <TabsTrigger key={key} value={key} className="gap-2">
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                  {showUnreadBadge ? (
                    <Badge
                      variant="default"
                      className="h-5 px-1.5 text-[10px] tabular-nums"
                    >
                      {stats.unreadInbox}
                    </Badge>
                  ) : count > 0 ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Master-detail layout */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[380px] shrink-0 border-r overflow-y-auto">
          <EmailList
            emails={emails}
            loading={loading}
            folder={folder}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="flex-1 overflow-y-auto bg-muted/30">
          {selected ? (
            <EmailDetail
              email={selected}
              folder={folder}
              onUpdated={handleEmailUpdated}
              onRemoved={handleEmailRemoved}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {loading ? "Chargement..." : "Sélectionnez un email"}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
