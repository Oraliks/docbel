"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

interface Revision {
  id: string;
  version: number;
  changeType: string;
  changeNotes: string | null;
  sourceFileName: string;
  createdAt: string;
}

export function RevisionsDialog({
  formId, open, onOpenChange, onRestored,
}: {
  formId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRestored: () => void;
}) {
  const [revs, setRevs] = useState<Revision[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/pdf/forms/${formId}/revisions`)
      .then((r) => r.json())
      .then((d) => setRevs(Array.isArray(d) ? d : []))
      .catch(() => setRevs([]));
  }, [formId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function restore(rev: Revision) {
    setBusy(rev.id);
    try {
      const res = await fetch(`/api/admin/pdf/forms/${formId}/revisions/${rev.id}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error("Échec de la restauration."); return; }
      toast.success(`Version ${rev.version} restaurée.${data.sourceMismatch ? " (PDF source différent — vérifiez les champs)" : ""}`);
      onOpenChange(false);
      onRestored();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historique des versions</DialogTitle>
          <DialogDescription>Restaure le schéma enrichi d&apos;une version antérieure.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto py-2">
          {revs === null ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : revs.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Aucune révision</EmptyTitle>
                <EmptyDescription>L&apos;historique apparaîtra après vos premières modifications.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            revs.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{r.version}</span>
                    <Badge variant="outline" className="text-[10px]">{r.changeType}</Badge>
                  </div>
                  {r.changeNotes && <span className="text-muted-foreground">{r.changeNotes}</span>}
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString("fr-BE")} · {r.sourceFileName}
                  </span>
                </div>
                <Button variant="outline" size="sm" disabled={busy === r.id} onClick={() => restore(r)}>
                  Restaurer
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
