"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Plus, Loader2, Download } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SerializedBureau, BureauTypeCode } from "@/lib/bureaus/types";
import { dayLabelFr } from "@/lib/bureaus/types";
import { BureauRevisionsDialog } from "./bureaux/revisions-dialog";
import { BureauFormDialog } from "./bureaux/bureau-form-dialog";
import { BureauxFilters } from "./bureaux/bureaux-filters";
import { BureauxTable } from "./bureaux/bureaux-table";
import {
  IMPERSONATION_READ_ONLY_REASON,
  useImpersonationReadOnly,
} from "./use-impersonation-read-only";
import {
  type FormState,
  EMPTY_FORM,
  bureauToForm,
  formToPayload,
} from "./bureaux/form-state";

type Organisme = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  color: string;
  type: string;
};

export function BureausManager() {
  const readOnly = useImpersonationReadOnly();
  const [items, setItems] = useState<SerializedBureau[]>([]);
  const [organismes, setOrganismes] = useState<Organisme[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterType, setFilterType] = useState<BureauTypeCode | "all">("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("active");
  const [filterVerified, setFilterVerified] = useState<string>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedBureau | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<SerializedBureau | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [revisionsFor, setRevisionsFor] = useState<SerializedBureau | null>(null);

  // Charge les organismes pour le sélecteur du dialog d'édition.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents/organismes")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Organisme[] | unknown) => {
        if (cancelled || !Array.isArray(data)) return;
        setOrganismes(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (filterType !== "all") params.set("type", filterType);
      if (filterRegion !== "all") params.set("region", filterRegion);
      if (filterActive !== "all") params.set("active", filterActive);
      if (filterVerified !== "all") params.set("verified", filterVerified);
      params.set("limit", "200");
      try {
        const res = await fetch(`/api/admin/bureaux?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setItems(data.items ?? []);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        toast.error("Échec du chargement des bureaux");
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, filterType, filterRegion, filterActive, filterVerified, refreshKey]);

  function refresh() {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }

  function openCreate() {
    setEditing(null);
    const defaultOrg = organismes.find((o) => o.code === "cpas")?.id ?? organismes[0]?.id ?? "";
    setForm({ ...EMPTY_FORM, organismeId: defaultOrg });
    setFormOpen(true);
  }

  function openEdit(b: SerializedBureau) {
    setEditing(b);
    setForm(bureauToForm(b));
    setFormOpen(true);
  }

  async function submitForm() {
    if (!form.organismeId) {
      toast.error("Sélectionnez un organisme");
      return;
    }
    if (!form.name.trim() || !form.street.trim() || !form.postalCode.trim() || !form.city.trim()) {
      toast.error("Champs obligatoires : nom, rue, code postal, ville");
      return;
    }
    if (!/^\d{4}$/.test(form.postalCode.trim())) {
      toast.error("Code postal : 4 chiffres");
      return;
    }
    if ((form.type === "CPAS" || form.type === "COMMUNE") && !form.communeId) {
      toast.error("Une commune attitrée est requise pour CPAS/COMMUNE");
      return;
    }

    setSubmitting(true);
    try {
      const url = editing ? `/api/admin/bureaux/${editing.id}` : "/api/admin/bureaux";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Échec de la sauvegarde");
        if (data?.details) {
          for (const d of data.details) toast.error(`${d.field}: ${d.message}`);
        }
        return;
      }
      toast.success(editing ? "Bureau mis à jour" : "Bureau créé");
      setFormOpen(false);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/bureaux/${confirmDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Échec de la suppression");
        return;
      }
      toast.success("Bureau désactivé");
      setConfirmDelete(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
    } finally {
      setDeleting(false);
    }
  }

  function doExport() {
    const params = new URLSearchParams();
    if (filterType !== "all") params.set("type", filterType);
    if (filterActive !== "all" && filterActive !== "active")
      params.set("filter", filterActive);
    else params.set("filter", "active");
    window.location.href = `/api/admin/bureaux/export?${params.toString()}`;
  }

  async function toggleVerify(b: SerializedBureau) {
    const verb = b.verified ? "DELETE" : "POST";
    try {
      const res = await fetch(`/api/admin/bureaux/${b.id}/verify`, { method: verb });
      if (!res.ok) {
        toast.error("Échec");
        return;
      }
      toast.success(b.verified ? "Vérification retirée" : "Marqué vérifié");
      refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erreur");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>{items.length} bureau{items.length > 1 ? "x" : ""}</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => doExport()}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            {/* Import CSV admin retiré : on utilise les scripts/ pour les
                imports en masse, l'UI ligne par ligne n'était pas utilisée. */}
            {readOnly ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      // Span wrapper : un <Button disabled> ne déclenche pas
                      // les events souris → le tooltip ne s'ouvrirait pas.
                      <span tabIndex={0}>
                        <Button disabled>
                          <Plus className="mr-2 h-4 w-4" /> Nouveau bureau
                        </Button>
                      </span>
                    }
                  />
                  <TooltipContent>{IMPERSONATION_READ_ONLY_REASON}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Nouveau bureau
              </Button>
            )}
          </div>
        </div>

        <BureauxFilters
          search={search}
          onSearchChange={setSearch}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          filterRegion={filterRegion}
          onFilterRegionChange={setFilterRegion}
          filterActive={filterActive}
          onFilterActiveChange={setFilterActive}
          filterVerified={filterVerified}
          onFilterVerifiedChange={setFilterVerified}
        />
      </CardHeader>
      <CardContent>
        <BureauxTable
          items={items}
          loading={loading}
          onEdit={openEdit}
          onDelete={setConfirmDelete}
          onToggleVerify={toggleVerify}
          onShowRevisions={setRevisionsFor}
          readOnly={readOnly}
        />
      </CardContent>

      {/* Create/Edit Dialog — refactored */}
      <BureauFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        organismes={organismes}
        onSubmit={submitForm}
        submitting={submitting}
      />

      {/* Soft delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver ce bureau ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmDelete?.name}</strong> ne sera plus affiché côté public mais reste
              en base (soft delete). Vous pourrez le réactiver via le filtre &quot;Désactivés&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BureauRevisionsDialog
        bureau={revisionsFor}
        open={!!revisionsFor}
        onOpenChange={(o) => !o && setRevisionsFor(null)}
      />
    </Card>
  );
}

// Helper exporté éventuellement réutilisable.
export { dayLabelFr };
