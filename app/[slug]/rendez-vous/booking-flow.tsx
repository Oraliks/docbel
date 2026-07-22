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
  Mail,
  MapPin,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { BookingField, DayAvailability } from "@/lib/booking/types";
import {
  addDaysYmd,
  brusselsNowParts,
} from "@/lib/booking/dates";
import {
  localeDate,
  BOOKING_LOCALES,
  BOOKING_LOCALE_LABELS,
  type BookingLocale,
} from "@/lib/booking/i18n";
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
  manageToken?: string;
  slotFull?: boolean;
  pendingVerification?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

interface DedupeResponse {
  blocked: boolean;
  lastBookingDate?: string;
  manageToken?: string;
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
  initialFrom: string;
  initialAvailability: AvailabilityResponse | null;
  locale: BookingLocale;
}

// ---------------------------------------------------------------------------
// Screen state discriminated union
// ---------------------------------------------------------------------------

type Screen =
  | { type: "calendar" }
  | { type: "form"; locationId: string; date: string; startTime: string; endTime: string }
  | {
      type: "success";
      token: string;
      confirmed: boolean;
      address: string;
      pendingVerification?: boolean;
    }
  | {
      type: "blocked";
      lastBookingDate: string;
      address: string;
      manageToken?: string;
    }
  | {
      type: "waitlist";
      locationId: string;
      date: string;
      startTime: string;
      endTime: string;
    }
  | { type: "waitlistDone"; date: string; startTime: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INTL_TAG: Record<BookingLocale, string> = { fr: "fr-BE", nl: "nl-BE", en: "en-GB", de: "de-DE" };

function shortDate(ymd: string, locale: BookingLocale): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));
}

function weekdayShort(ymd: string, locale: BookingLocale): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], { weekday: "short", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));
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

/** Récupère la valeur du champ email du formulaire (pré-remplit le renvoi de lien). */
function emailFromForm(
  fields: BookingField[],
  formData: Record<string, string | boolean>,
): string {
  const f = fields.find((x) => x.role === "email" || x.type === "email");
  const v = f ? formData[f.key] : "";
  return typeof v === "string" ? v : "";
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
  initialFrom,
  initialAvailability,
  locale,
}: Props) {
  const t = useTranslations("public.landing");
  const todayYmd = brusselsNowParts().ymd;
  const [screen, setScreen] = useState<Screen>({ type: "calendar" });

  // --- Calendar state ---
  const [from, setFrom] = useState(initialFrom);
  const [locationId, setLocationId] = useState<string>(
    initialAvailability?.location?.id ?? "",
  );
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(
    initialAvailability,
  );
  const [loadingAvail, setLoadingAvail] = useState(false);

  // --- Form state ---
  const [formData, setFormData] = useState<Record<string, string | boolean>>(() =>
    buildInitialFormData(fields, prefill),
  );
  const [submitting, setSubmitting] = useState(false);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dedupeBlocked, setDedupeBlocked] = useState<{
    lastBookingDate: string;
    address: string;
    manageToken?: string;
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
        if (!res.ok) throw new Error("availability-fetch-failed");
        const data: AvailabilityResponse = await res.json();
        setAvailability(data);
        // If no locationId was set yet, use the resolved one
        if (!locId && data.location?.id) {
          setLocationId(data.location.id);
        }
      } catch {
        toast.error(t("bookingToastAvailabilityError"));
      } finally {
        setLoadingAvail(false);
      }
    },
    [slug, initialCp],
  );

  // 1re semaine chargée en SSR → pas de fetch client au montage.
  const initialFetchDone = useRef(!!initialAvailability);
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
        setDedupeBlocked({
          lastBookingDate: data.lastBookingDate,
          address,
          manageToken: data.manageToken,
        });
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
      toast.error(t("bookingToastFixFields"));
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
          locale,
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
          pendingVerification: data.pendingVerification,
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
          manageToken: data.manageToken,
        });
        return;
      }

      if (res.status === 409 && data.slotFull) {
        // Créneau complet : proposer la liste d'attente (formulaire déjà rempli).
        setScreen({
          type: "waitlist",
          locationId: screen.locationId,
          date: screen.date,
          startTime: screen.startTime,
          endTime: screen.endTime,
        });
        return;
      }

      if (res.status === 409 && data.error) {
        toast.error(data.error);
        setScreen({ type: "calendar" });
        fetchAvailability(from, locationId);
        return;
      }

      if (res.status === 400) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
          focusFirstError(data.fieldErrors);
        }
        toast.error(data.error ?? t("bookingToastInvalidForm"));
        return;
      }

      toast.error(t("bookingToastGenericError"));
    } catch {
      toast.error(t("bookingToastNetworkError"));
    } finally {
      setSubmitting(false);
    }
  }

  // --- Liste d'attente (créneau complet) ---
  async function handleJoinWaitlist() {
    if (screen.type !== "waitlist") return;
    setJoiningWaitlist(true);
    try {
      const res = await fetch(`/api/booking/${slug}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: screen.locationId,
          date: screen.date,
          startTime: screen.startTime,
          formData,
          locale,
        }),
      });
      const data: { ok?: boolean; available?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (res.ok && data.ok) {
        setScreen({ type: "waitlistDone", date: screen.date, startTime: screen.startTime });
      } else if (data.available) {
        toast.info(t("bookingToastSlotAvailableAgain"));
        setScreen({ type: "calendar" });
        fetchAvailability(from, locationId);
      } else {
        toast.error(data.error ?? t("bookingToastWaitlistError"));
      }
    } catch {
      toast.error(t("bookingToastNetworkError"));
    } finally {
      setJoiningWaitlist(false);
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
    const errBorder = err ? " !border-[color:var(--destructive)] focus:!ring-[color:var(--destructive)]/40" : "";

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
              {f.required && <span className="ml-1 text-[color:var(--destructive)]">*</span>}
            </span>
          </label>
          {err && <p className="text-[12px] font-medium text-[color:var(--destructive)]">{err}</p>}
        </div>
      );
    }

    if (f.type === "select") {
      return (
        <div key={f.key} className="flex flex-col gap-1.5">
          <label htmlFor={f.key} className={GLASS_LABEL}>
            {f.label}
            {f.required && <span className="ml-1 text-[color:var(--destructive)]">*</span>}
          </label>
          <select
            id={f.key}
            value={strVal}
            onChange={(e) => updateField(f.key, e.target.value)}
            className={`${commonInputClass}${errBorder}`}
          >
            <option value="">{t("bookingSelectChoose")}</option>
            {(f.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {err && <p className="text-[12px] font-medium text-[color:var(--destructive)]">{err}</p>}
        </div>
      );
    }

    if (f.type === "textarea") {
      return (
        <div key={f.key} className="flex flex-col gap-1.5">
          <label htmlFor={f.key} className={GLASS_LABEL}>
            {f.label}
            {f.required && <span className="ml-1 text-[color:var(--destructive)]">*</span>}
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
          {err && <p className="text-[12px] font-medium text-[color:var(--destructive)]">{err}</p>}
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
          {f.required && <span className="ml-1 text-[color:var(--destructive)]">*</span>}
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
        {err && <p className="text-[12px] font-medium text-[color:var(--destructive)]">{err}</p>}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render screens
  // ---------------------------------------------------------------------------

  if (screen.type === "success") {
    const pv = screen.pendingVerification;
    return (
      <div className={`${GLASS_CARD} glass-surface mx-auto w-full max-w-xl rounded-2xl p-6`}>
        <div className="flex flex-col gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              pv ? "bg-[color:var(--glass-warning-surface)]" : "bg-[color:var(--glass-success-surface)]"
            }`}
          >
            {pv ? (
              <Mail className="text-[color:var(--glass-warning-ink)]" size={24} />
            ) : (
              <CalendarDays className="text-[color:var(--glass-success-ink)]" size={24} />
            )}
          </div>
          <div>
            <h2 className="text-[20px] font-semibold text-[color:var(--glass-ink)]">
              {pv
                ? t("bookingVerifyTitle")
                : screen.confirmed
                  ? t("bookingSuccessConfirmedTitle")
                  : t("bookingSuccessPendingTitle")}
            </h2>
            <p className="mt-1 text-[14px] text-[color:var(--glass-ink-soft)]">
              {pv
                ? t("bookingVerifyDesc")
                : screen.confirmed
                  ? t("bookingSuccessConfirmedDesc")
                  : t("bookingSuccessPendingDesc")}
            </p>
          </div>
          {!pv && (
            <Link
              href={`/rendez-vous/gestion/${screen.token}`}
              className="inline-flex w-fit items-center gap-2 rounded-full px-5 py-2 text-[14px] font-semibold transition-opacity hover:opacity-80"
              style={GLASS_PRIMARY_STYLE}
            >
              {t("bookingSuccessManage")}
              <ChevronRight size={14} />
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (screen.type === "waitlistDone") {
    return (
      <div className={`${GLASS_CARD} glass-surface mx-auto w-full max-w-xl rounded-2xl p-6`}>
        <div className="flex flex-col gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--glass-warning-surface)]">
            <Clock className="text-[color:var(--glass-warning-ink)]" size={24} />
          </div>
          <div>
            <h2 className="text-[20px] font-semibold text-[color:var(--glass-ink)]">
              {t("bookingWaitlistDoneTitle")}
            </h2>
            <p className="mt-1 text-[14px] text-[color:var(--glass-ink-soft)]">
              {t("bookingWaitlistDoneDesc", { date: localeDate(screen.date, locale), time: screen.startTime })}
            </p>
          </div>
          <button
            onClick={() => {
              setScreen({ type: "calendar" });
              fetchAvailability(from, locationId);
            }}
            className="flex items-center gap-1 self-start text-[13px] text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
          >
            <ChevronLeft size={14} />
            {t("backToCalendar")}
          </button>
        </div>
      </div>
    );
  }

  if (screen.type === "waitlist") {
    const canJoin = !!emailFromForm(fields, formData).trim();
    return (
      <div className={`${GLASS_CARD} glass-surface mx-auto w-full max-w-xl rounded-2xl p-6`}>
        <div className="flex flex-col gap-4">
          <h2 className="text-[18px] font-semibold text-[color:var(--glass-ink)]">
            {t("bookingWaitlistFullTitle")}
          </h2>
          <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
            {t("bookingWaitlistFullDesc", { date: localeDate(screen.date, locale), time: screen.startTime })}
          </p>
          {!canJoin && (
            <p className="text-[13px] text-[color:var(--glass-warning-ink)]">
              {t("bookingWaitlistNeedEmail")}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleJoinWaitlist}
              disabled={joiningWaitlist || !canJoin}
              style={GLASS_PRIMARY_STYLE}
              className="flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
            >
              {joiningWaitlist ? t("bookingWaitlistJoining") : t("bookingWaitlistJoin")}
            </button>
            <button
              onClick={() => {
                setScreen({ type: "calendar" });
                fetchAvailability(from, locationId);
              }}
              className="flex items-center gap-1 text-[13px] text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
            >
              <ChevronLeft size={14} />
              {t("bookingChooseOther")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen.type === "blocked") {
    return (
      <BlockedExisting
        slug={slug}
        locale={locale}
        lastBookingDate={screen.lastBookingDate}
        address={screen.address}
        manageToken={screen.manageToken}
        defaultEmail={emailFromForm(fields, formData)}
        onBack={() => {
          setScreen({ type: "calendar" });
          fetchAvailability(from, locationId);
        }}
      />
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
        title: t("bookingStep1Title"),
        desc: t("bookingStep1Desc"),
      },
      {
        Icon: UserRound,
        title: t("bookingStep2Title"),
        desc: t("bookingStep2Desc"),
      },
      {
        Icon: CheckCircle2,
        title: t("bookingStep3Title"),
        desc: t("bookingStep3Desc"),
      },
    ];

    const weekRange = `${shortDate(from, locale)} → ${shortDate(addDaysYmd(from, 6), locale)}`;

    return (
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* ── Carte d'info ── */}
        <aside className={`${GLASS_CARD} glass-surface flex flex-col gap-5 rounded-2xl p-5`}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
              {t("bookingSidebarKicker")}
            </p>
            <h1 className="glass-display mt-1 text-[30px] font-semibold leading-none">
              {tenantName}
            </h1>
          </div>

          <select
            aria-label={t("bookingLangLabel")}
            value={locale}
            onChange={(e) => {
              const url = new URL(window.location.href);
              url.searchParams.set("lang", e.target.value);
              window.location.href = url.toString();
            }}
            className={`${GLASS_INPUT} h-9 rounded-xl border px-2 text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--glass-accent-deep)]`}
          >
            {BOOKING_LOCALES.map((l) => (
              <option key={l} value={l}>{BOOKING_LOCALE_LABELS[l]}</option>
            ))}
          </select>

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
              aria-label={t("bookingLocationLabel")}
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
              {t("bookingHow")}
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
              {t("bookingWeekSelected")}
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
              {t("bookingNeedHelp")}{" "}
              <span className="text-[color:var(--glass-accent-deep)]">
                {t("bookingConsultGuide")}
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
              <span className="hidden sm:inline">{t("bookingWeekPrev")}</span>
            </button>
            <span className="text-[15px] font-semibold text-[color:var(--glass-ink)]">
              {weekRange}
            </span>
            <button
              onClick={handleWeekNext}
              disabled={loadingAvail}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-[color:var(--glass-ink-soft)] transition-colors hover:text-[color:var(--glass-ink)] disabled:pointer-events-none disabled:opacity-40"
            >
              <span className="hidden sm:inline">{t("bookingWeekNext")}</span>
              <ChevronRight size={15} />
            </button>
          </div>

          {loadingAvail && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[color:var(--glass-border)] pb-2">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--glass-ink-soft)]">
                  <Clock size={14} />
                  {t("bookingSlotsAvailable")}
                </span>
                <span className="text-[12px] text-[color:var(--glass-ink-faint)]">
                  GMT+2
                </span>
              </div>
              <div
                className="grid animate-pulse gap-2"
                style={{ gridTemplateColumns: "repeat(5, minmax(130px, 1fr))" }}
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={`sk-h-${i}`}
                    className="h-10 rounded-xl bg-[color:var(--glass-border)] opacity-50"
                  />
                ))}
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={`sk-c-${i}`}
                    className="h-11 rounded-xl bg-[color:var(--glass-border)] opacity-30"
                  />
                ))}
              </div>
            </div>
          )}

          {!loadingAvail && daysWithSlots.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
                {t("noSlots")}
              </p>
              <p className="mt-1 text-[12px] text-[color:var(--glass-ink-faint)]">
                {t("tryNext")}
              </p>
            </div>
          )}
          {/* (noSlots / tryNext already use externalised keys) */}

          {!loadingAvail && daysWithSlots.length > 0 && (
            <>
              <div className="flex items-center justify-between border-b border-[color:var(--glass-border)] pb-2">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--glass-ink-soft)]">
                  <Clock size={14} />
                  {t("bookingSlotsAvailable")}
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
                          {weekdayShort(day.date, locale)}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--glass-ink)]">
                          {shortDate(day.date, locale)}
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
                            {slot.remaining} {slot.remaining > 1 ? t("places") : t("place")}
                          </span>
                          {/* place/places already externalised */}
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
        <BlockedExisting
          slug={slug}
          locale={locale}
          lastBookingDate={dedupeBlocked.lastBookingDate}
          address={dedupeBlocked.address}
          manageToken={dedupeBlocked.manageToken}
          defaultEmail={emailFromForm(fields, formData)}
          onBack={() => {
            setDedupeBlocked(null);
            setScreen({ type: "calendar" });
            fetchAvailability(from, locationId);
          }}
        />
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {/* Selected slot summary */}
        <div className={`${GLASS_CARD} glass-surface rounded-2xl p-4`}>
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[color:var(--glass-accent-deep)]" />
            <span className="text-[14px] font-semibold text-[color:var(--glass-ink)]">
              {localeDate(screen.date, locale)}, {screen.startTime}–{screen.endTime}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className={`${GLASS_CARD} glass-surface rounded-2xl p-4`}>
          <div className="flex flex-col gap-4">
            <p className={GLASS_LABEL}>{t("yourInfo")}</p>
            {fields.map((f) => renderField(f))}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setScreen({ type: "calendar" })}
                className="flex items-center gap-1 text-[13px] text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
              >
                <ChevronLeft size={14} />
                {t("editSlot")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={GLASS_PRIMARY_STYLE}
                className="flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
              >
                {submitting ? t("submitting") : t("submit")}
              </button>
            </div>
          </div>
          {/* yourInfo / editSlot / submit / submitting are externalised */}
        </form>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Écran « rendez-vous existant » : ne plus être un cul-de-sac. Le propriétaire
// connecté gère/déplace en direct ; sinon on renvoie le lien par email.
// ---------------------------------------------------------------------------

function BlockedExisting({
  slug,
  locale,
  lastBookingDate,
  address,
  manageToken,
  defaultEmail,
  onBack,
}: {
  slug: string;
  locale: BookingLocale;
  lastBookingDate: string;
  address: string;
  manageToken?: string;
  defaultEmail: string;
  onBack: () => void;
}) {
  const t = useTranslations("public.landing");
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendLink() {
    if (!email.trim()) {
      toast.error(t("bookingResendNeedEmail"));
      return;
    }
    setSending(true);
    try {
      await fetch(`/api/booking/${slug}/resend-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // réponse toujours générique — on ne révèle jamais l'existence d'un RDV
    } finally {
      setSent(true);
      setSending(false);
    }
  }

  return (
    <div className={`${GLASS_CARD} glass-surface mx-auto w-full max-w-xl rounded-2xl p-6`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-[18px] font-semibold text-[color:var(--glass-ink)]">
            {t("blockedTitle")}
          </h2>
          <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
            {t("blockedDesc", { date: localeDate(lastBookingDate, locale) })}
          </p>
        </div>

        {manageToken ? (
          <Link
            href={`/rendez-vous/gestion/${manageToken}`}
            className="inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition-opacity hover:opacity-80"
            style={GLASS_PRIMARY_STYLE}
          >
            {t("blockedManage")}
            <ChevronRight size={14} />
          </Link>
        ) : sent ? (
          <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 text-[13px] text-[color:var(--glass-ink-soft)]">
            {t("blockedSent")}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
              {t("blockedEmailPrompt")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("bookingEmailPlaceholder")}
                className={`${GLASS_INPUT} h-10 flex-1 rounded-2xl border px-3 text-[14px] outline-none focus:ring-2 focus:ring-[color:var(--glass-accent-deep)]`}
              />
              <button
                onClick={sendLink}
                disabled={sending}
                style={GLASS_PRIMARY_STYLE}
                className="flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
              >
                {sending ? t("blockedSending") : t("blockedSend")}
              </button>
            </div>
          </div>
        )}

        <p className="text-[13px] text-[color:var(--glass-ink-faint)]">
          {t("blockedOffice", { address })}
        </p>

        <button
          onClick={onBack}
          className="flex items-center gap-1 self-start text-[13px] text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
        >
          <ChevronLeft size={14} />
          {t("backToCalendar")}
        </button>
      </div>
    </div>
  );
}
