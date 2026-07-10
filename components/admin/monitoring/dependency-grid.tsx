import { cn } from "@/lib/utils";
import type { DependencyHealth } from "@/lib/health/types";

function Dot({ configured, kind }: { configured: boolean; kind: DependencyHealth["kind"] }) {
  // critique non configuré = rouge ; optionnel non configuré = gris (neutre, pas une erreur).
  const cls = configured
    ? "bg-emerald-500"
    : kind === "critical"
      ? "bg-rose-500"
      : "bg-muted-foreground/40";
  return <span className={cn("size-2 shrink-0 rounded-full", cls)} />;
}

export function DependencyGrid({ dependencies }: { dependencies: DependencyHealth[] }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-xs font-semibold">Dépendances &amp; intégrations</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {dependencies.map((d) => (
          <div
            key={d.key}
            className="flex items-start gap-2.5 rounded-lg border bg-background/40 px-3 py-2"
          >
            <span className="mt-1.5">
              <Dot configured={d.configured} kind={d.kind} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium">{d.label}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">{d.detail}</p>
            </div>
            <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
              {d.configured ? "configuré" : "inactif"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
