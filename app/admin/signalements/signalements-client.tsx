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
  }, [typeFilter, statusFilter]);

  const typeLabel = useMemo(() => {
    const map = new Map(typeOptions.map((t) => [t.value, t.label]));
    return (type: string) => map.get(type) ?? type;
  }, [typeOptions]);

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
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40">
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
    </div>
  );
}
