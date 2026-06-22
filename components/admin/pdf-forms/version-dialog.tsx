"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Diff {
  added: string[];
  removed: string[];
  renamed: { from: string; to: string }[];
  unchanged: string[];
}

export function VersionDialog({
  formId, open, onOpenChange, onApplied,
}: {
  formId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApplied: () => void;
}) {
  const t = useTranslations("admin.pdf");
  const [file, setFile] = useState<File | null>(null);
  const [diff, setDiff] = useState<Diff | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setFile(null); setDiff(null); setNotes("");
  }

  async function preview() {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/admin/pdf/forms/${formId}/version`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || t("toastInvalidPdf")); return; }
      setDiff(data.diff);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("apply", "true");
      if (notes.trim()) fd.set("changeNotes", notes.trim());
      const res = await fetch(`/api/admin/pdf/forms/${formId}/version`, { method: "POST", body: fd });
      if (!res.ok) { toast.error(t("toastApplyError")); return; }
      toast.success(t("toastVersionApplied"));
      reset(); onOpenChange(false); onApplied();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("replacePdfTitle")}</DialogTitle>
          <DialogDescription>{t("replacePdfDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ver-file">{t("newPdf")}</Label>
            <Input id="ver-file" type="file" accept="application/pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDiff(null); }} />
          </div>

          {!diff ? (
            <Button variant="outline" onClick={preview} disabled={!file || busy}>
              {busy && <Loader2Icon className="size-4 animate-spin" />} {t("compareFields")}
            </Button>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">{t("diffAdded", { count: diff.added.length })}</Badge>
                <Badge variant="destructive">{t("diffRemoved", { count: diff.removed.length })}</Badge>
                <Badge variant="secondary">{t("diffRenamed", { count: diff.renamed.length })}</Badge>
                <Badge variant="outline">{t("diffUnchanged", { count: diff.unchanged.length })}</Badge>
              </div>
              {diff.renamed.length > 0 && (
                <ul className="text-xs text-muted-foreground">
                  {diff.renamed.map((r, i) => <li key={i}><code>{r.from}</code> → <code>{r.to}</code></li>)}
                </ul>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ver-notes" className="text-xs text-muted-foreground">{t("versionNoteLabel")}</Label>
                <Input id="ver-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("versionNotePlaceholder")} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button onClick={apply} disabled={!diff || busy}>
            {busy && <Loader2Icon className="size-4 animate-spin" />} {t("applyNewVersion")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
