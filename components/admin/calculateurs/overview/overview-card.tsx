import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  type CalcMethodology,
  RELIABILITY_LABELS,
} from "@/lib/calculators/_methodology";
import { cn } from "@/lib/utils";
import { getOverviewIcon } from "./_icons";

interface OverviewCardProps {
  data: CalcMethodology;
}

/**
 * Map des couleurs Tailwind par niveau de fiabilité — utilisées
 * pour le badge et le carré-icône à gauche de la card.
 *
 * On préfère les classes Tailwind (vs styles inline) pour profiter du
 * dark mode et garder la classlist auditable.
 */
const RELIABILITY_BADGE: Record<
  CalcMethodology["reliability"],
  { badge: string; iconBg: string; iconText: string }
> = {
  high: {
    badge:
      "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    iconText: "text-emerald-700 dark:text-emerald-300",
  },
  medium: {
    badge:
      "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    iconBg: "bg-amber-500/10 dark:bg-amber-500/15",
    iconText: "text-amber-700 dark:text-amber-300",
  },
  low: {
    badge:
      "bg-red-500/10 text-red-700 border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
    iconBg: "bg-red-500/10 dark:bg-red-500/15",
    iconText: "text-red-700 dark:text-red-300",
  },
};

/**
 * Card horizontale compacte d'un calculateur dans la liste d'overview.
 *
 * Toute la card est cliquable (via Link englobant) et navigue vers la
 * fiche détail. Le rendu est conçu pour 2 cards par ligne sur desktop
 * (et 1 sur mobile), avec un padding compact pour gagner en densité
 * verticale.
 */
export function OverviewCard({ data }: OverviewCardProps) {
  const Icon = getOverviewIcon(data.slug);
  const tones = RELIABILITY_BADGE[data.reliability];
  const reliabilityLabel = RELIABILITY_LABELS[data.reliability];

  return (
    <Link
      href={`/admin/chomage/outils/calculateurs/${data.slug}`}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all",
        "hover:bg-muted/40 hover:border-primary/30 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/* Icône domaine ----------------------------------------------- */}
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tones.iconBg,
          tones.iconText,
        )}
      >
        <Icon className="size-4" />
      </div>

      {/* Titre + pitch ------------------------------------------------ */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-foreground group-hover:text-primary">
          {data.title}
        </p>
        <p className="line-clamp-1 text-[11.5px] text-muted-foreground">
          {data.pitch}
        </p>
      </div>

      {/* Badge fiabilité + flèche ------------------------------------- */}
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            tones.badge,
          )}
        >
          {reliabilityLabel}
        </span>
        <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}
