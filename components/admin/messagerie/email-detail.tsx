"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Archive,
  Trash2,
  Send,
  Paperclip,
  Reply,
  Eye,
  EyeOff,
  AlertOctagon,
  Inbox,
  CornerUpLeft,
  ChevronDown,
  ChevronUp,
  Star,
  Forward as ForwardIcon,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeEmailHtml, unblockImages } from "@/lib/inbox/sanitize";
import { getAvatarFor } from "@/lib/inbox/avatar";
import { ForwardDialog } from "./forward-dialog";
import { EmailEditor } from "./email-editor";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import {
  buildReplyInitialHtml,
  htmlToPlain,
  isEditorEmpty,
  plainToHtml,
} from "./email-html";
import type { EmailFull, EmailListItem, Folder, ThreadEmail } from "./types";

interface EmailDetailProps {
  email: EmailListItem;
  folder: Folder;
  onUpdated: (email: EmailListItem) => void;
  onRemoved: (id: string) => void;
  onToggleStar: (id: string, next: boolean) => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function draftKey(emailId: string): string {
  return `messagerie-draft-${emailId}`;
}

export function EmailDetail({ email: initial, folder, onUpdated, onRemoved, onToggleStar }: EmailDetailProps) {
  const t = useTranslations("admin.messagerie");
  const [email, setEmail] = useState<EmailFull | EmailListItem>(initial);
  const [thread, setThread] = useState<ThreadEmail[]>([]);
  const [loadingFull, setLoadingFull] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  // Reply body is HTML (from rich text editor)
  const [replyHtml, setReplyHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(new Set());
  const [showImages, setShowImages] = useState(false);
  const [signature, setSignature] = useState("");
  const confirm = useConfirm();

  // Fetch signature once
  useEffect(() => {
    void fetch("/api/inbox/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.signature) setSignature(data.signature);
      });
  }, []);

  // Re-fetch full body whenever the selected email changes
  useEffect(() => {
    setEmail(initial);
    setShowReply(false);
    setShowForward(false);
    setShowImages(false);
    setExpandedThreadIds(new Set());
    const defaultSubject = initial.subject.toLowerCase().startsWith("re:")
      ? initial.subject
      : `Re: ${initial.subject}`;
    setReplySubject(defaultSubject);

    // Restore draft if any
    try {
      const stored = localStorage.getItem(draftKey(initial.id));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.html === "string") {
          setReplyHtml(parsed.html);
          if (typeof parsed.subject === "string") setReplySubject(parsed.subject);
          if (!isEditorEmpty(parsed.html)) setShowReply(true);
        } else {
          setReplyHtml("");
        }
      } else {
        setReplyHtml("");
      }
    } catch {
      setReplyHtml("");
    }

    let cancelled = false;
    setLoadingFull(true);
    void fetch(`/api/inbox/${initial.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: EmailFull | null) => {
        if (cancelled || !data) return;
        setEmail(data);
        setThread(data.thread || []);
        if (!initial.isRead && data.isRead) {
          onUpdated({ ...initial, isRead: true });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFull(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initial, onUpdated]);

  // Auto-save draft
  useEffect(() => {
    if (!showReply) return;
    const t = window.setTimeout(() => {
      try {
        if (!isEditorEmpty(replyHtml) || replySubject.trim()) {
          localStorage.setItem(
            draftKey(email.id),
            JSON.stringify({ subject: replySubject, html: replyHtml })
          );
        }
      } catch {
        /* ignore quota errors */
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [replyHtml, replySubject, email.id, showReply]);

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey(email.id));
    } catch {
      /* ignore */
    }
  }

  async function patchEmail(patch: { isRead?: boolean; moveTo?: Folder }) {
    setBusy(true);
    const description =
      patch.moveTo === "ARCHIVE"
        ? t("statusArchived")
        : patch.moveTo === "INBOX"
        ? t("statusMovedToInbox")
        : patch.moveTo === "SPAM"
        ? t("statusMarkedSpam")
        : patch.isRead === true
        ? t("statusMarkedRead")
        : patch.isRead === false
        ? t("statusMarkedUnread")
        : t("statusUpdated");
    try {
      const response = await fetch(`/api/inbox/${email.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.moved) {
          onRemoved(email.id);
          toast.success(description);
        } else {
          setEmail((prev) => ({ ...prev, ...data }));
          onUpdated({ ...initial, ...data });
          toast.success(description);
        }
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || t("actionFailed"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteEmail() {
    const isAlreadyTrashed = folder === "TRASH";
    const ok = await confirm({
      title: isAlreadyTrashed ? t("deletePermanentlyTitle") : t("moveToTrashTitle"),
      description: isAlreadyTrashed ? t("deletePermanentlyDescription") : t("moveToTrashDescription"),
      confirmText: isAlreadyTrashed ? t("deletePermanently") : t("moveToTrash"),
      destructive: true,
      requireText: isAlreadyTrashed ? t("deleteRequireText") : undefined,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/inbox/${email.id}`, { method: "DELETE" });
      if (response.ok) {
        onRemoved(email.id);
        toast.success(isAlreadyTrashed ? t("emailDeletedPermanently") : t("emailMovedToTrash"));
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || t("deleteFailed"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("networkError"));
    } finally {
      setBusy(false);
    }
  }

  function openReply(withQuote: boolean) {
    setShowReply(true);
    setReplyHtml((prev) => {
      if (!isEditorEmpty(prev)) return prev;
      return buildReplyInitialHtml(email, signature, withQuote);
    });
  }

  async function sendReply() {
    if (isEditorEmpty(replyHtml) || !replySubject.trim()) return;
    setSending(true);
    try {
      const text = htmlToPlain(replyHtml);
      const response = await fetch(`/api/inbox/${email.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: replySubject, text, html: replyHtml }),
      });
      if (response.ok) {
        toast.success(t("replySent"), {
          description: t("toRecipient", { recipient: replyDestName || replyDest }),
        });
        clearDraft();
        setReplyHtml("");
        setShowReply(false);
        onUpdated({ ...initial, isReplied: true, isRead: true });
        // Re-fetch to pull the reply we just sent into the thread
        void fetch(`/api/inbox/${email.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data: EmailFull | null) => {
            if (data) {
              setEmail(data);
              setThread(data.thread || []);
            }
          });
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || t("sendFailed"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("networkError"));
    } finally {
      setSending(false);
    }
  }

  const fullEmail = email as Partial<EmailFull>;
  const replyDest = fullEmail.replyToAddress || email.fromAddress;
  const replyDestName = fullEmail.replyToAddress ? fullEmail.replyToName : email.fromName;
  const canReply = folder !== "SENT";
  const conversationOthers = thread.filter((t) => t.id !== email.id);
  const avatar = getAvatarFor(email.fromName, email.fromAddress);

  // Sanitize the HTML body — block remote images by default unless user opts in
  const sanitized = useMemo(() => {
    if (!fullEmail.htmlBody) return null;
    const result = sanitizeEmailHtml(fullEmail.htmlBody, !showImages);
    if (showImages) {
      return { ...result, html: unblockImages(result.html) };
    }
    return result;
  }, [fullEmail.htmlBody, showImages]);

  function toggleThreadExpansion(id: string) {
    setExpandedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Local keyboard shortcuts
  useKeyboardShortcuts({
    onReply: () => canReply && openReply(true),
    onForward: () => setShowForward(true),
    onArchive:
      folder !== "ARCHIVE" && folder !== "SENT"
        ? () => void patchEmail({ moveTo: "ARCHIVE" })
        : undefined,
    onDelete: () => void deleteEmail(),
    onToggleStar: () => onToggleStar(email.id, !email.isFlagged),
    onMarkUnread:
      folder === "INBOX" || folder === "SPAM"
        ? () => void patchEmail({ isRead: false })
        : undefined,
  });

  return (
    <div className="flex h-full flex-col">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-1 border-b bg-background px-3 py-1.5 md:px-4 md:py-2">
        {canReply && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 h-8"
            onClick={() => openReply(true)}
            title={t("replyTitle")}
          >
            <Reply className="size-3.5" />
            <span className="hidden sm:inline">{t("reply")}</span>
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 h-8"
          onClick={() => setShowForward(true)}
          title={t("forwardTitle")}
        >
          <ForwardIcon className="size-3.5" />
          <span className="hidden sm:inline">{t("forward")}</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={cn("gap-1.5 h-8", email.isFlagged && "text-amber-500")}
          onClick={() => onToggleStar(email.id, !email.isFlagged)}
          title={t("starTitle")}
        >
          <Star className={cn("size-3.5", email.isFlagged && "fill-current")} />
          <span className="hidden sm:inline">{email.isFlagged ? t("starred") : t("star")}</span>
        </Button>
        {(folder === "INBOX" || folder === "SPAM") && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 h-8"
            disabled={busy}
            onClick={() => patchEmail({ isRead: !email.isRead })}
            title={t("markUnreadTitle")}
          >
            {email.isRead ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            <span className="hidden md:inline">{email.isRead ? t("markUnread") : t("markRead")}</span>
          </Button>
        )}
        {folder !== "ARCHIVE" && folder !== "SENT" && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 h-8"
            disabled={busy}
            onClick={() => patchEmail({ moveTo: "ARCHIVE" })}
            title={t("archiveTitle")}
          >
            <Archive className="size-3.5" />
            <span className="hidden md:inline">{t("archive")}</span>
          </Button>
        )}
        {folder === "SPAM" && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 h-8"
            disabled={busy}
            onClick={() => patchEmail({ moveTo: "INBOX" })}
          >
            <Inbox className="size-3.5" />
            <span className="hidden md:inline">{t("notSpam")}</span>
          </Button>
        )}
        {folder !== "SPAM" && folder !== "TRASH" && folder !== "SENT" && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 h-8"
            disabled={busy}
            onClick={() => patchEmail({ moveTo: "SPAM" })}
          >
            <AlertOctagon className="size-3.5" />
            <span className="hidden md:inline">{t("spam")}</span>
          </Button>
        )}
        <div className="ml-auto" />
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={busy}
          onClick={deleteEmail}
          title={t("deleteTitle")}
        >
          <Trash2 className="size-3.5" />
          <span className="hidden md:inline">{folder === "TRASH" ? t("delete") : t("trash")}</span>
        </Button>
      </div>

      {/* Message body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold leading-tight tracking-tight md:text-xl">
              {email.subject || t("noSubject")}
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              {(initial.isReplied || folder === "SENT") && (
                <Badge variant="secondary" className="gap-1">
                  <CornerUpLeft className="size-3" />
                  {folder === "SENT" ? t("statusSent") : t("statusReplied")}
                </Badge>
              )}
            </div>
          </div>

          {/* Thread (other messages in this conversation) */}
          {conversationOthers.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                {t("conversationCount", { count: thread.length })}
              </div>
              {conversationOthers.map((m) => {
                const isExpanded = expandedThreadIds.has(m.id);
                const isSent = m.folder === "SENT";
                const tAvatar = getAvatarFor(m.fromName, m.fromAddress);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-md border bg-background overflow-hidden",
                      isSent && "border-l-2 border-l-primary/40"
                    )}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40 transition-colors"
                      onClick={() => toggleThreadExpansion(m.id)}
                    >
                      <div
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                          tAvatar.bg,
                          tAvatar.fg
                        )}
                      >
                        {tAvatar.initials}
                      </div>
                      <Badge variant="outline" className="shrink-0 h-5 px-1.5 text-[10px]">
                        {t(`folderSingular_${m.folder}` as Parameters<typeof t>[0])}
                      </Badge>
                      <span className="font-medium truncate">
                        {m.fromName || m.fromAddress}
                      </span>
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {m.textBody.replace(/\s+/g, " ").trim().slice(0, 80)}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {formatShortDate(m.receivedAt)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="border-t bg-muted/20 px-4 py-3 text-sm">
                        {m.htmlBody ? (
                          <div
                            className="prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeEmailHtml(m.htmlBody, true).html,
                            }}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap">{m.textBody || t("emptyMessage")}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-4 flex items-start gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                avatar.bg,
                avatar.fg
              )}
            >
              {avatar.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-sm font-medium text-foreground truncate">
                  {email.fromName || email.fromAddress}
                  {email.fromName && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      &lt;{email.fromAddress}&gt;
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(email.receivedAt)}
                </span>
              </div>
              {fullEmail.replyToAddress && fullEmail.replyToAddress !== email.fromAddress && (
                <div className="text-xs text-muted-foreground">
                  {t("replyTo", { address: fullEmail.replyToAddress })}
                </div>
              )}
            </div>
          </div>

          {email.attachments.length > 0 && (
            <div className="mb-4 rounded-md border bg-background p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Paperclip className="size-3" />
                {t("attachments", { count: email.attachments.length })}
              </div>
              <ul className="space-y-1 text-sm">
                {email.attachments.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{a.filename}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground italic">
                {t("attachmentsDownloadNote")}
              </p>
            </div>
          )}

          {/* Blocked images banner */}
          {sanitized && sanitized.blockedImageCount > 0 && !showImages && (
            <div className="mb-4 flex items-center gap-3 rounded-md border bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/20">
              <ImageIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="flex-1 text-amber-900 dark:text-amber-200">
                {t("blockedImages", { count: sanitized.blockedImageCount })}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0"
                onClick={() => setShowImages(true)}
              >
                {t("showImages")}
              </Button>
            </div>
          )}

          <Separator className="mb-4" />

          {loadingFull && !fullEmail.htmlBody ? (
            <div className="text-sm text-muted-foreground">{t("loadingContent")}</div>
          ) : sanitized ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-background p-4"
              dangerouslySetInnerHTML={{ __html: sanitized.html }}
            />
          ) : (
            <div className="rounded-md border bg-background p-4 whitespace-pre-wrap text-sm">
              {email.textBody || t("emptyMessage")}
            </div>
          )}

          {/* Inline reply form */}
          {showReply && canReply && (
            <div className="mt-6 rounded-md border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">
                  contact@docbel.be → {replyDestName ? `${replyDestName} ` : ""}
                  &lt;{replyDest}&gt;
                </div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => {
                    setReplyHtml(
                      (prev) =>
                        prev +
                        `<p>Le ${new Date(email.receivedAt).toLocaleString(
                          "fr-FR"
                        )}, ${email.fromName || email.fromAddress} a écrit&nbsp;:</p><blockquote>${
                          (email as EmailFull).htmlBody?.trim()
                            ? (email as EmailFull).htmlBody
                            : plainToHtml(email.textBody || "")
                        }</blockquote>`
                    );
                  }}
                >
                  {t("quoteMessage")}
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">{t("subjectLabel")}</label>
                  <Input
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">{t("messageLabel")}</label>
                  <EmailEditor
                    value={replyHtml}
                    onChange={setReplyHtml}
                    placeholder={t("replyPlaceholder")}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={sendReply}
                    disabled={sending || isEditorEmpty(replyHtml) || !replySubject.trim()}
                    className="gap-1.5"
                  >
                    <Send className="size-3.5" />
                    {sending ? t("sending") : t("send")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowReply(false);
                      setReplyHtml("");
                      clearDraft();
                    }}
                    disabled={sending}
                  >
                    {t("cancel")}
                  </Button>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {!isEditorEmpty(replyHtml) && (
                      <span className="text-green-600 dark:text-green-500">{t("draftSaved")}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ForwardDialog
        open={showForward}
        onOpenChange={setShowForward}
        email={email}
        signature={signature}
      />
    </div>
  );
}
