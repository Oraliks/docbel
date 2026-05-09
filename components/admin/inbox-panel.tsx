"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InboxDetailView } from "./inbox-detail";
import { Archive, Trash2, Mail, ChevronRight, RefreshCw, CheckCircle, Circle, Reply, Paperclip } from "lucide-react";

export interface InboxEmail {
  id: string;
  fromAddress: string;
  fromName: string | null;
  subject: string;
  textBody: string;
  htmlBody?: string | null;
  isRead: boolean;
  isArchived: boolean;
  isReplied: boolean;
  receivedAt: string;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
  messageId?: string | null;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)}j`;
  return date.toLocaleDateString("fr-FR");
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

export function InboxPanel() {
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [selected, setSelected] = useState<InboxEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "REPLIED">("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    try {
      const response = await fetch("/api/inbox");
      if (response.ok) {
        const data = await response.json();
        setEmails(data);
      }
    } catch (err) {
      console.error("Failed to fetch inbox:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncInbox = useCallback(
    async (silent = false) => {
      setSyncing(true);
      if (!silent) setSyncMessage(null);
      try {
        const response = await fetch("/api/inbox/sync", { method: "POST" });
        if (response.ok) {
          const result = await response.json();
          if (!silent) {
            setSyncMessage(
              `${result.imported} nouveau(x), ${result.skipped} déjà importé(s)${
                result.errors > 0 ? `, ${result.errors} erreur(s)` : ""
              }`
            );
          }
          await fetchEmails();
        } else {
          const err = await response.json().catch(() => ({}));
          setSyncMessage(`Erreur de synchro : ${err.error || response.statusText}`);
        }
      } catch (err) {
        console.error("Sync failed:", err);
        setSyncMessage("Erreur de synchro");
      } finally {
        setSyncing(false);
      }
    },
    [fetchEmails]
  );

  useEffect(() => {
    async function init() {
      await fetchEmails();
      // Sync on mount (silent — no toast unless something fails)
      await syncInbox(true);
    }
    void init();
  }, [fetchEmails, syncInbox]);

  async function updateEmail(id: string, patch: { isRead?: boolean; isArchived?: boolean }) {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/inbox/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        const updated = await response.json();
        if (updated.isArchived) {
          setEmails((prev) => prev.filter((e) => e.id !== id));
        } else {
          setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
        }
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteEmail(id: string) {
    if (!confirm("Supprimer définitivement cet email ?")) return;
    setActionLoading(id);
    try {
      const response = await fetch(`/api/inbox/${id}`, { method: "DELETE" });
      if (response.ok) {
        setEmails((prev) => prev.filter((e) => e.id !== id));
      }
    } finally {
      setActionLoading(null);
    }
  }

  function handleEmailUpdated(updated: InboxEmail) {
    setEmails((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setSelected(updated);
  }

  const filtered = emails.filter((e) => {
    if (filter === "UNREAD") return !e.isRead;
    if (filter === "REPLIED") return e.isReplied;
    return true;
  });

  const stats = {
    total: emails.length,
    unread: emails.filter((e) => !e.isRead).length,
    replied: emails.filter((e) => e.isReplied).length,
  };

  if (selected) {
    return (
      <InboxDetailView
        email={selected}
        onBack={() => setSelected(null)}
        onUpdated={handleEmailUpdated}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats + sync button */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Non lus</p>
              <p className="text-3xl font-bold">{stats.unread}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Répondus</p>
              <p className="text-3xl font-bold">{stats.replied}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-muted/50 border-border">
          <CardContent className="pt-6 flex flex-col items-center gap-2">
            <Button
              onClick={() => syncInbox(false)}
              disabled={syncing}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Synchronisation..." : "Synchroniser"}
            </Button>
            {syncMessage && (
              <p className="text-xs text-muted-foreground text-center">{syncMessage}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "ALL", label: "Tous" },
          { key: "UNREAD", label: "Non lus" },
          { key: "REPLIED", label: "Répondus" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as "ALL" | "UNREAD" | "REPLIED")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Email list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail size={20} />
            Emails ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {filter === "ALL"
                ? "Aucun email — clique sur Synchroniser pour aller chercher les nouveaux"
                : "Aucun email avec ce filtre"}
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">De</TableHead>
                    <TableHead className="font-semibold">Sujet</TableHead>
                    <TableHead className="font-semibold">Statut</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((email) => (
                    <TableRow
                      key={email.id}
                      className={`hover:bg-muted/50 transition-colors ${
                        !email.isRead ? "font-medium" : ""
                      }`}
                    >
                      <TableCell>
                        <div className="cursor-pointer" onClick={() => setSelected(email)}>
                          <div className="hover:text-primary">
                            {email.fromName || email.fromAddress}
                          </div>
                          {email.fromName && (
                            <div className="text-sm text-muted-foreground font-normal">
                              {email.fromAddress}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div
                          className="max-w-md cursor-pointer hover:text-primary hover:underline flex items-center gap-1"
                          onClick={() => setSelected(email)}
                        >
                          <span className="truncate">
                            {truncate(email.subject || "(sans objet)", 80)}
                          </span>
                          {email.attachments.length > 0 && (
                            <Paperclip size={14} className="text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!email.isRead && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                              Nouveau
                            </Badge>
                          )}
                          {email.isReplied && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                              Répondu
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-normal">
                        {formatDate(email.receivedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            onClick={() => setSelected(email)}
                            variant="ghost"
                            size="sm"
                            title={email.isReplied ? "Voir / Renvoyer" : "Voir / Répondre"}
                            className="h-8 w-8 p-0"
                          >
                            {email.isReplied ? <ChevronRight size={16} /> : <Reply size={16} />}
                          </Button>
                          <Button
                            onClick={() =>
                              updateEmail(email.id, { isRead: !email.isRead })
                            }
                            disabled={actionLoading === email.id}
                            variant="ghost"
                            size="sm"
                            title={email.isRead ? "Marquer comme non lu" : "Marquer comme lu"}
                            className="h-8 w-8 p-0"
                          >
                            {email.isRead ? (
                              <Circle size={16} className="text-blue-600" />
                            ) : (
                              <CheckCircle size={16} className="text-green-600" />
                            )}
                          </Button>
                          <Button
                            onClick={() => updateEmail(email.id, { isArchived: true })}
                            disabled={actionLoading === email.id}
                            variant="ghost"
                            size="sm"
                            title="Archiver"
                            className="h-8 w-8 p-0"
                          >
                            <Archive size={16} />
                          </Button>
                          <Button
                            onClick={() => deleteEmail(email.id)}
                            disabled={actionLoading === email.id}
                            variant="ghost"
                            size="sm"
                            title="Supprimer"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
