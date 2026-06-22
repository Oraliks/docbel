"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { TypeToConfirmField, typeToConfirmMatches } from "@/components/ui/type-to-confirm-field";
import {
  Pencil,
  Plus,
  Search,
  Trash2,
  Loader2,
  CalendarIcon,
} from "lucide-react";
import { COUNTRY_CODE_MAP, type U1Extra } from "@/lib/u1-institutions";
import { CountryFlag } from "@/components/docbel/country-flag";

type Institution = {
  id: string;
  country: string;
  countryCode: string | null;
  flag: string;
  organization: string;
  department: string | null;
  alternateName: string | null;
  addressLines: string[];
  postalAddress: string | null;
  phone: string | null;
  fax: string | null;
  website: string | null;
  emails: string[];
  extra: U1Extra;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  country: string;
  countryCode: string;
  organization: string;
  department: string;
  alternateName: string;
  addressLines: string;
  postalAddress: string;
  phone: string;
  fax: string;
  website: string;
  emails: string;
  extraJson: string;
};

const EMPTY_FORM: FormState = {
  country: "",
  countryCode: "",
  organization: "",
  department: "",
  alternateName: "",
  addressLines: "",
  postalAddress: "",
  phone: "",
  fax: "",
  website: "",
  emails: "",
  extraJson: "",
};

function institutionToForm(inst: Institution): FormState {
  return {
    country: inst.country,
    countryCode: inst.countryCode ?? "",
    organization: inst.organization,
    department: inst.department ?? "",
    alternateName: inst.alternateName ?? "",
    addressLines: inst.addressLines.join("\n"),
    postalAddress: inst.postalAddress ?? "",
    phone: inst.phone ?? "",
    fax: inst.fax ?? "",
    website: inst.website ?? "",
    emails: inst.emails.join(", "),
    extraJson: inst.extra ? JSON.stringify(inst.extra, null, 2) : "",
  };
}

function parseExtraJson(
  value: string,
  invalidJsonLabel: string
): { ok: true; extra: unknown } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, extra: null };
  try {
    return { ok: true, extra: JSON.parse(trimmed) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : invalidJsonLabel,
    };
  }
}

function formToPayload(
  form: FormState,
  labels: { invalidJson: string; extraJsonError: (error: string) => string }
):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string } {
  const extraResult = parseExtraJson(form.extraJson, labels.invalidJson);
  if (!extraResult.ok) return { ok: false, error: labels.extraJsonError(extraResult.error) };
  const fallbackCode = COUNTRY_CODE_MAP[form.country.trim()] ?? "";
  return {
    ok: true,
    data: {
      country: form.country.trim(),
      countryCode: form.countryCode.trim() || fallbackCode,
      organization: form.organization.trim(),
      department: form.department.trim() || null,
      alternateName: form.alternateName.trim() || null,
      addressLines: form.addressLines
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      postalAddress: form.postalAddress.trim() || null,
      phone: form.phone.trim() || null,
      fax: form.fax.trim() || null,
      website: form.website.trim() || null,
      emails: form.emails
        .split(/[,;\n]/)
        .map((e) => e.trim())
        .filter(Boolean),
      extra: extraResult.extra,
    },
  };
}

export function U1InstitutionsManager() {
  const t = useTranslations("admin.u1Institutions");
  const [items, setItems] = useState<Institution[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Institution | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Institution | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");

  const [lastUpdated, setLastUpdated] = useState("");
  const [lastUpdatedDraft, setLastUpdatedDraft] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/u1-institutions/meta");
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
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      try {
        const res = await fetch(`/api/admin/u1-institutions?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setItems(data.items ?? []);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        toast.error(t("loadError"));
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, refreshKey]);

  function refresh() {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }

  async function saveLastUpdated() {
    if (lastUpdatedDraft === lastUpdated) return;
    setSavingDate(true);
    try {
      const res = await fetch("/api/admin/u1-institutions/meta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastUpdated: lastUpdatedDraft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? t("saveError"));
        return;
      }
      const data = await res.json();
      setLastUpdated(data.lastUpdated);
      setLastUpdatedDraft(data.lastUpdated);
      toast.success(t("dateSaved"));
    } catch (err) {
      console.error(err);
      toast.error(t("networkError"));
    } finally {
      setSavingDate(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(inst: Institution) {
    setEditing(inst);
    setForm(institutionToForm(inst));
    setFormOpen(true);
  }

  async function submitForm() {
    const payload = formToPayload(form, {
      invalidJson: t("invalidJson"),
      extraJsonError: (error) => t("extraJsonError", { error }),
    });
    if (!payload.ok) {
      toast.error(payload.error);
      return;
    }
    setSubmitting(true);
    try {
      const url = editing
        ? `/api/admin/u1-institutions/${editing.id}`
        : "/api/admin/u1-institutions";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data?.details) && data.details.length > 0) {
          toast.error(data.details.map((d: { message: string }) => d.message).join(" • "));
        } else {
          toast.error(data?.error ?? t("saveRecordError"));
        }
        return;
      }
      toast.success(editing ? t("updateSuccess") : t("createSuccess"));
      setFormOpen(false);
      setEditing(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error(t("networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function performDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/u1-institutions/${confirmDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? t("deleteError"));
        return;
      }
      toast.success(t("deleteSuccess"));
      setConfirmDelete(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast.error(t("networkError"));
    } finally {
      setDeleting(false);
    }
  }

  const dateChanged = lastUpdatedDraft !== lastUpdated;
  const previewCode = useMemo(
    () => form.countryCode || COUNTRY_CODE_MAP[form.country.trim()] || null,
    [form.country, form.countryCode]
  );

  return (
    <div className="space-y-6">
      {/* Date de mise à jour */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 flex-1 max-w-xs">
              <Label htmlFor="u1-last-updated" className="flex items-center gap-1.5">
                <CalendarIcon size={14} />
                {t("lastUpdatedLabel")}
              </Label>
              <Input
                id="u1-last-updated"
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
              {t("saveDate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <Button onClick={openCreate}>
              <Plus size={16} />
              {t("newInstitution")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t("tableTitle")}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {t("entryCount", { count: items.length })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold w-[200px]">{t("columnCountry")}</TableHead>
                  <TableHead className="font-semibold">{t("columnOrganization")}</TableHead>
                  <TableHead className="font-semibold w-[200px]">{t("columnWebsite")}</TableHead>
                  <TableHead className="font-semibold text-right w-[120px]">{t("columnActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12">
                      <Loader2 className="inline animate-spin text-muted-foreground" size={20} />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      {t("emptyState")}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((inst) => (
                    <TableRow key={inst.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <span className="inline-flex items-center gap-2.5">
                          <CountryFlag
                            code={inst.countryCode}
                            country={inst.country}
                            size={22}
                          />
                          <span className="font-medium">{inst.country}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{inst.organization}</div>
                        {inst.department && (
                          <div className="text-xs text-muted-foreground">{inst.department}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {inst.website ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            onClick={() => openEdit(inst)}
                            variant="ghost"
                            size="sm"
                            title={t("edit")}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            onClick={() => {
                              setConfirmDelete(inst);
                              setDeleteTyped("");
                            }}
                            variant="ghost"
                            size="sm"
                            title={t("delete")}
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
        </CardContent>
      </Card>

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription>
              {editing ? t("editDescription") : t("createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="u1-country">{t("fieldCountry")}</Label>
              <Input
                id="u1-country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="Italie"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u1-countryCode" className="flex items-center gap-2">
                <span>{t("fieldCountryCode")}</span>
                {previewCode && (
                  <CountryFlag code={previewCode} country={form.country} size={18} />
                )}
              </Label>
              <Input
                id="u1-countryCode"
                value={form.countryCode}
                onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}
                placeholder={t("fieldCountryCodePlaceholder")}
                maxLength={2}
                className="uppercase"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="u1-organization">{t("fieldOrganization")}</Label>
              <Input
                id="u1-organization"
                value={form.organization}
                onChange={(e) => setForm({ ...form, organization: e.target.value })}
                placeholder="Istituto Nazionale Previdenza Sociale"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u1-department">{t("fieldDepartment")}</Label>
              <Input
                id="u1-department"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Servizio Rapporti Internazionali"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u1-alternateName">{t("fieldAlternateName")}</Label>
              <Input
                id="u1-alternateName"
                value={form.alternateName}
                onChange={(e) => setForm({ ...form, alternateName: e.target.value })}
                placeholder="Eesti Töötukassa"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="u1-address">{t("fieldAddress")}</Label>
              <Textarea
                id="u1-address"
                rows={3}
                value={form.addressLines}
                onChange={(e) => setForm({ ...form, addressLines: e.target.value })}
                placeholder={"Via Ciro il Grande 21\n00144 ROMA"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u1-postal">{t("fieldPostalAddress")}</Label>
              <Input
                id="u1-postal"
                value={form.postalAddress}
                onChange={(e) => setForm({ ...form, postalAddress: e.target.value })}
                placeholder={t("fieldPostalAddressPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u1-phone">{t("fieldPhone")}</Label>
              <Input
                id="u1-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="00 39 396 59051"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u1-fax">{t("fieldFax")}</Label>
              <Input
                id="u1-fax"
                value={form.fax}
                onChange={(e) => setForm({ ...form, fax: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u1-website">{t("fieldWebsite")}</Label>
              <Input
                id="u1-website"
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://www.inps.it"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="u1-emails">{t("fieldEmails")}</Label>
              <Input
                id="u1-emails"
                value={form.emails}
                onChange={(e) => setForm({ ...form, emails: e.target.value })}
                placeholder="contact@example.com, info@example.com"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="u1-extra">
                {t("fieldExtra")}
              </Label>
              <Textarea
                id="u1-extra"
                rows={4}
                value={form.extraJson}
                onChange={(e) => setForm({ ...form, extraJson: e.target.value })}
                placeholder='{"visitorAddress": ["…"], "additionalServices": [{…}]}'
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {t("fieldExtraHint")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              {t("cancel")}
            </Button>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" size={16} />}
              {editing ? t("save") : t("create")}
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
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete
                ? t("deleteConfirmDescription", {
                    country: confirmDelete.country,
                    organization: confirmDelete.organization,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmDelete ? (
            <TypeToConfirmField
              requireText={confirmDelete.country}
              value={deleteTyped}
              onChange={setDeleteTyped}
              disabled={deleting}
            />
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                void performDelete();
              }}
              disabled={deleting || !typeToConfirmMatches(deleteTyped, confirmDelete?.country ?? "")}
            >
              {deleting && <Loader2 className="animate-spin" size={16} />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
