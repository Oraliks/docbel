import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { PartnerCounts } from "./types";

interface PartnerOverviewStatsProps {
  counts: PartnerCounts;
}

/**
 * 4 cards stats compactes en haut de la page admin /admin/partenaires.
 *
 * Pattern aligné sur `components/admin/calculateurs/overview/overview-stats.tsx`
 * (bordure gauche colorée + chiffre + label). Tonalités :
 *   - Total    : slate   (neutre — toutes les organisations)
 *   - Actives  : emerald (au moins un domaine actif)
 *   - En attente : amber (au moins un user pending / non vérifié)
 *   - Inactives : red   (toutes les organisations sans domaine actif)
 */
export function PartnerOverviewStats({ counts }: PartnerOverviewStatsProps) {
  const t = useTranslations("admin.partenaires");
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard value={counts.total} label={t("statTotal")} tone="slate" />
      <StatCard
        symbol="✓"
        value={counts.active}
        label={t("statActive")}
        tone="emerald"
      />
      <StatCard
        symbol="⏳"
        value={counts.pending}
        label={t("statPending")}
        tone="amber"
      />
      <StatCard
        symbol="∅"
        value={counts.inactive}
        label={t("statInactive")}
        tone="red"
      />
    </div>
  );
}

type Tone = "emerald" | "amber" | "red" | "slate";

const TONE_STYLES: Record<
  Tone,
  { border: string; symbol: string; value: string }
> = {
  emerald: {
    border: "border-l-emerald-500",
    symbol: "text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  amber: {
    border: "border-l-amber-500",
    symbol: "text-amber-600 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-300",
  },
  red: {
    border: "border-l-red-500",
    symbol: "text-red-600 dark:text-red-400",
    value: "text-red-700 dark:text-red-300",
  },
  slate: {
    border: "border-l-slate-400 dark:border-l-slate-500",
    symbol: "text-slate-500 dark:text-slate-400",
    value: "text-foreground",
  },
};

interface StatCardProps {
  symbol?: string;
  value: number;
  label: string;
  tone: Tone;
}

function StatCard({ symbol, value, label, tone }: StatCardProps) {
  const styles = TONE_STYLES[tone];
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3 border-l-4",
        styles.border,
      )}
    >
      <div className="flex items-baseline gap-2">
        {symbol ? (
          <span className={cn("text-lg font-bold leading-none", styles.symbol)}>
            {symbol}
          </span>
        ) : null}
        <span className={cn("text-2xl font-bold leading-none", styles.value)}>
          {value}
        </span>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
