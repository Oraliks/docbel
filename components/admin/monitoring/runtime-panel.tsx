import type { RuntimeInfo } from "@/lib/health/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t py-1.5 text-[12px] first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-[11px]">{value}</span>
    </div>
  );
}

export function RuntimePanel({ runtime }: { runtime: RuntimeInfo }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-2 text-xs font-semibold">Runtime</h2>
      <Row label="Environnement" value={runtime.env} />
      <Row label="Vercel env" value={runtime.vercelEnv ?? "hors Vercel"} />
      <Row label="Région" value={runtime.region ?? "—"} />
      <Row label="Build" value={runtime.buildId ?? "dev"} />
      <Row label="Node" value={runtime.nodeVersion} />
    </section>
  );
}
