"use client";

/// Historique des versions publiées d'un arbre + restauration (clone vers
/// draft). Calque léger du RevisionsDialog des PDF.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { History, RotateCcw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Revision {
  id: string;
  version: number;
  changeType: string;
  changeNotes: string | null;
  diffSummary: { added?: string[]; removed?: string[]; modified?: string[] } | null;
  publishedBy: string | null;
  publishedAt: string;
}

export function VersionsDialog({
  treeId,
  open,
  onOpenChange,
  onRestored,
}: {
  treeId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRestored: () => void;
}) {
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = useCallback(() => {
    setRevisions(null);
    fetch(`/api/decision-trees/${treeId}/revisions`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRevisions(Array.isArray(d) ? d : []))
      .catch(() => setRevisions([]));
  }, [treeId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function restore(rev: Revision) {
    setRestoring(rev.id);
    try {
      const res = await fetch(
        `/api/decision-trees/${treeId}/revisions/${rev.id}/restore`,
        { method: "POST" },
      );
      if (!res.ok) {
        toast.error("Échec de la restauration.");
        return;
      }
      toast.success(`Version ${rev.version} restaurée dans le brouillon.`, {
        description: "Republiez pour la rendre publique.",
      });
      onOpenChange(false);
      onRestored();
    } finally {
      setRestoring(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> Historique des versions
          </DialogTitle>
          <DialogDescription>
            Restaurer une version la copie dans le brouillon. Republiez ensuite
            pour la rendre publique.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {revisions === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : revisions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune version publiée pour l'instant.
            </p>
          ) : (
            revisions.map((rev) => (
              <div
                key={rev.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Version {rev.version}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {rev.changeType}
                    </Badge>
                  </div>
                  {rev.changeNotes && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {rev.changeNotes}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDiff(rev.diffSummary)} ·{" "}
                    {new Date(rev.publishedAt).toLocaleString("fr-BE")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restore(rev)}
                  disabled={restoring !== null}
                >
                  {restoring === rev.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
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

function formatDiff(
  diff: { added?: string[]; removed?: string[]; modified?: string[] } | null,
): string {
  if (!diff) return "—";
  const parts: string[] = [];
  if (diff.added?.length) parts.push(`+${diff.added.length}`);
  if (diff.removed?.length) parts.push(`−${diff.removed.length}`);
  if (diff.modified?.length) parts.push(`~${diff.modified.length}`);
  return parts.length ? parts.join(" ") + " nœuds" : "aucun changement";
}
