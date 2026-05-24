"use client";

import { Card } from "@/components/ui/card";
import { CheckCircle2, CircleOff, LayoutGrid, Star } from "lucide-react";
import type { Section } from "./types";

interface Props {
  sections: Section[];
}

/**
 * 4 cards en haut de la page admin /outils :
 * Total, Actifs, Inactifs, Populaires.
 * Calcule les agrégats à partir des sections reçues (memoless — pas besoin
 * de useMemo : un map+reduce léger sur <30 outils).
 */
export function StatsCards({ sections }: Props) {
  const tools = sections.flatMap((s) => s.tools);
  const total = tools.length;
  const actifs = tools.filter((t) => t.active).length;
  const inactifs = total - actifs;
  const populaires = tools.filter((t) => t.popular).length;

  const pct = (n: number) =>
    total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Total"
        value={total}
        hint="Toutes catégories"
        Icon={LayoutGrid}
        accent="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
      />
      <StatCard
        label="Actifs"
        value={actifs}
        hint={`${pct(actifs)} du total`}
        Icon={CheckCircle2}
        accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
      />
      <StatCard
        label="Inactifs"
        value={inactifs}
        hint={`${pct(inactifs)} du total`}
        Icon={CircleOff}
        accent="bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300"
      />
      <StatCard
        label="Populaires"
        value={populaires}
        hint="Marqués populaires"
        Icon={Star}
        accent="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  Icon,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="flex flex-row items-center gap-3 p-4">
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent}`}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </Card>
  );
}
