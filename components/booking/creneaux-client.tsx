"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { weekdayLabel } from "@/lib/booking/dates";
import type { EffectiveRole } from "@/lib/booking/access";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  active: boolean;
}

interface Rule {
  id: string;
  locationId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  capacity: number;
  serviceCode: string | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
}

interface RuleForm {
  locationId: string;
  weekday: string;
  startTime: string;
  endTime: string;
  capacity: string;
  serviceCode: string;
  validFrom: string;
  validUntil: string;
}

const EMPTY_FORM: RuleForm = {
  locationId: "",
  weekday: "1",
  startTime: "09:00",
  endTime: "10:00",
  capacity: "1",
  serviceCode: "",
  validFrom: "",
  validUntil: "",
};

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // lun → dim

// ─── Component ────────────────────────────────────────────────────────────────

interface CreneauxClientProps {
  tenantId: string;
  role: EffectiveRole;
}

export function CreneauxClient({ tenantId, role }: CreneauxClientProps) {
  const canEdit = role === "owner" || role === "manager";

  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("all");
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialog, setDialog] = useState<{
    open: boolean;
    editing: Rule | null;
    form: RuleForm;
    saving: boolean;
  }>({ open: false, editing: null, form: EMPTY_FORM, saving: false });

  const [gen, setGen] = useState({
    open: false,
    saving: false,
    weekdays: [1, 2, 3, 4, 5] as number[],
    startTime: "09:00",
    endTime: "17:00",
    slotDuration: "30",
    capacity: "1",
    serviceCode: "",
  });

  // Load locations
  useEffect(() => {
    fetch(`/api/booking/partner/tenants/${tenantId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.locations) {
          setLocations(d.locations);
          if (d.locations.length > 0) setLocationId(d.locations[0].id);
        }
      })
      .catch(() => {});
  }, [tenantId]);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationId !== "all") params.set("locationId", locationId);
      const res = await fetch(
        `/api/booking/partner/tenants/${tenantId}/rules?${params}`
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      setRules(data.rules ?? []);
    } finally {
      setLoading(false);
    }
  }, [tenantId, locationId]);

  useEffect(() => {
    if (locationId !== "all") loadRules();
    else setRules([]);
  }, [loadRules, locationId]);

  function openAdd() {
    setDialog({
      open: true,
      editing: null,
      form: { ...EMPTY_FORM, locationId: locationId !== "all" ? locationId : "" },
      saving: false,
    });
  }

  function openEdit(r: Rule) {
    setDialog({
      open: true,
      editing: r,
      form: {
        locationId: r.locationId,
        weekday: String(r.weekday),
        startTime: r.startTime,
        endTime: r.endTime,
        capacity: String(r.capacity),
        serviceCode: r.serviceCode ?? "",
        validFrom: r.validFrom ?? "",
        validUntil: r.validUntil ?? "",
      },
      saving: false,
    });
  }

  async function handleSave() {
    const { form, editing } = dialog;
    if (!form.locationId) {
      toast.error("Veuillez choisir une antenne");
      return;
    }
    const payload = {
      locationId: form.locationId,
      weekday: Number(form.weekday),
      startTime: form.startTime,
      endTime: form.endTime,
      capacity: Number(form.capacity) || 1,
      serviceCode: form.serviceCode || undefined,
      validFrom: form.validFrom || undefined,
      validUntil: form.validUntil || undefined,
    };
    setDialog((s) => ({ ...s, saving: true }));
    const url = editing
      ? `/api/booking/partner/tenants/${tenantId}/rules/${editing.id}`
      : `/api/booking/partner/tenants/${tenantId}/rules`;
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setDialog((s) => ({ ...s, saving: false }));
    if (!res.ok) {
      toast.error(data.error ?? "Erreur");
      return;
    }
    toast.success(editing ? "Créneau mis à jour" : "Créneau ajouté");
    setDialog((s) => ({ ...s, open: false }));
    loadRules();
  }

  async function handleDelete(ruleId: string) {
    const res = await fetch(
      `/api/booking/partner/tenants/${tenantId}/rules/${ruleId}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Erreur");
      return;
    }
    toast.success("Créneau supprimé");
    loadRules();
  }

  async function handleGenerate() {
    if (gen.weekdays.length === 0) {
      toast.error("Choisissez au moins un jour");
      return;
    }
    const targetLoc = locationId !== "all" ? locationId : locations[0]?.id;
    if (!targetLoc) {
      toast.error("Choisissez d'abord une antenne");
      return;
    }
    setGen((s) => ({ ...s, saving: true }));
    const res = await fetch(
      `/api/booking/partner/tenants/${tenantId}/rules/bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: targetLoc,
          weekdays: gen.weekdays,
          startTime: gen.startTime,
          endTime: gen.endTime,
          slotDuration: Number(gen.slotDuration) || 30,
          capacity: Number(gen.capacity) || 1,
          serviceCode: gen.serviceCode || undefined,
        }),
      },
    );
    const data = await res.json();
    setGen((s) => ({ ...s, saving: false }));
    if (!res.ok) {
      toast.error(data.error ?? "Erreur");
      return;
    }
    toast.success(`${data.count} créneaux générés`);
    setGen((s) => ({ ...s, open: false }));
    loadRules();
  }

  function setField(key: keyof RuleForm, value: string) {
    setDialog((s) => ({ ...s, form: { ...s.form, [key]: value } }));
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h2 className="text-xl font-semibold">Créneaux récurrents</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Définissez les créneaux hebdomadaires et leur nombre de places
          disponibles par heure.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {locations.length > 1 && (
          <Select value={locationId} onValueChange={(v) => setLocationId(v ?? "")}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Choisir une antenne" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {canEdit && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setGen((s) => ({ ...s, open: true }))}
            >
              <Wand2 className="size-4" />
              Générer
            </Button>
            <Button onClick={openAdd}>
              <Plus className="size-4" />
              Ajouter
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun créneau configuré pour cette antenne.
        </p>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jour</TableHead>
                <TableHead>Horaire</TableHead>
                <TableHead>Places</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Validité</TableHead>
                {canEdit && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{weekdayLabel(r.weekday)}</TableCell>
                  <TableCell className="font-mono">
                    {r.startTime}–{r.endTime}
                  </TableCell>
                  <TableCell>{r.capacity}</TableCell>
                  <TableCell>{r.serviceCode ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.validFrom && r.validUntil
                      ? `${r.validFrom} → ${r.validUntil}`
                      : r.validFrom
                      ? `Dès ${r.validFrom}`
                      : r.validUntil
                      ? `Jusqu'au ${r.validUntil}`
                      : "Toujours"}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog
        open={dialog.open}
        onOpenChange={(o) => !dialog.saving && setDialog((s) => ({ ...s, open: o }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog.editing ? "Modifier le créneau" : "Ajouter un créneau"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {/* Antenne */}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Antenne</Label>
              <Select
                value={dialog.form.locationId}
                onValueChange={(v) => setField("locationId", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Jour */}
            <div className="flex flex-col gap-1.5">
              <Label>Jour</Label>
              <Select
                value={dialog.form.weekday}
                onValueChange={(v) => setField("weekday", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {weekdayLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Capacité */}
            <div className="flex flex-col gap-1.5">
              <Label>Places</Label>
              <Input
                type="number"
                min={1}
                value={dialog.form.capacity}
                onChange={(e) => setField("capacity", e.target.value)}
              />
            </div>

            {/* Début */}
            <div className="flex flex-col gap-1.5">
              <Label>Heure de début</Label>
              <Input
                type="time"
                value={dialog.form.startTime}
                onChange={(e) => setField("startTime", e.target.value)}
              />
            </div>

            {/* Fin */}
            <div className="flex flex-col gap-1.5">
              <Label>Heure de fin</Label>
              <Input
                type="time"
                value={dialog.form.endTime}
                onChange={(e) => setField("endTime", e.target.value)}
              />
            </div>

            {/* Service */}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Code service (optionnel)</Label>
              <Input
                placeholder="ex: CHOMAGE_A"
                value={dialog.form.serviceCode}
                onChange={(e) => setField("serviceCode", e.target.value)}
              />
            </div>

            {/* Validité */}
            <div className="flex flex-col gap-1.5">
              <Label>Valide à partir du</Label>
              <Input
                type="date"
                value={dialog.form.validFrom}
                onChange={(e) => setField("validFrom", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Valide jusqu&apos;au</Label>
              <Input
                type="date"
                value={dialog.form.validUntil}
                onChange={(e) => setField("validUntil", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog((s) => ({ ...s, open: false }))}
              disabled={dialog.saving}
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={dialog.saving}>
              {dialog.saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generator dialog */}
      <Dialog
        open={gen.open}
        onOpenChange={(o) => !gen.saving && setGen((s) => ({ ...s, open: o }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Générer des créneaux</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Jours</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((wd) => {
                  const on = gen.weekdays.includes(wd);
                  return (
                    <button
                      key={wd}
                      type="button"
                      onClick={() =>
                        setGen((s) => ({
                          ...s,
                          weekdays: on
                            ? s.weekdays.filter((x) => x !== wd)
                            : [...s.weekdays, wd],
                        }))
                      }
                      className={`rounded-lg border px-2.5 py-1 text-sm transition-colors ${
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {weekdayLabel(wd, true)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>De</Label>
                <Input
                  type="time"
                  value={gen.startTime}
                  onChange={(e) => setGen((s) => ({ ...s, startTime: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>À</Label>
                <Input
                  type="time"
                  value={gen.endTime}
                  onChange={(e) => setGen((s) => ({ ...s, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Durée / créneau</Label>
                <Select
                  value={gen.slotDuration}
                  onValueChange={(v) =>
                    setGen((s) => ({ ...s, slotDuration: v ?? "30" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["15", "20", "30", "45", "60"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Places / créneau</Label>
                <Input
                  type="number"
                  min={1}
                  value={gen.capacity}
                  onChange={(e) => setGen((s) => ({ ...s, capacity: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Code service (optionnel)</Label>
              <Input
                placeholder="ex: CHOMAGE_A"
                value={gen.serviceCode}
                onChange={(e) => setGen((s) => ({ ...s, serviceCode: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Les créneaux existants ne sont pas remplacés — les nouveaux s&apos;ajoutent.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGen((s) => ({ ...s, open: false }))}
              disabled={gen.saving}
            >
              Annuler
            </Button>
            <Button onClick={handleGenerate} disabled={gen.saving}>
              {gen.saving ? "Génération…" : "Générer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
