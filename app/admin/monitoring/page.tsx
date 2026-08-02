import { redirect } from "next/navigation";
import { requireAdminAuth } from "@/lib/auth-check";
import { getHealthReport, getRecentSnapshots } from "@/lib/health/checks";
import { getAllSettings, SETTING_KEYS } from "@/lib/app-settings";
import { OverallBanner } from "@/components/admin/monitoring/overall-banner";
import { HealthHistory } from "@/components/admin/monitoring/health-history";
import { DependencyGrid } from "@/components/admin/monitoring/dependency-grid";
import { RuntimePanel } from "@/components/admin/monitoring/runtime-panel";
import { FlagsPanel, type FlagRow } from "@/components/admin/monitoring/flags-panel";
import { CRONS_PLANIFIES } from "@/lib/health/crons";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) redirect("/login");

  const [report, settings, snapshots] = await Promise.all([
    getHealthReport(),
    getAllSettings(),
    getRecentSnapshots(),
  ]);

  // Flags booléens de AppSetting (on ne montre que les toggles "true"/"false").
  const boolKeys = Object.values(SETTING_KEYS).filter(
    (k) => settings[k] === "true" || settings[k] === "false",
  );
  const flags: FlagRow[] = boolKeys.map((k) => ({ key: k, enabled: settings[k] === "true" }));

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monitoring</h1>
        <p className="mt-2 text-muted-foreground">
          Santé des systèmes, dépendances et configuration runtime.
        </p>
      </div>

      <OverallBanner
        status={report.status}
        dbLatencyMs={report.db.latencyMs}
        checkedAt={report.checkedAt}
      />

      <HealthHistory points={snapshots} />

      <DependencyGrid dependencies={report.dependencies} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RuntimePanel runtime={report.runtime} />
        <FlagsPanel flags={flags} />
        {/* Dérivé de `vercel.json` : ajouter un cron le fait apparaître ici le
            jour même. Vercel n'expose pas d'état d'exécution — c'est le
            PLANNING qu'on montre, pas le dernier résultat. */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-xs font-semibold">
            Tâches planifiées ({CRONS_PLANIFIES.length})
          </h2>
          {CRONS_PLANIFIES.map((c, i) => (
            <div key={c.path} className={i > 0 ? "border-t py-1.5" : "py-1.5"}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12px] font-medium">{c.label}</p>
                <p className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {c.schedule}
                </p>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">{c.path}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
