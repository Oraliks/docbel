"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send } from "lucide-react";
import { EmailEditor } from "./email-editor";
import { buildForwardInitialHtml, htmlToPlain, isEditorEmpty } from "./email-html";
import type { EmailFull, EmailListItem } from "./types";

interface ForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: EmailListItem | EmailFull;
  signature?: string;
}

export function ForwardDialog({ open, onOpenChange, email, signature = "" }: ForwardDialogProps) {
  const t = useTranslations("admin.messagerie");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTo("");
      const prefix = email.subject.toLowerCase().startsWith("fwd:") ? email.subject : `Fwd: ${email.subject}`;
      setSubject(prefix);
      setHtml(buildForwardInitialHtml(email, signature));
    }
  }, [open, email, signature]);

  async function handleSend() {
    if (!to.trim() || !subject.trim() || isEditorEmpty(html)) return;
    setSending(true);
    try {
      const text = htmlToPlain(html);
      const response = await fetch(`/api/inbox/${email.id}/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), text, html }),
      });
      if (response.ok) {
        toast.success(t("emailForwarded"), { description: t("toRecipient", { recipient: to.trim() }) });
        onOpenChange(false);
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || t("forwardFailed"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("networkError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("forward")}</DialogTitle>
          <DialogDescription>{t("fromAccount")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t("toLabel")}</label>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={t("recipientPlaceholder")}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t("subjectLabel")}</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t("messageLabel")}</label>
            <EmailEditor value={html} onChange={setHtml} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim() || isEditorEmpty(html)}
            className="gap-1.5"
          >
            <Send className="size-3.5" />
            {sending ? t("sending") : t("forward")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
