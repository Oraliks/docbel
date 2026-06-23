"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Search,
} from "lucide-react";

const PAGE_SIZE = 50;

type Locale = "nl" | "en";

type Status = "ia" | "reviewed" | "published";

type Row = {
  id: string;
  model: string;
  recordId: string;
  field: string;
  locale: string;
  value: string;
  status: string;
  updatedBy: string | null;
  updatedAt: string;
  sourceText: string;
};

// Libellés FR des modèles (chrome admin = FR codé en dur).
const MODEL_LABELS: Record<string, string> = {
  news: "Actualités",
  tool: "Outils",
  organisme: "Organismes",
  calculatorAsset: "Assets calculateurs",
  commissionParitaire: "Commissions paritaires",
  documentBundle: "Dossiers",
  bureau: "Bureaux",
};
const MODELS = Object.keys(MODEL_LABELS);

const STATUS_LABELS: Record<Status, string> = {
  ia: "IA",
  reviewed: "Relu",
  published: "Publié",
};

function statusVariant(status: string): "warning" | "info" | "success" | "secondary" {
  switch (status) {
    case "ia":
      return "warning";
    case "reviewed":
      return "info";
    case "published":
      return "success";
    default:
      return "secondary";
  }
}

// Sentinelle "tous" (une seule valeur par select sans SelectItem dédié = bug).
const ALL = "ALL";

export function ContentTranslationsManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [model, setModel] = useState<string>(ALL);
  const [locale, setLocale] = useState<Locale>("nl");
  const [status, setStatus] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // État d'édition local : id → { value, status } (dirty tracking).
  const [drafts, setDrafts] = useState<
    Record<string, { value: string; status: string }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Debounce de la recherche.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(handle);
  }, [search]);

  // Reset page sur changement de filtre.
  useEffect(() => {
    setPage(1);
  }, [model, locale, status, debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (model !== ALL) params.set("model", model);
      params.set("locale", locale);
      if (status !== ALL) params.set("status", status);
      if (debouncedSearch) params.set("q", debouncedSearch);
      params.set("page", String(page));

      const res = await fetch(`/api/admin/content-translations?${params}`);
      if (!res.ok) throw new Error("Chargement impossible");
      const data = (await res.json()) as { rows: Row[]; total: number };
      setRows(data.rows);
      setTotal(data.total);
      // Initialise les brouillons depuis les valeurs serveur.
      const next: Record<string, { value: string; status: string }> = {};
      for (const r of data.rows) next[r.id] = { value: r.value, status: r.status };
      setDrafts(next);
    } catch {
      toast.error("Erreur lors du chargement des traductions");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [model, locale, status, debouncedSearch, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = (r: Row) => {
    const d = drafts[r.id];
    return !!d && (d.value !== r.value || d.status !== r.status);
  };

  const setDraftValue = (id: string, value: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], value } }));
  const setDraftStatus = (id: string, statusVal: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], status: statusVal } }));

  const save = async (r: Row) => {
    const d = drafts[r.id];
    if (!d) return;
    setSavingId(r.id);
    try {
      const res = await fetch(`/api/admin/content-translations/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: d.value, status: d.status }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Échec");
      }
      const updated = (await res.json()) as Row;
      // Met à jour la ligne en place (sans recharger toute la page).
      setRows((prev) =>
        prev.map((row) =>
          row.id === r.id
            ? { ...row, value: updated.value, status: updated.status, updatedBy: updated.updatedBy, updatedAt: updated.updatedAt }
            : row
        )
      );
      toast.success("Traduction enregistrée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSavingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lignes de traduction</CardTitle>
        {/* Filtres */}
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-model">Modèle</Label>
            <Select value={model} onValueChange={(v) => setModel(v ?? ALL)}>
              <SelectTrigger id="ct-model" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les modèles</SelectItem>
                {MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODEL_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Langue</Label>
            <div className="inline-flex h-8 items-center rounded-lg border border-input p-0.5">
              {(["nl", "en"] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocale(loc)}
                  className={`h-7 rounded-md px-3 text-sm font-medium transition-colors ${
                    locale === loc
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-status">Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
              <SelectTrigger id="ct-status" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les statuts</SelectItem>
                <SelectItem value="ia">IA</SelectItem>
                <SelectItem value="reviewed">Relu</SelectItem>
                <SelectItem value="published">Publié</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="ct-search">Recherche</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ct-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher dans la traduction…"
                className="pl-8"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Champ</TableHead>
                <TableHead className="w-[30%]">Source (FR)</TableHead>
                <TableHead>Traduction ({locale.toUpperCase()})</TableHead>
                <TableHead className="w-40">Statut</TableHead>
                <TableHead className="w-28 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Aucune traduction pour ces filtres.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const d = drafts[r.id] ?? { value: r.value, status: r.status };
                  const dirty = isDirty(r);
                  return (
                    <TableRow key={r.id} className="align-top">
                      <TableCell className="align-top">
                        <div className="font-medium">{r.field}</div>
                        <div className="text-xs text-muted-foreground">
                          {MODEL_LABELS[r.model] ?? r.model}
                        </div>
                        <div className="mt-1 truncate text-[11px] text-muted-foreground" title={r.recordId}>
                          {r.recordId}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="max-h-48 overflow-y-auto rounded-md bg-muted/50 px-2.5 py-2 text-sm whitespace-pre-wrap text-muted-foreground">
                          {r.sourceText || (
                            <span className="italic">— source vide —</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Textarea
                          value={d.value}
                          onChange={(e) => setDraftValue(r.id, e.target.value)}
                          className="min-h-20"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-2">
                          <Badge variant={statusVariant(d.status)}>
                            {STATUS_LABELS[d.status as Status] ?? d.status}
                          </Badge>
                          <Select
                            value={d.status}
                            onValueChange={(v) => setDraftStatus(r.id, v ?? d.status)}
                          >
                            <SelectTrigger size="sm" className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ia">IA</SelectItem>
                              <SelectItem value="reviewed">Relu</SelectItem>
                              <SelectItem value="published">Publié</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button
                          size="sm"
                          disabled={!dirty || savingId === r.id}
                          onClick={() => save(r)}
                        >
                          {savingId === r.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Save className="size-4" />
                          )}
                          Enregistrer
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total === 0 ? "0 résultat" : `${from}–${to} sur ${total}`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
              Précédent
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Suivant
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
