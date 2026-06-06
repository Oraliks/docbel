"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CalendarDays, Download, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import type { BookingStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/booking/status";
import { frenchDate } from "@/lib/booking/dates";
import type { DayAvailability } from "@/lib/booking/types";
import { GLASS_CARD, GLASS_LABEL, GLASS_PRIMARY_STYLE } from "@/lib/glass-classes";

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface ManageResponse {
  status: BookingStatus;
  date: string;
  startTime: string;
  endTime: string;
  citizenName: string | null;
  rejectionReason: string | null;
  cancelReason: string | null;
  tenant: { name: string; brandColor: string | null };
  tenantSlug: string;
  locationId: string;
  location: { name: string; address: string };
  canCancel: boolean;
  canReschedule: boolean;
  canDownloadIcs: boolean;
}

interface PickedSlot {
  date: string;
  startTime: string;
  endTime: string;
}

// ---------------------------------------------------------------------------
// Status colour chip
// ---------------------------------------------------------------------------

const STATUS_CHIP: Record<BookingStatus, string> = {
  pending_approval: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  cancelled_citizen: "bg-gray-100 text-gray-600",
  cancelled_partner: "bg-gray-100 text-gray-600",
  no_show: "bg-orange-100 text-orange-800",
  completed: "bg-violet-100 text-violet-800",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ManageClient({ token }: { token: string }) {
  const [data, setData] = useState<ManageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [availDays, setAvailDays] = useState<DayAvailability[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [picked, setPicked] = useState<PickedSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/booking/manage/${token}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error();
      const json: ManageResponse = await res.json();
      setData(json);
    } catch {
      toast.error("Erreur lors du chargement de votre rendez-vous.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/booking/manage/${token}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const err: { error?: string } = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Impossible d'annuler ce rendez-vous.");
        return;
      }
      toast.success("Rendez-vous annulé.");
      setConfirmCancel(false);
      await load();
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setCancelling(false);
    }
  }

  async function openReschedule(d: ManageResponse) {
    setConfirmCancel(false);
    setPicked(null);
    setRescheduling(true);
    setAvailLoading(true);
    try {
      const res = await fetch(
        `/api/booking/${d.tenantSlug}/availability?locationId=${encodeURIComponent(d.locationId)}&days=28`,
      );
      if (!res.ok) throw new Error();
      const json: { days: DayAvailability[] } = await res.json();
      setAvailDays(json.days.filter((day) => day.slots.length > 0));
    } catch {
      toast.error("Impossible de charger les créneaux disponibles.");
      setRescheduling(false);
    } finally {
      setAvailLoading(false);
    }
  }

  async function handleReschedule() {
    if (!picked) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/booking/manage/${token}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: picked.date, startTime: picked.startTime }),
      });
      if (!res.ok) {
        const err: { error?: string } = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Impossible de déplacer ce rendez-vous.");
        if (res.status === 409 && data) void openReschedule(data);
        return;
      }
      toast.success("Rendez-vous déplacé.");
      setRescheduling(false);
      setPicked(null);
      await load();
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[14px] text-[color:var(--glass-ink-faint)]">
        Chargement…
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className={`${GLASS_CARD} glass-surface rounded-2xl p-6`}>
        <p className="text-[15px] text-[color:var(--glass-ink-soft)]">
          Rendez-vous introuvable. Le lien est peut-être expiré ou incorrect.
        </p>
      </div>
    );
  }

  const chipClass = STATUS_CHIP[data.status] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="flex flex-col gap-4">
      {/* Status card */}
      <div className={`${GLASS_CARD} glass-surface rounded-2xl p-5`}>
        <div className="flex flex-col gap-4">
          {/* Header: tenant + status */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={GLASS_LABEL}>Organisme</p>
              <div className="mt-0.5 flex items-center gap-2">
                {data.tenant.brandColor && (
                  <div
                    className="h-3 w-3 flex-shrink-0 rounded-full"
                    style={{ background: data.tenant.brandColor }}
                  />
                )}
                <span className="text-[15px] font-semibold text-[color:var(--glass-ink)]">
                  {data.tenant.name}
                </span>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${chipClass}`}
            >
              {STATUS_LABELS[data.status]}
            </span>
          </div>

          {/* Date + time */}
          <div className="flex items-start gap-2">
            <CalendarDays
              size={16}
              className="mt-0.5 flex-shrink-0 text-[color:var(--glass-ink-faint)]"
            />
            <div>
              <p className="text-[14px] font-medium text-[color:var(--glass-ink)]">
                {frenchDate(data.date)}
              </p>
              <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
                {data.startTime} – {data.endTime}
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-2">
            <MapPin
              size={16}
              className="mt-0.5 flex-shrink-0 text-[color:var(--glass-ink-faint)]"
            />
            <div>
              <p className="text-[14px] font-medium text-[color:var(--glass-ink)]">
                {data.location.name}
              </p>
              <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
                {data.location.address}
              </p>
            </div>
          </div>

          {/* Citizen name */}
          {data.citizenName && (
            <p className="text-[13px] text-[color:var(--glass-ink-faint)]">
              Demande au nom de <strong>{data.citizenName}</strong>
            </p>
          )}

          {/* Rejection / cancel reason */}
          {data.status === "rejected" && data.rejectionReason && (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              <strong>Motif de refus :</strong> {data.rejectionReason}
            </div>
          )}
          {(data.status === "cancelled_citizen" || data.status === "cancelled_partner") &&
            data.cancelReason && (
              <div className="rounded-xl bg-gray-100 px-4 py-3 text-[13px] text-gray-600">
                <strong>Motif d&apos;annulation :</strong> {data.cancelReason}
              </div>
            )}
        </div>
      </div>

      {/* Actions */}
      {(data.canDownloadIcs || data.canCancel || data.canReschedule) && (
        <div className="flex flex-wrap gap-3">
          {data.canDownloadIcs && (
            <a
              href={`/api/booking/manage/${token}/ics`}
              className="flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] px-4 py-2 text-[13px] font-medium text-[color:var(--glass-ink)] transition-colors hover:border-[color:var(--glass-accent-deep)]"
            >
              <Download size={14} />
              Ajouter à mon agenda (.ics)
            </a>
          )}

          {data.canReschedule && !rescheduling && !confirmCancel && (
            <button
              onClick={() => void openReschedule(data)}
              className="flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] px-4 py-2 text-[13px] font-medium text-[color:var(--glass-ink)] transition-colors hover:border-[color:var(--glass-accent-deep)]"
            >
              <CalendarClock size={14} />
              Déplacer le rendez-vous
            </button>
          )}

          {data.canCancel && !confirmCancel && !rescheduling && (
            <button
              onClick={() => setConfirmCancel(true)}
              className="flex items-center gap-2 rounded-full border border-rose-300 px-4 py-2 text-[13px] font-medium text-rose-600 transition-colors hover:border-rose-500 hover:text-rose-700"
            >
              <X size={14} />
              Annuler le rendez-vous
            </button>
          )}
        </div>
      )}

      {/* Reschedule picker */}
      {rescheduling && (
        <div className={`${GLASS_CARD} glass-surface rounded-2xl p-5`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-[color:var(--glass-ink)]">
              Choisir un nouveau créneau
            </p>
            <button
              onClick={() => {
                setRescheduling(false);
                setPicked(null);
              }}
              className="rounded-full p-1 text-[color:var(--glass-ink-faint)] transition-colors hover:text-[color:var(--glass-ink)]"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          {availLoading ? (
            <p className="mt-4 text-[14px] text-[color:var(--glass-ink-faint)]">
              Chargement des créneaux…
            </p>
          ) : availDays.length === 0 ? (
            <p className="mt-4 text-[14px] text-[color:var(--glass-ink-soft)]">
              Aucun autre créneau disponible pour le moment.
            </p>
          ) : (
            <div className="mt-4 flex max-h-[22rem] flex-col gap-4 overflow-y-auto pr-1">
              {availDays.map((day) => (
                <div key={day.date}>
                  <p className="text-[13px] font-semibold capitalize text-[color:var(--glass-ink)]">
                    {frenchDate(day.date)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {day.slots.map((slot) => {
                      const isCurrent =
                        day.date === data.date && slot.startTime === data.startTime;
                      const isSel =
                        picked?.date === day.date && picked?.startTime === slot.startTime;
                      return (
                        <button
                          key={slot.startTime}
                          disabled={isCurrent}
                          onClick={() =>
                            setPicked({
                              date: day.date,
                              startTime: slot.startTime,
                              endTime: slot.endTime,
                            })
                          }
                          style={isSel ? GLASS_PRIMARY_STYLE : undefined}
                          className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            isSel
                              ? "font-semibold"
                              : "border border-[color:var(--glass-border)] text-[color:var(--glass-ink)] hover:border-[color:var(--glass-accent-deep)]"
                          }`}
                          title={isCurrent ? "Créneau actuel" : undefined}
                        >
                          {slot.startTime}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {picked && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--glass-border)] pt-4">
              <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
                Nouveau créneau : <strong>{frenchDate(picked.date)}</strong> à{" "}
                <strong>{picked.startTime}</strong>
              </p>
              <button
                onClick={handleReschedule}
                disabled={submitting}
                style={GLASS_PRIMARY_STYLE}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
              >
                {submitting ? "Déplacement…" : "Confirmer le déplacement"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cancel confirmation */}
      {confirmCancel && (
        <div className={`${GLASS_CARD} glass-surface rounded-2xl p-5`}>
          <p className="text-[14px] text-[color:var(--glass-ink)]">
            Confirmez-vous l&apos;annulation de ce rendez-vous ?
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setConfirmCancel(false)}
              className="rounded-full border border-[color:var(--glass-border)] px-4 py-2 text-[13px] font-medium text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
            >
              Non, garder
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              style={GLASS_PRIMARY_STYLE}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
            >
              {cancelling ? "Annulation…" : "Oui, annuler"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
