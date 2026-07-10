import { CircleCheck, TriangleAlert, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/lib/health/types";

const MAP: Record<
  HealthStatus,
  { label: string; sub: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  ok: {
    label: "Tous les systèmes opérationnels",
    sub: "Aucun incident détecté",
    icon: CircleCheck,
    cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  degraded: {
    label: "Service dégradé",
    sub: "Latence base de données élevée",
    icon: TriangleAlert,
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  down: {
    label: "Incident en cours",
    sub: "Base de données injoignable",
    icon: CircleX,
    cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
  },
};

export function OverallBanner({
  status,
  dbLatencyMs,
  checkedAt,
}: {
  status: HealthStatus;
  dbLatencyMs: number | null;
  checkedAt: string;
}) {
  const m = MAP[status];
  const Icon = m.icon;
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3", m.cls)}>
      <Icon className="size-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{m.label}</p>
        <p className="text-[12px] opacity-80">{m.sub}</p>
      </div>
      <div className="text-right font-mono text-[11px] opacity-80">
        <div>{dbLatencyMs !== null ? `DB ${dbLatencyMs} ms` : "DB —"}</div>
        <div>{new Date(checkedAt).toLocaleTimeString("fr-BE")}</div>
      </div>
    </div>
  );
}
