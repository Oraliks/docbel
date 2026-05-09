"use client";

import React from "react";
import { Paperclip, CornerUpLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailListItem, Folder } from "./types";

interface EmailListProps {
  emails: EmailListItem[];
  loading: boolean;
  folder: Folder;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function previewText(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 120);
}

const EMPTY_LABEL: Record<Folder, string> = {
  INBOX: "Aucun email reçu",
  SENT: "Aucun email envoyé",
  SPAM: "Aucun spam",
  ARCHIVE: "Aucun email archivé",
  TRASH: "Corbeille vide",
};

export function EmailList({ emails, loading, folder, selectedId, onSelect }: EmailListProps) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-md bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        {EMPTY_LABEL[folder]}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {emails.map((email) => {
        const isSelected = email.id === selectedId;
        const displayName =
          folder === "SENT"
            ? safeFirstAddress(email.toAddresses) || email.toAddresses
            : email.fromName || email.fromAddress;
        const isUnread = !email.isRead && (folder === "INBOX" || folder === "SPAM");
        return (
          <li key={email.id}>
            <button
              type="button"
              onClick={() => onSelect(email.id)}
              className={cn(
                "block w-full text-left px-4 py-3 transition-colors hover:bg-muted/60 focus:outline-none focus-visible:bg-muted",
                isSelected && "bg-primary/10 hover:bg-primary/15"
              )}
            >
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <span
                  className={cn(
                    "text-sm truncate",
                    isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                  )}
                >
                  {isUnread && (
                    <span className="inline-block size-1.5 mr-2 -translate-y-0.5 rounded-full bg-primary" />
                  )}
                  {displayName}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {formatRelativeDate(email.receivedAt)}
                </span>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 text-sm truncate",
                  isUnread ? "text-foreground" : "text-foreground/80"
                )}
              >
                {email.isReplied && (
                  <CornerUpLeft className="size-3 shrink-0 text-green-600 dark:text-green-500" />
                )}
                <span className="truncate">{email.subject || "(sans objet)"}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {email.attachments.length > 0 && (
                  <Paperclip className="size-3 shrink-0" />
                )}
                <span className="truncate">{previewText(email.textBody)}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function safeFirstAddress(jsonString: string): string | null {
  try {
    const arr = JSON.parse(jsonString);
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") return arr[0];
  } catch {
    /* ignore */
  }
  return null;
}
