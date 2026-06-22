"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

const TYPE_CODES: BureauTypeCode[] = [
  "CPAS",
  "COMMUNE",
  "ONEM",
  "SYNDICAT",
  "PERMANENCE",
  "AUTRE",
];

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
  const t = useTranslations("admin.bureaux");
  const [tab, setTab] = useState<"general" | "address" | "contact" | "hours" | "extra">(
    "general"
  );

  const typeLabel = (code: BureauTypeCode) =>
    t(`type${code}` as Parameters<typeof t>[0]);

  const selectedOrganisme = organismes.find((o) => o.id === form.organismeId);

  async function geocode() {
    const addr = `${form.street} ${form.streetNum}, ${form.postalCode} ${form.city}, Belgique`.trim();
    if (!form.street || !form.city) {
      toast.error(t("geocodeNeedStreetCity"));
      return;
    }
    toast.info(t("geocodeInProgress"));
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(addr)}`);
      if (!res.ok) throw new Error("Échec");
      const j = await res.json();
      const data = Array.isArray(j?.data) ? j.data[0] : null;
      if (!data) {
        toast.error(t("geocodeNotFound"));
        return;
      }
      const lat = Number(data.lat);
      const lng = Number(data.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
        toast.success(t("geocodeSuccess"));
      }
    } catch {
      toast.error(t("geocodeUnavailable"));
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
            {editing ? t("dialogEditTitle", { name: editing.name }) : t("dialogNewTitle")}
          </DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab((v ?? "general") as typeof tab)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 pt-3 pb-2 border-b shrink-0">
            <TabsList className="flex w-full">
              <TabsTrigger value="general" className="gap-1.5 flex-1 min-w-fit">
                <Building2 className="h-3.5 w-3.5" /> {t("tabIdentity")}
                {!requiredOK.general && (
                  <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="address" className="gap-1.5 flex-1 min-w-fit">
                <MapPinned className="h-3.5 w-3.5" /> {t("tabAddress")}
                {!requiredOK.address && (
                  <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="contact" className="gap-1.5 flex-1 min-w-fit">
                <Phone className="h-3.5 w-3.5" /> {t("tabContact")}
              </TabsTrigger>
              <TabsTrigger value="hours" className="gap-1.5 flex-1 min-w-fit">
                <Clock className="h-3.5 w-3.5" /> {t("tabHours")}
              </TabsTrigger>
              <TabsTrigger value="extra" className="gap-1.5 flex-1 min-w-fit">
                <FileText className="h-3.5 w-3.5" /> {t("tabServices")}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* ===== Identité ===== */}
            <TabsContent value="general" className="mt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("fieldTypeRequired")}>
                  <Select
                    value={form.type}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, type: (v ?? "AUTRE") as BureauTypeCode }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{typeLabel(form.type)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_CODES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {typeLabel(code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("fieldOrganismeRequired")}>
                  <Select
                    value={form.organismeId}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, organismeId: v ?? "" }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("organismePlaceholder")}>
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

              <Field label={t("fieldNameRequired")}>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("namePlaceholder")}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("fieldNameNl")} optional>
                  <Input
                    value={form.nameNl}
                    onChange={(e) => setForm((f) => ({ ...f, nameNl: e.target.value }))}
                    placeholder={t("nameNlPlaceholder")}
                  />
                </Field>
                <Field label={t("fieldNameDe")} optional>
                  <Input
                    value={form.nameDe}
                    onChange={(e) => setForm((f) => ({ ...f, nameDe: e.target.value }))}
                    placeholder={t("nameDePlaceholder")}
                  />
                </Field>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, active: v }))}
                />
                <Label className="cursor-pointer">
                  {t("activeLabel")}{" "}
                  <span className="text-xs text-muted-foreground">
                    {t("activeHint")}
                  </span>
                </Label>
              </div>
            </TabsContent>

            {/* ===== Adresse ===== */}
            <TabsContent value="address" className="mt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
                <Field label={t("fieldStreetRequired")}>
                  <Input
                    value={form.street}
                    onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                    placeholder={t("streetPlaceholder")}
                  />
                </Field>
                <Field label={t("fieldStreetNum")} optional>
                  <Input
                    value={form.streetNum}
                    onChange={(e) => setForm((f) => ({ ...f, streetNum: e.target.value }))}
                    placeholder="6"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4">
                <Field label={t("fieldPostalCodeRequired")}>
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
                <Field label={t("fieldCityRequired")}>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder={t("cityPlaceholder")}
                  />
                </Field>
              </div>

              <Field
                label={
                  form.type === "CPAS" || form.type === "COMMUNE"
                    ? t("fieldCommuneRequired")
                    : t("fieldCommune")
                }
                helper={
                  form.type === "CPAS" || form.type === "COMMUNE"
                    ? t("communeHelperRequired")
                    : t("communeHelperOptional")
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
                    {t("gpsLabel")}
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={geocode}>
                    <MapPin className="mr-2 h-3.5 w-3.5" /> {t("autoGeocode")}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("fieldLatitude")} compact>
                    <Input
                      value={form.lat}
                      onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                      placeholder="50.85"
                      className="font-mono text-sm"
                    />
                  </Field>
                  <Field label={t("fieldLongitude")} compact>
                    <Input
                      value={form.lng}
                      onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                      placeholder="4.35"
                      className="font-mono text-sm"
                    />
                  </Field>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("gpsHint")}
                </p>
              </div>
            </TabsContent>

            {/* ===== Contact ===== */}
            <TabsContent value="contact" className="mt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("fieldPhone")}>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="02 000 00 00"
                  />
                </Field>
                <Field label={t("fieldEmail")}>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="info@example.be"
                  />
                </Field>
              </div>
              <Field label={t("fieldWebsite")}>
                <Input
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="https://www.exemple.be"
                />
              </Field>
              <Field
                label={t("fieldAppointmentUrl")}
                helper={t("appointmentUrlHelper")}
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
                label={t("fieldHoursNotes")}
                helper={t("hoursNotesHelper")}
              >
                <Input
                  value={form.hoursNotes}
                  onChange={(e) => setForm((f) => ({ ...f, hoursNotes: e.target.value }))}
                  placeholder={t("hoursNotesPlaceholder")}
                />
              </Field>
            </TabsContent>

            {/* ===== Services + Notes ===== */}
            <TabsContent value="extra" className="mt-0 space-y-4">
              <Field
                label={t("fieldServices")}
                helper={t("servicesHelper")}
              >
                <ServicesChips
                  value={form.services}
                  onChange={(s) => setForm((f) => ({ ...f, services: s }))}
                />
              </Field>
              <Field
                label={t("fieldNotes")}
                helper={t("notesHelper")}
              >
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={4}
                  placeholder={t("notesPlaceholder")}
                />
              </Field>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-muted/20">
          <div className="flex items-center gap-2 mr-auto text-xs text-muted-foreground">
            {!canSubmit && <span>{t("requiredFieldsMissing")}</span>}
            {canSubmit && <span className="text-green-700">{t("readyToSave")}</span>}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !canSubmit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? t("saveChanges") : t("createBureau")}
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
  const t = useTranslations("admin.bureaux");
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <Label className="text-xs font-medium flex items-center gap-1">
        {label}
        {optional && <span className="text-[10px] text-muted-foreground font-normal">{t("optionalSuffix")}</span>}
      </Label>
      {children}
      {helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  );
}
