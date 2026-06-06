"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  MapPin,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import type { BookingField, DayAvailability } from "@/lib/booking/types";
import {
  addDaysYmd,
  brusselsNowParts,
  frenchDate,
  frenchDateShort,
  weekdayLabel,
} from "@/lib/booking/dates";
import { validateFormFields } from "@/lib/booking/form-fields";
import {
  GLASS_CARD,
  GLASS_INPUT,
  GLASS_LABEL,
  GLASS_PRIMARY_STYLE,
} from "@/lib/glass-classes";

// ---------------------------------------------------------------------------
// Local interfaces for API responses
// ---------------------------------------------------------------------------

interface LocationInfo {
  id: string;
  name: string;
  address: string;
}

interface AvailabilityResponse {
  location: LocationInfo | null;
  allLocations: LocationInfo[];
  communeName: string | null;
  days: DayAvailability[];
}

interface BookResponse {
  ok?: boolean;
  token?: string;
  confirmed?: boolean;
  blocked?: boolean;
  lastBookingDate?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

interface DedupeResponse {
  blocked: boolean;
  lastBookingDate?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  slug: string;
  tenantName: string;
  brandColor: string | null;
  fields: BookingField[];
  dedupeField: string; // "email" | "name" | "nrn"
  initialCp: string | null;
  prefill: { name: string; email: string } | null;
}

// ---------------------------------------------------------------------------
// Screen state discriminated union
// ---------------------------------------------------------------------------

type Screen =
  | { type: "calendar" }
  | { type: "form"; locationId: string; date: string; startTime: string; endTime: string }
  | { type: "success"; token: string; confirmed: boolean; address: string }
  | { type: "blocked"; lastBookingDate: string; address: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTHS_ABBR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function dayHeaderLabel(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(d)} ${MONTHS_ABBR[Number(m) - 1]}`;
}

function buildInitialFormData(
  fields: BookingField[],
  prefill: { name: string; email: string } | null,
): Record<string, string | boolean> {
  const data: Record<string, string | boolean> = {};
  for (const f of fields) {
    if (f.type === "checkbox") {
      data[f.key] = false;
    } else if (prefill) {
      if (f.role === "email" || f.type === "email") {
        data[f.key] = prefill.email;
      } else if (f.role === "name") {
        // split name into first/last if possible
        const parts = prefill.name.trim().split(/\s+/);
        if (f.key.toLowerCase().includes("first") || f.key.toLowerCase().includes("prenom")) {
          data[f.key] = parts.slice(1).join(" ") || parts[0] || "";
        } else if (f.key.toLowerCase().includes("last") || f.key.toLowerCase().includes("nom")) {
          data[f.key] = parts[0] || "";
        } else {
          data[f.key] = prefill.name;
        }
      } else {
        data[f.key] = "";
      }
    } else {
      data[f.key] = "";
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BookingFlow({
  slug,
  tenantName,
  fields,
  dedupeField,
  initialCp,
  prefill,
}: Props) {
  const todayYmd = brusselsNowParts().ymd;
  const [screen, setScreen] = useState<Screen>({ type: "calendar" });

  // --- Calendar state ---
  const [from, setFrom] = useState(todayYmd);
  const [locationId, setLocationId] = useState<string>("");
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);

  // --- Form state ---
  const [formData, setFormData] = useState<Record<string, string | boolean>>(() =>
    buildInitialFormData(fields, prefill),
  );
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dedupeBlocked, setDedupeBlocked] = useState<{
    lastBookingDate: string;
    address: string;
  } | null>(null);

  // --- Fetch availability ---
  const fetchAvailability = useCallback(
    async (fromDate: string, locId: string) => {
      setLoadingAvail(true);
      try {
        const params = new URLSearchParams({ from: fromDate, days: "7" });
        if (initialCp) params.set("cp", initialCp);
        if (locId) params.set("locationId", locId);

        const res = await fetch(`/api/booking/${slug}/availability?${params.toString()}`);
        if (!res.ok) throw new Error("Erreur lors du chargement des disponibilités");
        const data: AvailabilityResponse = await res.json();
        setAvailability(data);
        // If no locationId was set yet, use the resolved one
        if (!locId && data.location?.id) {
          setLocationId(data.location.id);
        }
      } catch {
        toast.error("Impossible de charger les disponibilités. Réessayez.");
      } finally {
        setLoadingAvail(false);
      }
    },
    [slug, initialCp],
  );

  // Initial fetch
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchAvailability(from, locationId);
    }
  }, [fetchAvailability, from, locationId]);

  function handleWeekPrev() {
    const newFrom = addDaysYmd(from, -7);
    const f = newFrom < todayYmd ? todayYmd : newFrom;
    setFrom(f);
    fetchAvailability(f, locationId);
  }

  function handleWeekNext() {
    const f = addDaysYmd(from, 7);
    setFrom(f);
    fetchAvailability(f, locationId);
  }

  function handleLocationChange(newLocId: string) {
    setLocationId(newLocId);
    fetchAvailability(from, newLocId);
  }

  function handleSlotSelect(
    day: DayAvailability,
    slot: { startTime: string; endTime: string },
  ) {
    const resolvedLocId =
      locationId || availability?.location?.id || "";
    setScreen({
      type: "form",
      locationId: resolvedLocId,
      date: day.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    setDedupeBlocked(null);
  }

  // --- Dedupe check on blur ---
  async function handleDedupeBlur(value: string) {
    if (!value.trim()) return;
    const body: Record<string, string> = {};
    if (dedupeField === "email") body.email = value.trim();
    else if (dedupeField === "name") body.name = value.trim();
    else if (dedupeField === "nrn") body.nrn = value.trim();
    else body.email = value.trim();

    try {
      const res = await fetch(`/api/booking/${slug}/dedupe-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const data: DedupeResponse = await res.json();
      if (data.blocked && data.lastBookingDate) {
        const address =
          availability?.location?.address ??
          availability?.allLocations[0]?.address ??
          "";
        setDedupeBlocked({ lastBookingDate: data.lastBookingDate, address });
      }
    } catch {
      // silent — dedupe check is best-effort
    }
  }

  // --- Form submission ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (screen.type !== "form") return;

    // Validation client complète (mêmes règles Zod que le serveur) → erreurs
    // par champ, affichées en rouge sous chaque champ concerné.
    const validation = validateFormFields(fields, formData);
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      toast.error("Veuillez corriger les champs indiqués en rouge.");
      focusFirstError(validation.errors);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      const res = await fetch(`/api/booking/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: screen.locationId,
          date: screen.date,
          startTime: screen.startTime,
          formData,
        }),
      });

      const data: BookResponse = await res.json();

      if (res.status === 201 && data.ok && data.token !== undefined) {
        const address =
          availability?.allLocations.find((l) => l.id === screen.locationId)
            ?.address ??
          availability?.location?.address ??
          "";
        setScreen({
          type: "success",
          token: data.token,
          confirmed: data.confirmed ?? false,
          address,
        });
        return;
      }

      if (res.status === 409 && data.blocked && data.lastBookingDate) {
        const address =
          availability?.allLocations.find((l) => l.id === screen.locationId)
            ?.address ??
          availability?.location?.address ??
          "";
        setScreen({
          type: "blocked",
          lastBookingDate: data.lastBookingDate,
          address,
        });
        return;
      }

      if (res.status === 409 && data.error) {
        toast.error(data.error);
        // Créneau complet : revenir au calendrier et refetch
        setScreen({ type: "calendar" });
        fetchAvailability(from, locationId);
        return;
      }

      if (res.status === 400) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
          focusFirstError(data.fieldErrors);
        }
        toast.error(data.error ?? "Formulaire invalide. Vérifiez les champs.");
        return;
      }

      toast.error("Une erreur est survenue. Veuillez réessayer.");
    } catch {
      toast.error("Erreur réseau. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function focusFirstError(errs: Record<string, string>) {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    const el = document.getElementById(firstKey);
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function updateField(key: string, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  }

  function renderField(f: BookingField) {
    const val = formData[f.key];
    const strVal = typeof val === "string" ? val : "";
    const boolVal = typeof val === "boolean" ? val : false;
    const err = fieldErrors[f.key];
    const errBorder = err ? " !border-rose-400 focus:!ring-rose-300" : "";

    // Determine if this field triggers dedupe check on blur
    const isDedupeField =
      (dedupeField === "email" && (f.role === "email" || f.type === "email")) ||
      (dedupeField === "name" && f.role === "name") ||
      (dedupeField === "nrn" && (f.role === "nrn" || f.type === "nrn"));

    const commonInputClass = `${GLASS_INPUT} h-10 w-full rounded-2xl border px-3 text-[14px] outline-none focus:ring-2 focus:ring-[color:var(--glass-accent-deep)]`;

    if (f.type === "checkbox") {
      return (
        <div key={f.key} className="flex flex-col gap-1">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={boolVal}
              onChange={(e) => updateField(f.key, e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-[color:var(--glass-accent-deep)]"
            />
            <span className="text-[14px] text-[color:var(--glass-ink-soft)]">
              {f.label}
              {f.required && <span className="ml-1 text-rose-500">*</span>}
            </span>
          </label>
          {err && <p className="text-[12px] font-medium text-rose-600">{err}</p>}
        </div>
      );
    }

    if (f.type === "select") {
      return (
        <div key={f.key} className="flex flex-col gap-1.5">
          <label htmlFor={f.key} className={GLASS_LABEL}>
            {f.label}
            {f.required && <span className="ml-1 text-rose-500">*</span>}
          </label>
          <select
            id={f.key}
            value={strVal}
            onChange={(e) => updateField(f.key, e.target.value)}
            className={`${commonInputClass}${errBorder}`}
          >
            <option value="">Choisir…</option>
            {(f.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {err && <p className="text-[12px] font-medium text-rose-600">{err}</p>}
        </div>
      );
    }

    if (f.type === "textarea") {
      return (
        <div key={f.key} className="flex flex-col gap-1.5">
          <label htmlFor={f.key} className={GLASS_LABEL}>
            {f.label}
            {f.required && <span className="ml-1 text-rose-500">*</span>}
          </label>
          <textarea
            id={f.key}
            value={strVal}
            maxLength={f.maxLength ?? 2000}
            placeholder={f.placeholder}
            onChange={(e) => updateField(f.key, e.target.value)}
            rows={3}
            className={`${GLASS_INPUT} w-full rounded-2xl border px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[color:var(--glass-accent-deep)]${errBorder}`}
          />
          {err && <p className="text-[12px] font-medium text-rose-600">{err}</p>}
        </div>
      );
    }

    // All remaining input types (text, email, tel, date, nrn, postal_code)
    const inputType =
      f.type === "email"
        ? "email"
        : f.type === "tel"
          ? "tel"
          : f.type === "date"
            ? "date"
            : "text";

    const placeholder =
      f.placeholder ??
      (f.type === "nrn" ? "00.00.00-000.00" : f.type === "postal_code" ? "1000" : undefined);

    const inputMode =
      f.type === "postal_code" || f.type === "nrn"
        ? ("numeric" as const)
        : undefined;

    const maxLen =
      f.type === "postal_code"
        ? 4
        : f.type === "nrn"
          ? 15
          : f.maxLength;

    return (
      <div key={f.key} className="flex flex-col gap-1.5">
        <label htmlFor={f.key} className={GLASS_LABEL}>
          {f.label}
          {f.required && <span className="ml-1 text-rose-500">*</span>}
        </label>
        <input
          id={f.key}
          type={inputType}
          value={strVal}
          maxLength={maxLen}
          inputMode={inputMode}
          placeholder={placeholder}
          onChange={(e) => updateField(f.key, e.target.value)}
          onBlur={isDedupeField ? () => handleDedupeBlur(strVal) : undefined}
          className={`${commonInputClass}${errBorder}`}
        />
        {err && <p className="text-[12px] font-medium text-rose-600">{err}</p>}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render screens
  // ---------------------------------------------------------------------------

  if (screen.type === "success") {
    return (
      <div className={`${GLASS_CARD} glass-surface mx-auto w-full max-w-xl rounded-2xl p-6`}>
        <div className="flex flex-col gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <CalendarDays className="text-emerald-600" size={24} />
          </div>
          <div>
            <h2 className="text-[20px] font-semibold text-[color:var(--glass-ink)]">
              {screen.confirmed
                ? "Votre rendez-vous est confirmé"
                : "Votre demande est enregistrée"}
            </h2>
            {!screen.confirmed && (
              <p className="mt-1 text-[14px] text-[color:var(--glass-ink-soft)]">
                Votre demande est en cours de validation. Vous recevrez un email de confirmation.
              </p>
            )}
          </div>
          <Link
            href={`/rendez-vous/gestion/${screen.token}`}
            className="inline-flex w-fit items-center gap-2 rounded-full px-5 py-2 text-[14px] font-semibold transition-opacity hover:opacity-80"
            style={GLASS_PRIMARY_STYLE}
          >
            Gérer ma demande
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  if (screen.type === "blocked") {
    return (
      <div className={`${GLASS_CARD} glass-surface mx-auto w-full max-w-xl rounded-2xl p-6`}>
        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] font-semibold text-[color:var(--glass-ink)]">
            Rendez-vous existant
          </h2>
          <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
            Vous avez déjà un rendez-vous récent (le{" "}
            <strong>{frenchDateShort(screen.lastBookingDate)}</strong>). Veuillez
            vous présenter directement au bureau&nbsp;:{" "}
            <strong>{screen.address}</strong>.
          </p>
          <button
            onClick={() => {
              setScreen({ type: "calendar" });
              fetchAvailability(from, locationId);
            }}
            className="flex items-center gap-1 self-start text-[13px] text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
          >
            <ChevronLeft size={14} />
            Retour au calendrier
          </button>
        </div>
      </div>
    );
  }

  // --- Calendar screen ---
  if (screen.type === "calendar") {
    const daysWithSlots =
      availability?.days.filter((d) => d.slots.length > 0) ?? [];
    const isPrevDisabled = from <= todayYmd;
    const loc = availability?.location ?? null;

    // Matrice heures × jours (lignes = heures, colonnes = jours).
    const allTimes = [
      ...new Set(daysWithSlots.flatMap((d) => d.slots.map((s) => s.startTime))),
    ].sort();
    const slotAt = (day: DayAvailability, time: string) =>
      day.slots.find((s) => s.startTime === time);

    const steps = [
      {
        Icon: CalendarDays,
        title: "Sélectionnez un créneau",
        desc: "Choisissez le jour et l'heure qui vous conviennent.",
      },
      {
        Icon: UserRound,
        title: "Vos coordonnées",
        desc: "Indiquez vos informations pour confirmer le rendez-vous.",
      },
      {
        Icon: CheckCircle2,
        title: "Confirmation par email",
        desc: "Vous recevez un email avec tous les détails.",
      },
    ];

    const weekRange = `${frenchDateShort(from)} → ${frenchDateShort(addDaysYmd(from, 6))}`;

    return (
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* ── Carte d'info ── */}
        <aside className={`${GLASS_CARD} glass-surface flex flex-col gap-5 rounded-2xl p-5`}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
              Prise de rendez-vous
            </p>
            <h1 className="glass-display mt-1 text-[30px] font-semibold leading-none">
              {tenantName}
            </h1>
          </div>

          {loc && (
            <div className="flex items-start gap-2 text-[13px] text-[color:var(--glass-ink-soft)]">
              <MapPin
                size={15}
                className="mt-0.5 flex-shrink-0 text-[color:var(--glass-accent-deep)]"
              />
              <span>
                <strong className="text-[color:var(--glass-ink)]">{loc.name}</strong>
                {loc.address && (
                  <>
                    <br />
                    {loc.address}
                  </>
                )}
              </span>
            </div>
          )}

          {availability && availability.allLocations.length > 1 && (
            <select
              aria-label="Antenne"
              value={locationId || loc?.id || ""}
              onChange={(e) => handleLocationChange(e.target.value)}
              className={`${GLASS_INPUT} h-9 rounded-xl border px-2 text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--glass-accent-deep)]`}
            >
              {availability.allLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          <div className="h-px bg-[color:var(--glass-border)]" />

          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-semibold text-[color:var(--glass-ink)]">
              Comment ça fonctionne&nbsp;?
            </p>
            {steps.map((s) => (
              <div key={s.title} className="flex items-start gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[color:var(--glass-border)] text-[color:var(--glass-accent-deep)]">
                  <s.Icon size={15} />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-[color:var(--glass-ink)]">
                    {s.title}
                  </p>
                  <p className="text-[12px] leading-snug text-[color:var(--glass-ink-faint)]">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="h-px bg-[color:var(--glass-border)]" />

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
              Semaine sélectionnée
            </p>
            <p className="mt-1.5 flex items-center gap-2 text-[14px] font-medium text-[color:var(--glass-ink)]">
              <CalendarDays size={15} className="text-[color:var(--glass-accent-deep)]" />
              {weekRange}
            </p>
          </div>

          <Link
            href="/aidez-moi"
            className="mt-auto flex items-center gap-2 rounded-xl border border-[color:var(--glass-border)] p-3 text-[13px] text-[color:var(--glass-ink-soft)] transition-colors hover:text-[color:var(--glass-ink)]"
          >
            <HelpCircle size={16} className="flex-shrink-0 text-[color:var(--glass-accent-deep)]" />
            <span>
              Besoin d&apos;aide&nbsp;?{" "}
              <span className="text-[color:var(--glass-accent-deep)]">
                Consulter notre guide
              </span>
            </span>
          </Link>
        </aside>

        {/* ── Calendrier ── */}
        <div className={`${GLASS_CARD} glass-surface flex flex-col gap-4 rounded-2xl p-5`}>
          {/* Navigation semaine */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleWeekPrev}
              disabled={isPrevDisabled || loadingAvail}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-[color:var(--glass-ink-soft)] transition-colors hover:text-[color:var(--glass-ink)] disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft size={15} />
              <span className="hidden sm:inline">Semaine précédente</span>
            </button>
            <span className="text-[15px] font-semibold text-[color:var(--glass-ink)]">
              {weekRange}
            </span>
            <button
              onClick={handleWeekNext}
              disabled={loadingAvail}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-[color:var(--glass-ink-soft)] transition-colors hover:text-[color:var(--glass-ink)] disabled:pointer-events-none disabled:opacity-40"
            >
              <span className="hidden sm:inline">Semaine suivante</span>
              <ChevronRight size={15} />
            </button>
          </div>

          {loadingAvail && (
            <div className="py-12 text-center text-[14px] text-[color:var(--glass-ink-faint)]">
              Chargement des disponibilités…
            </div>
          )}

          {!loadingAvail && daysWithSlots.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
                Aucun créneau disponible cette semaine.
              </p>
              <p className="mt-1 text-[12px] text-[color:var(--glass-ink-faint)]">
                Essayez la semaine suivante.
              </p>
            </div>
          )}

          {!loadingAvail && daysWithSlots.length > 0 && (
            <>
              <div className="flex items-center justify-between border-b border-[color:var(--glass-border)] pb-2">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--glass-ink-soft)]">
                  <Clock size={14} />
                  Créneaux disponibles
                </span>
                <span className="text-[12px] text-[color:var(--glass-ink-faint)]">
                  GMT+2
                </span>
              </div>

              <div className="overflow-x-auto pb-1">
                <div
                  className="grid min-w-max gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${daysWithSlots.length}, minmax(130px, 1fr))`,
                  }}
                >
                  {/* En-têtes jours */}
                  {daysWithSlots.map((day) => {
                    const isToday = day.date === todayYmd;
                    return (
                      <div
                        key={`h-${day.date}`}
                        className={`flex flex-col items-center rounded-xl border px-2 py-2 text-center ${
                          isToday
                            ? "border-[color:var(--glass-accent-deep)]"
                            : "border-transparent"
                        }`}
                      >
                        <span className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--glass-ink-faint)]">
                          {weekdayLabel(day.weekday, true)}.
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--glass-ink)]">
                          {dayHeaderLabel(day.date)}
                          {isToday && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--glass-accent-deep)]" />
                          )}
                        </span>
                      </div>
                    );
                  })}

                  {/* Cellules heures × jours */}
                  {allTimes.map((time) =>
                    daysWithSlots.map((day) => {
                      const slot = slotAt(day, time);
                      if (!slot) {
                        return <div key={`${day.date}-${time}`} aria-hidden />;
                      }
                      return (
                        <button
                          key={`${day.date}-${time}`}
                          onClick={() => handleSlotSelect(day, slot)}
                          className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-2 text-left transition-all hover:border-[color:var(--glass-accent-deep)] hover:shadow-sm"
                        >
                          <span className="text-[13px] font-semibold text-[color:var(--glass-ink)]">
                            {slot.startTime}
                          </span>
                          <span className="text-[11px] text-[color:var(--glass-ink-faint)]">
                            {slot.remaining} {slot.remaining > 1 ? "places" : "place"}
                          </span>
                        </button>
                      );
                    }),
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Form screen ---
  if (screen.type === "form") {
    // If dedupe live-check came back blocked, show block screen
    if (dedupeBlocked) {
      return (
        <div className={`${GLASS_CARD} glass-surface mx-auto w-full max-w-xl rounded-2xl p-6`}>
          <div className="flex flex-col gap-3">
            <h2 className="text-[18px] font-semibold text-[color:var(--glass-ink)]">
              Rendez-vous existant
            </h2>
            <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
              Vous avez déjà un rendez-vous récent (le{" "}
              <strong>{frenchDateShort(dedupeBlocked.lastBookingDate)}</strong>).
              Veuillez vous présenter directement au bureau&nbsp;:{" "}
              <strong>{dedupeBlocked.address}</strong>.
            </p>
            <button
              onClick={() => {
                setDedupeBlocked(null);
                setScreen({ type: "calendar" });
                fetchAvailability(from, locationId);
              }}
              className="flex items-center gap-1 self-start text-[13px] text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
            >
              <ChevronLeft size={14} />
              Retour au calendrier
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {/* Selected slot summary */}
        <div className={`${GLASS_CARD} glass-surface rounded-2xl p-4`}>
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[color:var(--glass-accent-deep)]" />
            <span className="text-[14px] font-semibold text-[color:var(--glass-ink)]">
              {frenchDate(screen.date)}, {screen.startTime}–{screen.endTime}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className={`${GLASS_CARD} glass-surface rounded-2xl p-4`}>
          <div className="flex flex-col gap-4">
            <p className={GLASS_LABEL}>Vos informations</p>
            {fields.map((f) => renderField(f))}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setScreen({ type: "calendar" })}
                className="flex items-center gap-1 text-[13px] text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
              >
                <ChevronLeft size={14} />
                Modifier le créneau
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={GLASS_PRIMARY_STYLE}
                className="flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
              >
                {submitting ? "Envoi en cours…" : "Confirmer la demande"}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return null;
}
