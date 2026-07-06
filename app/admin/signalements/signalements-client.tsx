"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ReportRow {
  id: string;
  type: string;
  status: string;
  message: string | null;
  targetId: string | null;
  targetLabel: string | null;
  targetUrl: string | null;
  payload: Record<string, unknown>;
  reporterEmail: string | null;
  reporterOrg: string | null;
  createdAt: string | Date;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "in_progress", label: "En cours" },
  { value: "resolved", label: "Résolu" },
  { value: "dismissed", label: "Rejeté" },
  { value: "all", label: "Tous" },
];

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "border-amber-500 text-amber-700",
  in_progress: "border-blue-500 text-blue-700",
  resolved: "border-green-500 text-green-700",
  dismissed: "border-gray-400 text-gray-500",
};

function PayloadDetail({ type, payload }: { type: string; payload: Record<string, unknown> }) {
  if (type === "translation") {
    const p = payload as { sourceText?: string; currentText?: string; suggestedText?: string; locale?: string };
    return (
      <div className="flex flex-col gap-2">
        <PayloadField label="Source (FR)" value={p.sourceText} />
        {p.currentText ? <PayloadField label="Traduction actuelle" value={p.currentText} /> : null}
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm whitespace-pre-wrap">
          {p.suggestedText}
        </div>
      </div>
    );
  }
  const entries = Object.entries(payload).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-1.5 text-xs">
      {entries.map(([key, value]) => (
        <PayloadField key={key} label={key} value={String(value)} />
      ))}
    </div>
  );
}

function PayloadField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="rounded-lg border bg-muted/40 px-2.5 py-2 text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}

export function SignalementsClient({
  initialReports,
  typeOptions,
}: {
  initialReports: ReportRow[];
  typeOptions: { value: string; label: string }[];
}) {
  const [items, setItems] = useState<ReportRow[]>(initialReports);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ status: statusFilter, ...(typeFilter !== "all" ? { type: typeFilter } : {}) });
    fetch(`/api/admin/reports?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setItems(j.items ?? []);
      })
      .catch(() => toast.error("Échec du chargement des signalements."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [typeFilter, statusFilter, refreshKey]);

  const typeLabel = useMemo(() => {
    const map = new Map(typeOptions.map((t) => [t.value, t.label]));
    return (type: string) => map.get(type) ?? type;
  }, [typeOptions]);

  async function updateStatus(newStatus: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/reports/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, adminNote: note.trim() || undefined }),
      });
      if (!res.ok) {
        toast.error("Échec de la mise à jour.");
        return;
      }
      toast.success("Signalement mis à jour.");
      setSelected(null);
      setRefreshKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "pending")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Aucun signalement dans cette catégorie.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Émetteur</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => { setSelected(r); setNote(""); }}>
                <TableCell>
                  <Badge variant="outline">{typeLabel(r.type)}</Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {r.targetUrl ? (
                    <a href={r.targetUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      {r.targetLabel ?? r.targetUrl}
                    </a>
                  ) : (
                    r.targetLabel ?? "—"
                  )}
                </TableCell>
                <TableCell className="max-w-md truncate text-sm">{r.message ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.reporterOrg ?? r.reporterEmail ?? "Anonyme"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleDateString("fr-BE")}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_BADGE_CLASS[r.status] ?? ""}>
                    {STATUS_OPTIONS.find((s) => s.value === r.status)?.label ?? r.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{typeLabel(selected.type)}</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4 pb-4">
                {selected.targetUrl ? (
                  <a href={selected.targetUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                    Voir la page concernée ↗
                  </a>
                ) : null}
                <div className="text-sm">
                  <span className="text-muted-foreground">Émetteur : </span>
                  {selected.reporterOrg ?? selected.reporterEmail ?? "Anonyme"}
                </div>
                {selected.message ? (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">{selected.message}</div>
                ) : null}
                <PayloadDetail type={selected.type} payload={selected.payload} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Note admin</label>
                  <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note interne (optionnel)" />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus("in_progress")}>
                    En cours
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus("resolved")}>
                    Résolu
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus("dismissed")}>
                    Rejeté
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
