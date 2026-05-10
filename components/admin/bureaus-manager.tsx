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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Pencil, Plus, Search, Trash2, Loader2, Upload, MapPin, Download, ShieldCheck, ShieldAlert, History, AlertTriangle } from "lucide-react";
import type { SerializedBureau, BureauTypeCode } from "@/lib/bureaus/types";
import { dayLabelFr } from "@/lib/bureaus/types";
import { HoursEditor } from "./bureaus/hours-editor";
import { CommuneCombobox } from "./bureaus/commune-combobox";
import { ServicesChips } from "./bureaus/services-chips";
import { ImportCsvDialog } from "./bureaus/import-csv-dialog";
import { BureauRevisionsDialog } from "./bureaus/revisions-dialog";

type Organisme = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  color: string;
  type: string;
};

const TYPE_LABELS: Record<BureauTypeCode, string> = {
  CPAS: "CPAS",
  COMMUNE: "Commune",
  ONEM: "ONEM",
  SYNDICAT: "Syndicat",
  PERMANENCE: "Permanence",
  AUTRE: "Autre",
};

const TYPE_COLORS: Record<BureauTypeCode, string> = {
  CPAS: "#5E3A8E",
  COMMUNE: "#2E7D32",
  ONEM: "#0050A0",
  SYNDICAT: "#E30613",
  PERMANENCE: "#D4A017",
  AUTRE: "#6B7280",
};

type FormState = {
  organismeId: string;
  type: BureauTypeCode;
  name: string;
  nameNl: string;
  nameDe: string;
  street: string;
  streetNum: string;
  postalCode: string;
  city: string;
  lat: string;
  lng: string;
  communeId: string;
  phone: string;
  email: string;
  website: string;
  appointmentUrl: string;
  hours: ReturnType<typeof emptyHours>;
  hoursNotes: string;
  services: string[];
  active: boolean;
  notes: string;
};

function emptyHours() {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, slots: [] as { open: string; close: string }[] }));
}

const EMPTY_FORM: FormState = {
  organismeId: "",
  type: "CPAS",
  name: "",
  nameNl: "",
  nameDe: "",
  street: "",
  streetNum: "",
  postalCode: "",
  city: "",
  lat: "",
  lng: "",
  communeId: "",
  phone: "",
  email: "",
  website: "",
  appointmentUrl: "",
  hours: emptyHours(),
  hoursNotes: "",
  services: [],
  active: true,
  notes: "",
};

function bureauToForm(b: SerializedBureau): FormState {
  // Merge hours seedés avec les 7 jours pour rendre l'édition exhaustive
  const hours = emptyHours();
  for (const h of b.hours) {
    const idx = hours.findIndex((x) => x.day === h.day);
    if (idx >= 0) hours[idx] = { day: h.day, slots: h.slots };
  }
  return {
    organismeId: b.organismeId,
    type: b.type,
    name: b.name,
    nameNl: b.nameNl ?? "",
    nameDe: b.nameDe ?? "",
    street: b.street,
    streetNum: b.streetNum ?? "",
    postalCode: b.postalCode,
    city: b.city,
    lat: b.lat !== null ? String(b.lat) : "",
    lng: b.lng !== null ? String(b.lng) : "",
    communeId: b.communeId ?? "",
    phone: b.phone ?? "",
    email: b.email ?? "",
    website: b.website ?? "",
    appointmentUrl: b.appointmentUrl ?? "",
    hours,
    hoursNotes: b.hoursNotes ?? "",
    services: b.services,
    active: b.active,
    notes: b.notes ?? "",
  };
}

function formToPayload(form: FormState) {
  return {
    organismeId: form.organismeId,
    type: form.type,
    name: form.name.trim(),
    nameNl: form.nameNl.trim() || null,
    nameDe: form.nameDe.trim() || null,
    street: form.street.trim(),
    streetNum: form.streetNum.trim() || null,
    postalCode: form.postalCode.trim(),
    city: form.city.trim(),
    lat: form.lat.trim() ? Number(form.lat) : null,
    lng: form.lng.trim() ? Number(form.lng) : null,
    communeId: form.communeId || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    website: form.website.trim() || null,
    appointmentUrl: form.appointmentUrl.trim() || null,
    hours: form.hours,
    hoursNotes: form.hoursNotes.trim() || null,
    services: form.services,
    active: form.active,
    notes: form.notes.trim() || null,
  };
}

export function BureausManager() {
  const [items, setItems] = useState<SerializedBureau[]>([]);
  const [organismes, setOrganismes] = useState<Organisme[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterType, setFilterType] = useState<BureauTypeCode | "all">("all");
  const [filterOrg, setFilterOrg] = useState<string>("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("active");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedBureau | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<SerializedBureau | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [revisionsFor, setRevisionsFor] = useState<SerializedBureau | null>(null);
  const [filterVerified, setFilterVerified] = useState<string>("all");

  // Charge les organismes pour le sélecteur
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
      if (filterOrg !== "all") params.set("organismeId", filterOrg);
      if (filterRegion !== "all") params.set("region", filterRegion);
      if (filterActive !== "all") params.set("active", filterActive);
      if (filterVerified !== "all") params.set("verified", filterVerified);
      params.set("limit", "200");
      try {
        const res = await fetch(`/api/admin/bureaus?${params.toString()}`);
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
  }, [debouncedSearch, filterType, filterOrg, filterRegion, filterActive, filterVerified, refreshKey]);

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
      const url = editing ? `/api/admin/bureaus/${editing.id}` : "/api/admin/bureaus";
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
      const res = await fetch(`/api/admin/bureaus/${confirmDelete.id}`, { method: "DELETE" });
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
    window.location.href = `/api/admin/bureaus/export?${params.toString()}`;
  }

  async function toggleVerify(b: SerializedBureau) {
    const verb = b.verified ? "DELETE" : "POST";
    try {
      const res = await fetch(`/api/admin/bureaus/${b.id}/verify`, { method: verb });
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

  async function geocode() {
    const addr = `${form.street} ${form.streetNum}, ${form.postalCode} ${form.city}, Belgique`.trim();
    if (!addr || addr === ", , Belgique") {
      toast.error("Renseignez d'abord rue et ville");
      return;
    }
    toast.info("Géocodage via OpenStreetMap...");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr)}`,
        { headers: { "Accept-Language": "fr,en" } }
      );
      if (!res.ok) throw new Error("Échec");
      const j = await res.json();
      if (!Array.isArray(j) || j.length === 0) {
        toast.error("Adresse introuvable");
        return;
      }
      const lat = Number(j[0].lat);
      const lng = Number(j[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
        toast.success("Coordonnées récupérées");
      }
    } catch (err) {
      console.error(err);
      toast.error("Géocodage indisponible");
    }
  }

  const orgsById = useMemo(() => new Map(organismes.map((o) => [o.id, o])), [organismes]);

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
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau bureau
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-5 mt-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Recherche : nom, ville, rue, CP..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType((v ?? "all") as BureauTypeCode | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {(Object.keys(TYPE_LABELS) as BureauTypeCode[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterRegion} onValueChange={(v) => setFilterRegion(v ?? "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Région" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes régions</SelectItem>
              <SelectItem value="brussels">Bruxelles</SelectItem>
              <SelectItem value="wallonia">Wallonie</SelectItem>
              <SelectItem value="flanders">Flandre</SelectItem>
              <SelectItem value="germanophone">Communauté germanophone</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterActive} onValueChange={(v) => setFilterActive(v ?? "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="false">Désactivés</SelectItem>
              <SelectItem value="all">Tous</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
          <Select value={filterVerified} onValueChange={(v) => setFilterVerified(v ?? "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Vérification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes vérifications</SelectItem>
              <SelectItem value="true">Vérifiés</SelectItem>
              <SelectItem value="false">Non vérifiés</SelectItem>
              <SelectItem value="stale">À revérifier (+6 mois ou jamais)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Aucun bureau trouvé.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Commune</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Vérif.</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="font-medium">{b.name}</div>
                    {b.organismeName && (
                      <div className="text-xs text-muted-foreground">{b.organismeName}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      style={{
                        backgroundColor: TYPE_COLORS[b.type] + "20",
                        color: TYPE_COLORS[b.type],
                        borderColor: TYPE_COLORS[b.type] + "40",
                      }}
                    >
                      {TYPE_LABELS[b.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {b.postalCode} {b.city}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.street}
                      {b.streetNum ? ` ${b.streetNum}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    {b.communeName ? (
                      <span className="text-sm">{b.communeName}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {b.active ? (
                      <Badge variant="outline" className="border-green-500 text-green-700">
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-gray-400 text-gray-500">
                        Désactivé
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <VerifyBadge bureau={b} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleVerify(b)}
                        title={b.verified ? "Retirer la vérification" : "Marquer vérifié"}
                      >
                        {b.verified ? (
                          <ShieldCheck className="h-4 w-4 text-green-600" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRevisionsFor(b)}
                        title="Historique"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)} title="Modifier">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(b)} title="Désactiver">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Modifier — ${editing.name}` : "Nouveau bureau"}</DialogTitle>
            <DialogDescription>
              CPAS et Communes nécessitent une commune attitrée. ONEM = mappé via la matrice des
              compétences territoriales.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <div>
                <Label>Type *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: (v ?? "AUTRE") as BureauTypeCode }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as BureauTypeCode[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Organisme *</Label>
                <Select
                  value={form.organismeId}
                  onValueChange={(v) => setForm((f) => ({ ...f, organismeId: v ?? "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organismes.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.shortName ?? o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="col-span-2">
              <Label>Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="CPAS de Saint-Gilles"
              />
            </div>

            <div>
              <Label>Nom NL</Label>
              <Input
                value={form.nameNl}
                onChange={(e) => setForm((f) => ({ ...f, nameNl: e.target.value }))}
              />
            </div>
            <div>
              <Label>Nom DE</Label>
              <Input
                value={form.nameDe}
                onChange={(e) => setForm((f) => ({ ...f, nameDe: e.target.value }))}
              />
            </div>

            <div className="col-span-2 grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label>Rue *</Label>
                <Input
                  value={form.street}
                  onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                />
              </div>
              <div>
                <Label>N°</Label>
                <Input
                  value={form.streetNum}
                  onChange={(e) => setForm((f) => ({ ...f, streetNum: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>CP *</Label>
                <Input
                  value={form.postalCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, postalCode: e.target.value.replace(/\D/g, "").slice(0, 4) }))
                  }
                  placeholder="1000"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <Label>Ville *</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <Label>Commune attitrée {form.type === "CPAS" || form.type === "COMMUNE" ? "*" : ""}</Label>
              <CommuneCombobox value={form.communeId} onChange={(v) => setForm((f) => ({ ...f, communeId: v }))} />
            </div>

            <div className="col-span-2 grid grid-cols-3 gap-2 items-end">
              <div>
                <Label>Latitude</Label>
                <Input
                  value={form.lat}
                  onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                  placeholder="50.85"
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  value={form.lng}
                  onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                  placeholder="4.35"
                />
              </div>
              <Button type="button" variant="outline" onClick={geocode}>
                <MapPin className="mr-2 h-4 w-4" /> Géocoder
              </Button>
            </div>

            <div>
              <Label>Téléphone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Site web</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>URL prise de RDV</Label>
              <Input
                value={form.appointmentUrl}
                onChange={(e) => setForm((f) => ({ ...f, appointmentUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="col-span-2">
              <Label>Horaires</Label>
              <HoursEditor value={form.hours} onChange={(h) => setForm((f) => ({ ...f, hours: h }))} />
            </div>

            <div className="col-span-2">
              <Label>Note sur les horaires</Label>
              <Input
                value={form.hoursNotes}
                onChange={(e) => setForm((f) => ({ ...f, hoursNotes: e.target.value }))}
                placeholder="Permanence sociale uniquement le mercredi matin"
              />
            </div>

            <div className="col-span-2">
              <Label>Services proposés</Label>
              <ServicesChips value={form.services} onChange={(s) => setForm((f) => ({ ...f, services: s }))} />
            </div>

            <div className="col-span-2">
              <Label>Notes internes (admin)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, active: v }))}
              />
              <Label>Bureau actif (visible côté public)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <ImportCsvDialog open={importOpen} onOpenChange={setImportOpen} onImported={refresh} organismes={organismes} />

      <BureauRevisionsDialog
        bureau={revisionsFor}
        open={!!revisionsFor}
        onOpenChange={(o) => !o && setRevisionsFor(null)}
      />
    </Card>
  );
}

function VerifyBadge({ bureau }: { bureau: SerializedBureau }) {
  if (!bureau.verified) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const lastVerified = bureau.lastVerifiedAt ? new Date(bureau.lastVerifiedAt) : null;
  if (!lastVerified) {
    return (
      <Badge variant="outline" className="border-green-500 text-green-700">
        <ShieldCheck className="h-3 w-3 mr-1" /> Vérifié
      </Badge>
    );
  }
  const ageMs = Date.now() - lastVerified.getTime();
  const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000);
  const isStale = ageMonths > 6;
  return (
    <div className="flex flex-col gap-0.5">
      <Badge
        variant="outline"
        className={
          isStale ? "border-amber-500 text-amber-700" : "border-green-500 text-green-700"
        }
      >
        {isStale ? (
          <AlertTriangle className="h-3 w-3 mr-1" />
        ) : (
          <ShieldCheck className="h-3 w-3 mr-1" />
        )}
        {isStale ? "À revérifier" : "Vérifié"}
      </Badge>
      <span className="text-[10px] text-muted-foreground">
        {Math.round(ageMonths)} mois
      </span>
    </div>
  );
}

// Helper exporté éventuellement réutilisable.
export { dayLabelFr };
