import { cn } from "@/lib/utils";

export interface FlagRow {
  key: string;
  enabled: boolean;
}

export function FlagsPanel({ flags }: { flags: FlagRow[] }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-2 text-xs font-semibold">Feature flags</h2>
      {flags.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-muted-foreground">Aucun flag</p>
      ) : (
        flags.map((f, i) => (
          <div
            key={f.key}
            className={cn(
              "flex items-center justify-between gap-2 py-1.5 text-[12px]",
              i > 0 && "border-t",
            )}
          >
            <span className="truncate font-mono text-[11px] text-muted-foreground">{f.key}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-medium",
                f.enabled
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {f.enabled ? "on" : "off"}
            </span>
          </div>
        ))
      )}
    </section>
  );
}
