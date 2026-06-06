"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, FileDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_BADGE, STATUS_LABELS } from "@/lib/booking/status";
import {
  addDaysYmd,
  brusselsNowParts,
  combineToUtc,
  frenchDate,
  frenchDateShort,
} from "@/lib/booking/dates";
import type { EffectiveRole } from "@/lib/booking/access";
import type { BookingField } from "@/lib/booking/types";
import { buildPlanning, planningFilename } from "@/lib/rendez-vous/planning";
import { renderPlanningPdf } from "@/lib/rendez-vous/planning-pdf";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  active: boolean;
}

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  serviceCode: string | null;
  citizenName: string | null;
  citizenEmail: string | null;
  citizenPhone: string | null;
  citizenNrnLast4: string | null;
  citizenPostalCode: string | null;
  formData: Record<string, unknown> | null;
  locationName: string | null;
  autoApproved: boolean;
  rejectionReason: string | null;
  cancelReason: string | null;
  createdAt: string;
}

type BookingStatus =
  | "pending_approval"
  | "confirmed"
  | "rejected"
  | "cancelled_citizen"
  | "cancelled_partner"
  | "no_show"
  | "completed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekStart(ymd: string): string {
  const date = new Date(ymd + "T00:00:00Z");
  const day = date.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday
  const mon = new Date(date);
  mon.setUTCDate(mon.getUTCDate() + diff);
  return mon.toISOString().slice(0, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AgendaClientProps {
  tenantId: string;
  role: EffectiveRole;
}

export function AgendaClient({ tenantId, role }: AgendaClientProps) {
  const today = brusselsNowParts().ymd;
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const weekEnd = addDaysYmd(weekStart, 6);

  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [locations, setLocations] = useState<Location[]>([]);
  const [formFields, setFormFields] = useState<BookingField[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Action dialog state
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    bookingId: string;
    action: "reject" | "cancel" | null;
    reason: string;
    saving: boolean;
  }>({ open: false, bookingId: "", action: null, reason: "", saving: false });

  // Detail sheet
  const [detailSheet, setDetailSheet] = useState<{
    open: boolean;
    booking: Booking | null;
  }>({ open: false, booking: null });

  // Load locations once
  useEffect(() => {
    fetch(`/api/booking/partner/tenants/${tenantId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.locations) setLocations(d.locations);
        if (d.tenant?.formFields) setFormFields(d.tenant.formFields);
      })
      .catch(() => {});
  }, [tenantId]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: weekStart, to: weekEnd });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (locationFilter !== "all") params.set("locationId", locationFilter);
      const res = await fetch(
        `/api/booking/partner/tenants/${tenantId}/bookings?${params}`
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors du chargement");
        return;
      }
      setBookings(data.bookings ?? []);
    } finally {
      setLoading(false);
    }
  }, [tenantId, weekStart, weekEnd, statusFilter, locationFilter]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Group by date
  const byDate = bookings.reduce<Record<string, Booking[]>>((acc, b) => {
    (acc[b.date] ??= []).push(b);
    return acc;
  }, {});

  // Build 7-day range for display
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStart, i));

  async function performAction(
    bookingId: string,
    payload: Record<string, string>
  ) {
    const res = await fetch(
      `/api/booking/partner/tenants/${tenantId}/bookings/${bookingId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Erreur");
      return false;
    }
    return true;
  }

  async function handleSimpleAction(
    bookingId: string,
    action: "approve" | "no_show" | "complete"
  ) {
    const ok = await performAction(bookingId, { action });
    if (ok) {
      const labels: Record<string, string> = {
        approve: "Rendez-vous approuvé",
        no_show: "Marqué absent",
        complete: "Marqué honoré",
      };
      toast.success(labels[action]);
      loadBookings();
    }
  }

  async function handleReasonAction() {
    const { bookingId, action, reason } = actionDialog;
    if (!action) return;
    if (!reason.trim()) {
      toast.error("Veuillez saisir un motif");
      return;
    }
    setActionDialog((s) => ({ ...s, saving: true }));
    const ok = await performAction(bookingId, { action, reason: reason.trim() });
    setActionDialog((s) => ({ ...s, saving: false }));
    if (ok) {
      toast.success(
        action === "reject" ? "Rendez-vous refusé" : "Rendez-vous annulé"
      );
      setActionDialog({ open: false, bookingId: "", action: null, reason: "", saving: false });
      loadBookings();
    }
  }

  function openReasonDialog(bookingId: string, action: "reject" | "cancel") {
    setActionDialog({ open: true, bookingId, action, reason: "", saving: false });
  }

  const canAct = role !== null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setWeekStart((w) => addDaysYmd(w, -7))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-44 text-center text-sm font-medium">
            {frenchDateShort(weekStart)} – {frenchDateShort(weekEnd)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setWeekStart((w) => addDaysYmd(w, 7))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart(getWeekStart(today))}
            className="text-xs text-muted-foreground"
          >
            Aujourd&apos;hui
          </Button>
        </div>

        {/* Filters */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {(
              Object.entries(STATUS_LABELS) as [BookingStatus, string][]
            ).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {locations.length > 0 && (
          <Select value={locationFilter} onValueChange={(v) => setLocationFilter(v ?? "all")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Toutes les antennes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les antennes</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={loadBookings}>
            <RefreshCw className="size-4" />
            Actualiser
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams({ from: weekStart, to: weekEnd });
              if (locationFilter !== "all") params.set("locationId", locationFilter);
              window.location.href = `/api/booking/partner/tenants/${tenantId}/export-ics?${params}`;
            }}
          >
            <Download className="size-4" />
            Exporter .ics
          </Button>
        </div>
      </div>

      {/* Calendar days */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {days.map((day) => {
            const dayBookings = byDate[day] ?? [];
            return (
              <div key={day}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      day === today ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {frenchDate(day)}
                  </span>
                  {dayBookings.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({dayBookings.length} RDV)
                    </span>
                  )}
                  {dayBookings.length > 0 && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="ml-auto"
                      onClick={async () => {
                        const appts = dayBookings
                          .filter(
                            (b) =>
                              b.status === "confirmed" ||
                              b.status === "pending_approval",
                          )
                          .map((b) => ({
                            name: b.citizenName ?? "RDV",
                            start: combineToUtc(b.date, b.startTime),
                            end: combineToUtc(b.date, b.endTime),
                          }));
                        if (appts.length === 0) {
                          toast.error("Aucun rendez-vous à imprimer ce jour");
                          return;
                        }
                        try {
                          const planning = buildPlanning(appts);
                          const blob = await renderPlanningPdf(planning);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = planningFilename(planning);
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {
                          toast.error("Erreur lors de la génération du PDF");
                        }
                      }}
                    >
                      <FileDown className="size-3.5" />
                      Planning PDF
                    </Button>
                  )}
                </div>
                {dayBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-2">
                    Aucun rendez-vous
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayBookings
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((b) => (
                        <BookingRow
                          key={b.id}
                          booking={b}
                          canAct={canAct}
                          onApprove={() => handleSimpleAction(b.id, "approve")}
                          onReject={() => openReasonDialog(b.id, "reject")}
                          onCancel={() => openReasonDialog(b.id, "cancel")}
                          onNoShow={() => handleSimpleAction(b.id, "no_show")}
                          onComplete={() => handleSimpleAction(b.id, "complete")}
                          onDetail={() =>
                            setDetailSheet({ open: true, booking: b })
                          }
                        />
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reason dialog */}
      <Dialog
        open={actionDialog.open}
        onOpenChange={(o) =>
          !actionDialog.saving &&
          setActionDialog((s) => ({ ...s, open: o }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === "reject"
                ? "Refuser ce rendez-vous"
                : "Annuler ce rendez-vous"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reason-input">
              Motif <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason-input"
              rows={3}
              placeholder="Expliquez la raison au citoyen…"
              value={actionDialog.reason}
              onChange={(e) =>
                setActionDialog((s) => ({ ...s, reason: e.target.value }))
              }
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setActionDialog((s) => ({ ...s, open: false }))
              }
              disabled={actionDialog.saving}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReasonAction}
              disabled={actionDialog.saving}
            >
              {actionDialog.saving ? "En cours…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail sheet */}
      <Sheet
        open={detailSheet.open}
        onOpenChange={(o) => setDetailSheet((s) => ({ ...s, open: o }))}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Détail du rendez-vous</SheetTitle>
          </SheetHeader>
          {detailSheet.booking && (
            <BookingDetail booking={detailSheet.booking} fields={formFields} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── BookingRow ────────────────────────────────────────────────────────────────

interface BookingRowProps {
  booking: Booking;
  canAct: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onNoShow: () => void;
  onComplete: () => void;
  onDetail: () => void;
}

function BookingRow({
  booking: b,
  canAct,
  onApprove,
  onReject,
  onCancel,
  onNoShow,
  onComplete,
  onDetail,
}: BookingRowProps) {
  const badgeClass =
    STATUS_BADGE[b.status as keyof typeof STATUS_BADGE] ??
    "bg-gray-100 text-gray-700";
  const statusLabel =
    STATUS_LABELS[b.status as keyof typeof STATUS_LABELS] ?? b.status;

  const hasFormData =
    b.formData && Object.keys(b.formData).length > 0;

  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-start gap-2">
        {/* Time */}
        <span className="text-sm font-mono font-medium min-w-[90px]">
          {b.startTime}–{b.endTime}
        </span>

        {/* Citizen info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {b.citizenName ?? "Citoyen anonyme"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {[b.citizenEmail, b.citizenPhone]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
          {b.locationName && (
            <p className="text-xs text-muted-foreground">{b.locationName}</p>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1 shrink-0">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${badgeClass}`}
          >
            {statusLabel}
          </span>
          {b.autoApproved && (
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
              auto
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {canAct && (
        <div className="flex flex-wrap gap-2">
          {b.status === "pending_approval" && (
            <>
              <Button size="sm" onClick={onApprove}>
                Approuver
              </Button>
              <Button size="sm" variant="destructive" onClick={onReject}>
                Refuser
              </Button>
            </>
          )}
          {b.status === "confirmed" && (
            <>
              <Button size="sm" variant="outline" onClick={onCancel}>
                Annuler
              </Button>
              <Button size="sm" variant="outline" onClick={onNoShow}>
                Absent
              </Button>
              <Button size="sm" variant="outline" onClick={onComplete}>
                Honoré
              </Button>
            </>
          )}
          {hasFormData && (
            <Button size="sm" variant="ghost" onClick={onDetail}>
              Voir le formulaire
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── BookingDetail ────────────────────────────────────────────────────────────

// Rôles déjà résumés dans la section « Demandeur » → exclus des réponses brutes
// (évite la redondance ; le NRN n'est jamais affiché en clair).
const IDENTITY_ROLES = new Set(["name", "email", "phone", "nrn", "postal_code"]);

function formValue(v: unknown): string {
  if (v === true) return "Oui";
  if (v === false) return "Non";
  return String(v ?? "").trim();
}

function BookingDetail({
  booking: b,
  fields,
}: {
  booking: Booking;
  fields: BookingField[];
}) {
  const data = (b.formData ?? {}) as Record<string, unknown>;
  const extras = fields
    .filter((f) => !IDENTITY_ROLES.has(f.role ?? ""))
    .map((f) => ({ label: f.label, value: formValue(data[f.key]) }))
    .filter((x) => x.value !== "");

  const statusLabel =
    STATUS_LABELS[b.status as keyof typeof STATUS_LABELS] ?? b.status;

  return (
    <div className="flex flex-col gap-5 px-4 pb-6 text-sm">
      <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2.5">
        <Row label="Date" value={frenchDate(b.date)} />
        <Row label="Horaire" value={`${b.startTime} – ${b.endTime}`} />
        <Row label="Antenne" value={b.locationName ?? "—"} />
        <Row label="Statut" value={statusLabel} />
      </dl>

      <Section title="Demandeur">
        <Row label="Nom" value={b.citizenName ?? "—"} />
        <Row label="Email" value={b.citizenEmail ?? "—"} />
        <Row label="Téléphone" value={b.citizenPhone ?? "—"} />
        {b.citizenPostalCode && (
          <Row label="Code postal" value={b.citizenPostalCode} />
        )}
        {b.citizenNrnLast4 && <Row label="NRN" value={`••• ${b.citizenNrnLast4}`} />}
      </Section>

      {extras.length > 0 && (
        <Section title="Réponses au formulaire">
          {extras.map((e) => (
            <Row key={e.label} label={e.label} value={e.value} />
          ))}
        </Section>
      )}

      {(b.rejectionReason || b.cancelReason) && (
        <Section title="Motif">
          {b.rejectionReason && <Row label="Refus" value={b.rejectionReason} />}
          {b.cancelReason && <Row label="Annulation" value={b.cancelReason} />}
        </Section>
      )}

      <p className="text-xs text-muted-foreground">
        Créé le {new Date(b.createdAt).toLocaleString("fr-BE")}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2.5">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </>
  );
}
