import Link from "next/link";
import { GitBranch, FileText, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { parsePeriod, type Period } from "@/lib/admin/dashboard-stats-helpers";
import { getParcoursFunnel } from "@/lib/admin/parcours-funnel";
import { ParcoursFunnel } from "@/components/admin/parcours/parcours-funnel";

export const dynamic = "force-dynamic";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 j" },
  { value: "30d", label: "30 j" },
  { value: "90d", label: "90 j" },
];

/**
 * Statistiques du parcours (Lot 3) — un entonnoir UNIQUE réunissant orientation
 * (arbres), dossiers (runs) et documents, avec accès aux deux dashboards détaillés.
 * Auth admin garantie par app/admin/layout.tsx.
 */
export default async function ParcoursAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: raw } = await searchParams;
  const period = parsePeriod(raw);
  const { interactionStages, entityMetrics } = await getParcoursFunnel(period);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* En-tête + sélecteur de période (liens, préserve le chemin) */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GitBranch className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Statistiques du parcours
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Orientation, dossiers et documents réunis en un seul entonnoir.
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border bg-card p-0.5 text-xs">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/admin/parcours/analytics?period=${p.value}`}
              scroll={false}
              className={cn(
                "rounded-md px-2.5 py-1 tabular-nums transition-colors",
                period === p.value
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <ParcoursFunnel
        interactionStages={interactionStages}
        entityMetrics={entityMetrics}
      />

      {/* Accès aux deux dashboards détaillés (drill-down). */}
      <div className="grid gap-3 sm:grid-cols-2">
        <DrillCard
          href="/admin/decision-trees/analytics"
          icon={<GitBranch className="size-4 text-primary" />}
          title="Détail orientation"
          desc="Demande par dossier, recherches sans résultat, activité Decision Builder."
        />
        <DrillCard
          href="/admin/pdf/analytics"
          icon={<FileText className="size-4 text-primary" />}
          title="Détail formulaires PDF"
          desc="Taux de succès, volumes par formulaire, répartition par langue."
        />
      </div>
    </div>
  );
}

function DrillCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5">{icon}</span>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
