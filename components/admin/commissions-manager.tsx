"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Plus,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarIcon,
} from "lucide-react";
import {
  COMMISSION_TYPES,
  COMMISSION_TYPE_LABELS,
  type CommissionType,
} from "@/lib/commissions";

type Commission = {
  id: string;
  code: string;
  numero: string;
  numeroOfficiel: string;
  codeOfficiel5: string;
  suffixeInterne: string;
  type: string;
  nom: string;
  label: string;
  searchText: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  code: string;
  numero: string;
  numeroOfficiel: string;
  codeOfficiel5: string;
  suffixeInterne: string;
  type: CommissionType;
  nom: string;
};

const PAGE_SIZE = 50;

const EMPTY_FORM: FormState = {
  code: "",
  numero: "",
  numeroOfficiel: "",
  codeOfficiel5: "",
  suffixeInterne: "00",
  type: "commission_paritaire",
  nom: "",
};

function badgeForType(type: string): string {
  switch (type) {
    case "commission_paritaire":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200";
    case "sous_commission_paritaire":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    case "sous_secteur_officieux_ou_interne":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function typeLabel(type: string): string {
  if (type in COMMISSION_TYPE_LABELS) {
    return COMMISSION_TYPE_LABELS[type as CommissionType];
  }
  return type;
}

export function CommissionsManager() {
  const [items, setItems] = useState<Commission[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CommissionType | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Commission | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Commission | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [lastUpdated, setLastUpdated] = useState("");
  const [lastUpdatedDraft, setLastUpdatedDraft] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/commissions/meta");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setLastUpdated(data.lastUpdated ?? "");
        setLastUpdatedDraft(data.lastUpdated ?? "");
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setSkip(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const params = new URLSearchParams();
      params.set("skip", String(skip));
      params.set("take", String(PAGE_SIZE));
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (typeFilter !== "ALL") params.set("type", typeFilter);

      try {
        const res = await fetch(`/api/admin/commissions?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        toast.error("Échec du chargement des commissions");
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, typeFilter, skip, refreshKey]);

  function refresh() {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }

  async function saveLastUpdated() {
    if (lastUpdatedDraft === lastUpdated) return;
    setSavingDate(true);
    try {
      const res = await fetch("/api/admin/commissions/meta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastUpdated: lastUpdatedDraft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Échec de la sauvegarde");
        return;
      }
      const data = await res.json();
      setLastUpdated(data.lastUpdated);
      setLastUpdatedDraft(data.lastUpdated);
      toast.success("Date de mise à jour enregistrée");
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
    } finally {
      setSavingDate(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;

  const stats = useMemo(() => {
    return {
      total,
    };
  }, [total]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(c: Commission) {
    setEditing(c);
    setForm({
      code: c.code,
      numero: c.numero,
      numeroOfficiel: c.numeroOfficiel,
      codeOfficiel5: c.codeOfficiel5,
      suffixeInterne: c.suffixeInterne,
      type: (c.type as CommissionType) ?? "commission_paritaire",
      nom: c.nom,
    });
    setFormOpen(true);
  }

  async function submitForm() {
    setSubmitting(true);
    try {
      const url = editing
        ? `/api/admin/commissions/${editing.id}`
        : "/api/admin/commissions";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data?.details) && data.details.length > 0) {
          toast.error(data.details.map((d: { message: string }) => d.message).join(" • "));
        } else {
          toast.error(data?.error ?? "Erreur lors de l'enregistrement");
        }
        return;
      }

      toast.success(editing ? "Commission mise à jour" : "Commission créée");
      setFormOpen(false);
      setEditing(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  async function performDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/commissions/${confirmDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Suppression impossible");
        return;
      }
      toast.success("Commission supprimée");
      setConfirmDelete(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
    } finally {
      setDeleting(false);
    }
  }

  const dateChanged = lastUpdatedDraft !== lastUpdated;

  return (
    <div className="space-y-6">
      {/* Date de mise à jour */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 flex-1 max-w-xs">
              <Label htmlFor="cp-last-updated" className="flex items-center gap-1.5">
                <CalendarIcon size={14} />
                Date de mise à jour (affichée sur le front)
              </Label>
              <Input
                id="cp-last-updated"
                type="date"
                value={lastUpdatedDraft}
                onChange={(e) => setLastUpdatedDraft(e.target.value)}
              />
            </div>
            <Button
              onClick={saveLastUpdated}
              disabled={savingDate || !dateChanged}
              variant={dateChanged ? "default" : "outline"}
            >
              {savingDate && <Loader2 className="animate-spin" size={16} />}
              Enregistrer la date
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par code, numéro ou nom…"
                  className="pl-9"
                />
              </div>
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v as CommissionType | "ALL");
                  setSkip(0);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les types</SelectItem>
                  {COMMISSION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {COMMISSION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCreate}>
              <Plus size={16} />
              Nouvelle commission
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Commissions paritaires</span>
            <span className="text-sm font-normal text-muted-foreground">
              {stats.total} entrée{stats.total > 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold w-[120px]">Code</TableHead>
                  <TableHead className="font-semibold w-[120px]">Numéro</TableHead>
                  <TableHead className="font-semibold w-[180px]">Type</TableHead>
                  <TableHead className="font-semibold">Nom</TableHead>
                  <TableHead className="font-semibold text-right w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Loader2 className="inline animate-spin text-muted-foreground" size={20} />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      Aucune commission ne correspond à ces filtres
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="font-mono">{c.numero}</TableCell>
                      <TableCell>
                        <Badge className={badgeForType(c.type)}>{typeLabel(c.type)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xl">
                        <div className="truncate" title={c.nom}>
                          {c.nom}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            onClick={() => openEdit(c)}
                            variant="ghost"
                            size="sm"
                            title="Modifier"
                            className="h-8 w-8 p-0"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            onClick={() => setConfirmDelete(c)}
                            variant="ghost"
                            size="sm"
                            title="Supprimer"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} / {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
                  disabled={skip === 0}
                >
                  <ChevronLeft size={16} /> Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSkip(skip + PAGE_SIZE)}
                  disabled={skip + PAGE_SIZE >= total}
                >
                  Suivant <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier la commission" : "Nouvelle commission"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Modifiez les champs puis enregistrez."
                : "Remplissez les champs pour créer une nouvelle commission paritaire."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cp-code">Code (7 chiffres) *</Label>
              <Input
                id="cp-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="1020401"
                maxLength={7}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-numero">Numéro *</Label>
              <Input
                id="cp-numero"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                placeholder="102.04.01"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-numeroOfficiel">Numéro officiel *</Label>
              <Input
                id="cp-numeroOfficiel"
                value={form.numeroOfficiel}
                onChange={(e) => setForm({ ...form, numeroOfficiel: e.target.value })}
                placeholder="102.04"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-codeOfficiel5">Code officiel (5 chiffres) *</Label>
              <Input
                id="cp-codeOfficiel5"
                value={form.codeOfficiel5}
                onChange={(e) => setForm({ ...form, codeOfficiel5: e.target.value })}
                placeholder="10204"
                maxLength={5}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-suffixe">Suffixe interne (2 chiffres) *</Label>
              <Input
                id="cp-suffixe"
                value={form.suffixeInterne}
                onChange={(e) => setForm({ ...form, suffixeInterne: e.target.value })}
                placeholder="00"
                maxLength={2}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-type">Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as CommissionType })}
              >
                <SelectTrigger id="cp-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMISSION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {COMMISSION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cp-nom">Nom *</Label>
              <Input
                id="cp-nom"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="CARRIERES DE PETIT GRANIT…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" size={16} />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette commission ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete
                ? `Vous êtes sur le point de supprimer ${confirmDelete.numero} - ${confirmDelete.nom}. Cette action est irréversible.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void performDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting && <Loader2 className="animate-spin" size={16} />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
