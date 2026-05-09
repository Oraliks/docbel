"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import type { EmailFull, EmailListItem, Folder } from "./types";

interface EmailDetailProps {
  email: EmailListItem;
  folder: Folder;
  onUpdated: (email: EmailListItem) => void;
  onRemoved: (id: string) => void;
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function EmailDetail({ email: initial, folder, onUpdated, onRemoved }: EmailDetailProps) {
  const [email, setEmail] = useState<EmailFull | EmailListItem>(initial);
  const [loadingFull, setLoadingFull] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-fetch full body whenever the selected email changes
  useEffect(() => {
    setEmail(initial);
    setShowReply(false);
    setReplyText("");
    setFeedback(null);
    setReplySubject(
      initial.subject.toLowerCase().startsWith("re:") ? initial.subject : `Re: ${initial.subject}`
    );

    let cancelled = false;
    setLoadingFull(true);
    void fetch(`/api/inbox/${initial.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: EmailFull | null) => {
        if (cancelled || !data) return;
        setEmail(data);
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

  async function patchEmail(patch: { isRead?: boolean; moveTo?: Folder }) {
    setBusy(true);
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
        } else {
          setEmail((prev) => ({ ...prev, ...data }));
          onUpdated({ ...initial, ...data });
        }
      } else {
        const err = await response.json().catch(() => ({}));
        setFeedback({ kind: "error", text: err.error || "Action échouée" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteEmail() {
    const isAlreadyTrashed = folder === "TRASH";
    const confirmText = isAlreadyTrashed
      ? "Supprimer définitivement cet email ?"
      : "Mettre cet email à la corbeille ?";
    if (!confirm(confirmText)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/inbox/${email.id}`, { method: "DELETE" });
      if (response.ok) {
        onRemoved(email.id);
      } else {
        const err = await response.json().catch(() => ({}));
        setFeedback({ kind: "error", text: err.error || "Suppression échouée" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!replyText.trim() || !replySubject.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/inbox/${email.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: replySubject, text: replyText }),
      });
      if (response.ok) {
        setFeedback({ kind: "success", text: "Réponse envoyée" });
        setReplyText("");
        setShowReply(false);
        // mark replied locally
        onUpdated({ ...initial, isReplied: true, isRead: true });
      } else {
        const err = await response.json().catch(() => ({}));
        setFeedback({ kind: "error", text: err.error || "Envoi échoué" });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ kind: "error", text: "Erreur réseau" });
    } finally {
      setSending(false);
    }
  }

  const fullEmail = email as Partial<EmailFull>;
  const replyDest = fullEmail.replyToAddress || email.fromAddress;
  const replyDestName = fullEmail.replyToAddress ? fullEmail.replyToName : email.fromName;
  const canReply = folder !== "SENT";

  return (
    <div className="flex h-full flex-col">
      {/* Action bar */}
      <div className="flex items-center gap-1 border-b bg-background px-4 py-2">
        {canReply && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 h-8"
            onClick={() => setShowReply((v) => !v)}
          >
            <Reply className="size-3.5" />
            Répondre
          </Button>
        )}
        {(folder === "INBOX" || folder === "SPAM") && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 h-8"
            disabled={busy}
            onClick={() => patchEmail({ isRead: !email.isRead })}
          >
            {email.isRead ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {email.isRead ? "Marquer non lu" : "Marquer lu"}
          </Button>
        )}
        {folder !== "ARCHIVE" && folder !== "SENT" && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 h-8"
            disabled={busy}
            onClick={() => patchEmail({ moveTo: "ARCHIVE" })}
          >
            <Archive className="size-3.5" />
            Archiver
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
            Pas spam
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
            Spam
          </Button>
        )}
        <div className="ml-auto" />
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={busy}
          onClick={deleteEmail}
        >
          <Trash2 className="size-3.5" />
          {folder === "TRASH" ? "Supprimer" : "Corbeille"}
        </Button>
      </div>

      {/* Message body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold leading-tight tracking-tight">
              {email.subject || "(sans objet)"}
            </h2>
            {(initial.isReplied || folder === "SENT") && (
              <Badge variant="secondary" className="gap-1 shrink-0">
                <CornerUpLeft className="size-3" />
                {folder === "SENT" ? "Envoyé" : "Répondu"}
              </Badge>
            )}
          </div>

          <div className="mb-4 flex items-center justify-between gap-4 text-sm">
            <div>
              <div className="font-medium text-foreground">
                {email.fromName || email.fromAddress}
                {email.fromName && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    &lt;{email.fromAddress}&gt;
                  </span>
                )}
              </div>
              {fullEmail.replyToAddress && fullEmail.replyToAddress !== email.fromAddress && (
                <div className="text-xs text-muted-foreground">
                  Répondre à : {fullEmail.replyToAddress}
                </div>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDate(email.receivedAt)}
            </span>
          </div>

          {email.attachments.length > 0 && (
            <div className="mb-4 rounded-md border bg-background p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Paperclip className="size-3" />
                Pièces jointes ({email.attachments.length})
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
                Pour télécharger, ouvre l&apos;email sur OVH webmail.
              </p>
            </div>
          )}

          <Separator className="mb-4" />

          {loadingFull && !fullEmail.htmlBody ? (
            <div className="text-sm text-muted-foreground">Chargement du contenu...</div>
          ) : fullEmail.htmlBody ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-background p-4"
              dangerouslySetInnerHTML={{ __html: fullEmail.htmlBody }}
            />
          ) : (
            <div className="rounded-md border bg-background p-4 whitespace-pre-wrap text-sm">
              {email.textBody || "(message vide)"}
            </div>
          )}

          {feedback && (
            <div
              className={`mt-4 rounded-md border px-3 py-2 text-sm ${
                feedback.kind === "success"
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Inline reply form */}
          {showReply && canReply && (
            <div className="mt-6 rounded-md border bg-background p-4">
              <div className="mb-3 text-xs font-medium text-muted-foreground">
                Répondre depuis contact@docbel.be → {replyDestName ? `${replyDestName} ` : ""}
                &lt;{replyDest}&gt;
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Sujet</label>
                  <Input
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Message</label>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Écrivez votre réponse..."
                    rows={8}
                    className="resize-y"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={sendReply}
                    disabled={sending || !replyText.trim() || !replySubject.trim()}
                    className="gap-1.5"
                  >
                    <Send className="size-3.5" />
                    {sending ? "Envoi..." : "Envoyer"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowReply(false);
                      setReplyText("");
                    }}
                    disabled={sending}
                  >
                    Annuler
                  </Button>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {replyText.length} caractères
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
