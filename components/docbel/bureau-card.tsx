"use client";

import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeOpenStatus,
  dayLabelFr,
  type SerializedBureau,
  type BureauTypeCode,
} from "@/lib/bureaus/types";
import type { SerializedBureauWithDistance } from "@/lib/bureaus/resolve";
import { BureauHoursDisplay } from "./bureau-hours-display";
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

const SERVICE_LABEL_FR: Record<string, string> = {
  RIS: "RIS",
  aide_juridique: "Aide juridique",
  aide_alimentaire: "Aide alimentaire",
  domiciliation: "Domiciliation",
  energie: "Énergie",
  logement: "Logement",
  etat_civil: "État civil",
  population: "Population",
  urbanisme: "Urbanisme",
  chomage: "Chômage",
  controle: "Contrôle ONEM",
  permanence_sociale: "Permanence sociale",
  rdv_obligatoire: "RDV obligatoire",
};

type Props = {
  bureau: SerializedBureau | SerializedBureauWithDistance;
  /** Couleur d'accent (par défaut : couleur de l'organisme du bureau) */
  accent?: string;
  /** Mis en avant comme bureau attitré (border colorée) */
  attitre?: boolean;
  /** Label optionnel à afficher en pill */
  label?: string;
  /** Affiche les horaires en accordéon (défaut: true) */
  showHours?: boolean;
  /** Activer le bouton "Signaler une erreur" */
  enableReport?: boolean;
  /** Mode compact (sans services, ni horaires) — pour BureauCallout */
  compact?: boolean;
};

export function BureauCard({
  bureau,
  accent: accentProp,
  attitre = false,
  label,
  showHours = true,
  enableReport = true,
  compact = false,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const accent = accentProp ?? bureau.organismeColor ?? "#C8102E";
  const Icon = TYPE_ICONS[bureau.type] ?? Building2;
  const distance =
    "distanceKm" in bureau && typeof bureau.distanceKm === "number" ? bureau.distanceKm : null;
  const status = computeOpenStatus(bureau.hours);

  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--surface-2)] p-4 flex flex-col gap-2",
        attitre ? "border-[1.5px]" : "border"
      )}
      style={{ borderColor: attitre ? accent : "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon size={16} style={{ color: accent }} />
            <h4 className="font-bold text-[13.5px] leading-tight text-[var(--foreground)]">
              {bureau.name}
            </h4>
          </div>
          <div className="text-xs text-[var(--text-muted)] leading-snug">
            <MapPin size={11} className="inline align-middle mr-0.5" />
            {bureau.fullAddress}
            {distance !== null && (
              <span className="ml-1.5 font-semibold" style={{ color: accent }}>
                · {distance.toFixed(1)} km
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {label && (
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                attitre ? "text-white" : "text-[var(--text-muted)] bg-[var(--border)]"
              )}
              style={attitre ? { backgroundColor: accent } : undefined}
            >
              {label}
            </span>
          )}
          <OpenBadge status={status} />
        </div>
      </div>

      {bureau.hoursNotes && (
        <div className="text-[11px] flex items-start gap-1 px-2 py-1 rounded bg-amber-100/40 border border-amber-300/40 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" /> {bureau.hoursNotes}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
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
            <Mail size={11} /> Email
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
            <Globe size={11} /> Site
          </a>
        )}
        {bureau.appointmentUrl && (
          <a
            href={bureau.appointmentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 no-underline px-2.5 py-0.5 rounded font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            <CalendarCheck size={11} /> Prendre RDV
          </a>
        )}
      </div>

      {!compact && bureau.services.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {bureau.services.slice(0, 6).map((s) => (
            <span
              key={s}
              className="text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--border)] text-[var(--foreground)]"
            >
              {SERVICE_LABEL_FR[s] ?? s}
            </span>
          ))}
        </div>
      )}

      {!compact && showHours && bureau.hours.length > 0 && (
        <BureauHoursDisplay hours={bureau.hours} />
      )}

      {enableReport && !compact && (
        <div className="flex justify-end pt-1 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="text-[10.5px] inline-flex items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:underline"
          >
            <Flag size={10} /> Signaler une erreur
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

function OpenBadge({ status }: { status: ReturnType<typeof computeOpenStatus> }) {
  const base = "text-[10.5px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1";
  if (status.state === "no_data") {
    return (
      <span className={`${base} text-[var(--text-muted)]`}>Horaires non renseignés</span>
    );
  }
  if (status.state === "open") {
    return (
      <span className={`${base} bg-green-500/15 text-green-700 dark:text-green-400`}>
        ● Ouvert · ferme {status.closesAt}
      </span>
    );
  }
  if (status.state === "holiday") {
    return (
      <span className={`${base} bg-purple-500/10 text-purple-700 dark:text-purple-400`}>
        Férié ({status.holidayName})
      </span>
    );
  }
  if (status.state === "closed_today") {
    return (
      <span className={`${base} bg-red-500/10 text-red-700 dark:text-red-400`}>
        Fermé aujourd&apos;hui
      </span>
    );
  }
  if (status.state === "closed" && status.nextOpen) {
    return (
      <span className={`${base} bg-red-500/10 text-red-700 dark:text-red-400`}>
        Fermé · ouvre {dayLabelFr(status.nextOpen.day)} {status.nextOpen.time}
      </span>
    );
  }
  return (
    <span className={`${base} bg-red-500/10 text-red-700 dark:text-red-400`}>Fermé</span>
  );
}
