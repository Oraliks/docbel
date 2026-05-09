"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface ComposeDialogProps {
  onSent?: () => void;
}

export function ComposeDialog({ onSent }: ComposeDialogProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTo("");
    setSubject("");
    setText("");
    setError(null);
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/inbox/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), text }),
      });
      if (response.ok) {
        reset();
        setOpen(false);
        onSent?.();
      } else {
        const err = await response.json().catch(() => ({}));
        setError(err.error || "Envoi échoué");
      }
    } catch (err) {
      console.error(err);
      setError("Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" className="gap-2 h-8">
            <PenSquare className="size-3.5" />
            Nouveau
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[600px]">
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
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              className="resize-y"
            />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim() || !text.trim()}
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
