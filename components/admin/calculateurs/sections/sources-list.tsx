import { ExternalLink } from "lucide-react";
import type { MethodologySource } from "@/lib/calculators/_methodology";

interface MethodologySourcesListProps {
  sources: MethodologySource[];
}

/**
 * Liste complète des sources officielles (onglet Sources).
 * Si vide : affiche un placeholder discret.
 */
export function MethodologySourcesList({ sources }: MethodologySourcesListProps) {
  if (!sources || sources.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-[12.5px] text-muted-foreground">
        Aucune source officielle documentée pour ce calculateur.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Sources officielles ({sources.length})
      </h2>
      <ul className="flex flex-col gap-1">
        {sources.map((s, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/60 px-3 py-2"
          >
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center gap-1.5 text-[12.5px] font-medium text-foreground hover:text-primary hover:underline"
            >
              <span className="truncate">{s.name}</span>
              <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
            </a>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
              Officiel
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
