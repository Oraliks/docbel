"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PenSquare, Send } from "lucide-react";
import { EmailEditor } from "./email-editor";
import { buildComposeInitialHtml, htmlToPlain, isEditorEmpty } from "./email-html";

const COMPOSE_DRAFT_KEY = "messagerie-compose-draft";

interface ComposeDialogProps {
  onSent?: () => void;
}

export function ComposeDialog({ onSent }: ComposeDialogProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void (async () => {
      // Try to restore from draft first
      let restored = false;
      try {
        const stored = localStorage.getItem(COMPOSE_DRAFT_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.html) {
            if (cancelled) return;
            setTo(parsed.to || "");
            setSubject(parsed.subject || "");
            setHtml(parsed.html);
            restored = true;
          }
        }
      } catch {
        /* ignore */
      }

      if (!restored) {
        try {
          const r = await fetch("/api/inbox/settings");
          if (!cancelled && r.ok) {
            const data = await r.json();
            setHtml(buildComposeInitialHtml(data.signature || ""));
          }
        } catch {
          setHtml(buildComposeInitialHtml(""));
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Auto-save draft
  useEffect(() => {
    if (!open || !hydrated) return;
    const t = window.setTimeout(() => {
      try {
        if (to.trim() || subject.trim() || !isEditorEmpty(html)) {
          localStorage.setItem(
            COMPOSE_DRAFT_KEY,
            JSON.stringify({ to, subject, html })
          );
        }
      } catch {
        /* ignore quota */
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [to, subject, html, open, hydrated]);

  function reset() {
    setTo("");
    setSubject("");
    setHtml("");
    setHydrated(false);
    try {
      localStorage.removeItem(COMPOSE_DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || isEditorEmpty(html)) return;
    setSending(true);
    try {
      const text = htmlToPlain(html);
      const response = await fetch("/api/inbox/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), text, html }),
      });
      if (response.ok) {
        toast.success("Email envoyé", { description: `À ${to.trim()}` });
        reset();
        setOpen(false);
        onSent?.();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || "Envoi échoué");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setHydrated(false);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" className="gap-2 h-8">
            <PenSquare className="size-3.5" />
            <span className="hidden sm:inline">Nouveau</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau message</DialogTitle>
          <DialogDescription>Envoyé depuis contact@docbel.be</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">À</label>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="destinataire@exemple.be"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Sujet</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sujet du message"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Message</label>
            <EmailEditor value={html} onChange={setHtml} />
          </div>
          {(to.trim() || subject.trim() || !isEditorEmpty(html)) && (
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 dark:text-green-500">·</span> Brouillon sauvegardé localement
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={sending}
          >
            Effacer
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Fermer
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim() || isEditorEmpty(html)}
            className="gap-1.5"
          >
            <Send className="size-3.5" />
            {sending ? "Envoi..." : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
