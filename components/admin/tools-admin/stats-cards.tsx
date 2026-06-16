import {
  Building2,
  CheckCircle2,
  CircleSlash,
  Handshake,
  LayoutGrid,
  type LucideIcon,
  Star,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCounts } from "./types";

interface StatsCardsProps {
  counts: ToolCounts;
}

/**
 * Bandeau de stats horizontal en tête de /admin/chomage/outils (refonte
 * mockup 2026-06). Un seul conteneur carte, plusieurs stats inline séparées
 * par un filet vertical. Aux 4 globaux s'ajoutent les compteurs par segment
 * d'accès (Citoyen/Employeur/Partenaire) — calculés en amont via
 * `effectiveRules`. Pas de stat "Admin" : un admin voit tout par définition,
 * ce n'est pas un segment d'accès.
 */
export function StatsCards({ counts }: StatsCardsProps) {
  return (
    <div className="flex flex-wrap items-stretch divide-x divide-border rounded-xl border border-border bg-card">
      <Stat
        icon={LayoutGrid}
        value={counts.total}
        label="Total"
        tone="slate"
        accent
      />
      <Stat
        icon={CheckCircle2}
        value={counts.active}
        label="Actifs"
        tone="emerald"
      />
      <Stat
        icon={CircleSlash}
        value={counts.inactive}
        label="Inactif"
        tone="red"
      />
      <Stat icon={Star} value={counts.popular} label="Populaires" tone="amber" />
      <Stat icon={User} value={counts.citoyen} label="Citoyen" tone="blue" />
      <Stat
        icon={Building2}
        value={counts.employeur}
        label="Employeur"
        tone="violet"
      />
      <Stat
        icon={Handshake}
        value={counts.partenaire}
        label="Partenaire"
        tone="amber"
      />
    </div>
  );
}

type Tone = "emerald" | "amber" | "red" | "slate" | "blue" | "violet";

const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
  slate: "text-slate-500 dark:text-slate-400",
  blue: "text-blue-600 dark:text-blue-400",
  violet: "text-violet-600 dark:text-violet-400",
};

function Stat({
  icon: Icon,
  value,
  label,
  tone,
  accent,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  tone: Tone;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[88px] flex-1 flex-col gap-0.5 px-4 py-3",
        accent && "border-l-4 border-l-primary",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn("size-3.5", TONE_TEXT[tone])} />
        <span className="text-xl font-bold leading-none text-foreground">
          {value}
        </span>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
