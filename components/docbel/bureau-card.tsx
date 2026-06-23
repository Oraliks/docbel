"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Building2,
  Landmark,
  Users,
  Phone,
  Globe,
  CalendarCheck,
  MapPin,
  Clock,
  AlertTriangle,
  Mail,
  Flag,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeOpenStatus,
  dayLabelFr,
  type SerializedBureau,
  type BureauTypeCode,
  type BureauHours,
} from "@/lib/bureaus/types";
import type { SerializedBureauWithDistance } from "@/lib/bureaus/resolve";
import { BureauReportDialog } from "./bureau-report-dialog";

type IconProps = { className?: string; size?: number; style?: React.CSSProperties };
const TYPE_ICONS: Record<BureauTypeCode, React.ComponentType<IconProps>> = {
  CPAS: Users as unknown as React.ComponentType<IconProps>,
  COMMUNE: Landmark as unknown as React.ComponentType<IconProps>,
  ONEM: Building2 as unknown as React.ComponentType<IconProps>,
  SYNDICAT: Users as unknown as React.ComponentType<IconProps>,
  PERMANENCE: Clock as unknown as React.ComponentType<IconProps>,
  AUTRE: Building2 as unknown as React.ComponentType<IconProps>,
};

/** Clés de services connues → traduites via `service_<key>`. Une clé inconnue
 * retombe sur sa valeur brute (donnée). */
const KNOWN_SERVICE_KEYS = new Set([
  "RIS",
  "aide_juridique",
  "aide_alimentaire",
  "domiciliation",
  "energie",
  "logement",
  "etat_civil",
  "population",
  "urbanisme",
  "chomage",
  "controle",
  "permanence_sociale",
  "rdv_obligatoire",
]);

type Props = {
  bureau: SerializedBureau | SerializedBureauWithDistance;
  accent?: string;
  /** Variantes :
   *   - "attitre" : gros, fond teinté, bordure colorée, badge fort
   *   - "default" : standard
   *   - "compact" : pour callout, sans services ni accordéon
   */
  variant?: "attitre" | "default" | "compact";
  label?: string;
  enableReport?: boolean;
};

export function BureauCard({
  bureau,
  accent: accentProp,
  variant = "default",
  label,
  enableReport = true,
}: Props) {
  const t = useTranslations("public.shared");
  const [reportOpen, setReportOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const accent = accentProp ?? bureau.organismeColor ?? "#C8102E";
  const Icon = TYPE_ICONS[bureau.type] ?? Building2;
  const distance =
    "distanceKm" in bureau && typeof bureau.distanceKm === "number" ? bureau.distanceKm : null;
  const status = computeOpenStatus(bureau.hours);
  const todayHours = getTodayHoursSummary(bureau.hours, t);

  const isAttitre = variant === "attitre";
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "group rounded-xl flex flex-col gap-2 transition-all duration-200",
        isAttitre
          ? "p-5 shadow-sm hover:shadow-md"
          : isCompact
          ? "p-3"
          : "p-4 hover:shadow-sm hover:-translate-y-0.5",
        isAttitre ? "border-[1.5px]" : "border"
      )}
      style={{
        borderColor: isAttitre ? accent : "var(--border)",
        background: isAttitre ? `${accent}08` : "var(--surface-2)",
      }}
    >
      {/* Header : icône + nom + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div
            className={cn(
              "flex items-center justify-center rounded-lg shrink-0",
              isAttitre ? "w-10 h-10" : "w-8 h-8"
            )}
            style={{ background: `${accent}15`, color: accent }}
          >
            <Icon size={isAttitre ? 20 : 16} />
          </div>
          <div className="min-w-0 flex-1">
            <h4
              className={cn(
                "font-bold leading-tight text-[var(--foreground)]",
                isAttitre ? "text-base" : "text-sm"
              )}
            >
              {bureau.name}
            </h4>
            <div className="text-xs text-[var(--text-muted)] leading-snug mt-0.5 flex items-center gap-1 flex-wrap">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{bureau.fullAddress}</span>
              {distance !== null && (
                <span className="font-semibold whitespace-nowrap" style={{ color: accent }}>
                  · {distance.toFixed(1)} km
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {label && (
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                isAttitre ? "text-white" : "text-[var(--text-muted)] bg-[var(--border)]"
              )}
              style={isAttitre ? { backgroundColor: accent } : undefined}
            >
              {label}
            </span>
          )}
          {bureau.verified && (
            <span
              className="text-[9.5px] font-semibold uppercase tracking-wider text-green-700 dark:text-green-400"
              title={t("verifiedTitle")}
            >
              ✓ {t("verified")}
            </span>
          )}
        </div>
      </div>

      {/* Aujourd'hui : ligne hyper visible */}
      {!isCompact && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs",
            getTodayBackground(status)
          )}
        >
          <Clock size={12} className="shrink-0" />
          <span className="font-semibold">{t("todayLabel")}</span>
          <span className="flex-1 truncate">{todayHours}</span>
          <OpenChip status={status} t={t} />
        </div>
      )}

      {/* Notes horaires en alerte */}
      {bureau.hoursNotes && !isCompact && (
        <div className="text-[11px] flex items-start gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-100/40 border border-amber-300/40 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" />
          <span>{bureau.hoursNotes}</span>
        </div>
      )}

      {/* Services en chips */}
      {!isCompact && bureau.services.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {bureau.services.slice(0, 6).map((s) => (
            <span
              key={s}
              className="text-[10.5px] px-2 py-0.5 rounded-full bg-[var(--border)]/60 text-[var(--text-muted)]"
            >
              {KNOWN_SERVICE_KEYS.has(s)
                ? t(`service_${s}` as Parameters<typeof t>[0])
                : s}
            </span>
          ))}
        </div>
      )}

      {/* CTA principal (RDV) — gros */}
      {bureau.appointmentUrl && (
        <a
          href={bureau.appointmentUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex items-center justify-center gap-1.5 font-bold text-white rounded-lg transition-transform hover:scale-[1.02]",
            isAttitre ? "px-4 py-2.5 text-sm" : "px-3 py-2 text-xs"
          )}
          style={{ backgroundColor: accent }}
        >
          <CalendarCheck size={isAttitre ? 16 : 13} />
          {t("bookAppointment")}
        </a>
      )}

      {/* Actions secondaires */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        {bureau.phone && (
          <a
            href={`tel:${bureau.phone.replace(/\s/g, "")}`}
            className="inline-flex items-center gap-1 no-underline hover:underline"
            style={{ color: accent }}
          >
            <Phone size={11} /> {bureau.phone}
          </a>
        )}
        {bureau.email && (
          <a
            href={`mailto:${bureau.email}`}
            className="inline-flex items-center gap-1 no-underline hover:underline"
            style={{ color: accent }}
          >
            <Mail size={11} /> {t("email")}
          </a>
        )}
        {bureau.website && (
          <a
            href={bureau.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 no-underline hover:underline"
            style={{ color: accent }}
          >
            <Globe size={11} /> {t("website")}
          </a>
        )}
      </div>

      {/* Accordéon horaires semaine */}
      {!isCompact && bureau.hours.length > 0 && (
        <div className="border-t border-[var(--border)] pt-2 mt-1">
          <button
            type="button"
            onClick={() => setHoursOpen(!hoursOpen)}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--foreground)] inline-flex items-center gap-1 transition-colors"
          >
            {t("seeAllHours")}{" "}
            {hoursOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          {hoursOpen && <WeekHoursTable hours={bureau.hours} />}
        </div>
      )}

      {/* Footer : signaler */}
      {enableReport && !isCompact && (
        <div className="flex justify-end mt-0.5">
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="text-[10.5px] inline-flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:underline"
          >
            <Flag size={9} /> {t("reportError")}
          </button>
        </div>
      )}

      {enableReport && (
        <BureauReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          bureauId={bureau.id}
          bureauName={bureau.name}
        />
      )}
    </div>
  );
}

/** Skeleton pour les cartes en chargement */
export function BureauCardSkeleton({ variant = "default" }: { variant?: "attitre" | "default" }) {
  const isAttitre = variant === "attitre";
  return (
    <div
      className={cn(
        "rounded-xl border bg-[var(--surface-2)] animate-pulse",
        isAttitre ? "p-5" : "p-4"
      )}
    >
      <div className="flex items-start gap-2.5 mb-3">
        <div
          className={cn("rounded-lg bg-[var(--border)]/60", isAttitre ? "w-10 h-10" : "w-8 h-8")}
        />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-3/4 bg-[var(--border)]/60 rounded" />
          <div className="h-2.5 w-1/2 bg-[var(--border)]/40 rounded" />
        </div>
      </div>
      <div className="h-6 w-full bg-[var(--border)]/40 rounded mb-2" />
      <div className="flex gap-1.5">
        <div className="h-4 w-14 bg-[var(--border)]/40 rounded-full" />
        <div className="h-4 w-20 bg-[var(--border)]/40 rounded-full" />
      </div>
    </div>
  );
}

// ───────── helpers ─────────

type TFn = ReturnType<typeof useTranslations<"public.shared">>;

function OpenChip({
  status,
  t,
}: {
  status: ReturnType<typeof computeOpenStatus>;
  t: TFn;
}) {
  const base = "text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0";
  if (status.state === "open") {
    return (
      <span className={`${base} bg-green-500/20 text-green-700 dark:text-green-400`}>
        ● {t("open")}
      </span>
    );
  }
  if (status.state === "holiday") {
    return (
      <span className={`${base} bg-purple-500/20 text-purple-700 dark:text-purple-400`}>
        {t("holiday")}
      </span>
    );
  }
  return (
    <span className={`${base} bg-red-500/15 text-red-700 dark:text-red-400`}>{t("closed")}</span>
  );
}

function getTodayBackground(status: ReturnType<typeof computeOpenStatus>): string {
  if (status.state === "open") return "bg-green-50 dark:bg-green-950/30 text-green-900 dark:text-green-200";
  if (status.state === "holiday") return "bg-purple-50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200";
  return "bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200";
}

/** "9h–12h · 13h–16h" pour aujourd'hui, ou "Fermé · ouvre lun. 09:00" */
function getTodayHoursSummary(hours: BureauHours, t: TFn): string {
  const now = new Date();
  const today = now.getDay();
  const todaySlots = hours.find((h) => h.day === today)?.slots ?? [];
  const status = computeOpenStatus(hours, now);

  if (status.state === "holiday") {
    return t("holidayWithName", { name: status.holidayName });
  }
  if (todaySlots.length > 0) {
    return todaySlots.map((s) => `${s.open}–${s.close}`).join(" · ");
  }
  if (status.state === "closed" && status.nextOpen) {
    return t("closedOpensAt", {
      day: dayLabelFr(status.nextOpen.day),
      time: status.nextOpen.time,
    });
  }
  return t("closedToday");
}

function WeekHoursTable({ hours }: { hours: BureauHours }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
      {order.map((d) => {
        const slots = hours.find((h) => h.day === d)?.slots ?? [];
        return (
          <div key={d} className="contents">
            <span className="font-semibold">{dayLabelFr(d)}</span>
            <span>
              {slots.length === 0
                ? "—"
                : slots.map((s) => `${s.open}–${s.close}`).join(" · ")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
