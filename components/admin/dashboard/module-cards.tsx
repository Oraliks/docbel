import Link from "next/link";
import { Briefcase, Calendar, GraduationCap, Sparkles } from "lucide-react";
import { getModuleStats } from "@/lib/admin/dashboard-stats";
import type { Period } from "@/lib/admin/dashboard-stats-helpers";

const nf = new Intl.NumberFormat("fr-BE");

function ModuleCard({
  href,
  icon: Icon,
  title,
  stats,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  stats: { value: number; label: string }[];
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/40"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </span>
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <div className="flex gap-5">
        {stats.map((s) => (
          <span key={s.label}>
            <span className="block text-base font-medium leading-tight tabular-nums">
              {nf.format(s.value)}
            </span>
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
          </span>
        ))}
      </div>
    </Link>
  );
}

export async function ModuleCards({ period }: { period: Period }) {
  const m = await getModuleStats(period);
  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <ModuleCard
        href="/admin/booking"
        icon={Calendar}
        title="RDV"
        stats={[
          { value: m.rdv.upcoming7d, label: "à venir 7 j" },
          { value: m.rdv.activeTenants, label: "tenants" },
        ]}
      />
      <ModuleCard
        href="/admin/formations"
        icon={GraduationCap}
        title="Formations"
        stats={[
          { value: m.formations.enrollments, label: "inscriptions" },
          { value: m.formations.upcomingSessions, label: "sessions" },
        ]}
      />
      <ModuleCard
        href="/admin/chomage/ia/chat"
        icon={Sparkles}
        title="Assistant IA"
        stats={[
          { value: m.ia.sessions, label: "sessions" },
          { value: m.ia.openGaps, label: "gaps" },
        ]}
      />
      <ModuleCard
        href="/admin/employeurs/stats"
        icon={Briefcase}
        title="Employeur"
        stats={[
          { value: m.employeur.simulations, label: "simulations" },
          { value: m.employeur.drafts, label: "brouillons" },
        ]}
      />
    </section>
  );
}
