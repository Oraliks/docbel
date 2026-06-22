"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useVisualEditor } from "./provider/visual-editor-context";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApplied: () => void;
}

/// Dialog de confirmation avant matérialisation. Affiche le résumé (nb champs
/// par type), mentionne explicitement que l'opération crée une nouvelle version
/// du PDF source.
export function VisualMaterializeDialog({ open, onOpenChange, onApplied }: Props) {
  const t = useTranslations("admin.pdf");
  const { doc, materialize, serverMaterializedAt } = useVisualEditor();
  const [busy, setBusy] = useState(false);

  const textCount = doc.fields.filter((f) => f.type === "text").length;
  const checkboxCount = doc.fields.filter((f) => f.type === "checkbox").length;

  async function go() {
    setBusy(true);
    const res = await materialize();
    setBusy(false);
    if (res.ok) {
      onOpenChange(false);
      onApplied();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("materializeTitle")}</DialogTitle>
          <DialogDescription>{t("materializeDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between"><span>{t("textFields")}</span><span className="tabular-nums">{textCount}</span></div>
          <div className="flex justify-between"><span>{t("checkboxFields")}</span><span className="tabular-nums">{checkboxCount}</span></div>
          {serverMaterializedAt && (
            <div className="text-xs text-muted-foreground">
              {t("lastMaterialized", { date: new Date(serverMaterializedAt).toLocaleString("fr-BE") })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={go} disabled={busy || doc.fields.length === 0}>
            {busy && <Loader2Icon className="size-4 animate-spin" />} {t("applyToPdf")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
