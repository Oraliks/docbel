"use client";

import React from "react";
import { Paperclip, CornerUpLeft, Star, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { getAvatarFor } from "@/lib/inbox/avatar";
import type { EmailListItem, Folder } from "./types";

interface EmailListProps {
  emails: EmailListItem[];
  loading: boolean;
  folder: Folder;
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleSelected: (id: string) => void;
  onToggleStar: (id: string, next: boolean) => void;
  searchQuery?: string;
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

function safeFirstAddress(jsonString: string): string | null {
  try {
    const arr = JSON.parse(jsonString);
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") return arr[0];
  } catch {
    /* ignore */
  }
  return null;
}

export function EmailList({
  emails,
  loading,
  folder,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelected,
  onToggleStar,
  searchQuery,
}: EmailListProps) {
  if (loading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2.5 p-2">
            <div className="size-8 rounded-full bg-muted/60 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-1/3 rounded bg-muted/60 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-muted/60 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        {searchQuery ? `Aucun résultat pour "${searchQuery}"` : EMPTY_LABEL[folder]}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {emails.map((email) => {
        const isSelected = email.id === selectedId;
        const isChecked = selectedIds.has(email.id);
        const displayName =
          folder === "SENT"
            ? safeFirstAddress(email.toAddresses) || email.toAddresses
            : email.fromName || email.fromAddress;
        const isUnread = !email.isRead && (folder === "INBOX" || folder === "SPAM");
        const avatar = getAvatarFor(
          folder === "SENT" ? null : email.fromName,
          folder === "SENT" ? safeFirstAddress(email.toAddresses) || email.fromAddress : email.fromAddress
        );

        return (
          <li key={email.id}>
            <div
              className={cn(
                "group/item relative flex items-start gap-2 px-3 py-2.5 transition-colors hover:bg-muted/60",
                isSelected && "bg-primary/10 hover:bg-primary/15",
                isChecked && "bg-primary/5"
              )}
            >
              {/* Checkbox - only visible on hover or when selected */}
              <div
                className={cn(
                  "shrink-0 transition-opacity",
                  isChecked ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleSelected(email.id)}
                  aria-label="Sélectionner"
                  className="mt-1"
                />
              </div>

              {/* Avatar — hidden when checkbox is checked or hovered */}
              <button
                type="button"
                onClick={() => onSelect(email.id)}
                className={cn(
                  "shrink-0 transition-opacity",
                  (isChecked) && "hidden",
                  "group-hover/item:hidden"
                )}
                aria-label="Ouvrir l'email"
              >
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-xs font-semibold",
                    avatar.bg,
                    avatar.fg
                  )}
                >
                  {avatar.initials}
                </div>
              </button>

              {/* Content */}
              <button
                type="button"
                onClick={() => onSelect(email.id)}
                className="min-w-0 flex-1 text-left"
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
                  {email.threadSize && email.threadSize > 1 && (
                    <span className="inline-flex items-center gap-0.5 shrink-0 rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                      <MessagesSquare className="size-2.5" />
                      {email.threadSize}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {email.attachments.length > 0 && (
                    <Paperclip className="size-3 shrink-0" />
                  )}
                  <span className="truncate">{previewText(email.textBody)}</span>
                </div>
              </button>

              {/* Star button — always visible */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(email.id, !email.isFlagged);
                }}
                className={cn(
                  "shrink-0 self-start mt-0.5 rounded p-0.5 transition-colors hover:bg-muted",
                  email.isFlagged
                    ? "text-amber-500"
                    : "text-muted-foreground/40 hover:text-amber-500"
                )}
                aria-label={email.isFlagged ? "Retirer le suivi" : "Suivre"}
              >
                <Star className={cn("size-3.5", email.isFlagged && "fill-current")} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
