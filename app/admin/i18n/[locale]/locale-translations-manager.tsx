"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
  Download,
  EyeOff,
  History,
  Loader2,
  Save,
  Search,
  X,
} from "lucide-react";

const PAGE_SIZE = 50;

type Status = "ia" | "reviewed" | "published";
type Origin = "ia" | "human" | "imported";

type Row = {
  id: string;
  model: string;
  recordId: string;
  field: string;
  locale: string;
  value: string;
  status: string;
  origin: string;
  updatedBy: string | null;
  updatedAt: string;
  sourceText: string;
};

type HistoryEntry = {
  id: string;
  oldValue: string;
  newValue: string;
  oldStatus: string;
  newStatus: string;
  origin: string;
  editedBy: string;
  editedAt: string;
};

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

// La DB renvoie le model en PascalCase ("Bureau"), MODEL_LABELS est indexé en
// camelCase → on normalise avant lookup pour afficher le bon libellé FR.
const modelLabel = (m: string) =>
  MODEL_LABELS[m ? m[0].toLowerCase() + m.slice(1) : m] ?? m;

const STATUS_LABELS: Record<Status, string> = {
  ia: "IA",
  reviewed: "Relu",
  published: "Publié",
};

const ORIGIN_LABELS: Record<Origin, string> = {
  ia: "IA",
  human: "Humain",
  imported: "Import",
};

function statusVariant(s: string): "warning" | "info" | "success" | "secondary" {
  if (s === "ia") return "warning";
  if (s === "reviewed") return "info";
  if (s === "published") return "success";
  return "secondary";
}

function originVariant(o: string): "secondary" | "info" | "outline" {
  if (o === "human") return "info";
  if (o === "imported") return "outline";
  return "secondary";
}

const ALL = "_all";

export function LocaleTranslationsManager({ locale }: { locale: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [model, setModel] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);

  const [drafts, setDrafts] = useState<Record<string, { value: string; status: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [historyRowId, setHistoryRowId] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => { setPage(1); }, [model, status, debouncedSearch, hideEmpty]);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set("locale", locale);
    if (model !== ALL) p.set("model", model);
    if (status !== ALL) p.set("status", status);
    if (debouncedSearch) p.set("q", debouncedSearch);
    if (hideEmpty) p.set("hideEmpty", "1");
    p.set("page", String(page));
    return p;
  }, [locale, model, status, debouncedSearch, hideEmpty, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content-translations?${buildParams()}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { rows: Row[]; total: number };
      setRows(data.rows);
      setTotal(data.total);
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
  }, [buildParams]);

  useEffect(() => { void load(); }, [load]);

  const isDirty = (r: Row) => {
    const d = drafts[r.id];
    return !!d && (d.value !== r.value || d.status !== r.status);
  };

  const setDraftValue = (id: string, v: string) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], value: v } }));
  const setDraftStatus = (id: string, s: string) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], status: s } }));

  const save = async (r: Row) => {
    const d = drafts[r.id];
    if (!d) return;
    setSavingId(r.id);
    try {
      const res = await fetch(`/api/admin/content-translations/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: d.value, status: d.status, origin: "human" }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Échec");
      const updated = (await res.json()) as Row;
      setRows((prev) =>
        prev.map((row) =>
          row.id === r.id
            ? { ...row, value: updated.value, status: updated.status, origin: updated.origin, updatedBy: updated.updatedBy, updatedAt: updated.updatedAt }
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

  const openHistory = async (id: string) => {
    if (historyRowId === id) { setHistoryRowId(null); return; }
    setHistoryRowId(id);
    setHistoryEntries([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/content-translations/history/${id}`);
      const data = await res.json();
      setHistoryEntries(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Impossible de charger l'historique");
    } finally {
      setHistoryLoading(false);
    }
  };

  const exportCsv = () => {
    const p = new URLSearchParams(buildParams());
    p.delete("page");
    window.location.href = `/api/admin/content-translations/export?${p}`;
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-4">
      {/* Barre de filtres */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-model">Modèle</Label>
            <Select value={model} onValueChange={(v) => setModel(v ?? ALL)}>
              <SelectTrigger id="ct-model" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les modèles</SelectItem>
                {MODELS.map((m) => (
                  <SelectItem key={m} value={m}>{MODEL_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-status">Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
              <SelectTrigger id="ct-status" className="w-40">
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

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setHideEmpty((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                hideEmpty
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
              title="Masquer les lignes sans source FR"
            >
              <EyeOff className="size-4" />
              {hideEmpty ? "Sources vides masquées" : "Toutes les lignes"}
            </button>

            <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-1.5">
              <Download className="size-4" />
              Exporter CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Compteur */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total === 0 ? "0 résultat" : `${from}–${to} sur ${total} lignes`}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" /> Précédent
          </Button>
          <span>{page} / {totalPages}</span>
          <Button
            variant="outline" size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Suivant <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Lignes */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          Aucune traduction pour ces filtres.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const d = drafts[r.id] ?? { value: r.value, status: r.status };
            const dirty = isDirty(r);
            const isHistoryOpen = historyRowId === r.id;

            return (
              <div
                key={r.id}
                className={`rounded-xl border bg-card transition-shadow ${dirty ? "border-primary/40 shadow-sm shadow-primary/10" : ""}`}
              >
                {/* En-tête de ligne */}
                <div className="flex items-center gap-2 border-b px-4 py-2.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {modelLabel(r.model)}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <code className="text-xs font-mono text-muted-foreground">{r.field}</code>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground/60 max-w-[200px]" title={r.recordId}>
                    {r.recordId}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Badge variant={originVariant(r.origin as Origin)} className="text-[10px] py-0">
                      {ORIGIN_LABELS[r.origin as Origin] ?? r.origin}
                    </Badge>
                    {r.updatedBy && (
                      <span className="text-[11px] text-muted-foreground/60">
                        {r.updatedBy} · {new Date(r.updatedAt).toLocaleDateString("fr-BE")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Corps : source FR | traduction */}
                <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
                  {/* Source FR */}
                  <div className="border-b p-4 lg:border-r lg:border-b-0">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Source FR
                    </p>
                    {r.sourceText ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {r.sourceText}
                      </p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground/60">
                        Pas de contenu source en français pour ce champ.
                      </p>
                    )}
                  </div>

                  {/* Traduction */}
                  <div className="p-4">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Traduction {locale.toUpperCase()}
                    </p>
                    <Textarea
                      value={d.value}
                      onChange={(e) => setDraftValue(r.id, e.target.value)}
                      className="min-h-[5rem] resize-y"
                    />
                  </div>
                </div>

                {/* Pied : statut + actions */}
                <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-4 py-2.5 rounded-b-xl">
                  <Badge variant={statusVariant(d.status as Status)}>
                    {STATUS_LABELS[d.status as Status] ?? d.status}
                  </Badge>

                  <Select value={d.status} onValueChange={(v) => setDraftStatus(r.id, v ?? d.status)}>
                    <SelectTrigger size="sm" className="w-32 h-7">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ia">IA</SelectItem>
                      <SelectItem value="reviewed">Relu</SelectItem>
                      <SelectItem value="published">Publié</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="ghost" size="sm"
                      className={`h-7 gap-1 text-xs ${isHistoryOpen ? "text-primary" : ""}`}
                      onClick={() => openHistory(r.id)}
                    >
                      <History className="size-3.5" />
                      Historique
                    </Button>

                    <Button
                      size="sm" className="h-7 gap-1"
                      disabled={!dirty || savingId === r.id}
                      onClick={() => save(r)}
                    >
                      {savingId === r.id
                        ? <Loader2 className="size-3.5 animate-spin" />
                        : <Save className="size-3.5" />}
                      Enregistrer
                    </Button>
                  </div>
                </div>

                {/* Panneau historique (inline) */}
                {isHistoryOpen && (
                  <div ref={historyPanelRef} className="border-t bg-muted/20 px-4 py-3 rounded-b-xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Historique des modifications
                      </p>
                      <button
                        type="button"
                        onClick={() => setHistoryRowId(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    {historyLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Chargement…
                      </div>
                    ) : historyEntries.length === 0 ? (
                      <p className="py-3 text-sm text-muted-foreground italic">
                        Aucune modification enregistrée.
                      </p>
                    ) : (
                      <ol className="flex flex-col gap-2">
                        {historyEntries.map((h, i) => (
                          <li key={h.id} className={`rounded-lg border px-3 py-2 text-sm ${i === 0 ? "border-primary/30 bg-primary/5" : "bg-card"}`}>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-medium text-xs">{h.editedBy}</span>
                              <span className="text-muted-foreground/60 text-xs">
                                {new Date(h.editedAt).toLocaleString("fr-BE")}
                              </span>
                              <Badge variant={originVariant(h.origin as Origin)} className="text-[10px] py-0">
                                {ORIGIN_LABELS[h.origin as Origin] ?? h.origin}
                              </Badge>
                              {h.oldStatus !== h.newStatus && (
                                <span className="text-[11px] text-muted-foreground">
                                  {STATUS_LABELS[h.oldStatus as Status] ?? h.oldStatus}
                                  {" → "}
                                  {STATUS_LABELS[h.newStatus as Status] ?? h.newStatus}
                                </span>
                              )}
                            </div>
                            {h.oldValue !== h.newValue && (
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                <div className="rounded bg-red-50 dark:bg-red-950/30 px-2 py-1 text-xs text-red-700 dark:text-red-400 line-through opacity-70 whitespace-pre-wrap">
                                  {h.oldValue || <em>vide</em>}
                                </div>
                                <div className="rounded bg-green-50 dark:bg-green-950/30 px-2 py-1 text-xs text-green-700 dark:text-green-400 whitespace-pre-wrap">
                                  {h.newValue || <em>vide</em>}
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination bas */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span>{from}–{to} sur {total}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="size-4" /> Précédent
            </Button>
            <span>{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Suivant <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
