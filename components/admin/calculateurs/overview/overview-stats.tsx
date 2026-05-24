import { cn } from "@/lib/utils";

interface OverviewStatsProps {
  counts: {
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

/**
 * 4 cards stats compactes en haut de la page d'overview des méthodologies.
 *
 * Chaque card affiche un gros chiffre (le compte) et un label court, avec
 * une bordure colorée fine côté gauche indiquant la catégorie de fiabilité.
 * Présentationnel — purement props-driven, pas d'état interne.
 */
export function OverviewStats({ counts }: OverviewStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        symbol="✓"
        value={counts.high}
        label="Fiables"
        tone="emerald"
      />
      <StatCard
        symbol="∼"
        value={counts.medium}
        label="Approximatifs"
        tone="amber"
      />
      <StatCard symbol="!" value={counts.low} label="À vérifier" tone="red" />
      <StatCard value={counts.total} label="Total" tone="slate" />
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
        <span
          className={cn("text-2xl font-bold leading-none", styles.value)}
        >
          {value}
        </span>
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
