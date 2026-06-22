"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Package,
  Eye,
  EyeOff,
  ExternalLink,
  Search,
  X,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  LIFE_EVENT_CATEGORIES,
  getLifeEventCategory,
} from "@/lib/bundles/types";

export interface BundleRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  order: number;
  lifeEventCategory: string | null;
  showOnOnboarding: boolean;
  itemsCount: number;
  updatedAt: string;
}

interface Props {
  initialBundles: BundleRow[];
}

export function BundlesList({ initialBundles }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.documents");
  const [bundles, setBundles] = useState<BundleRow[]>(initialBundles);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<BundleRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bundles.filter((b) => {
      if (q) {
        const hay = `${b.name} ${b.slug} ${b.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryFilter !== "all") {
        if (categoryFilter === "__none__") {
          if (b.lifeEventCategory) return false;
        } else if (b.lifeEventCategory !== categoryFilter) {
          return false;
        }
      }
      if (statusFilter === "active" && !b.active) return false;
      if (statusFilter === "inactive" && b.active) return false;
      if (statusFilter === "onboarding" && !b.showOnOnboarding) return false;
      return true;
    });
  }, [bundles, search, categoryFilter, statusFilter]);

  async function toggleActive(b: BundleRow) {
    setBusy(b.id);
    try {
      const res = await fetch(`/api/documents/bundles/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !b.active }),
      });
      if (!res.ok) throw new Error(t("failed"));
      setBundles((prev) =>
        prev.map((x) => (x.id === b.id ? { ...x, active: !b.active } : x))
      );
      toast.success(b.active ? t("deactivated") : t("activated"));
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(b: BundleRow) {
    setBusy(b.id);
    try {
      const res = await fetch(`/api/documents/bundles/${b.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("failed"));
      const data = await res.json();
      if (data.softDeleted) {
        setBundles((prev) =>
          prev.map((x) => (x.id === b.id ? { ...x, active: false } : x))
        );
        toast.success(data.message || t("bundleDeactivated"));
      } else {
        setBundles((prev) => prev.filter((x) => x.id !== b.id));
        toast.success(t("deleted"));
      }
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(null);
      setDeleteTarget(null);
    }
  }

  function resetFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
  }

  const activeFilters =
    (search ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button render={<Link href="/admin/pdf" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t("back")}
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="w-7 h-7" />
            {t("bundlesTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("bundlesSubtitle", { count: bundles.length })}
          </p>
        </div>
        <Button render={<Link href="/admin/pdf/dossiers/new" />} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          {t("newBundle")}
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("bundlesSearchPlaceholder")}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
          <SelectTrigger className="h-9 w-full lg:w-56 text-sm">
            <SelectValue placeholder={t("allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            <SelectItem value="__none__">{t("noCategory")}</SelectItem>
            {LIFE_EVENT_CATEGORIES.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.emoji} {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="h-9 w-full lg:w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="active">{t("statusActivePlural")}</SelectItem>
            <SelectItem value="inactive">{t("statusInactivePlural")}</SelectItem>
            <SelectItem value="onboarding">{t("statusOnboarding")}</SelectItem>
          </SelectContent>
        </Select>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="w-3.5 h-3.5 mr-1" />
            {t("resetFilters", { count: activeFilters })}
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {t("shownCount", { count: filtered.length })}
        </span>
      </div>

      {/* Table */}
      {bundles.length === 0 ? (
        <div className="border border-dashed rounded-md py-16 text-center">
          <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{t("noBundleYet")}</p>
          <Button
            render={<Link href="/admin/pdf/dossiers/new" />}
            className="mt-3"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("createFirstBundle")}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed rounded-md py-12 text-center text-sm text-muted-foreground">
          {t("noBundleMatchesFilters")}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">{t("colBundle")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("colCategory")}</TableHead>
                <TableHead className="hidden lg:table-cell text-center">{t("colDocs")}</TableHead>
                <TableHead className="text-center">{t("colStatus")}</TableHead>
                <TableHead className="w-[1%] text-right">{t("colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => {
                const category = getLifeEventCategory(b.lifeEventCategory);
                return (
                  <TableRow
                    key={b.id}
                    className={!b.active ? "opacity-60" : ""}
                  >
                    <TableCell>
                      <Link
                        href={`/admin/pdf/dossiers/${b.id}`}
                        className="flex items-center gap-2 group min-w-0"
                      >
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center text-white flex-shrink-0"
                          style={{ backgroundColor: b.color }}
                        >
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate group-hover:underline">
                            {b.name}
                          </div>
                          <code className="text-[11px] text-muted-foreground">
                            /{b.slug}
                          </code>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {category ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          <span aria-hidden>{category.emoji}</span>
                          {category.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-center">
                      <span className="text-sm tabular-nums">
                        {b.itemsCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <Badge
                          variant={b.active ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {b.active ? t("statusActive") : t("statusInactive")}
                        </Badge>
                        {b.showOnOnboarding && (
                          <Badge variant="outline" className="text-[10px]">
                            {t("onboarding")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {b.active && (
                          <Button
                            render={
                              <Link
                                href={`/d/${b.slug}`}
                                target="_blank"
                              />
                            }
                            variant="ghost"
                            size="icon-sm"
                            title={t("citizenPreview")}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => toggleActive(b)}
                          disabled={busy === b.id}
                          title={b.active ? t("deactivate") : t("activate")}
                        >
                          {b.active ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          render={
                            <Link
                              href={`/admin/pdf/dossiers/${b.id}`}
                            />
                          }
                          variant="ghost"
                          size="icon-sm"
                          title={t("edit")}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteTarget(b)}
                          disabled={busy === b.id}
                          className="text-destructive"
                          title={t("delete")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteBundleTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteBundleDescription", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
