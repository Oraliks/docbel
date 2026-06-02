"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MapPin, Building2, MapPinned, Phone, Clock, FileText } from "lucide-react";
import type { SerializedBureau, BureauTypeCode } from "@/lib/bureaus/types";
import { HoursEditor } from "./hours-editor";
import { CommuneCombobox } from "./commune-combobox";
import { ServicesChips } from "./services-chips";

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
  COMMUNE: "Maison communale",
  ONEM: "ONEM / RVA",
  SYNDICAT: "Syndicat",
  PERMANENCE: "Permanence",
  AUTRE: "Autre",
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
  hours: { day: number; slots: { open: string; close: string }[] }[];
  hoursNotes: string;
  services: string[];
  active: boolean;
  notes: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: SerializedBureau | null;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  organismes: Organisme[];
  onSubmit: () => Promise<void>;
  submitting: boolean;
};

export function BureauFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  organismes,
  onSubmit,
  submitting,
}: Props) {
  const [tab, setTab] = useState<"general" | "address" | "contact" | "hours" | "extra">(
    "general"
  );

  const selectedOrganisme = organismes.find((o) => o.id === form.organismeId);

  async function geocode() {
    const addr = `${form.street} ${form.streetNum}, ${form.postalCode} ${form.city}, Belgique`.trim();
    if (!form.street || !form.city) {
      toast.error("Renseignez d'abord rue et ville");
      return;
    }
    toast.info("Géocodage en cours...");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(addr)}`);
      if (!res.ok) throw new Error("Échec");
      const j = await res.json();
      const data = Array.isArray(j?.data) ? j.data[0] : null;
      if (!data) {
        toast.error("Adresse introuvable");
        return;
      }
      const lat = Number(data.lat);
      const lng = Number(data.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
        toast.success("Coordonnées récupérées");
      }
    } catch {
      toast.error("Géocodage indisponible");
    }
  }

  // Sections et leur état "rempli/manquant" pour pastiller les tabs
  const requiredOK = {
    general: !!(form.organismeId && form.name && form.type),
    address: !!(form.street && /^\d{4}$/.test(form.postalCode) && form.city &&
      (form.type !== "CPAS" && form.type !== "COMMUNE" ? true : form.communeId)),
    contact: true, // optionnel
    hours: true, // optionnel
    extra: true,
  };

  const canSubmit =
    requiredOK.general && requiredOK.address && form.organismeId && form.name && form.street && form.city;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg">
            {editing ? `Modifier — ${editing.name}` : "Nouveau bureau"}
          </DialogTitle>
          <DialogDescription>
            CPAS et Maisons communales nécessitent une commune attitrée. ONEM = mappé via la
            matrice des compétences territoriales.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab((v ?? "general") as typeof tab)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 pt-3 pb-2 border-b shrink-0">
            <TabsList className="flex w-full">
              <TabsTrigger value="general" className="gap-1.5 flex-1 min-w-fit">
                <Building2 className="h-3.5 w-3.5" /> Identité
                {!requiredOK.general && (
                  <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="address" className="gap-1.5 flex-1 min-w-fit">
                <MapPinned className="h-3.5 w-3.5" /> Adresse
                {!requiredOK.address && (
                  <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="contact" className="gap-1.5 flex-1 min-w-fit">
                <Phone className="h-3.5 w-3.5" /> Contact
              </TabsTrigger>
              <TabsTrigger value="hours" className="gap-1.5 flex-1 min-w-fit">
                <Clock className="h-3.5 w-3.5" /> Horaires
              </TabsTrigger>
              <TabsTrigger value="extra" className="gap-1.5 flex-1 min-w-fit">
                <FileText className="h-3.5 w-3.5" /> Services
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* ===== Identité ===== */}
            <TabsContent value="general" className="mt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Type *">
                  <Select
                    value={form.type}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, type: (v ?? "AUTRE") as BureauTypeCode }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{TYPE_LABELS[form.type]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABELS) as BureauTypeCode[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Organisme *">
                  <Select
                    value={form.organismeId}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, organismeId: v ?? "" }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choisir un organisme...">
                        {selectedOrganisme ? (
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ background: selectedOrganisme.color }}
                            />
                            {selectedOrganisme.shortName ?? selectedOrganisme.name}
                          </span>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {organismes.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ background: o.color }}
                            />
                            {o.shortName ?? o.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Nom *">
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex : CPAS de Saint-Gilles, Commune de Bruxelles, ONEM Liège..."
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nom NL" optional>
                  <Input
                    value={form.nameNl}
                    onChange={(e) => setForm((f) => ({ ...f, nameNl: e.target.value }))}
                    placeholder="OCMW Sint-Gillis"
                  />
                </Field>
                <Field label="Nom DE" optional>
                  <Input
                    value={form.nameDe}
                    onChange={(e) => setForm((f) => ({ ...f, nameDe: e.target.value }))}
                    placeholder="ÖSHZ"
                  />
                </Field>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, active: v }))}
                />
                <Label className="cursor-pointer">
                  Bureau actif{" "}
                  <span className="text-xs text-muted-foreground">
                    (visible côté public)
                  </span>
                </Label>
              </div>
            </TabsContent>

            {/* ===== Adresse ===== */}
            <TabsContent value="address" className="mt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
                <Field label="Rue *">
                  <Input
                    value={form.street}
                    onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                    placeholder="Rue Van Lint"
                  />
                </Field>
                <Field label="N°" optional>
                  <Input
                    value={form.streetNum}
                    onChange={(e) => setForm((f) => ({ ...f, streetNum: e.target.value }))}
                    placeholder="6"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4">
                <Field label="CP *">
                  <Input
                    value={form.postalCode}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        postalCode: e.target.value.replace(/\D/g, "").slice(0, 4),
                      }))
                    }
                    placeholder="1070"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Ville *">
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Anderlecht"
                  />
                </Field>
              </div>

              <Field
                label={`Commune attitrée ${
                  form.type === "CPAS" || form.type === "COMMUNE" ? "*" : ""
                }`}
                helper={
                  form.type === "CPAS" || form.type === "COMMUNE"
                    ? "Obligatoire : la commune que ce bureau dessert."
                    : "Optionnel pour SYNDICAT/PERMANENCE."
                }
              >
                <CommuneCombobox
                  value={form.communeId}
                  onChange={(v) => setForm((f) => ({ ...f, communeId: v }))}
                />
              </Field>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Coordonnées GPS
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={geocode}>
                    <MapPin className="mr-2 h-3.5 w-3.5" /> Auto-géocoder
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Latitude" compact>
                    <Input
                      value={form.lat}
                      onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                      placeholder="50.85"
                      className="font-mono text-sm"
                    />
                  </Field>
                  <Field label="Longitude" compact>
                    <Input
                      value={form.lng}
                      onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                      placeholder="4.35"
                      className="font-mono text-sm"
                    />
                  </Field>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Utilisées pour le calcul de distance dans le résolveur public.
                </p>
              </div>
            </TabsContent>

            {/* ===== Contact ===== */}
            <TabsContent value="contact" className="mt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Téléphone">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="02 000 00 00"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="info@example.be"
                  />
                </Field>
              </div>
              <Field label="Site web officiel">
                <Input
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="https://www.exemple.be"
                />
              </Field>
              <Field
                label="URL prise de rendez-vous en ligne"
                helper="Lien direct vers la page RDV (apparaît comme CTA principal sur la carte publique)."
              >
                <Input
                  value={form.appointmentUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, appointmentUrl: e.target.value }))
                  }
                  placeholder="https://rdv.example.be/cpas"
                />
              </Field>
            </TabsContent>

            {/* ===== Horaires ===== */}
            <TabsContent value="hours" className="mt-0 space-y-4">
              <HoursEditor
                value={form.hours}
                onChange={(h) => setForm((f) => ({ ...f, hours: h }))}
              />
              <Field
                label="Note sur les horaires"
                helper="Affichée en encadré jaune sur la card publique. Utile pour préciser une exception."
              >
                <Input
                  value={form.hoursNotes}
                  onChange={(e) => setForm((f) => ({ ...f, hoursNotes: e.target.value }))}
                  placeholder="Permanence sociale uniquement le mercredi matin"
                />
              </Field>
            </TabsContent>

            {/* ===== Services + Notes ===== */}
            <TabsContent value="extra" className="mt-0 space-y-4">
              <Field
                label="Services proposés"
                helper="Cochez ceux disponibles. Vous pouvez ajouter des services personnalisés."
              >
                <ServicesChips
                  value={form.services}
                  onChange={(s) => setForm((f) => ({ ...f, services: s }))}
                />
              </Field>
              <Field
                label="Notes internes"
                helper="Visibles uniquement par les admins (pas publié)."
              >
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={4}
                  placeholder="Remarques, sources, dernière vérification..."
                />
              </Field>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-muted/20">
          <div className="flex items-center gap-2 mr-auto text-xs text-muted-foreground">
            {!canSubmit && <span>⚠ Champs obligatoires manquants</span>}
            {canSubmit && <span className="text-green-700">✓ Prêt à enregistrer</span>}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !canSubmit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Enregistrer les modifications" : "Créer le bureau"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  helper,
  optional,
  compact,
  children,
}: {
  label: string;
  helper?: string;
  optional?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <Label className="text-xs font-medium flex items-center gap-1">
        {label}
        {optional && <span className="text-[10px] text-muted-foreground font-normal">— facultatif</span>}
      </Label>
      {children}
      {helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  );
}
