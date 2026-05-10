"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check, X, ExternalLink } from "lucide-react";

type Report = {
  id: string;
  bureauId: string;
  bureau: { id: string; name: string; type: string; postalCode: string; city: string } | null;
  category: string;
  message: string;
  reporterEmail: string | null;
  status: "pending" | "resolved" | "dismissed";
  adminNotes: string | null;
  createdAt: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  hours: "Horaires",
  address: "Adresse",
  phone: "Téléphone",
  closed: "Fermé/déménagé",
  other: "Autre",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  resolved: "Résolu",
  dismissed: "Rejeté",
};

export function ReportsManager() {
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [refreshKey, setRefreshKey] = useState(0);

  const [resolving, setResolving] = useState<Report | null>(null);
  const [resolveStatus, setResolveStatus] = useState<"resolved" | "dismissed">("resolved");
  const [adminNotes, setAdminNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/bureaus/reports?status=${filterStatus}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setItems(j.items ?? []);
      })
      .catch(() => toast.error("Échec du chargement"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterStatus, refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  async function submitResolution() {
    if (!resolving) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/bureaus/reports/${resolving.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: resolveStatus, adminNotes: adminNotes || null }),
      });
      if (!res.ok) {
        toast.error("Échec");
        return;
      }
      toast.success(resolveStatus === "resolved" ? "Marqué comme résolu" : "Rejeté");
      setResolving(null);
      setAdminNotes("");
      setResolveStatus("resolved");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{items.length} signalement{items.length > 1 ? "s" : ""}</CardTitle>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "pending")}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="resolved">Résolus</SelectItem>
              <SelectItem value="dismissed">Rejetés</SelectItem>
              <SelectItem value="all">Tous</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Aucun signalement {STATUS_LABELS[filterStatus]?.toLowerCase()}.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bureau</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.bureau ? (
                      <Link
                        href={`/admin/bureaus`}
                        className="font-medium hover:underline inline-flex items-center gap-1"
                      >
                        {r.bureau.name} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">[supprimé]</span>
                    )}
                    {r.bureau && (
                      <div className="text-xs text-muted-foreground">
                        {r.bureau.postalCode} {r.bureau.city}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{CATEGORY_LABELS[r.category] ?? r.category}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="text-sm">{r.message}</div>
                    {r.reporterEmail && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ↳ {r.reporterEmail}
                      </div>
                    )}
                    {r.adminNotes && (
                      <div className="text-xs italic text-muted-foreground mt-0.5">
                        Note admin : {r.adminNotes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString("fr-BE")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        r.status === "pending"
                          ? "border-amber-500 text-amber-700"
                          : r.status === "resolved"
                          ? "border-green-500 text-green-700"
                          : "border-gray-400 text-gray-500"
                      }
                    >
                      {STATUS_LABELS[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" && (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setResolving(r);
                            setResolveStatus("resolved");
                          }}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setResolving(r);
                            setResolveStatus("dismissed");
                          }}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveStatus === "resolved" ? "Marquer comme résolu" : "Rejeter le signalement"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Note interne (facultatif)"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={submitResolution} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
