"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Edit2,
  Globe,
  Archive,
  RefreshCw,
  BarChart3,
  History,
  Inbox,
  Search,
  X,
  PenTool,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Building2,
  Library,
  Package,
  Copy,
  Trash2,
  FolderTree,
  Settings as SettingsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DeleteTemplateDialog } from "./delete-template-dialog";

interface Template {
  id: string;
  toolId: string;
  sourceType: string;
  status: string;
  version: number;
  requiresSignature: boolean;
  effectiveDate: string | null;
  expiresAt: string | null;
  officialRef: string | null;
  updatedAt: string;
  tool: { id: string; name: string; slug: string };
  sourceFile: { id: string; name: string; fileType: string | null };
  organisme: {
    id: string;
    code: string;
    name: string;
    shortName: string | null;
    color: string;
    type: string;
  } | null;
  counts: {
    generated: number;
    revisions: number;
    drafts: number;
    bundleItems: number;
  };
}

interface OrganismeOption {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  color: string;
  type: string;
}

interface TemplateListProps {
  templates: Template[];
  organismes: OrganismeOption[];
}

const sourceTypeLabel: Record<string, string> = {
  pdf_acroform: "PDF (formulaire)",
  pdf_flat: "PDF (plat)",
  docx: "Word (DOCX)",
};

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  published: { label: "Publié", variant: "default" },
  archived: { label: "Archivé", variant: "outline" },
};

const PAGE_SIZE = 10;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

function isExpiringSoon(iso: string | null, daysThreshold = 30): boolean {
  if (!iso) return false;
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < daysThreshold * 24 * 60 * 60 * 1000;
}

export function TemplateList({ templates, organismes }: TemplateListProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    template: Template;
    related: { generated: number; revisions: number; drafts: number; bundleItems: number };
  } | null>(null);

  // Filtres
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("published");
  const [organismeFilter, setOrganismeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  async function changeStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/documents/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      toast.success(status === "published" ? "Publié" : status === "archived" ? "Archivé" : "Mis à jour");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  // Filtrage côté client
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (q) {
        const hay = `${t.tool.name} ${t.tool.slug} ${t.sourceFile.name} ${t.officialRef ?? ""} ${t.organisme?.name ?? ""} ${t.organisme?.shortName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (organismeFilter !== "all") {
        if (organismeFilter === "none") {
          if (t.organisme) return false;
        } else if (t.organisme?.id !== organismeFilter) return false;
      }
      if (sourceFilter !== "all" && t.sourceType !== sourceFilter) return false;
      return true;
    });
  }, [templates, search, statusFilter, organismeFilter, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const activeFiltersCount =
    (search ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (organismeFilter !== "all" ? 1 : 0) +
    (sourceFilter !== "all" ? 1 : 0);

  function resetFilters() {
    setSearch("");
    setStatusFilter("published");
    setOrganismeFilter("all");
    setSourceFilter("all");
    setPage(0);
  }

  // Compteurs par statut (filtres autres appliqués pour cohérence)
  const statusCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = templates.filter((t) => {
      if (q) {
        const hay = `${t.tool.name} ${t.tool.slug} ${t.sourceFile.name} ${t.officialRef ?? ""} ${t.organisme?.name ?? ""} ${t.organisme?.shortName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (organismeFilter !== "all") {
        if (organismeFilter === "none") {
          if (t.organisme) return false;
        } else if (t.organisme?.id !== organismeFilter) return false;
      }
      if (sourceFilter !== "all" && t.sourceType !== sourceFilter) return false;
      return true;
    });
    return {
      all: matched.length,
      published: matched.filter((t) => t.status === "published").length,
      draft: matched.filter((t) => t.status === "draft").length,
      archived: matched.filter((t) => t.status === "archived").length,
    };
  }, [templates, search, organismeFilter, sourceFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Générateurs de documents</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {filtered.length} sur {templates.length} modèle{templates.length !== 1 ? "s" : ""}
            {activeFiltersCount > 0 && (
              <>
                {" • "}
                <button onClick={resetFilters} className="underline hover:text-foreground">
                  Réinitialiser les filtres
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/admin/documents/sections" />} variant="outline" size="sm">
            <FolderTree className="w-4 h-4 mr-2" />
            Sections
          </Button>
          <Button render={<Link href="/admin/documents/organismes" />} variant="outline" size="sm">
            <Building2 className="w-4 h-4 mr-2" />
            Organismes
          </Button>
          <Button render={<Link href="/admin/documents/presets" />} variant="outline" size="sm">
            <Library className="w-4 h-4 mr-2" />
            Presets
          </Button>
          <Button render={<Link href="/admin/documents/bundles" />} variant="outline" size="sm">
            <Package className="w-4 h-4 mr-2" />
            Bundles
          </Button>
          <Button render={<Link href="/admin/documents/generated" />} variant="outline" size="sm">
            <Inbox className="w-4 h-4 mr-2" />
            Générés
          </Button>
          <Button render={<Link href="/admin/documents/analytics" />} variant="outline" size="sm">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          <Button render={<Link href="/admin/documents/settings" />} variant="outline" size="sm">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Paramètres
          </Button>
          <Button render={<Link href="/admin/documents/new" />} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, slug, organisme, référence…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-8 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <Select
          value={organismeFilter}
          onValueChange={(v) => {
            setOrganismeFilter(v || "all");
            setPage(0);
          }}
        >
          <SelectTrigger className="w-auto min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous organismes</SelectItem>
            <SelectItem value="none">Sans organisme</SelectItem>
            {organismes.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.shortName || o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>


        <Select
          value={sourceFilter}
          onValueChange={(v) => {
            setSourceFilter(v || "all");
            setPage(0);
          }}
        >
          <SelectTrigger className="w-auto min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="pdf_acroform">PDF formulaire</SelectItem>
            <SelectItem value="pdf_flat">PDF plat</SelectItem>
            <SelectItem value="docx">Word DOCX</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs status */}
      <div className="flex flex-wrap gap-1 border-b">
        {[
          { id: "published", label: "Publiés", count: statusCounts.published },
          { id: "draft", label: "Brouillons", count: statusCounts.draft },
          { id: "archived", label: "Archivés", count: statusCounts.archived },
          { id: "all", label: "Tous", count: statusCounts.all },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setStatusFilter(t.id);
              setPage(0);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t.label}</span>
            <Badge
              variant={statusFilter === t.id ? "default" : "secondary"}
              className="text-[10px] px-1.5 py-0 h-5 min-w-[20px] justify-center"
            >
              {t.count}
            </Badge>
          </button>
        ))}
      </div>

      {/* Table */}
      {templates.length === 0 ? (
        <div className="border border-dashed rounded-lg flex flex-col items-center justify-center py-16 gap-3">
          <FileText className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">Aucun modèle pour l&apos;instant.</p>
          <Button render={<Link href="/admin/documents/new" />}>
            <Plus className="w-4 h-4 mr-2" />
            Créer le premier modèle
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed rounded-lg flex flex-col items-center justify-center py-16 gap-3">
          <Search className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">Aucun résultat.</p>
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Réinitialiser les filtres
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Document</TableHead>
                <TableHead>Organisme</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Validité</TableHead>
                <TableHead>Modifié</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((t) => {
                const status = statusLabel[t.status] || { label: t.status, variant: "outline" as const };
                const expired = isExpired(t.expiresAt);
                const expiringSoon = isExpiringSoon(t.expiresAt);
                return (
                  <TableRow key={t.id} className="group">
                    <TableCell>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/documents/${t.toolId}`}
                            className="font-medium hover:underline truncate"
                          >
                            {t.tool.name}
                          </Link>
                          {t.requiresSignature && (
                            <Tooltip>
                              <TooltipTrigger
                                render={<PenTool className="w-3.5 h-3.5 text-muted-foreground" />}
                              />
                              <TooltipContent>Signature requise</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <code className="font-mono">/{t.tool.slug}</code>
                          {t.officialRef && (
                            <>
                              <span>·</span>
                              <span className="truncate">{t.officialRef}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {t.organisme ? (
                        <Badge
                          variant="outline"
                          className="font-medium"
                          style={{ borderColor: t.organisme.color, color: t.organisme.color }}
                        >
                          {t.organisme.shortName || t.organisme.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {sourceTypeLabel[t.sourceType] || t.sourceType}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">v{t.version}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {expired ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Périmé
                              </Badge>
                            }
                          />
                          <TooltipContent>Expiré le {formatDate(t.expiresAt)}</TooltipContent>
                        </Tooltip>
                      ) : expiringSoon ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Badge variant="outline" className="text-xs gap-1 border-amber-500 text-amber-700">
                                <AlertTriangle className="w-3 h-3" />
                                Bientôt
                              </Badge>
                            }
                          />
                          <TooltipContent>Expire le {formatDate(t.expiresAt)}</TooltipContent>
                        </Tooltip>
                      ) : t.effectiveDate ? (
                        <span className="text-xs text-muted-foreground">
                          depuis {formatDate(t.effectiveDate)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground">{formatDate(t.updatedAt)}</span>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                render={<Link href={`/admin/documents/${t.toolId}`} />}
                                variant="ghost"
                                size="sm"
                              >
                                <Edit2 className="w-4 h-4" />
                                <span className="sr-only">Éditer</span>
                              </Button>
                            }
                          />
                          <TooltipContent>Éditer</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                render={<Link href={`/admin/documents/${t.toolId}/history`} />}
                                variant="ghost"
                                size="sm"
                              >
                                <History className="w-4 h-4" />
                                <span className="sr-only">Historique</span>
                              </Button>
                            }
                          />
                          <TooltipContent>Historique des versions</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy === t.id}
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Dupliquer "${t.tool.name}" ?`,
                                    description:
                                      "Une copie en brouillon sera créée avec un nouveau slug. Vous serez redirigé vers son éditeur.",
                                    confirmText: "Dupliquer",
                                  });
                                  if (!ok) return;
                                  setBusy(t.id);
                                  try {
                                    const res = await fetch(
                                      `/api/documents/templates/${t.id}/duplicate`,
                                      {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: "{}",
                                      }
                                    );
                                    if (!res.ok) {
                                      const j = await res.json().catch(() => ({}));
                                      throw new Error(j.error || "Échec");
                                    }
                                    const dup = await res.json();
                                    toast.success(`Dupliqué : ${dup.name}`);
                                    router.push(`/admin/documents/${dup.toolId}`);
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "Erreur");
                                  } finally {
                                    setBusy(null);
                                  }
                                }}
                              >
                                <Copy className="w-4 h-4" />
                                <span className="sr-only">Dupliquer</span>
                              </Button>
                            }
                          />
                          <TooltipContent>Dupliquer</TooltipContent>
                        </Tooltip>

                        {t.status === "published" && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  render={
                                    <Link
                                      href={`/outils/${t.tool.slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    />
                                  }
                                  variant="ghost"
                                  size="sm"
                                >
                                  <Globe className="w-4 h-4" />
                                  <span className="sr-only">Voir public</span>
                                </Button>
                              }
                            />
                            <TooltipContent>Voir la page publique</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Séparateur visuel */}
                        <span className="mx-1 h-6 w-px bg-border" aria-hidden />

                        {t.status === "draft" && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy === t.id}
                                  onClick={() => changeStatus(t.id, "published")}
                                  className="text-green-700 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                                >
                                  <Globe className="w-4 h-4" />
                                  <span className="sr-only">Publier</span>
                                </Button>
                              }
                            />
                            <TooltipContent>Publier</TooltipContent>
                          </Tooltip>
                        )}
                        {t.status === "published" && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy === t.id}
                                  onClick={() => changeStatus(t.id, "draft")}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  <span className="sr-only">Dépublier</span>
                                </Button>
                              }
                            />
                            <TooltipContent>Dépublier (repasser en brouillon)</TooltipContent>
                          </Tooltip>
                        )}
                        {t.status !== "archived" ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy === t.id}
                                  onClick={() => changeStatus(t.id, "archived")}
                                  className="text-amber-700 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                                >
                                  <Archive className="w-4 h-4" />
                                  <span className="sr-only">Archiver</span>
                                </Button>
                              }
                            />
                            <TooltipContent>Archiver (réversible)</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy === t.id}
                                  onClick={() => changeStatus(t.id, "draft")}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  <span className="sr-only">Désarchiver</span>
                                </Button>
                              }
                            />
                            <TooltipContent>Désarchiver</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy === t.id}
                                onClick={() =>
                                  setDeleteTarget({
                                    template: t,
                                    related: t.counts,
                                  })
                                }
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="sr-only">Supprimer définitivement</span>
                              </Button>
                            }
                          />
                          <TooltipContent>Supprimer définitivement</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Page {safePage + 1} sur {totalPages} · {filtered.length} résultat
                {filtered.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const showPage =
                    i === 0 ||
                    i === totalPages - 1 ||
                    Math.abs(i - safePage) <= 1;
                  if (!showPage) {
                    if (i === 1 || i === totalPages - 2) {
                      return (
                        <span key={i} className="px-1 text-muted-foreground text-xs">
                          …
                        </span>
                      );
                    }
                    return null;
                  }
                  return (
                    <Button
                      key={i}
                      variant={i === safePage ? "default" : "outline"}
                      size="sm"
                      className="min-w-[32px]"
                      onClick={() => setPage(i)}
                    >
                      {i + 1}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <DeleteTemplateDialog
          open={!!deleteTarget}
          onOpenChange={(v) => !v && setDeleteTarget(null)}
          templateName={deleteTarget.template.tool.name}
          templateSlug={deleteTarget.template.tool.slug}
          related={deleteTarget.related}
          onConfirm={async () => {
            try {
              const res = await fetch(
                `/api/documents/templates/${deleteTarget.template.id}?hard=true&confirmSlug=${encodeURIComponent(deleteTarget.template.tool.slug)}`,
                { method: "DELETE" }
              );
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || "Échec");
              }
              toast.success(`"${deleteTarget.template.tool.name}" supprimé définitivement`);
              setDeleteTarget(null);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erreur");
            }
          }}
        />
      )}
    </div>
  );
}
