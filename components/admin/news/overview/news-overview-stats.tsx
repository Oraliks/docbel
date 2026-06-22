"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { NewsCounts } from "./types";

interface NewsOverviewStatsProps {
  counts: NewsCounts;
}

/**
 * 4 cards stats compactes en haut de la page admin /admin/news.
 *
 * Pattern aligné sur `components/admin/calculateurs/overview/overview-stats.tsx`
 * (bordure gauche colorée + chiffre + label). Tonalités choisies pour matcher
 * la sémantique des statuts de news :
 *   - Total      : slate (neutre)
 *   - Publiés    : emerald (état "vivant" / public)
 *   - Brouillons : amber  (en cours / draft)
 *   - Planifiés  : violet (futur / différé)
 *
 * Présentationnel — purement props-driven.
 */
export function NewsOverviewStats({ counts }: NewsOverviewStatsProps) {
  const t = useTranslations("admin.news");
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard value={counts.total} label={t("kpiTotal")} tone="slate" />
      <StatCard
        symbol="✓"
        value={counts.published}
        label={t("kpiPublished")}
        tone="emerald"
      />
      <StatCard
        symbol="✎"
        value={counts.draft}
        label={t("kpiDrafts")}
        tone="amber"
      />
      <StatCard
        symbol="⏱"
        value={counts.scheduled}
        label={t("kpiScheduled")}
        tone="violet"
      />
    </div>
  );
}

type Tone = "emerald" | "amber" | "violet" | "slate";

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
  violet: {
    border: "border-l-violet-500",
    symbol: "text-violet-600 dark:text-violet-400",
    value: "text-violet-700 dark:text-violet-300",
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
