import { FileText, FolderCheck, Download } from "lucide-react";
import {
  interactionConversions,
  type EntityMetric,
  type EntityUnit,
  type InteractionPhase,
  type InteractionStage,
} from "@/lib/admin/parcours-funnel-core";

const nf = new Intl.NumberFormat("fr-BE");

const PHASE: Record<InteractionPhase, { bar: string; dot: string; label: string }> = {
  orientation: { bar: "bg-primary", dot: "bg-primary", label: "Orientation" },
  dossier: { bar: "bg-indigo-500", dot: "bg-indigo-500", label: "Dossier" },
};

/** Icône + libellé d'unité par métrique d'entité (rend l'unité explicite). */
const UNIT: Record<
  EntityUnit,
  { icon: typeof FileText; unitLabel: string; tint: string }
> = {
  pdf: { icon: FileText, unitLabel: "PDF", tint: "text-primary" },
  dossiers: { icon: FolderCheck, unitLabel: "dossiers", tint: "text-indigo-500" },
  retraits: { icon: Download, unitLabel: "retraits", tint: "text-emerald-500" },
};

/**
 * Funnel « Parcours » (Lot 5 — de-conflated). Deux blocs DISTINCTS :
 *   1. l'entonnoir d'INTERACTION (unité « événement », conversions internes) ;
 *   2. les métriques d'ENTITÉ, chacune avec SON unité — plus jamais fusionnées
 *      dans une seule colonne « Documents obtenus » trompeuse.
 * Présentational (les comptes viennent de `getParcoursFunnel`). UI admin
 * shadcn blanc + violet (primary), pas de glass.
 */
export function ParcoursFunnel({
  interactionStages,
  entityMetrics,
}: {
  interactionStages: InteractionStage[];
  entityMetrics: EntityMetric[];
}) {
  const conversions = interactionConversions(interactionStages);
  const max = Math.max(...interactionStages.map((s) => s.count), 1);
  const empty = interactionStages.every((s) => s.count === 0);
  const first = interactionStages[0]?.count ?? 0;
  const last = interactionStages[interactionStages.length - 1]?.count ?? 0;
  const overall = first > 0 ? Math.round((last / first) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Bloc 1 : entonnoir d'interaction ────────────────────────────── */}
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Entonnoir des interactions</h2>
            <p className="text-xs text-muted-foreground">
              De la recherche au démarrage d&apos;un dossier (unité : événements).
            </p>
          </div>
          {overall !== null && !empty && (
            <div className="text-right">
              <div className="font-mono text-xl font-semibold tabular-nums text-primary">
                {overall} %
              </div>
              <div className="text-[11px] text-muted-foreground">
                recherche → dossier démarré
              </div>
            </div>
          )}
        </div>

        {/* Légende des phases */}
        <div className="mb-4 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          {(Object.keys(PHASE) as InteractionPhase[]).map((p) => (
            <span key={p} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${PHASE[p].dot}`} />
              {PHASE[p].label}
            </span>
          ))}
        </div>

        {empty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucun événement sur la période. Les données se remplissent au fil de
            l&apos;usage réel de /mon-dossier.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {interactionStages.map((stage, i) => (
              <div key={stage.key}>
                {i > 0 && (
                  <div className="py-1 pl-0.5 text-[11px] tabular-nums text-muted-foreground">
                    ↓{" "}
                    {conversions[i - 1] === null
                      ? "—"
                      : `${conversions[i - 1]} %`}
                  </div>
                )}
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-sm">{stage.label}</span>
                  <span className="font-mono text-sm font-medium tabular-nums">
                    {nf.format(stage.count)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-sm bg-muted">
                  <div
                    className={`h-full rounded-sm ${PHASE[stage.phase].bar}`}
                    style={{
                      width: `${Math.max((stage.count / max) * 100, 1.5)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Bloc 2 : métriques d'entité (unités DISTINCTES, non convertibles) ── */}
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Résultats produits</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Trois compteurs d&apos;unités différentes — ils ne se comparent pas
          entre eux ni aux étapes ci-dessus.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {entityMetrics.map((metric) => {
            const u = UNIT[metric.unit];
            const Icon = u.icon;
            return (
              <div
                key={metric.key}
                className="flex flex-col gap-1 rounded-lg border bg-background p-4"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className={`size-3.5 ${u.tint}`} />
                  <span>{metric.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-semibold tabular-nums">
                    {nf.format(metric.count)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {u.unitLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
