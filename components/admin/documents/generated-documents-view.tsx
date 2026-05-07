"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Mail,
  Clock,
  FileX,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

interface GeneratedItem {
  id: string;
  templateId: string;
  templateName: string;
  templateSlug: string;
  userId: string | null;
  isAnonymous: boolean;
  emailSentTo: string | null;
  payloadHash: string;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  fileExists: boolean;
  fileSize: number | null;
  fileName: string | null;
}

interface ApiResponse {
  items: GeneratedItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  templates: { id: string; name: string }[];
}

function formatBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-BE");
}

export function GeneratedDocumentsView() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [templateId, setTemplateId] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [emailedOnly, setEmailedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (templateId !== "all") params.set("templateId", templateId);
      if (userFilter !== "all") params.set("user", userFilter);
      if (emailedOnly) params.set("emailedOnly", "true");
      const res = await fetch(`/api/documents/generated?${params}`);
      if (!res.ok) throw new Error("Erreur de chargement");
      setData(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [page, templateId, userFilter, emailedOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset à la page 1 quand on change un filtre
  useEffect(() => {
    setPage(1);
  }, [templateId, userFilter, emailedOnly]);

  async function deleteOne(id: string) {
    if (!confirm("Supprimer définitivement ce document généré ? Cette action est irréversible.")) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/documents/generated/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec");
      toast.success("Document supprimé");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  }

  const items = data?.items || [];
  const filtered = search
    ? items.filter(
        (i) =>
          i.templateName.toLowerCase().includes(search.toLowerCase()) ||
          i.id.toLowerCase().includes(search.toLowerCase()) ||
          i.emailSentTo?.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button render={<Link href="/admin/documents" />} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Documents générés</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total} document${data.total !== 1 ? "s" : ""} au total` : "…"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Modèle, ID, email…"
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modèle</Label>
              <Select value={templateId} onValueChange={(v) => setTemplateId(v ?? "all")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les modèles</SelectItem>
                  {data?.templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type d&apos;utilisateur</Label>
              <Select value={userFilter} onValueChange={(v) => setUserFilter(v ?? "all")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="authenticated">Connectés</SelectItem>
                  <SelectItem value="anonymous">Anonymes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">&nbsp;</Label>
              <label className="flex h-9 items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={emailedOnly}
                  onCheckedChange={(c) => setEmailedOnly(c === true)}
                />
                Envoyés par email uniquement
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading && items.length === 0 ? (
            <p className="p-12 text-center text-muted-foreground">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="p-12 text-center text-muted-foreground">
              {data?.total === 0
                ? "Aucun document généré pour l'instant."
                : "Aucun résultat avec ces filtres."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Modèle</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Taille</TableHead>
                    <TableHead>Expire</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <div className="text-sm">{formatRelative(i.createdAt)}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(i.createdAt).toLocaleString("fr-BE")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/outils/${i.templateSlug}`}
                          target="_blank"
                          className="font-medium hover:underline"
                        >
                          {i.templateName}
                        </Link>
                        <div className="text-xs text-muted-foreground font-mono">{i.id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell>
                        {i.isAnonymous ? (
                          <Badge variant="outline" className="text-xs">
                            <UserX className="w-3 h-3 mr-1" />
                            Anonyme
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            <UserCheck className="w-3 h-3 mr-1" />
                            Connecté
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {i.emailSentTo ? (
                          <span className="text-sm flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[180px]" title={i.emailSentTo}>
                              {i.emailSentTo}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatBytes(i.fileSize)}</TableCell>
                      <TableCell>
                        {i.isExpired ? (
                          <Badge variant="destructive" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            Expiré
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {new Date(i.expiresAt).toLocaleDateString("fr-BE")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {i.fileExists && !i.isExpired ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              render={
                                <a
                                  href={`/api/documents/generated/${i.id}/download`}
                                  download
                                />
                              }
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" disabled title="Fichier indisponible">
                              <FileX className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteOne(i.id)}
                            disabled={busyId === i.id}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} sur {data.totalPages} ({data.total} documents)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1 || loading}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={data.page >= data.totalPages || loading}
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
