"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, History } from "lucide-react";
import type { SerializedBureau } from "@/lib/bureaus/types";

type Revision = {
  id: string;
  diff: { changed: string[]; previous: Record<string, unknown>; current: Record<string, unknown> } | null;
  snapshot: Record<string, unknown>;
  changeNotes: string | null;
  changedBy: string | null;
  createdAt: string;
};

const FIELD_LABELS: Record<string, string> = {
  organismeId: "Organisme",
  type: "Type",
  name: "Nom",
  nameNl: "Nom NL",
  nameDe: "Nom DE",
  street: "Rue",
  streetNum: "N°",
  postalCode: "CP",
  city: "Ville",
  lat: "Latitude",
  lng: "Longitude",
  communeId: "Commune attitrée",
  phone: "Téléphone",
  email: "Email",
  website: "Site web",
  appointmentUrl: "URL RDV",
  hours: "Horaires",
  hoursNotes: "Note horaires",
  services: "Services",
  active: "Actif",
  notes: "Notes",
};

export function BureauRevisionsDialog({
  bureau,
  open,
  onOpenChange,
}: {
  bureau: SerializedBureau | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [items, setItems] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !bureau) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/bureaus/${bureau.id}/revisions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setItems(j.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bureau]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Historique — {bureau?.name}
          </DialogTitle>
          <DialogDescription>
            {items.length} révision{items.length > 1 ? "s" : ""} enregistrée
            {items.length > 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[55vh]">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aucune révision pour ce bureau.
            </div>
          )}
          <div className="space-y-3">
            {items.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {new Date(r.createdAt).toLocaleString("fr-BE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  {r.changedBy && (
                    <span className="font-mono text-[10px]">{r.changedBy.slice(0, 8)}</span>
                  )}
                </div>
                {r.diff?.changed && r.diff.changed.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {r.diff.changed.map((f) => (
                      <Badge key={f} variant="secondary" className="text-[10.5px]">
                        {FIELD_LABELS[f] ?? f}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Aucun champ modifié</div>
                )}
                {r.diff?.changed && r.diff.changed.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Voir le diff
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {r.diff.changed.map((f) => (
                        <div key={f} className="grid grid-cols-[120px_1fr_1fr] gap-2">
                          <span className="font-semibold">{FIELD_LABELS[f] ?? f}</span>
                          <div className="text-red-700 line-through truncate">
                            {fmtValue(r.diff!.previous[f])}
                          </div>
                          <div className="text-green-700 truncate">
                            {fmtValue(r.diff!.current[f])}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {r.changeNotes && (
                  <div className="text-xs text-muted-foreground italic">{r.changeNotes}</div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v).slice(0, 80);
    } catch {
      return "[obj]";
    }
  }
  return String(v).slice(0, 80);
}
