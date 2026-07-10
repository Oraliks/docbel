import { Database, Inbox, Users } from "lucide-react";
import { getStatusStrip } from "@/lib/admin/dashboard-stats";
import { computeDelta } from "@/lib/admin/dashboard-stats-helpers";
import { cn } from "@/lib/utils";
import { ApiHealthCard } from "./api-health-card";

const nf = new Intl.NumberFormat("fr-BE");

function StatusCard({
  label,
  value,
  valueClassName,
  sub,
  subMono = false,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  sub: string;
  subMono?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            iconClassName,
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className={cn("mt-1 text-xl font-medium tabular-nums", valueClassName)}>{value}</p>
      <p className={cn("text-[11px] text-muted-foreground", subMono && "font-mono")}>{sub}</p>
    </div>
  );
}

export async function StatusStrip() {
  const s = await getStatusStrip();
  const trafficDelta = computeDelta(s.traffic24h, s.trafficPrev24h);

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <ApiHealthCard />
      <StatusCard
        label="Base de données"
        value={s.db.ok ? "Prêt" : "Indispo"}
        valueClassName={s.db.ok ? undefined : "text-rose-600 dark:text-rose-400"}
        sub={s.db.latencyMs !== null ? `Neon · ${s.db.latencyMs} ms` : "Neon · —"}
        subMono
        icon={Database}
        iconClassName="bg-teal-500/10 text-teal-600 dark:text-teal-400"
      />
      <StatusCard
        label="À traiter"
        value={nf.format(s.ops.total)}
        valueClassName={s.ops.total > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
        sub={`${s.ops.activeQueues} file${s.ops.activeQueues > 1 ? "s" : ""} active${s.ops.activeQueues > 1 ? "s" : ""}`}
        icon={Inbox}
        iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
      />
      <StatusCard
        label="Trafic 24 h"
        value={nf.format(s.traffic24h)}
        sub={
          trafficDelta === null
            ? "vs 24 h précédentes : —"
            : `${trafficDelta >= 0 ? "+" : ""}${trafficDelta} % vs 24 h précédentes`
        }
        icon={Users}
        iconClassName="bg-primary/10 text-primary"
      />
    </section>
  );
}
