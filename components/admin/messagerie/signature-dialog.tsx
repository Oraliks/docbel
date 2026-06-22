"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
import { Settings } from "lucide-react";

export function SignatureDialog() {
  const t = useTranslations("admin.messagerie");
  const [open, setOpen] = useState(false);
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void fetch("/api/inbox/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSignature(data.signature || "");
      })
      .finally(() => setLoading(false));
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/inbox/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      if (response.ok) {
        toast.success(t("signatureSaved"));
        setOpen(false);
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || t("error"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" className="gap-2 h-8" title={t("settings")}>
            <Settings className="size-3.5" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("signatureTitle")}</DialogTitle>
          <DialogDescription>{t("signatureDescription")}</DialogDescription>
        </DialogHeader>
        <div>
          <Textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            disabled={loading}
            placeholder={t("signaturePlaceholder")}
            rows={8}
            className="resize-y font-mono text-sm"
          />
          <p className="mt-2 text-xs text-muted-foreground">{t("signatureHelper")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
