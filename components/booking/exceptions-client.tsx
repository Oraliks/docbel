"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { frenchDateShort } from "@/lib/booking/dates";
import type { EffectiveRole } from "@/lib/booking/access";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  active: boolean;
}

interface ExceptionSlot {
  startTime: string;
  endTime: string;
  capacity: number;
}

interface BookingException {
  id: string;
  locationId: string;
  date: string;
  kind: "closed" | "extra";
  slots: ExceptionSlot[] | null;
  reason: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ExceptionsClientProps {
  tenantId: string;
  role: EffectiveRole;
}

export function ExceptionsClient({ tenantId, role }: ExceptionsClientProps) {
  const canEdit = role === "owner" || role === "manager";

  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("all");
  const [exceptions, setExceptions] = useState<BookingException[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialog, setDialog] = useState<{
    open: boolean;
    form: {
      locationId: string;
      date: string;
      kind: "closed" | "extra";
      reason: string;
      slots: ExceptionSlot[];
    };
    saving: boolean;
  }>({
    open: false,
    form: {
      locationId: "",
      date: "",
      kind: "closed",
      reason: "",
      slots: [{ startTime: "09:00", endTime: "10:00", capacity: 1 }],
    },
    saving: false,
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

  const loadExceptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationId !== "all") params.set("locationId", locationId);
      const res = await fetch(
        `/api/booking/partner/tenants/${tenantId}/exceptions?${params}`
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      setExceptions(data.exceptions ?? []);
    } finally {
      setLoading(false);
    }
  }, [tenantId, locationId]);

  useEffect(() => {
    if (locationId !== "all") loadExceptions();
    else setExceptions([]);
  }, [loadExceptions, locationId]);

  function openAdd() {
    setDialog({
      open: true,
      form: {
        locationId: locationId !== "all" ? locationId : "",
        date: "",
        kind: "closed",
        reason: "",
        slots: [{ startTime: "09:00", endTime: "10:00", capacity: 1 }],
      },
      saving: false,
    });
  }

  async function handleSave() {
    const { form } = dialog;
    if (!form.locationId || !form.date) {
      toast.error("Antenne et date obligatoires");
      return;
    }
    const payload: {
      locationId: string;
      date: string;
      kind: "closed" | "extra";
      reason?: string;
      slots?: ExceptionSlot[];
    } = {
      locationId: form.locationId,
      date: form.date,
      kind: form.kind,
      reason: form.reason || undefined,
    };
    if (form.kind === "extra") payload.slots = form.slots;

    setDialog((s) => ({ ...s, saving: true }));
    const res = await fetch(
      `/api/booking/partner/tenants/${tenantId}/exceptions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    setDialog((s) => ({ ...s, saving: false }));
    if (!res.ok) {
      toast.error(data.error ?? "Erreur");
      return;
    }
    toast.success("Exception ajoutée");
    setDialog((s) => ({ ...s, open: false }));
    loadExceptions();
  }

  async function handleDelete(exId: string) {
    const res = await fetch(
      `/api/booking/partner/tenants/${tenantId}/exceptions/${exId}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Erreur");
      return;
    }
    toast.success("Exception supprimée");
    loadExceptions();
  }

  function setFormField<K extends keyof typeof dialog.form>(
    key: K,
    value: (typeof dialog.form)[K]
  ) {
    setDialog((s) => ({ ...s, form: { ...s.form, [key]: value } }));
  }

  function updateSlot(idx: number, field: keyof ExceptionSlot, value: string | number) {
    const slots = [...dialog.form.slots];
    slots[idx] = { ...slots[idx], [field]: value };
    setFormField("slots", slots);
  }

  function addSlot() {
    setFormField("slots", [
      ...dialog.form.slots,
      { startTime: "09:00", endTime: "10:00", capacity: 1 },
    ]);
  }

  function removeSlot(idx: number) {
    const slots = dialog.form.slots.filter((_, i) => i !== idx);
    setFormField("slots", slots);
  }

  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? id;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h2 className="text-xl font-semibold">Exceptions</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Gérez les jours de fermeture et les créneaux exceptionnels hors
          planning habituel.
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
          <Button onClick={openAdd} className="ml-auto">
            <Plus className="size-4" />
            Ajouter une exception
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : exceptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune exception pour cette antenne.
        </p>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Antenne</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Créneaux</TableHead>
                {canEdit && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((ex) => (
                  <TableRow key={ex.id}>
                    <TableCell className="font-medium">
                      {frenchDateShort(ex.date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {locationName(ex.locationId)}
                    </TableCell>
                    <TableCell>
                      {ex.kind === "closed" ? (
                        <Badge className="bg-rose-100 text-rose-800 border-0">
                          Fermé
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800 border-0">
                          Extra
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ex.reason ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {ex.slots && ex.slots.length > 0
                        ? ex.slots
                            .map((s) => `${s.startTime}–${s.endTime} (${s.capacity})`)
                            .join(", ")
                        : "—"}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(ex.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add dialog */}
      <Dialog
        open={dialog.open}
        onOpenChange={(o) =>
          !dialog.saving && setDialog((s) => ({ ...s, open: o }))
        }
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter une exception</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Antenne */}
            <div className="flex flex-col gap-1.5">
              <Label>Antenne</Label>
              <Select
                value={dialog.form.locationId}
                onValueChange={(v) => setFormField("locationId", v ?? "")}
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

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={dialog.form.date}
                onChange={(e) => setFormField("date", e.target.value)}
              />
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <div className="flex gap-4">
                {(["closed", "extra"] as const).map((kind) => (
                  <label
                    key={kind}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      name="kind"
                      value={kind}
                      checked={dialog.form.kind === kind}
                      onChange={() => setFormField("kind", kind)}
                    />
                    {kind === "closed" ? "Fermeture" : "Créneaux supplémentaires"}
                  </label>
                ))}
              </div>
            </div>

            {/* Slots if extra */}
            {dialog.form.kind === "extra" && (
              <div className="flex flex-col gap-2">
                <Label>Créneaux</Label>
                {dialog.form.slots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={slot.startTime}
                      className="flex-1"
                      onChange={(e) => updateSlot(idx, "startTime", e.target.value)}
                    />
                    <span className="text-sm">–</span>
                    <Input
                      type="time"
                      value={slot.endTime}
                      className="flex-1"
                      onChange={(e) => updateSlot(idx, "endTime", e.target.value)}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={slot.capacity}
                      className="w-16"
                      onChange={(e) =>
                        updateSlot(idx, "capacity", Number(e.target.value))
                      }
                    />
                    {dialog.form.slots.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        onClick={() => removeSlot(idx)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" type="button" onClick={addSlot}>
                  <Plus className="size-4" /> Ajouter un créneau
                </Button>
              </div>
            )}

            {/* Motif */}
            <div className="flex flex-col gap-1.5">
              <Label>Motif (optionnel)</Label>
              <Textarea
                rows={2}
                placeholder="ex: Jour férié, réunion interne…"
                value={dialog.form.reason}
                onChange={(e) => setFormField("reason", e.target.value)}
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
    </div>
  );
}
