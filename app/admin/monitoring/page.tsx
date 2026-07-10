import { redirect } from "next/navigation";
import { requireAdminAuth } from "@/lib/auth-check";
import { getHealthReport, getRecentSnapshots } from "@/lib/health/checks";
import { getAllSettings, SETTING_KEYS } from "@/lib/app-settings";
import { OverallBanner } from "@/components/admin/monitoring/overall-banner";
import { HealthHistory } from "@/components/admin/monitoring/health-history";
import { DependencyGrid } from "@/components/admin/monitoring/dependency-grid";
import { RuntimePanel } from "@/components/admin/monitoring/runtime-panel";
import { FlagsPanel, type FlagRow } from "@/components/admin/monitoring/flags-panel";

export const dynamic = "force-dynamic";

// Crons connus (source : vercel.json). Statique et documenté — on n'a pas
// d'API Vercel pour interroger l'état d'exécution ; on liste le planning.
const CRONS: { path: string; label: string }[] = [
  { path: "/api/inbox/sync", label: "Synchro inbox IMAP" },
  { path: "/api/documents/cron/purge", label: "Purge dossiers (RGPD)" },
  { path: "/api/admin/pdf/cron/purge-drafts", label: "Purge brouillons PDF" },
  { path: "/api/chomage-ia/ingestion/cron", label: "Veille / ingestion IA" },
  { path: "/api/chomage-ia/sources/cron-obsolescence", label: "Obsolescence sources IA" },
  { path: "/api/cron/kbo-refresh", label: "Rafraîchissement KBO" },
];

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
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-xs font-semibold">Tâches planifiées</h2>
          {CRONS.map((c, i) => (
            <div key={c.path} className={i > 0 ? "border-t py-1.5" : "py-1.5"}>
              <p className="text-[12px] font-medium">{c.label}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{c.path}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
