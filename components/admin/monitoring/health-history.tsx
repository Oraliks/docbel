import type { SnapshotPoint } from "@/lib/health/checks";

export function HealthHistory({ points }: { points: SnapshotPoint[] }) {
  if (points.length < 2) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-xs font-semibold">Historique — latence DB</h2>
        <p className="py-3 text-center text-[11px] text-muted-foreground">
          Pas encore de données (le cron alimente l&apos;historique).
        </p>
      </section>
    );
  }
  const max = Math.max(...points.map((p) => p.dbLatencyMs ?? 0), 1);
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 24 - ((p.dbLatencyMs ?? 0) / max) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const incidents = points.filter((p) => p.status === "down").length;
  const lastLatency = points[points.length - 1]?.dbLatencyMs ?? null;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold">Historique — latence DB</h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {points.length} pts · {incidents} incident{incidents > 1 ? "s" : ""}
          {lastLatency !== null ? ` · ${lastLatency} ms` : ""}
        </span>
      </div>
      <svg width="100%" height="26" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
        <polyline
          points={coords}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </section>
  );
}
