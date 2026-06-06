"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingField, BookingFieldType, BookingFieldRole } from "@/lib/booking/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  active: boolean;
}

interface TenantDetail {
  id: string;
  name: string;
  category: string;
  requireApproval: boolean;
  autoApproveAfterHours: number | null;
  dedupeField: string | null;
  dedupeWindowDays: number | null;
  brandColor: string | null;
  emailFromName: string | null;
  formFields: BookingField[];
  active: boolean;
}

const FIELD_TYPES: { value: BookingFieldType; label: string }[] = [
  { value: "text", label: "Texte" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Téléphone" },
  { value: "textarea", label: "Zone de texte" },
  { value: "select", label: "Liste déroulante" },
  { value: "checkbox", label: "Case à cocher" },
  { value: "date", label: "Date" },
  { value: "nrn", label: "N° registre national" },
  { value: "postal_code", label: "Code postal" },
];

const FIELD_ROLES: { value: BookingFieldRole; label: string }[] = [
  { value: "name", label: "Nom" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Téléphone" },
  { value: "nrn", label: "NRN" },
  { value: "postal_code", label: "Code postal" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ConfigurationClientProps {
  tenantId: string;
}

export function ConfigurationClient({ tenantId }: ConfigurationClientProps) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/booking/partner/tenants/${tenantId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur chargement");
        return;
      }
      setTenant(data.tenant);
      setLocations(data.locations ?? []);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (!tenant) return null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <h2 className="text-xl font-semibold">Configuration</h2>

      {/* Section A: Parameters */}
      <ParamsSection
        tenantId={tenantId}
        tenant={tenant}
        onSaved={loadData}
      />

      {/* Section B: Form fields */}
      <FormFieldsSection
        tenantId={tenantId}
        formFields={tenant.formFields}
        onSaved={loadData}
      />

      {/* Section C: Locations */}
      <LocationsSection
        tenantId={tenantId}
        locations={locations}
        onSaved={loadData}
      />
    </div>
  );
}

// ─── Section A: Parameters ────────────────────────────────────────────────────

function ParamsSection({
  tenantId,
  tenant,
  onSaved,
}: {
  tenantId: string;
  tenant: TenantDetail;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    requireApproval: tenant.requireApproval,
    autoApproveAfterHours: String(tenant.autoApproveAfterHours ?? ""),
    dedupeField: tenant.dedupeField ?? "none",
    dedupeWindowDays: String(tenant.dedupeWindowDays ?? ""),
    brandColor: tenant.brandColor ?? "#7C3AED",
    emailFromName: tenant.emailFromName ?? "",
    active: tenant.active,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/booking/partner/tenants/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requireApproval: form.requireApproval,
        autoApproveAfterHours: form.autoApproveAfterHours
          ? Number(form.autoApproveAfterHours)
          : null,
        dedupeField: form.dedupeField === "none" ? null : form.dedupeField,
        dedupeWindowDays: form.dedupeWindowDays
          ? Number(form.dedupeWindowDays)
          : null,
        brandColor: form.brandColor || null,
        emailFromName: form.emailFromName || null,
        active: form.active,
      }),
    });
    setSaving(false);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Erreur");
      return;
    }
    toast.success("Paramètres enregistrés");
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Paramètres généraux</CardTitle>
        <CardDescription>
          Approbation, déduplication et identité visuelle du guichet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* requireApproval */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Approbation manuelle</Label>
            <p className="text-xs text-muted-foreground">
              Les réservations doivent être validées par l&apos;équipe.
            </p>
          </div>
          <Switch
            checked={form.requireApproval}
            onCheckedChange={(v) => setForm((s) => ({ ...s, requireApproval: v }))}
          />
        </div>

        {/* autoApproveAfterHours */}
        {form.requireApproval && (
          <div className="flex flex-col gap-1.5">
            <Label>Auto-approuver après (heures)</Label>
            <Input
              type="number"
              min={0}
              placeholder="ex: 24 (laisser vide pour désactiver)"
              value={form.autoApproveAfterHours}
              onChange={(e) =>
                setForm((s) => ({ ...s, autoApproveAfterHours: e.target.value }))
              }
              className="max-w-xs"
            />
          </div>
        )}

        <Separator />

        {/* dedupeField */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Champ de déduplication</Label>
            <Select
              value={form.dedupeField}
              onValueChange={(v) => setForm((s) => ({ ...s, dedupeField: v ?? "email" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="name">Nom</SelectItem>
                <SelectItem value="nrn">NRN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.dedupeField !== "none" && (
            <div className="flex flex-col gap-1.5">
              <Label>Fenêtre (jours)</Label>
              <Input
                type="number"
                min={1}
                value={form.dedupeWindowDays}
                onChange={(e) =>
                  setForm((s) => ({ ...s, dedupeWindowDays: e.target.value }))
                }
                placeholder="ex: 30"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* brandColor */}
        <div className="flex flex-col gap-1.5">
          <Label>Couleur de marque (hex)</Label>
          <div className="flex items-center gap-3 max-w-xs">
            <input
              type="color"
              value={form.brandColor}
              onChange={(e) =>
                setForm((s) => ({ ...s, brandColor: e.target.value }))
              }
              className="size-10 rounded-lg border cursor-pointer p-0.5"
            />
            <Input
              value={form.brandColor}
              onChange={(e) =>
                setForm((s) => ({ ...s, brandColor: e.target.value }))
              }
              placeholder="#7C3AED"
              className="flex-1"
            />
          </div>
        </div>

        {/* emailFromName */}
        <div className="flex flex-col gap-1.5">
          <Label>Nom d&apos;expéditeur email</Label>
          <Input
            value={form.emailFromName}
            onChange={(e) =>
              setForm((s) => ({ ...s, emailFromName: e.target.value }))
            }
            placeholder="ex: FGTB Bruxelles"
            className="max-w-xs"
          />
        </div>

        <Separator />

        {/* active */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Guichet actif</Label>
            <p className="text-xs text-muted-foreground">
              Désactivez pour masquer ce guichet aux citoyens.
            </p>
          </div>
          <Switch
            checked={form.active}
            onCheckedChange={(v) => setForm((s) => ({ ...s, active: v }))}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-fit">
          {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Section B: Form fields ───────────────────────────────────────────────────

type FieldDialogState = {
  open: boolean;
  editingIdx: number | null;
  form: {
    key: string;
    label: string;
    type: BookingFieldType;
    required: boolean;
    role: BookingFieldRole | "";
    options: string;
  };
  saving: boolean;
};

function FormFieldsSection({
  tenantId,
  formFields,
  onSaved,
}: {
  tenantId: string;
  formFields: BookingField[];
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<BookingField[]>(formFields);
  const [saving, setSaving] = useState(false);

  const [dlg, setDlg] = useState<FieldDialogState>({
    open: false,
    editingIdx: null,
    form: {
      key: "",
      label: "",
      type: "text",
      required: false,
      role: "",
      options: "",
    },
    saving: false,
  });

  function openAdd() {
    setDlg({
      open: true,
      editingIdx: null,
      form: { key: "", label: "", type: "text", required: false, role: "", options: "" },
      saving: false,
    });
  }

  function openEdit(idx: number) {
    const f = fields[idx];
    setDlg({
      open: true,
      editingIdx: idx,
      form: {
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required ?? false,
        role: f.role ?? "",
        options: f.options?.join("\n") ?? "",
      },
      saving: false,
    });
  }

  function setDlgField<K extends keyof FieldDialogState["form"]>(
    key: K,
    value: FieldDialogState["form"][K]
  ) {
    setDlg((s) => ({ ...s, form: { ...s.form, [key]: value } }));
  }

  function handleDialogSave() {
    const { form, editingIdx } = dlg;
    if (!form.label.trim()) {
      toast.error("Le libellé est obligatoire");
      return;
    }
    const key =
      form.key ||
      slugify(form.label) ||
      `field_${Date.now()}`;

    const newField: BookingField = {
      key,
      label: form.label.trim(),
      type: form.type,
      required: form.required || undefined,
      role: form.role || undefined,
      options:
        form.type === "select" && form.options
          ? form.options
              .split("\n")
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
    };

    if (editingIdx !== null) {
      setFields((prev) => prev.map((f, i) => (i === editingIdx ? newField : f)));
    } else {
      setFields((prev) => [...prev, newField]);
    }
    setDlg((s) => ({ ...s, open: false }));
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveField(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= fields.length) return;
    const arr = [...fields];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setFields(arr);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/booking/partner/tenants/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formFields: fields }),
    });
    setSaving(false);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Erreur");
      return;
    }
    toast.success("Formulaire enregistré");
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Formulaire citoyen</CardTitle>
        <CardDescription>
          Champs demandés lors de la prise de rendez-vous en ligne.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun champ configuré.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {fields.map((f, idx) => (
              <div
                key={f.key + idx}
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
              >
                <GripVertical className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                    {f.required && " · obligatoire"}
                    {f.role && ` · rôle: ${f.role}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={idx === 0}
                    onClick={() => moveField(idx, -1)}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={idx === fields.length - 1}
                    onClick={() => moveField(idx, 1)}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(idx)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeField(idx)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={openAdd}>
            <Plus className="size-4" /> Ajouter un champ
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer le formulaire"}
          </Button>
        </div>
      </CardContent>

      {/* Field dialog */}
      <Dialog
        open={dlg.open}
        onOpenChange={(o) => setDlg((s) => ({ ...s, open: o }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dlg.editingIdx !== null ? "Modifier le champ" : "Nouveau champ"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Libellé <span className="text-destructive">*</span></Label>
              <Input
                value={dlg.form.label}
                onChange={(e) => setDlgField("label", e.target.value)}
                placeholder="ex: Numéro de téléphone"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Clé technique</Label>
              <Input
                value={dlg.form.key}
                onChange={(e) => setDlgField("key", e.target.value)}
                placeholder={`auto: ${slugify(dlg.form.label) || "champ"}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Type</Label>
                <Select
                  value={dlg.form.type}
                  onValueChange={(v) => setDlgField("type", v as BookingFieldType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Rôle sémantique</Label>
                <Select
                  value={dlg.form.role || "_none"}
                  onValueChange={(v) =>
                    setDlgField("role", v === "_none" ? "" : (v as BookingFieldRole))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucun</SelectItem>
                    {FIELD_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {dlg.form.type === "select" && (
              <div className="flex flex-col gap-1.5">
                <Label>Options (une par ligne)</Label>
                <textarea
                  className="min-h-[80px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm resize-y"
                  value={dlg.form.options}
                  onChange={(e) => setDlgField("options", e.target.value)}
                  placeholder={"Option A\nOption B\nOption C"}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="field-required"
                checked={dlg.form.required}
                onCheckedChange={(v) => setDlgField("required", !!v)}
              />
              <Label htmlFor="field-required" className="cursor-pointer">
                Champ obligatoire
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDlg((s) => ({ ...s, open: false }))}
            >
              Annuler
            </Button>
            <Button onClick={handleDialogSave}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Section C: Locations ─────────────────────────────────────────────────────

interface LocationForm {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  lat: string;
  lng: string;
  active: boolean;
}

const EMPTY_LOC: LocationForm = {
  name: "",
  street: "",
  postalCode: "",
  city: "",
  lat: "",
  lng: "",
  active: true,
};

function LocationsSection({
  tenantId,
  locations,
  onSaved,
}: {
  tenantId: string;
  locations: Location[];
  onSaved: () => void;
}) {
  const [dlg, setDlg] = useState<{
    open: boolean;
    editing: Location | null;
    form: LocationForm;
    saving: boolean;
  }>({ open: false, editing: null, form: EMPTY_LOC, saving: false });

  function openAdd() {
    setDlg({ open: true, editing: null, form: EMPTY_LOC, saving: false });
  }

  function openEdit(l: Location) {
    setDlg({
      open: true,
      editing: l,
      form: {
        name: l.name,
        street: l.street ?? "",
        postalCode: l.postalCode ?? "",
        city: l.city ?? "",
        lat: l.lat != null ? String(l.lat) : "",
        lng: l.lng != null ? String(l.lng) : "",
        active: l.active,
      },
      saving: false,
    });
  }

  function setField<K extends keyof LocationForm>(key: K, value: LocationForm[K]) {
    setDlg((s) => ({ ...s, form: { ...s.form, [key]: value } }));
  }

  async function handleSave() {
    const { form, editing } = dlg;
    if (!form.name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    const payload = {
      name: form.name.trim(),
      street: form.street || undefined,
      postalCode: form.postalCode || undefined,
      city: form.city || undefined,
      lat: form.lat ? Number(form.lat) : undefined,
      lng: form.lng ? Number(form.lng) : undefined,
      active: form.active,
    };
    setDlg((s) => ({ ...s, saving: true }));
    const url = editing
      ? `/api/booking/partner/tenants/${tenantId}/locations/${editing.id}`
      : `/api/booking/partner/tenants/${tenantId}/locations`;
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setDlg((s) => ({ ...s, saving: false }));
    if (!res.ok) {
      toast.error(data.error ?? "Erreur");
      return;
    }
    toast.success(editing ? "Antenne mise à jour" : "Antenne ajoutée");
    setDlg((s) => ({ ...s, open: false }));
    onSaved();
  }

  async function handleDelete(locId: string) {
    const res = await fetch(
      `/api/booking/partner/tenants/${tenantId}/locations/${locId}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(
        res.status === 409
          ? "Impossible : cette antenne a des rendez-vous"
          : (data.error ?? "Erreur")
      );
      return;
    }
    toast.success("Antenne supprimée");
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Antennes</CardTitle>
        <CardDescription>
          Chaque antenne est un lieu physique où les citoyens peuvent prendre
          rendez-vous. Le code postal et les coordonnées GPS servent au routage
          automatique commune→antenne.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune antenne.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {locations.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {l.name}
                    {!l.active && (
                      <span className="ml-2 text-xs text-destructive">(inactif)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[l.street, l.postalCode, l.city].filter(Boolean).join(", ") || "—"}
                    {l.lat && l.lng && ` · GPS: ${l.lat}, ${l.lng}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(l)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(l.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" onClick={openAdd} className="w-fit">
          <Plus className="size-4" /> Ajouter une antenne
        </Button>
      </CardContent>

      {/* Location dialog */}
      <Dialog
        open={dlg.open}
        onOpenChange={(o) =>
          !dlg.saving && setDlg((s) => ({ ...s, open: o }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dlg.editing ? "Modifier l'antenne" : "Nouvelle antenne"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input
                value={dlg.form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Rue</Label>
              <Input
                value={dlg.form.street}
                onChange={(e) => setField("street", e.target.value)}
                placeholder="ex: Rue de la Loi 200"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Code postal</Label>
                <Input
                  value={dlg.form.postalCode}
                  onChange={(e) => setField("postalCode", e.target.value)}
                  placeholder="1000"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Ville</Label>
                <Input
                  value={dlg.form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="Bruxelles"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={dlg.form.lat}
                  onChange={(e) => setField("lat", e.target.value)}
                  placeholder="50.8503"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={dlg.form.lng}
                  onChange={(e) => setField("lng", e.target.value)}
                  placeholder="4.3517"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={dlg.form.active}
                onCheckedChange={(v) => setField("active", v)}
              />
              <Label>Antenne active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDlg((s) => ({ ...s, open: false }))}
              disabled={dlg.saving}
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={dlg.saving}>
              {dlg.saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
