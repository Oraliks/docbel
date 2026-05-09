"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Archive, Trash2, Send, Paperclip } from "lucide-react";
import type { InboxEmail } from "./inbox-panel";

interface InboxDetailViewProps {
  email: InboxEmail;
  onBack: () => void;
  onUpdated: (email: InboxEmail) => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function InboxDetailView({ email: initial, onBack, onUpdated }: InboxDetailViewProps) {
  const [email, setEmail] = useState(initial);
  const [fullEmail, setFullEmail] = useState<InboxEmail | null>(null);
  const [replySubject, setReplySubject] = useState(
    initial.subject.toLowerCase().startsWith("re:") ? initial.subject : `Re: ${initial.subject}`
  );
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch full body (with htmlBody) on mount
  useEffect(() => {
    async function fetchFull() {
      const response = await fetch(`/api/inbox/${initial.id}`);
      if (response.ok) {
        const data = await response.json();
        setFullEmail(data);
        setEmail(data);
        if (!initial.isRead) onUpdated(data);
      }
    }
    void fetchFull();
  }, [initial.id, initial.isRead, onUpdated]);

  async function handleArchive() {
    setBusy(true);
    try {
      const response = await fetch(`/api/inbox/${email.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      if (response.ok) onBack();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer définitivement cet email ? Cette action est irréversible.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/inbox/${email.id}`, { method: "DELETE" });
      if (response.ok) onBack();
    } finally {
      setBusy(false);
    }
  }

  async function handleSendReply() {
    if (!replyText.trim()) return;
    setSending(true);
    setSendMessage(null);
    try {
      const response = await fetch(`/api/inbox/${email.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: replySubject, text: replyText }),
      });
      if (response.ok) {
        const updated = await response.json();
        setEmail(updated);
        onUpdated(updated);
        setReplyText("");
        setSendMessage("Réponse envoyée ✓");
      } else {
        const err = await response.json().catch(() => ({}));
        setSendMessage(`Erreur : ${err.error || response.statusText}`);
      }
    } catch (err) {
      console.error("Send failed:", err);
      setSendMessage("Erreur d'envoi");
    } finally {
      setSending(false);
    }
  }

  const body = fullEmail || email;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/70 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
          <div>
            <h2 className="text-2xl font-bold">{body.subject || "(sans objet)"}</h2>
            <p className="text-sm text-muted-foreground">
              {body.fromName ? `${body.fromName} · ` : ""}
              {body.fromAddress}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {body.isReplied && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
              Répondu
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleArchive} disabled={busy} variant="outline" size="sm" className="gap-2">
          <Archive size={16} />
          Archiver
        </Button>
        <Button
          onClick={handleDelete}
          disabled={busy}
          variant="destructive"
          size="sm"
          className="gap-2 ml-auto"
        >
          <Trash2 size={16} />
          Supprimer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail size={20} />
            Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">De</label>
              <p className="font-semibold">{body.fromName || body.fromAddress}</p>
              {body.fromName && <p className="text-sm text-muted-foreground">{body.fromAddress}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Reçu</label>
              <p className="text-sm">{formatDate(body.receivedAt)}</p>
            </div>
          </div>

          {body.attachments && body.attachments.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2 flex items-center gap-1">
                <Paperclip size={14} />
                Pièces jointes ({body.attachments.length})
              </label>
              <ul className="text-sm space-y-1">
                {body.attachments.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{a.filename}</span>
                    <span>·</span>
                    <span>{formatBytes(a.size)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-2 italic">
                Pour télécharger les pièces jointes, utilise OVH webmail.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Contenu</label>
            {body.htmlBody ? (
              <div
                className="bg-muted/50 p-4 rounded-lg text-sm border border-border prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: body.htmlBody }}
              />
            ) : (
              <div className="bg-muted/50 p-4 rounded-lg whitespace-pre-wrap text-sm border border-border">
                {body.textBody || "(message vide)"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Répondre depuis contact@docbel.be</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">À</label>
            <input
              type="text"
              value={body.fromName ? `${body.fromName} <${body.fromAddress}>` : body.fromAddress}
              disabled
              className="w-full px-4 py-2 border border-input bg-muted/30 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Sujet</label>
            <input
              type="text"
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
              className="w-full px-4 py-2 border border-input bg-background rounded-lg text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Message</label>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Écrivez votre réponse ici..."
              className="w-full px-4 py-3 border border-input bg-background rounded-lg text-sm focus:ring-2 focus:ring-ring focus:border-transparent resize-vertical"
              rows={8}
            />
            <p className="text-xs text-muted-foreground mt-2">{replyText.length} caractères</p>
          </div>
          {sendMessage && (
            <p
              className={`text-sm ${
                sendMessage.startsWith("Erreur") ? "text-red-600" : "text-green-600"
              }`}
            >
              {sendMessage}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleSendReply}
              disabled={sending || !replyText.trim() || !replySubject.trim()}
              className="gap-2"
            >
              <Send size={16} />
              {sending ? "Envoi..." : "Envoyer"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
