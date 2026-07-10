import { getTopLists } from "@/lib/admin/dashboard-stats";
import type { Period } from "@/lib/admin/dashboard-stats-helpers";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("fr-BE");

function RankedList({
  title,
  rows,
  mono = false,
  badge,
  accent = false,
  emptyLabel,
}: {
  title: string;
  rows: { label: string; count: number }[];
  mono?: boolean;
  badge?: string;
  accent?: boolean;
  emptyLabel: string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className={cn("rounded-xl border bg-card p-4", accent && "border-primary/40")}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold">{title}</h2>
        {badge ? (
          <span className="rounded-full bg-primary/10 px-1.5 py-px text-[11px] text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-muted-foreground">{emptyLabel}</p>
      ) : (
        rows.map((row, i) => (
          <div key={row.label} className={cn(i > 0 && "mt-1.5")}>
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span
                className={cn(
                  "min-w-0 truncate text-muted-foreground",
                  mono && "font-mono text-[11px]",
                )}
              >
                {row.label}
              </span>
              <span className="font-medium tabular-nums">{nf.format(row.count)}</span>
            </div>
            <div className="mt-0.5 h-[3px] rounded-full bg-muted">
              <div
                className="h-[3px] rounded-full bg-primary"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export async function TopLists({ period }: { period: Period }) {
  const t = await getTopLists(period);
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <RankedList
        title="Pages les plus vues"
        rows={t.pages.map((p) => ({ label: `/${p.slug}`.replace("//", "/"), count: p.count }))}
        mono
        emptyLabel="Aucune vue sur la période"
      />
      <RankedList
        title="Dossiers démarrés"
        rows={t.bundles.map((b) => ({ label: b.name, count: b.count }))}
        emptyLabel="Aucun dossier démarré"
      />
      <RankedList
        title="Recherches sans résultat"
        rows={t.noResult.map((n) => ({ label: n.query, count: n.count }))}
        accent
        badge="à créer"
        emptyLabel="Aucune recherche orpheline 🎉"
      />
    </section>
  );
}
