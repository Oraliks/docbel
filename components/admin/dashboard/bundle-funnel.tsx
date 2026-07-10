import { getBundleFunnel } from "@/lib/admin/dashboard-stats";
import { stepConversions, type Period } from "@/lib/admin/dashboard-stats-helpers";

const nf = new Intl.NumberFormat("fr-BE");

export async function BundleFunnel({ period }: { period: Period }) {
  const f = await getBundleFunnel(period);
  const stages = [
    { label: "Recherches", count: f.searches },
    { label: "Dossiers ouverts", count: f.opened },
    { label: "Runs créés", count: f.created },
    { label: "Complétés", count: f.completed },
  ];
  const conversions = stepConversions(stages.map((s) => s.count));
  const max = Math.max(...stages.map((s) => s.count), 1);
  const empty = stages.every((s) => s.count === 0);

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-2.5 text-xs font-semibold">Funnel dossiers</h2>
      {empty ? (
        <p className="py-6 text-center text-[11px] text-muted-foreground">
          Aucun événement sur la période — vérifier le feature flag « analytics ».
        </p>
      ) : (
        <div className="text-[11.5px]">
          {stages.map((stage, i) => (
            <div key={stage.label}>
              {i > 0 ? (
                <p className="my-1 text-[11px] tabular-nums text-muted-foreground">
                  ↓ {conversions[i - 1] === null ? "—" : `${conversions[i - 1]} %`}
                </p>
              ) : null}
              <div className="mb-0.5 flex items-center justify-between">
                <span className="text-muted-foreground">{stage.label}</span>
                <span className="font-medium tabular-nums">{nf.format(stage.count)}</span>
              </div>
              <div
                className="h-2 rounded-sm bg-primary"
                style={{ width: `${Math.max((stage.count / max) * 100, 2)}%` }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
