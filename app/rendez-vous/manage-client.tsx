"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Download, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import type { BookingStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/booking/status";
import { frenchDate } from "@/lib/booking/dates";
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
  location: { name: string; address: string };
  canCancel: boolean;
  canDownloadIcs: boolean;
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
      {(data.canDownloadIcs || data.canCancel) && (
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

          {data.canCancel && !confirmCancel && (
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
