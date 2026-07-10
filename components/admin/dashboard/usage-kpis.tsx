import { getUsageKpis } from "@/lib/admin/dashboard-stats";
import { PERIOD_DAYS, type Period } from "@/lib/admin/dashboard-stats-helpers";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("fr-BE");

function Sparkline({ series }: { series: number[] }) {
  if (series.length < 2) return null;
  const max = Math.max(...series, 1);
  const points = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * 100;
      const y = 13 - (v / max) * 11;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width="100%"
      height="14"
      viewBox="0 0 100 14"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-1"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function DeltaBadge({ delta, suffix = " %" }: { delta: number | null; suffix?: string }) {
  if (delta === null) return <span className="text-[11px] text-muted-foreground">—</span>;
  const positive = delta >= 0;
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[11px] font-medium tabular-nums",
        positive
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
      )}
    >
      {positive ? "+" : ""}
      {delta}
      {suffix}
    </span>
  );
}

function KpiCell({
  label,
  value,
  delta,
  series,
  suffix,
}: {
  label: string;
  value: string;
  delta: number | null;
  series?: number[];
  suffix?: string;
}) {
  return (
    <div className="bg-card px-4 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="text-lg font-medium tabular-nums">{value}</span>
        <DeltaBadge delta={delta} suffix={suffix} />
      </div>
      {series ? <Sparkline series={series} /> : null}
    </div>
  );
}

export async function UsageKpis({ period }: { period: Period }) {
  const k = await getUsageKpis(period);
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="px-4 pb-2 pt-3">
        <h2 className="text-xs font-semibold">Usage — {PERIOD_DAYS[period]} jours</h2>
      </div>
      <div className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-3">
        <KpiCell
          label="Visiteurs"
          value={nf.format(k.visitors.value)}
          delta={k.visitors.delta}
          series={k.visitors.series}
        />
        <KpiCell
          label="Dossiers démarrés"
          value={nf.format(k.runsStarted.value)}
          delta={k.runsStarted.delta}
          series={k.runsStarted.series}
        />
        <KpiCell
          label="Complétion"
          value={`${k.completion.value} %`}
          delta={k.completion.deltaPts}
          suffix=" pts"
        />
        <KpiCell
          label="PDF générés"
          value={nf.format(k.pdfGenerated.value)}
          delta={k.pdfGenerated.delta}
          series={k.pdfGenerated.series}
        />
        <KpiCell
          label="RDV pris"
          value={nf.format(k.bookings.value)}
          delta={k.bookings.delta}
          series={k.bookings.series}
        />
        <KpiCell
          label="Nouveaux comptes"
          value={nf.format(k.signups.value)}
          delta={k.signups.delta}
          series={k.signups.series}
        />
      </div>
    </section>
  );
}
