"use client";

import { useState } from "react";
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
          <DialogTitle>Matérialiser les champs visuels</DialogTitle>
          <DialogDescription>
            Cette opération crée une nouvelle version du PDF source avec les champs AcroForm correspondants.
            Le formulaire passera en brouillon.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between"><span>Champs texte</span><span className="tabular-nums">{textCount}</span></div>
          <div className="flex justify-between"><span>Cases à cocher</span><span className="tabular-nums">{checkboxCount}</span></div>
          {serverMaterializedAt && (
            <div className="text-xs text-muted-foreground">
              Dernière matérialisation : {new Date(serverMaterializedAt).toLocaleString("fr-BE")}
              {" — "}les anciens widgets seront remplacés.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annuler</Button>
          <Button onClick={go} disabled={busy || doc.fields.length === 0}>
            {busy && <Loader2Icon className="size-4 animate-spin" />} Appliquer au PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
